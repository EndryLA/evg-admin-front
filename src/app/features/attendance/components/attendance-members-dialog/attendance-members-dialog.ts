import { Component, computed, input, output } from '@angular/core';

import type { ProfilePresence } from '../../attendance-stats.models';

/**
 * The full roster over the dashboard's range — the "voir tous" expansion of the
 * top-members panel. Includes members who were never present, so absences are as
 * visible as turnout. Presentational: the parent owns the fetch and passes the
 * roster (already ordered most-present first) in.
 */
@Component({
  selector: 'app-attendance-members-dialog',
  host: { class: 'modal-form', '(keydown.escape)': 'close.emit()' },
  templateUrl: './attendance-members-dialog.html',
  styleUrl: './attendance-members-dialog.scss',
})
export class AttendanceMembersDialog {
  readonly members = input<ProfilePresence[] | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** Outreaches in range — the denominator behind every presence rate. */
  readonly outreaches = input(0);

  readonly close = output<void>();

  protected readonly list = computed(() => this.members() ?? []);

  /** Members who never turned up over the range — 0 hides the callout. */
  protected readonly absentCount = computed(
    () => this.list().filter((m) => m.presences === 0).length,
  );

  /** Format a 0..1 rate as a whole French percentage (e.g. `72 %`). */
  protected ratePercent(rate: number): string {
    return `${Math.round(rate * 100)} %`;
  }
}
