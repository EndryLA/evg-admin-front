import {
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateShortFr } from '../../../../shared/util/date.util';
import { drawBilan, downloadCanvasPng, type BilanValues } from '../../outreach-bilan.util';
import { OutreachService } from '../../outreach.service';
import { STATUS_LABELS, STATUS_TONES, type Outreach } from '../../outreach.models';

/** Upper bound on the figures, so a typo can't blow past the template's chips. */
const MAX_FIGURE = 9999;

/**
 * Bilan page for one outreach (`/sorties/:uuid/bilan`) — renders the department's
 * static template with this sortie's commune, contacts, conversions and ouvriers
 * written over it, then exports it as a PNG ready to share.
 *
 * Figures are pre-filled from what was recorded during the sortie and stay
 * editable: the roster rarely matches exactly how many ouvriers were out.
 */
@Component({
  selector: 'app-outreach-bilan',
  imports: [RouterLink],
  templateUrl: './outreach-bilan.html',
  styleUrl: './outreach-bilan.scss',
})
export class OutreachBilan implements OnInit {
  private readonly service = inject(OutreachService);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly outreach = signal<Outreach | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly renderError = signal<string | null>(null);

  /** Editable values written onto the template, pre-filled once on load. */
  protected readonly city = signal('');
  protected readonly contacts = signal(0);
  protected readonly conversions = signal(0);
  protected readonly workers = signal(0);

  protected readonly statusLabel = computed(() => {
    const o = this.outreach();
    return o ? STATUS_LABELS[o.status] : '';
  });
  protected readonly statusTone = computed(() => {
    const o = this.outreach();
    return o ? STATUS_TONES[o.status] : 'grey';
  });

  private readonly values = computed<BilanValues>(() => ({
    city: this.city(),
    contacts: this.contacts(),
    conversions: this.conversions(),
    workers: this.workers(),
  }));

  /**
   * Draws are queued rather than fired in parallel: they share one canvas, so a
   * slow draw resolving late would otherwise paint over a newer one.
   */
  private renderQueue: Promise<void> = Promise.resolve();

  constructor() {
    // Redraws on every edit; the canvas only exists once loading is done.
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const values = this.values();
      if (!canvas) {
        return;
      }
      this.renderQueue = this.renderQueue.then(() =>
        drawBilan(canvas, values).then(
          () => this.renderError.set(null),
          (error: unknown) =>
            this.renderError.set(
              error instanceof Error ? error.message : 'Rendu du bilan impossible.',
            ),
        ),
      );
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      outreach: this.service.getOne(this.uuid()),
      contacts: this.service.contactEntries(this.uuid()),
      attendances: this.service.attendances(this.uuid()),
    }).subscribe({
      next: ({ outreach, contacts, attendances }) => {
        this.outreach.set(outreach);
        this.city.set(outreach.cityName);
        this.contacts.set(contacts.filter((c) => c.type === 'CONTACT').length);
        this.conversions.set(contacts.filter((c) => c.type === 'CONVERSION').length);
        // Ouvriers come from the presence roster, not the contact entries —
        // someone can be out on the sortie without registering anyone.
        this.workers.set(attendances.length);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(messageFromError(err, 'Chargement de la sortie impossible.'));
        this.loading.set(false);
      },
    });
  }

  protected onCity(value: string): void {
    this.city.set(value);
  }

  /** Clamp a figure input to a non-negative whole number the template can hold. */
  protected onFigure(target: 'contacts' | 'conversions' | 'workers', value: string): void {
    const parsed = Math.trunc(Number(value));
    const safe = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), MAX_FIGURE) : 0;
    this[target].set(safe);
  }

  protected download(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const o = this.outreach();
    if (!canvas || !o) {
      return;
    }
    const date = formatDateShortFr(o.date).replace(/\//g, '-');
    const slug = `${o.name} ${date}`
      .toLocaleLowerCase('fr-FR')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    downloadCanvasPng(canvas, `bilan-${slug || 'sortie'}`);
  }
}
