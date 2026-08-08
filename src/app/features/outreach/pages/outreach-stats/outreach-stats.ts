import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { messageFromError } from '../../../../core/http/http-error.util';
import { OutreachService } from '../../outreach.service';
import {
  ATTENDANCE_TYPE_LABELS,
  ATTENDANCE_TYPE_TONES,
  CIVIL_STATE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  type CivilState,
  type ContactEntry,
  type Outreach,
  type OutreachAttendance,
} from '../../outreach.models';

/** A civil-state slice of the contacts, for the breakdown list. */
interface CivilStateSlice {
  label: string;
  count: number;
  percent: number;
}

/** One ouvrier on the roster, built from a recorded presence. */
interface WorkerRow {
  name: string;
  typeLabel: string;
  typeTone: string;
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
  protected readonly attendances = signal<OutreachAttendance[]>([]);
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

  /** Every person met, whichever type. */
  protected readonly entryCount = computed(() => this.contacts().length);
  protected readonly contactCount = computed(
    () => this.contacts().filter((c) => c.type === 'CONTACT').length,
  );
  protected readonly conversionCount = computed(
    () => this.contacts().filter((c) => c.type === 'CONVERSION').length,
  );
  /** Share of people met who became conversions, as a whole percentage. */
  protected readonly conversionRate = computed(() => {
    const total = this.entryCount();
    return total ? Math.round((this.conversionCount() / total) * 100) : 0;
  });
  /**
   * Ouvriers on the sortie, taken from the recorded presences rather than from
   * the contact entries — someone can be there without registering a contact.
   */
  protected readonly workerCount = computed(() => this.attendances().length);

  /** Civil-state distribution, largest slice first, empty ones dropped. */
  protected readonly civilBreakdown = computed<CivilStateSlice[]>(() => {
    const total = this.entryCount();
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

  /** The presence roster, members first then alphabetically. */
  protected readonly workers = computed<WorkerRow[]>(() =>
    this.attendances()
      .map((a) => ({
        name: `${a.firstname} ${a.lastname}`.trim(),
        typeLabel: ATTENDANCE_TYPE_LABELS[a.type],
        typeTone: ATTENDANCE_TYPE_TONES[a.type],
      }))
      .sort(
        (a, b) =>
          Number(b.typeLabel === ATTENDANCE_TYPE_LABELS.MEMBER) -
            Number(a.typeLabel === ATTENDANCE_TYPE_LABELS.MEMBER) ||
          a.name.localeCompare(b.name, 'fr'),
      ),
  );

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

    forkJoin({
      contacts: this.service.contactEntries(this.uuid()),
      attendances: this.service.attendances(this.uuid()),
    }).subscribe({
      next: ({ contacts, attendances }) => {
        this.contacts.set(contacts);
        this.attendances.set(attendances);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des statistiques impossible.'));
        this.loading.set(false);
      },
    });
  }
}
