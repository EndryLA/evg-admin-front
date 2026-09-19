import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { formatDateFr } from '../../../../shared/util/date.util';
import {
  ATTENDANCE_REASON_LABELS,
  ATTENDANCE_TYPE_LABELS,
  ATTENDANCE_TYPE_TONES,
  type OutreachPreAttendance,
} from '../../outreach.models';

/** How many sign-ups show before the "Voir tout" toggle reveals the rest. */
const PREVIEW_COUNT = 5;

/**
 * Pre-registrations card for an outreach: who announced they would come, and
 * whether they have been confirmed present. Presentational — the parent loads
 * the data and performs the confirm call.
 *
 * Two optional modes tweak what it shows:
 * - `seeAllLink` turns "Voir tout" into a navigation to a dedicated full-list
 *   page instead of an in-place toggle.
 * - `expanded` shows every row with no footer, plus the full set of columns and
 *   the confirm control, for that full-list page itself. The compact card is a
 *   read-only glance: name and type only.
 *
 * Confirming is offered only when {@link canConfirm} is set (the parent enables
 * it once the sortie has started), so nobody is marked present ahead of time.
 */
@Component({
  selector: 'app-outreach-pre-attendances',
  imports: [RouterLink],
  templateUrl: './outreach-pre-attendances.html',
  styleUrl: './outreach-pre-attendances.scss',
})
export class OutreachPreAttendances {
  readonly items = input<OutreachPreAttendance[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /**
   * When set, the footer becomes a permanent "Voir tout" link to this route
   * rather than an in-place toggle — it is the only way into the page where
   * sign-ups are confirmed, so it shows however few rows there are.
   */
  readonly seeAllLink = input<string | unknown[] | null>(null);
  /** Show every row with the full columns and the confirm control. */
  readonly expanded = input(false);
  readonly canConfirm = input(false);
  /** Uuid of the row whose action is in flight — its buttons are disabled. */
  readonly busyUuid = input<string | null>(null);
  /** Failure of the last confirm, shown above the table. */
  readonly actionError = input<string | null>(null);

  readonly confirm = output<OutreachPreAttendance>();
  readonly retry = output<void>();

  protected readonly showAll = signal(false);

  protected readonly visible = computed<OutreachPreAttendance[]>(() => {
    const all = this.items();
    return this.showAll() || this.expanded() ? all : all.slice(0, PREVIEW_COUNT);
  });
  protected readonly hasMore = computed(
    () => !this.expanded() && this.items().length > PREVIEW_COUNT,
  );
  protected readonly confirmedCount = computed(
    () => this.items().filter((p) => p.confirmed).length,
  );

  protected readonly fmtDate = formatDateFr;

  protected typeLabel(p: OutreachPreAttendance): string {
    return ATTENDANCE_TYPE_LABELS[p.type];
  }
  protected typeTone(p: OutreachPreAttendance): string {
    return ATTENDANCE_TYPE_TONES[p.type];
  }
  protected name(p: OutreachPreAttendance): string {
    return `${p.firstname} ${p.lastname}`.trim() || '—';
  }
  protected reasonLabel(p: OutreachPreAttendance): string {
    return p.reason ? ATTENDANCE_REASON_LABELS[p.reason] : '—';
  }

  protected toggle(): void {
    this.showAll.update((v) => !v);
  }
}
