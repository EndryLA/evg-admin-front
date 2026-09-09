import { toCity, type RawCity } from './outreach.adapter';
import type {
  CityContacts,
  ContactSummary,
  MonthlyContacts,
  OutreachContactStats,
  OutreachPresenceCounts,
  PresenceSummary,
  SectorContacts,
  TerrainReport,
} from './terrain-stats.models';

/** Raw `/api/stats/outreach` payloads — every field optional, to survive partial responses. */
export interface RawContactSummary {
  outreaches?: number;
  entries?: number;
  contacts?: number;
  conversions?: number;
  conversionRate?: number;
  avgEntriesPerOutreach?: number;
  avgConversionsPerOutreach?: number;
}

export interface RawMonthlyContacts {
  month?: string;
  outreaches?: number;
  entries?: number;
  contacts?: number;
  conversions?: number;
  conversionRate?: number;
}

export interface RawOutreachContactStats {
  outreachUuid?: string;
  name?: string;
  date?: string;
  location?: string;
  city?: RawCity | null;
  cityLabel?: string;
  entries?: number;
  contacts?: number;
  conversions?: number;
  conversionRate?: number;
}

export interface RawCityContacts {
  cityUuid?: string;
  name?: string;
  sector?: number;
  departmentCode?: string;
  entries?: number;
  contacts?: number;
  conversions?: number;
  conversionRate?: number;
}

export interface RawSectorContacts {
  sector?: number;
  cities?: number;
  entries?: number;
  contacts?: number;
  conversions?: number;
  conversionRate?: number;
}

export interface RawTerrainReport {
  summary?: RawContactSummary;
  monthly?: RawMonthlyContacts[];
  perOutreach?: RawOutreachContactStats[];
}

/** Raw `/api/stats/summary` payload — only the fields the bilan reads. */
export interface RawPresenceSummary {
  outreaches?: number;
  totalPresences?: number;
  totalAttendances?: number;
  memberAttendances?: number;
  avgPresencesPerOutreach?: number;
}

/** Raw `/api/stats/outreaches` row — only the presence fields are read here. */
export interface RawOutreachPresenceCounts {
  outreachUuid?: string;
  totalPresences?: number;
  attendances?: number;
  members?: number;
  guests?: number;
}

const num = (value: number | undefined): number => value ?? 0;

export function toContactSummary(raw: RawContactSummary): ContactSummary {
  return {
    outreaches: num(raw.outreaches),
    entries: num(raw.entries),
    contacts: num(raw.contacts),
    conversions: num(raw.conversions),
    conversionRate: num(raw.conversionRate),
    avgEntriesPerOutreach: num(raw.avgEntriesPerOutreach),
    avgConversionsPerOutreach: num(raw.avgConversionsPerOutreach),
  };
}

export function toMonthlyContacts(raw: RawMonthlyContacts): MonthlyContacts {
  return {
    month: raw.month ?? '',
    outreaches: num(raw.outreaches),
    entries: num(raw.entries),
    contacts: num(raw.contacts),
    conversions: num(raw.conversions),
    conversionRate: num(raw.conversionRate),
  };
}

export function toOutreachContactStats(raw: RawOutreachContactStats): OutreachContactStats {
  return {
    outreachUuid: raw.outreachUuid ?? '',
    name: raw.name ?? '',
    date: raw.date ?? '',
    location: raw.location ?? '',
    city: toCity(raw.city),
    cityLabel: raw.cityLabel ?? '',
    entries: num(raw.entries),
    contacts: num(raw.contacts),
    conversions: num(raw.conversions),
    conversionRate: num(raw.conversionRate),
  };
}

export function toCityContacts(raw: RawCityContacts): CityContacts {
  return {
    cityUuid: raw.cityUuid ?? '',
    name: raw.name ?? '',
    sector: raw.sector ?? null,
    departmentCode: raw.departmentCode ?? '',
    entries: num(raw.entries),
    contacts: num(raw.contacts),
    conversions: num(raw.conversions),
    conversionRate: num(raw.conversionRate),
  };
}

export function toSectorContacts(raw: RawSectorContacts): SectorContacts {
  return {
    sector: raw.sector ?? null,
    cities: num(raw.cities),
    entries: num(raw.entries),
    contacts: num(raw.contacts),
    conversions: num(raw.conversions),
    conversionRate: num(raw.conversionRate),
  };
}

export function toTerrainReport(raw: RawTerrainReport): TerrainReport {
  return {
    summary: toContactSummary(raw.summary ?? {}),
    monthly: (raw.monthly ?? []).map(toMonthlyContacts),
    perOutreach: (raw.perOutreach ?? []).map(toOutreachContactStats),
  };
}

export function toPresenceSummary(raw: RawPresenceSummary): PresenceSummary {
  return {
    outreaches: num(raw.outreaches),
    totalPresences: num(raw.totalPresences),
    totalAttendances: num(raw.totalAttendances),
    memberAttendances: num(raw.memberAttendances),
    avgPresencesPerOutreach: num(raw.avgPresencesPerOutreach),
  };
}

export function toOutreachPresenceCounts(
  raw: RawOutreachPresenceCounts,
): OutreachPresenceCounts {
  return {
    outreachUuid: raw.outreachUuid ?? '',
    totalPresences: num(raw.totalPresences),
    attendances: num(raw.attendances),
    members: num(raw.members),
    guests: num(raw.guests),
  };
}
