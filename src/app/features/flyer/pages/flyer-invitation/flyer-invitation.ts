import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  drawInvite,
  downloadCanvasPng,
  type FlyerBadge,
  type InviteValues,
} from '../../flyer-invitation.util';
import { TransitService, type TransitLine, type TransitStop } from '../../transit.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import {
  formatDateFr,
  formatFlyerDateFr,
  formatFlyerDatePartsFr,
  formatFlyerTimeFr,
  monthYearLabel,
} from '../../../../shared/util/date.util';
// The flyer is derived from a sortie, so it reads the outreach feature's service
// and models. A deliberate, read-only cross-feature dependency (flyer → outreach).
import { OutreachService } from '../../../outreach/outreach.service';
import {
  EMPTY_OUTREACH_FILTER,
  STATUS_LABELS,
  STATUS_TONES,
  type Outreach,
  type OutreachStatus,
} from '../../../outreach/outreach.models';

/** Zoom bounds for the photo inside the circle (1 = fills the disc when centred). */
const MIN_SCALE = 0.3;
const MAX_SCALE = 4;

/** Badge box-size bounds and default, in template px. */
const MIN_BADGE = 60;
const MAX_BADGE = 360;
const DEFAULT_BADGE = 96;
/** New badges are laid out two per row; gap between them, template px. */
const BADGE_GAP = 18;
/** Centre of the badge grid's first column, template px. Kept clear of the
 *  central photo circle (its right edge is ~x=810) so logos don't cover it.
 *  The Y origin sits on the template's vertical centre so new badges land in
 *  the middle of the image. */
const BADGE_ORIGIN_X = 890;
const BADGE_ORIGIN_Y = 540;

/** How many recent sorties to load into the picker. */
const OUTREACH_PAGE_SIZE = 100;

/** One calendar month of sorties in the picker, mirroring the sorties list. */
interface OutreachMonthGroup {
  key: string;
  label: string;
  rows: Outreach[];
}

/** `YYYY-MM-DD` for a date in local time (avoids `toISOString()`'s UTC shift). */
function localDateKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

type DragMode = 'none' | 'photo' | 'badge';

/**
 * Standalone invitation-flyer generator (`/flyers/invitation`): a photo framed
 * in the central circle, the place name under the logo, and public-transport
 * badges (searched via the backend Transitland proxy) freely placed and resized.
 * Everything renders on one canvas and exports as a PNG.
 */
@Component({
  selector: 'app-flyer-invitation',
  imports: [RouterLink],
  templateUrl: './flyer-invitation.html',
  styleUrl: './flyer-invitation.scss',
})
export class FlyerInvitation {
  private readonly transit = inject(TransitService);
  private readonly outreachService = inject(OutreachService);
  private readonly hostRef: ElementRef<HTMLElement> = inject(ElementRef);

  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly renderError = signal<string | null>(null);

  // ---- Outreach picker (chosen before the flyer is edited) ----
  /** The chosen sortie, or `null` while the picker is shown. */
  protected readonly outreach = signal<Outreach | null>(null);
  protected readonly outreachRows = signal<Outreach[]>([]);
  protected readonly listLoading = signal(true);
  protected readonly listError = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly fmtDate = formatDateFr;

  /** Client-side filter over the loaded sorties, by name or city. */
  protected readonly filteredOutreaches = computed<Outreach[]>(() => {
    const q = this.query().trim().toLocaleLowerCase('fr-FR');
    if (!q) {
      return this.outreachRows();
    }
    return this.outreachRows().filter(
      (o) =>
        o.name.toLocaleLowerCase('fr-FR').includes(q) ||
        o.cityName.toLocaleLowerCase('fr-FR').includes(q),
    );
  });

  /**
   * The filtered sorties grouped by calendar month, newest month first (rows are
   * loaded date-descending). Mirrors the sorties list's month sections.
   */
  protected readonly outreachGroups = computed<OutreachMonthGroup[]>(() => {
    const byKey = new Map<string, OutreachMonthGroup>();
    for (const o of this.filteredOutreaches()) {
      const key = o.date ? o.date.slice(0, 7) : '';
      let group = byKey.get(key);
      if (!group) {
        group = { key, label: o.date ? monthYearLabel(o.date) : 'SANS DATE', rows: [] };
        byKey.set(key, group);
      }
      group.rows.push(o);
    }
    return [...byKey.values()];
  });

  /**
   * The sortie to put in focus: the nearest upcoming one (still to come, by
   * date), or failing that the most recent. Its uuid drives the highlight and the
   * auto-scroll in the picker.
   */
  protected readonly nextOutreach = computed<Outreach | null>(() => {
    const today = localDateKey(new Date());
    const dated = this.outreachRows().filter((o) => o.date);
    const upcoming = dated
      .filter((o) => (o.date as string) >= today)
      .sort((a, b) => (a.date as string).localeCompare(b.date as string));
    if (upcoming.length) {
      return upcoming[0];
    }
    // No future sortie: fall back to the most recent past one (rows are date-desc).
    return dated[0] ?? this.outreachRows()[0] ?? null;
  });

  protected isNext(outreach: Outreach): boolean {
    return this.nextOutreach()?.uuid === outreach.uuid;
  }

  /** Date/time headline derived from the chosen sortie. `dateText`/`timeText`
   *  read the banner; `dateLines` is the stacked, upper-cased canvas headline. */
  protected readonly dateText = computed(() => formatFlyerDateFr(this.outreach()?.date));
  protected readonly timeText = computed(() => formatFlyerTimeFr(this.outreach()?.startTime));
  protected readonly dateLines = computed(() => formatFlyerDatePartsFr(this.outreach()?.date));

  /** Editable values written onto the template. */
  protected readonly place = signal('');
  protected readonly photo = signal<HTMLImageElement | null>(null);
  /** Name of the chosen photo file, shown next to the picker. */
  protected readonly photoName = signal('');

  /** How the photo sits in the circle: zoom + pan (template px from centre). */
  protected readonly scale = signal(MIN_SCALE);
  protected readonly offsetX = signal(0);
  protected readonly offsetY = signal(0);

  /** Transport badges placed on the flyer, and which one is selected. */
  protected readonly badges = signal<FlyerBadge[]>([]);
  protected readonly selectedBadgeId = signal<string | null>(null);
  protected readonly selectedBadge = computed(
    () => this.badges().find((b) => b.id === this.selectedBadgeId()) ?? null,
  );

  // ---- Transport search ----
  protected readonly transitQuery = signal('');
  protected readonly stops = signal<TransitStop[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchError = signal<string | null>(null);
  protected readonly selectedStop = signal<TransitStop | null>(null);
  private searchTimer?: ReturnType<typeof setTimeout>;

  private readonly values = computed<InviteValues>(() => ({
    photo: this.photo(),
    place: this.place(),
    dateLines: this.dateLines(),
    timeText: this.timeText().toLocaleUpperCase('fr-FR'),
    scale: this.scale(),
    offsetX: this.offsetX(),
    offsetY: this.offsetY(),
    badges: this.badges(),
  }));

  /** Pointer position at the last drag step, in client px. */
  private dragMode: DragMode = 'none';
  private lastPointerX = 0;
  private lastPointerY = 0;

  /**
   * Draws are queued rather than fired in parallel: they share one canvas, so a
   * slow draw resolving late would otherwise paint over a newer one.
   */
  private renderQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.loadOutreaches();
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const values = this.values();
      const selected = this.selectedBadgeId();
      if (!canvas) {
        return;
      }
      this.renderQueue = this.renderQueue.then(() =>
        drawInvite(canvas, values, selected).then(
          () => this.renderError.set(null),
          (error: unknown) =>
            this.renderError.set(
              error instanceof Error ? error.message : "Rendu de l'invitation impossible.",
            ),
        ),
      );
    });
  }

  protected onPlace(value: string): void {
    this.place.set(value);
  }

  // ---- Outreach picker ----

  /** Load recent sorties for the picker (most recent first). */
  protected loadOutreaches(): void {
    this.listLoading.set(true);
    this.listError.set(null);
    this.outreachService
      .list(0, OUTREACH_PAGE_SIZE, EMPTY_OUTREACH_FILTER, 'date,desc')
      .subscribe({
        next: (page) => {
          this.outreachRows.set(page.items);
          this.listLoading.set(false);
          // Bring the focused (next) sortie into view once the list has rendered.
          setTimeout(() => this.scrollToNext(), 0);
        },
        error: (err: unknown) => {
          this.listError.set(messageFromError(err, 'Chargement des sorties impossible.'));
          this.listLoading.set(false);
        },
      });
  }

  protected onSearch(value: string): void {
    this.query.set(value);
  }

  /** Land the picker on the focused (next) sortie, when it's in the list. */
  private scrollToNext(): void {
    const target = this.hostRef.nativeElement.querySelector<HTMLElement>('[data-next-anchor]');
    target?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  /** Pick a sortie: its lieu pre-fills the place field; date/time derive from it. */
  protected chooseOutreach(outreach: Outreach): void {
    this.outreach.set(outreach);
    this.place.set(outreach.location || outreach.cityName);
  }

  /** Back to the picker, keeping the photo and badges already placed. */
  protected changeOutreach(): void {
    this.outreach.set(null);
    this.query.set('');
  }

  protected statusLabel(status: OutreachStatus): string {
    return STATUS_LABELS[status];
  }
  protected statusTone(status: OutreachStatus): string {
    return STATUS_TONES[status];
  }

  /** Load the chosen image file into an off-DOM `Image` for the canvas draw. */
  protected onPhoto(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      this.photo.set(image);
      this.photoName.set(file.name);
      // Start from a centred, un-zoomed placement for the new photo.
      this.scale.set(MIN_SCALE);
      this.offsetX.set(0);
      this.offsetY.set(0);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      this.renderError.set('Image illisible. Choisissez un autre fichier.');
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  protected clearPhoto(): void {
    this.photo.set(null);
    this.photoName.set('');
    this.scale.set(MIN_SCALE);
    this.offsetX.set(0);
    this.offsetY.set(0);
  }

  protected onZoom(value: string): void {
    const next = Number(value);
    this.scale.set(
      Number.isFinite(next) ? Math.min(Math.max(next, MIN_SCALE), MAX_SCALE) : MIN_SCALE,
    );
  }

  // ---- Transport search ----

  protected onTransitSearch(value: string): void {
    this.transitQuery.set(value);
    clearTimeout(this.searchTimer);
    const q = value.trim();
    if (q.length < 2) {
      this.stops.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.searchTimer = setTimeout(() => {
      this.transit.searchStops(q).subscribe({
        next: (stops) => {
          this.stops.set(stops);
          this.searchError.set(null);
          this.searching.set(false);
        },
        error: () => {
          this.searchError.set('Recherche indisponible. Réessayez.');
          this.searching.set(false);
        },
      });
    }, 350);
  }

  protected selectStop(stop: TransitStop): void {
    this.selectedStop.set(stop);
  }

  /** Load the line's official pictogram, then place it as a badge and select it. */
  protected addLine(line: TransitLine): void {
    if (!line.pictoId) {
      return;
    }
    const count = this.badges().length;
    this.transit.picto(line.pictoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
          const badge: FlyerBadge = {
            id: crypto.randomUUID(),
            label: [line.network, line.shortName].filter(Boolean).join(' ') || line.shortName,
            image,
            // Lay new badges out two per row so they don't stack exactly.
            x: BADGE_ORIGIN_X + (count % 2) * (DEFAULT_BADGE + BADGE_GAP),
            y: BADGE_ORIGIN_Y + Math.floor(count / 2) * (DEFAULT_BADGE + BADGE_GAP),
            size: DEFAULT_BADGE,
          };
          this.badges.update((list) => [...list, badge]);
          this.selectedBadgeId.set(badge.id);
          URL.revokeObjectURL(url);
        };
        image.onerror = () => URL.revokeObjectURL(url);
        image.src = url;
      },
      error: () => this.searchError.set('Logo indisponible pour cette ligne.'),
    });
  }

  protected onBadgeSize(value: string): void {
    const id = this.selectedBadgeId();
    const size = Number(value);
    if (!id || !Number.isFinite(size)) {
      return;
    }
    this.patchBadge(id, { size: Math.min(Math.max(size, MIN_BADGE), MAX_BADGE) });
  }

  protected removeSelectedBadge(): void {
    const id = this.selectedBadgeId();
    if (!id) {
      return;
    }
    this.badges.update((list) => list.filter((b) => b.id !== id));
    this.selectedBadgeId.set(null);
  }

  private patchBadge(id: string, patch: Partial<FlyerBadge>): void {
    this.badges.update((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  // ---- Canvas interactions: move the photo or a badge, resize badges ----

  /** Canvas px per client px — the preview is drawn at 1080 but shown smaller. */
  private canvasScaleFactor(canvas: HTMLCanvasElement): number {
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 ? canvas.width / rect.width : 1;
  }

  /** Topmost badge under a client-space point, or null. */
  private badgeAt(canvas: HTMLCanvasElement, clientX: number, clientY: number): FlyerBadge | null {
    const rect = canvas.getBoundingClientRect();
    const fx = rect.width > 0 ? canvas.width / rect.width : 1;
    const fy = rect.height > 0 ? canvas.height / rect.height : 1;
    const x = (clientX - rect.left) * fx;
    const y = (clientY - rect.top) * fy;
    const list = this.badges();
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      const half = b.size / 2;
      if (Math.abs(x - b.x) <= half && Math.abs(y - b.y) <= half) {
        return b;
      }
    }
    return null;
  }

  protected onPointerDown(event: PointerEvent): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }
    const hit = this.badgeAt(canvas, event.clientX, event.clientY);
    if (hit) {
      this.selectedBadgeId.set(hit.id);
      this.dragMode = 'badge';
    } else if (this.photo()) {
      this.selectedBadgeId.set(null);
      this.dragMode = 'photo';
    } else {
      this.selectedBadgeId.set(null);
      this.dragMode = 'none';
      return;
    }
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (this.dragMode === 'none' || !canvas) {
      return;
    }
    const factor = this.canvasScaleFactor(canvas);
    const dx = (event.clientX - this.lastPointerX) * factor;
    const dy = (event.clientY - this.lastPointerY) * factor;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;

    if (this.dragMode === 'badge') {
      const id = this.selectedBadgeId();
      const b = this.selectedBadge();
      if (id && b) {
        this.patchBadge(id, { x: b.x + dx, y: b.y + dy });
      }
    } else {
      this.offsetX.update((x) => x + dx);
      this.offsetY.update((y) => y + dy);
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    this.dragMode = 'none';
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  protected onWheel(event: WheelEvent): void {
    const selected = this.selectedBadge();
    if (selected) {
      // A badge is selected: the wheel resizes it.
      event.preventDefault();
      const step = event.deltaY < 0 ? 12 : -12;
      this.patchBadge(selected.id, {
        size: Math.min(Math.max(selected.size + step, MIN_BADGE), MAX_BADGE),
      });
      return;
    }
    if (this.photo()) {
      event.preventDefault();
      const step = event.deltaY < 0 ? 0.12 : -0.12;
      this.scale.update((s) => Math.min(Math.max(s + step, MIN_SCALE), MAX_SCALE));
    }
  }

  protected async download(): Promise<void> {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }
    // Render once to an off-screen canvas with no selection ring, so the export
    // is clean regardless of what's selected in the preview.
    const out = document.createElement('canvas');
    try {
      await drawInvite(out, this.values(), null);
    } catch {
      return;
    }
    const o = this.outreach();
    const base = o ? `${o.name} ${formatDateFr(o.date).replace(/\//g, '-')}` : this.place();
    const slug = base
      .toLocaleLowerCase('fr-FR')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    downloadCanvasPng(out, `flyer-${slug || 'sortie'}`);
  }

  protected readonly minBadge = MIN_BADGE;
  protected readonly maxBadge = MAX_BADGE;
}
