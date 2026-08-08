import type { DashboardOutreach, OutreachStatus } from './dashboard.models';

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

/** Total row count of a raw Spring page — the tiles only need the count. */
export function toTotal(raw: RawPage<unknown>): number {
  return raw.totalElements ?? 0;
}
