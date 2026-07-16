import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  ATTENDANCE_TYPE_LABELS,
  ATTENDANCE_TYPE_TONES,
  type AttendanceType,
  type OutreachAttendance,
} from '../../outreach.models';

/** How many presences show before the "Voir tout" toggle reveals the rest. */
const PREVIEW_COUNT = 5;

/**
 * Presences card for an outreach — a compact list capped at {@link PREVIEW_COUNT}
 * rows with a "Voir tout / Voir moins" toggle. Purely presentational: the parent
 * loads the data and handles retry. Shared by the detail and manage pages.
 *
 * Two optional modes tweak the footer:
 * - `seeAllLink` turns "Voir tout" into a navigation to a dedicated full-list
 *   page instead of an in-place toggle.
 * - `expanded` shows every row with no footer, for that full-list page itself.
 */
@Component({
  selector: 'app-outreach-presences',
  imports: [RouterLink],
  templateUrl: './outreach-presences.html',
  styleUrl: './outreach-presences.scss',
})
export class OutreachPresences {
  readonly presences = input<OutreachAttendance[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** When set, "Voir tout" navigates to this route instead of toggling. */
  readonly seeAllLink = input<string | unknown[] | null>(null);
  /** Show all rows with no footer — for the standalone full-list page. */
  readonly expanded = input(false);

  readonly retry = output<void>();

  protected readonly showAll = signal(false);

  protected readonly visible = computed<OutreachAttendance[]>(() => {
    const all = this.presences();
    return this.showAll() || this.expanded() ? all : all.slice(0, PREVIEW_COUNT);
  });
  protected readonly hasMore = computed(
    () => !this.expanded() && this.presences().length > PREVIEW_COUNT,
  );

  protected typeLabel(type: AttendanceType): string {
    return ATTENDANCE_TYPE_LABELS[type];
  }
  protected typeTone(type: AttendanceType): string {
    return ATTENDANCE_TYPE_TONES[type];
  }
  protected name(p: OutreachAttendance): string {
    return `${p.firstname} ${p.lastname}`.trim() || '—';
  }

  protected toggle(): void {
    this.showAll.update((v) => !v);
  }
}
