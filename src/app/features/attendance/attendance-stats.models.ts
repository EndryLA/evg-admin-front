/**
 * Domain models for the department-wide presence statistics (`/api/stats`).
 * Everything is derived server-side from attendances (MEMBER vs GUEST).
 */

/** Server-side date presets; `null`/absent means a custom or open range. */
export type StatsPeriod = 'CURRENT_MONTH' | 'CURRENT_YEAR' | 'LAST_3_MONTHS';

/**
 * Query applied to every `/api/stats` call. `period` is a server preset;
 * `from`/`to` are inclusive calendar-day bounds (`YYYY-MM-DD`) for a custom
 * range. The remaining UUIDs narrow the scope (by team leader, outreach, or
 * city). Omit everything for department-wide, all-time figures.
 */
export interface StatsQuery {
  period: StatsPeriod | null;
  from: string | null;
  to: string | null;
  teamLeader: string | null;
  outreach: string | null;
  city: string | null;
}

/** Aggregate totals over the range (`AttendanceSummary`). */
export interface AttendanceSummary {
  outreaches: number;
  totalAttendances: number;
  memberAttendances: number;
  guestAttendances: number;
  /** Unique members — same person across N outreaches counts once. */
  distinctMembers: number;
  /** `memberAttendances / totalAttendances`, 0..1, 0 when none. */
  memberProportion: number;
  /** `guestAttendances / totalAttendances`, 0..1, 0 when none. */
  guestProportion: number;
  avgAttendancePerOutreach: number;
}

/** Lifecycle status of an outreach. */
export type OutreachStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'CANCELLED' | 'FINISHED';

/** Per-outreach attendance breakdown (`OutreachAttendance`). */
export interface OutreachAttendance {
  outreachUuid: string;
  name: string;
  /** Outreach date, `YYYY-MM-DD`. */
  date: string;
  location: string;
  cityLabel: string;
  status: OutreachStatus;
  /** `members + guests`. */
  attendances: number;
  members: number;
  guests: number;
}

/** A member ranked by number of attendances (`ProfilePresence`). */
export interface ProfilePresence {
  profileUuid: string;
  firstname: string;
  lastname: string;
  presences: number;
  /** `presences / outreaches`, 0..1, share of outreaches attended. */
  presenceRate: number;
}

/** A team leader's aggregate presence figures (`TeamStats`). */
export interface TeamStats {
  teamLeaderUuid: string;
  teamLeaderFirstname: string;
  teamLeaderLastname: string;
  members: number;
  totalPresences: number;
  avgPresencesPerMember: number;
  /** Average share of outreaches attended across the team, 0..1. */
  presenceRate: number;
}

/** An outreach's identity/scheduling fields, as embedded in an attendance overview row. */
export interface OutreachStatsSummary {
  uuid: string;
  name: string;
  location: string;
  /** Outreach date, `YYYY-MM-DD`. */
  date: string;
  cityLabel: string;
  status: OutreachStatus;
  /** `trackedAttendances + leaders` — everyone counted for that outreach. */
  totalPresences: number;
}

/** A present member or guest's identity, with no attendance metadata (`AttendeeName`). */
export interface AttendeeName {
  profileUuid: string;
  firstname: string;
  lastname: string;
}

/** One team leader's roster at a given outreach (`TeamAttendance`). */
export interface TeamAttendance {
  teamLeaderUuid: string;
  teamLeaderFirstname: string;
  teamLeaderLastname: string;
  members: AttendeeName[];
}

/**
 * Per-outreach attendance overview, broken down by team leader
 * (`OutreachAttendanceStats`, `/api/stats/outreaches/attendance-overview`).
 */
export interface OutreachAttendanceOverview {
  outreach: OutreachStatsSummary;
  /** Département members tracked under a team leader ("dpt" on the card). */
  trackedAttendances: number;
  teams: TeamAttendance[];
  guests: AttendeeName[];
  leaders: number;
}

/** French short month labels, indexed 1–12. */
export const MONTH_LABELS: Record<number, string> = {
  1: 'janv.',
  2: 'févr.',
  3: 'mars',
  4: 'avr.',
  5: 'mai',
  6: 'juin',
  7: 'juil.',
  8: 'août',
  9: 'sept.',
  10: 'oct.',
  11: 'nov.',
  12: 'déc.',
};
