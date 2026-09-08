/**
 * Domain models for the field statistics (`GET /api/stats/outreach`) — the
 * contacts/conversions side of the "Stats terrain" bilan: what the sorties
 * produced, month by month, city by city.
 *
 * Presence figures (effectif) come from `/api/stats/outreaches` and are joined
 * on the client — see {@link TerrainStatsService}.
 */

import type { City } from './outreach.models';

/** Server-side date presets; `null`/absent means a custom or open range. */
export type StatsPeriod = 'CURRENT_MONTH' | 'CURRENT_YEAR' | 'LAST_3_MONTHS';

/**
 * Query applied to the stats calls. `period` is a server preset; `from`/`to`
 * are inclusive calendar-day bounds (`YYYY-MM-DD`) for a custom range. The
 * UUIDs narrow the scope. Omit everything for department-wide, all-time figures.
 */
export interface StatsQuery {
  period: StatsPeriod | null;
  from: string | null;
  to: string | null;
  teamLeader: string | null;
  outreach: string | null;
  city: string | null;
}

/** Empty query — department-wide, all-time. */
export const EMPTY_STATS_QUERY: StatsQuery = {
  period: null,
  from: null,
  to: null,
  teamLeader: null,
  outreach: null,
  city: null,
};

/** Headline totals over the range (`ContactSummary`). */
export interface ContactSummary {
  outreaches: number;
  /** Everyone met, contacts and conversions together. */
  entries: number;
  contacts: number;
  conversions: number;
  /** `conversions / entries`, 0..1, 0 when none. */
  conversionRate: number;
  avgEntriesPerOutreach: number;
  avgConversionsPerOutreach: number;
}

/** One calendar month's figures (`MonthlyContacts`). `month` is `YYYY-MM`. */
export interface MonthlyContacts {
  month: string;
  outreaches: number;
  entries: number;
  contacts: number;
  conversions: number;
  conversionRate: number;
}

/** One sortie's contact figures (`OutreachContactStats`). */
export interface OutreachContactStats {
  outreachUuid: string;
  name: string;
  /** Outreach date, `YYYY-MM-DD`. */
  date: string;
  location: string;
  /** The linked commune, or `null` when the sortie only carries a free-text label. */
  city: City | null;
  /** Free-text city, used when no commune is linked. */
  cityLabel: string;
  entries: number;
  contacts: number;
  conversions: number;
  conversionRate: number;
}

/** One city's figures (`CityContacts`, `/api/stats/outreach/cities`). */
export interface CityContacts {
  cityUuid: string;
  name: string;
  /** Sector number, or `null` when the city is unassigned. */
  sector: number | null;
  departmentCode: string;
  entries: number;
  contacts: number;
  conversions: number;
  conversionRate: number;
}

/** One sector's figures (`SectorContacts`, `/api/stats/outreach/sectors`). */
export interface SectorContacts {
  sector: number | null;
  cities: number;
  entries: number;
  contacts: number;
  conversions: number;
  conversionRate: number;
}

/** The whole `/api/stats/outreach` payload (`OutreachStats`). */
export interface TerrainReport {
  summary: ContactSummary;
  monthly: MonthlyContacts[];
  perOutreach: OutreachContactStats[];
}

/** Per-sortie presence counts, joined onto the contact figures. */
export interface OutreachPresenceCounts {
  outreachUuid: string;
  /** `members + guests` — everyone mobilised for that sortie. */
  attendances: number;
  /** Département members (ouvriers/aides) — the "effectif DPT" column. */
  members: number;
  guests: number;
}

/** French month names, indexed 1–12, for the monthly table headings. */
export const MONTH_NAMES_FR: Record<number, string> = {
  1: 'Janvier',
  2: 'Février',
  3: 'Mars',
  4: 'Avril',
  5: 'Mai',
  6: 'Juin',
  7: 'Juillet',
  8: 'Août',
  9: 'Septembre',
  10: 'Octobre',
  11: 'Novembre',
  12: 'Décembre',
};
