import { Component, computed, input, output } from '@angular/core';

import type { ProfilePresence, TeamStats } from '../../attendance-stats.models';

/** One decimal, French comma, trimmed when whole (e.g. `3,7` / `4`). */
const decimal = (value: number): string =>
  value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/**
 * Detail view for one team on the Présences dashboard: the leader's headline
 * figures plus who actually turned up over the range. Presentational — the
 * parent owns the roster fetch and passes the result in.
 */
@Component({
  selector: 'app-attendance-team-dialog',
  host: { class: 'modal-form', '(keydown.escape)': 'close.emit()' },
  templateUrl: './attendance-team-dialog.html',
  styleUrl: './attendance-team-dialog.scss',
})
export class AttendanceTeamDialog {
  readonly team = input.required<TeamStats>();
  /** The team's present members, leader included; `null` while loading/failed. */
  readonly roster = input<ProfilePresence[] | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** Outreaches in range — the denominator behind every presence rate. */
  readonly outreaches = input(0);

  readonly close = output<void>();

  protected readonly leaderName = computed(() =>
    `${this.team().teamLeaderFirstname} ${this.team().teamLeaderLastname}`.trim(),
  );

  protected readonly list = computed(() => this.roster() ?? []);

  /** Members who never turned up over the range — 0 hides the callout. */
  protected readonly absentCount = computed(
    () => this.list().filter((m) => m.presences === 0).length,
  );

  /** Average presences per member, one decimal, French comma, trimmed when whole. */
  protected readonly avgLabel = computed(() => decimal(this.team().avgPresencesPerMember));

  /**
   * Members of this team at a typical outreach (`presences / outreaches`) — the
   * turnout read of the same total that {@link avgLabel} reads per member.
   */
  protected readonly avgPerOutreachLabel = computed(() => {
    const outreaches = this.outreaches();
    return decimal(outreaches === 0 ? 0 : this.team().totalPresences / outreaches);
  });

  /** Format a 0..1 rate as a whole French percentage (e.g. `72 %`). */
  protected ratePercent(rate: number): string {
    return `${Math.round(rate * 100)} %`;
  }
}
