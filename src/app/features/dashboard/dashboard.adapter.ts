import type { DashboardOutreach, MonthPreAttendance, OutreachStatus } from './dashboard.models';

/** Raw Spring `Page<T>` wrapper (only the fields the dashboard reads). */
export interface RawPage<T> {
  content?: T[];
  totalElements?: number;
}

/** Nested profile as returned inside `OutreachResponse.managedBy`. */
interface RawManager {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}

/** Nested `CityResponse`, as returned inside `OutreachResponse.city`. */
interface RawCity {
  officialName?: string;
}

/** Raw `OutreachResponse` from the backend. */
export interface RawOutreach {
  uuid?: string;
  name?: string;
  location?: string;
  city?: RawCity | null;
  cityLabel?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
  managedBy?: RawManager | null;
}

const STATUSES: readonly OutreachStatus[] = [
  'SCHEDULED',
  'IN_PROGRESS',
  'FINISHED',
  'CANCELLED',
];

function toStatus(value: string | null | undefined): OutreachStatus {
  return STATUSES.includes(value as OutreachStatus)
    ? (value as OutreachStatus)
    : 'SCHEDULED';
}

/** Map a raw outreach to the dashboard's reduced model. */
export function toDashboardOutreach(raw: RawOutreach): DashboardOutreach {
  const manager = raw.managedBy;
  return {
    uuid: raw.uuid ?? '',
    name: raw.name ?? '',
    location: raw.location ?? '',
    cityName: raw.city?.officialName ?? raw.cityLabel ?? '',
    date: raw.date ?? null,
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    status: toStatus(raw.status),
    managerName: manager
      ? `${manager.firstname ?? ''} ${manager.lastname ?? ''}`.trim()
      : '',
  };
}

/** Raw `MonthlyPreAttendanceSummary`. */
export interface RawMonthPreAttendance {
  kind?: string;
  uuid?: string;
  name?: string;
  date?: string | null;
  startTime?: string | null;
  /** An `OutreachStatus`, or an `EventStatus` for an event. */
  status?: string | null;
  eventType?: string | null;
  total?: number;
  members?: number;
  guests?: number;
  confirmed?: number;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  REUNION: 'Réunion',
  AGAPE: 'Agapé',
  OTHER: 'Événement',
};

/** A calendar event's `PLANNED` reads as a sortie's `SCHEDULED`; the rest match. */
function toEventStatus(value: string | null | undefined): OutreachStatus {
  return value === 'PLANNED' ? 'SCHEDULED' : toStatus(value);
}

export function toMonthPreAttendance(raw: RawMonthPreAttendance): MonthPreAttendance {
  const kind = raw.kind === 'EVENT' ? 'EVENT' : 'OUTREACH';
  return {
    kind,
    uuid: raw.uuid ?? '',
    name: raw.name ?? '',
    typeLabel: kind === 'EVENT' ? (EVENT_TYPE_LABELS[raw.eventType ?? ''] ?? 'Événement') : '',
    date: raw.date ?? null,
    startTime: raw.startTime ?? null,
    status: kind === 'EVENT' ? toEventStatus(raw.status) : toStatus(raw.status),
    total: raw.total ?? 0,
    members: raw.members ?? 0,
    guests: raw.guests ?? 0,
    confirmed: raw.confirmed ?? 0,
  };
}
