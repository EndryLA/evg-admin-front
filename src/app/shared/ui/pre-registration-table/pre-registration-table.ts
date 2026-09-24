import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  ATTENDANCE_REASON_LABELS,
  ATTENDANCE_TYPE_LABELS,
  ATTENDANCE_TYPE_TONES,
  presenceName,
  type PreRegistration,
} from '../../attendance/attendance.models';
import { formatDateFr } from '../../util/date.util';

/** How many sign-ups show before the "Voir tout" toggle reveals the rest. */
const PREVIEW_COUNT = 5;

/**
 * Pre-registrations card for an outreach or a calendar event: who announced
 * they would come, and whether they have been confirmed present.
 * Presentational — the parent loads the data and performs the confirm call.
 *
 * Two optional modes tweak what it shows:
 * - `seeAllLink` turns "Voir tout" into a navigation to a dedicated full-list
 *   page instead of an in-place toggle.
 * - `expanded` shows every row with no footer, plus the full set of columns and
 *   the confirm control, for that full-list page itself. The compact card is a
 *   read-only glance: name and type only.
 *
 * Confirming is offered only when {@link canConfirm} is set (the parent enables
 * it once the day has come), so nobody is marked present ahead of time.
 */
@Component({
  selector: 'app-pre-registration-table',
  imports: [RouterLink],
  templateUrl: './pre-registration-table.html',
  styleUrl: './pre-registration-table.scss',
})
export class PreRegistrationTable {
  readonly items = input<PreRegistration[]>([]);
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
  /** Tooltip on the confirm buttons while {@link canConfirm} is off. */
  readonly confirmHint = input('Disponible une fois la sortie démarrée');
  /** Hint under "Aucune pré-inscription". */
  readonly emptyHint = input("Personne ne s'est encore inscrit à cette sortie.");
  /** Uuid of the row whose action is in flight — its buttons are disabled. */
  readonly busyUuid = input<string | null>(null);
  /** Failure of the last confirm, shown above the table. */
  readonly actionError = input<string | null>(null);

  readonly confirm = output<PreRegistration>();
  readonly retry = output<void>();

  protected readonly showAll = signal(false);

  protected readonly visible = computed<PreRegistration[]>(() => {
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
  protected readonly name = presenceName;

  protected typeLabel(p: PreRegistration): string {
    return ATTENDANCE_TYPE_LABELS[p.type];
  }
  protected typeTone(p: PreRegistration): string {
    return ATTENDANCE_TYPE_TONES[p.type];
  }
  protected reasonLabel(p: PreRegistration): string {
    return p.reason ? ATTENDANCE_REASON_LABELS[p.reason] : '—';
  }

  protected toggle(): void {
    this.showAll.update((v) => !v);
  }
}
