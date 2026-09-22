import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr } from '../../../../shared/util/date.util';
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

/**
 * Sortie picker for bilan generation (`/sorties/bilan`): lists recent sorties so
 * the user can choose one and jump straight to its bilan flyer
 * (`/sorties/:uuid/bilan`). Reached from the "Génération de flyers" hub.
 */
@Component({
  selector: 'app-outreach-bilan-select',
  imports: [RouterLink],
  templateUrl: './outreach-bilan-select.html',
  styleUrl: './outreach-bilan-select.scss',
})
export class OutreachBilanSelect {
  private readonly service = inject(OutreachService);

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

  constructor() {
    this.load();
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
}
