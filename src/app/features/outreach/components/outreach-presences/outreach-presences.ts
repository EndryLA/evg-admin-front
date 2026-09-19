import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  ATTENDANCE_TYPE_LABELS,
  ATTENDANCE_TYPE_TONES,
  presenceName,
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
 * - `seeAllLink` turns the footer into a navigation to a dedicated full-list
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
  /**
   * When set, the footer becomes a permanent link to this route rather than an
   * in-place toggle — it is the only way into the page where presences are
   * added and removed, so it shows however few rows there are, empty included.
   */
  readonly seeAllLink = input<string | unknown[] | null>(null);
  /** Show all rows with no footer — for the standalone full-list page. */
  readonly expanded = input(false);
  /** Offer a remove control per row — set by the full-list page for admins. */
  readonly deletable = input(false);
  /** Show the count chip beside the title. Off on the full-list page. */
  readonly showCount = input(true);

  readonly retry = output<void>();
  /** A row was picked for removal; only ever emitted when {@link deletable}. */
  readonly remove = output<OutreachAttendance>();

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
  protected readonly name = presenceName;
  protected toggle(): void {
    this.showAll.update((v) => !v);
  }
}
