import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { OutreachService } from '../../outreach.service';
import {
  CIVIL_STATE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  type CivilState,
  type ContactEntry,
  type Outreach,
} from '../../outreach.models';

/** A civil-state slice of the contacts, for the breakdown list. */
interface CivilStateSlice {
  label: string;
  count: number;
  percent: number;
}

/** A single evangelist's tally, for the leaderboard. */
interface WorkerTally {
  name: string;
  count: number;
  conversions: number;
}

/**
 * Statistics page for one outreach (`/sorties/:uuid/statistiques`) — a
 * read-only breakdown of the contacts recorded during the sortie: headline
 * counts, conversion rate, civil-state distribution, and an evangelist
 * leaderboard. Reached from the manage page.
 */
@Component({
  selector: 'app-outreach-stats',
  imports: [RouterLink],
  templateUrl: './outreach-stats.html',
  styleUrl: './outreach-stats.scss',
})
export class OutreachStats implements OnInit {
  private readonly service = inject(OutreachService);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly outreach = signal<Outreach | null>(null);
  protected readonly contacts = signal<ContactEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly statusLabel = computed(() => {
    const o = this.outreach();
    return o ? STATUS_LABELS[o.status] : '';
  });
  protected readonly statusTone = computed(() => {
    const o = this.outreach();
    return o ? STATUS_TONES[o.status] : 'grey';
  });

  protected readonly contactCount = computed(() => this.contacts().length);
  protected readonly conversionCount = computed(
    () => this.contacts().filter((c) => c.type === 'CONVERSION').length,
  );
  /** Share of contacts that became conversions, as a whole percentage. */
  protected readonly conversionRate = computed(() => {
    const total = this.contactCount();
    return total ? Math.round((this.conversionCount() / total) * 100) : 0;
  });
  /** Distinct evangelists who recorded at least one contact. */
  protected readonly workerCount = computed(() => this.workers().length);

  /** Civil-state distribution, largest slice first, empty ones dropped. */
  protected readonly civilBreakdown = computed<CivilStateSlice[]>(() => {
    const total = this.contactCount();
    const counts = new Map<CivilState, number>();
    for (const c of this.contacts()) {
      counts.set(c.civilState, (counts.get(c.civilState) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([state, count]) => ({
        label: CIVIL_STATE_LABELS[state],
        count,
        percent: total ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  });

  /** Per-evangelist tallies, most contacts first. */
  protected readonly workers = computed<WorkerTally[]>(() => {
    const byName = new Map<string, WorkerTally>();
    for (const c of this.contacts()) {
      const name = c.evangelizedBy.trim();
      if (!name) {
        continue;
      }
      const key = name.toLowerCase();
      const tally = byName.get(key) ?? { name, count: 0, conversions: 0 };
      tally.count += 1;
      if (c.type === 'CONVERSION') {
        tally.conversions += 1;
      }
      byName.set(key, tally);
    }
    return [...byName.values()].sort((a, b) => b.count - a.count);
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.service.getOne(this.uuid()).subscribe({
      next: (data) => this.outreach.set(data),
      error: (err) =>
        this.loadError.set(messageFromError(err, 'Chargement de la sortie impossible.')),
    });

    this.service.contactEntries(this.uuid()).subscribe({
      next: (data) => {
        this.contacts.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des contacts impossible.'));
        this.loading.set(false);
      },
    });
  }
}
