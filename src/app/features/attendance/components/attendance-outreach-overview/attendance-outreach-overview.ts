import { Component, computed, inject, OnInit, signal } from '@angular/core';

import { messageFromError } from '../../../../core/http/http-error.util';
import { AttendanceStatsService } from '../../attendance-stats.service';
import {
  MONTH_LABELS,
  type AttendeeName,
  type OutreachAttendanceOverview,
  type StatsQuery,
} from '../../attendance-stats.models';

/** Empty query template — every scoping field but the year bounds. */
const EMPTY_QUERY: StatsQuery = {
  period: null,
  from: null,
  to: null,
  teamLeader: null,
  outreach: null,
  city: null,
};

/** One calendar month's worth of outreach cards, in display order. */
interface MonthGroup {
  key: string;
  label: string;
  rows: OutreachAttendanceOverview[];
}

/** Sentinel row key for an outreach's "Invités" roster (has no team-leader uuid). */
const GUESTS_KEY = 'guests';

/** Composite key identifying one collapsible roster row within one outreach card. */
function rosterKey(outreachUuid: string, teamLeaderUuid: string): string {
  return `${outreachUuid}::${teamLeaderUuid || GUESTS_KEY}`;
}

/**
 * Per-outreach attendance overview, grouped by month — each outreach shown as
 * a card with its team-by-team breakdown behind an expand/collapse toggle, and
 * each team (plus guests) individually collapsible into its member roster.
 * Everything — including the rosters — comes from the one
 * `/api/stats/outreaches/attendance-overview` call; no other endpoint is hit.
 * A sibling view to {@link AttendanceStats} on the same Présences page.
 */
@Component({
  selector: 'app-attendance-outreach-overview',
  host: { class: 'outreach-overview' },
  templateUrl: './attendance-outreach-overview.html',
  styleUrl: './attendance-outreach-overview.scss',
})
export class AttendanceOutreachOverview implements OnInit {
  private readonly service = inject(AttendanceStatsService);

  private readonly currentYear = new Date().getFullYear();
  protected readonly year = signal(this.currentYear);
  protected readonly isCurrentYear = computed(() => this.year() >= this.currentYear);

  protected readonly rows = signal<OutreachAttendanceOverview[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  /** Outreach uuids currently expanded. */
  private readonly openOutreaches = signal<ReadonlySet<string>>(new Set());
  /** Roster keys (see {@link rosterKey}) currently expanded. */
  private readonly openRosters = signal<ReadonlySet<string>>(new Set());

  protected readonly totalMobilized = computed(() =>
    this.rows().reduce((sum, r) => sum + r.outreach.totalPresences, 0),
  );

  /** Month groups, most recent first; each group's outreaches most recent first too. */
  protected readonly groups = computed<MonthGroup[]>(() => {
    const byKey = new Map<string, MonthGroup>();
    for (const row of this.rows()) {
      const [year, month] = row.outreach.date.split('-');
      const key = `${year}-${month}`;
      let group = byKey.get(key);
      if (!group) {
        const label = `${MONTH_LABELS[Number(month)] ?? month} ${year}`.toUpperCase();
        group = { key, label, rows: [] };
        byKey.set(key, group);
      }
      group.rows.push(row);
    }
    for (const group of byKey.values()) {
      group.rows.sort((a, b) => b.outreach.date.localeCompare(a.outreach.date));
    }
    return [...byKey.values()].sort((a, b) => b.key.localeCompare(a.key));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.openOutreaches.set(new Set());
    this.openRosters.set(new Set());
    const y = this.year();
    const query: StatsQuery = { ...EMPTY_QUERY, from: `${y}-01-01`, to: `${y}-12-31` };
    this.service.attendanceOverview(query).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des présences impossible.'));
        this.loading.set(false);
      },
    });
  }

  protected prevYear(): void {
    this.year.update((y) => y - 1);
    this.load();
  }

  protected nextYear(): void {
    if (this.isCurrentYear()) {
      return;
    }
    this.year.update((y) => y + 1);
    this.load();
  }

  // ---- Outreach cards ----

  protected isOpen(uuid: string): boolean {
    return this.openOutreaches().has(uuid);
  }

  protected toggle(uuid: string): void {
    this.openOutreaches.update((set) => toggled(set, uuid));
  }

  /** Teams ranked by member count, highest first. */
  protected sortedTeams(row: OutreachAttendanceOverview) {
    return [...row.teams].sort((a, b) => b.members.length - a.members.length);
  }

  /** `YYYY-MM-DD` → `08/08/2026`. */
  protected dateLabel(iso: string): string {
    const [year, month, day] = iso.split('-');
    return year && month && day ? `${day}/${month}/${year}` : iso;
  }

  // ---- Team / guest rosters (all data already in `rows`, nothing to fetch) ----

  protected isRosterOpen(outreachUuid: string, teamLeaderUuid: string): boolean {
    return this.openRosters().has(rosterKey(outreachUuid, teamLeaderUuid));
  }

  protected toggleRoster(outreachUuid: string, teamLeaderUuid: string): void {
    this.openRosters.update((set) => toggled(set, rosterKey(outreachUuid, teamLeaderUuid)));
  }

  protected attendeeName(a: AttendeeName): string {
    return `${a.firstname} ${a.lastname}`.trim() || '—';
  }
}

/** Return a copy of `set` with `value` toggled in/out. */
function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}
