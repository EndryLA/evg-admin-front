import { Component, computed, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr, monthYearLabel } from '../../../../shared/util/date.util';
import { OutreachService } from '../../outreach.service';
import {
  EMPTY_OUTREACH_FILTER,
  STATUS_LABELS,
  STATUS_TONES,
  type Outreach,
  type OutreachStatus,
} from '../../outreach.models';

/** How many recent sorties to load for the picker. */
const PAGE_SIZE = 100;

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

/**
 * Sortie picker for bilan generation (`/sorties/bilan`): lists recent sorties by
 * month so the user can choose one and jump straight to its bilan flyer
 * (`/sorties/:uuid/bilan`). Reached from the "Génération de flyers" hub. Same
 * layout as the invitation flyer's picker, except the sortie in focus is the
 * latest one that has taken place — the one a bilan is usually wanted for.
 */
@Component({
  selector: 'app-outreach-bilan-select',
  imports: [RouterLink],
  templateUrl: './outreach-bilan-select.html',
  styleUrl: './outreach-bilan-select.scss',
})
export class OutreachBilanSelect {
  private readonly service = inject(OutreachService);
  private readonly hostRef: ElementRef<HTMLElement> = inject(ElementRef);

  protected readonly rows = signal<Outreach[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly query = signal('');

  protected readonly fmtDate = formatDateFr;

  /** Client-side filter over the loaded sorties, by name or city. */
  protected readonly filtered = computed<Outreach[]>(() => {
    const q = this.query().trim().toLocaleLowerCase('fr-FR');
    if (!q) {
      return this.rows();
    }
    return this.rows().filter(
      (o) =>
        o.name.toLocaleLowerCase('fr-FR').includes(q) ||
        o.cityName.toLocaleLowerCase('fr-FR').includes(q),
    );
  });

  /**
   * The filtered sorties grouped by calendar month, newest month first (rows are
   * loaded date-descending). Mirrors the sorties list's month sections.
   */
  protected readonly groups = computed<OutreachMonthGroup[]>(() => {
    const byKey = new Map<string, OutreachMonthGroup>();
    for (const o of this.filtered()) {
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
   * The sortie to put in focus: the latest one that has taken place (today or
   * earlier), or failing that the nearest upcoming one. Its uuid drives the
   * highlight and the auto-scroll in the picker.
   */
  protected readonly focusOutreach = computed<Outreach | null>(() => {
    const today = localDateKey(new Date());
    // Rows are date-descending, so the first past-or-today one is the latest.
    const dated = this.rows().filter((o) => o.date);
    const past = dated.find((o) => (o.date as string) <= today);
    return past ?? dated[dated.length - 1] ?? this.rows()[0] ?? null;
  });

  constructor() {
    this.load();
  }

  protected isFocus(outreach: Outreach): boolean {
    return this.focusOutreach()?.uuid === outreach.uuid;
  }

  protected statusLabel(status: OutreachStatus): string {
    return STATUS_LABELS[status];
  }
  protected statusTone(status: OutreachStatus): string {
    return STATUS_TONES[status];
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.list(0, PAGE_SIZE, EMPTY_OUTREACH_FILTER, 'date,desc').subscribe({
      next: (page) => {
        this.rows.set(page.items);
        this.loading.set(false);
        // Bring the focused sortie into view once the list has rendered.
        setTimeout(() => this.scrollToFocus(), 0);
      },
      error: (err: unknown) => {
        this.loadError.set(messageFromError(err, 'Chargement des sorties impossible.'));
        this.loading.set(false);
      },
    });
  }

  protected onSearch(value: string): void {
    this.query.set(value);
  }

  /** Land the picker on the focused sortie, when it's in the list. */
  private scrollToFocus(): void {
    const target = this.hostRef.nativeElement.querySelector<HTMLElement>('[data-focus-anchor]');
    target?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }
}
