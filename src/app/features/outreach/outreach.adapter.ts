import type {
  AttendanceType,
  City,
  CivilState,
  ContactEntry,
  ContactType,
  Outreach,
  OutreachAttendance,
  OutreachInput,
  OutreachPage,
  OutreachStatus,
} from './outreach.models';

/** Raw Spring `Page<T>` wrapper (only the fields the UI reads). */
export interface RawPage<T> {
  content?: T[];
  totalElements?: number;
  last?: boolean;
}

/** Nested profile as returned inside `OutreachResponse.managedBy`. */
export interface RawManager {
  uuid?: string;
  firstname?: string;
  lastname?: string;
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

/** Raw `OutreachRequest` sent to the backend. */
export interface RawOutreachRequest {
  name: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  managedByUuid: string | null;
}

/** Raw `AttendanceResponse` from the backend (only the fields we display). */
export interface RawOutreachAttendance {
  uuid?: string;
  firstname?: string;
  lastname?: string;
  invitedBy?: string;
  type?: string | null;
  outreachUuid?: string;
}

/** Raw `CityResponse`, as nested in `OutreachResponse.city` and
 *  `ContactEntryResponse.city`. */
export interface RawCity {
  uuid?: string;
  officialName?: string;
  postalCode?: string;
  departmentName?: string;
  departmentCode?: string;
  inseeCode?: number | null;
  sector?: number | null;
}

/** Raw `ContactEntryResponse` from the backend. */
export interface RawContactEntry {
  uuid?: string;
  outreachUuid?: string;
  type?: string | null;
  civilState?: string | null;
  firstname?: string;
  lastname?: string;
  /** Nested commune for in-region entries, else `null`. */
  city?: RawCity | null;
  /** Free-text city for out-of-region entries not linked to a commune. */
  cityLabel?: string | null;
  evangelizedBy?: string;
  phoneNumber?: string;
  observations?: string;
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

const ATTENDANCE_TYPES: readonly AttendanceType[] = ['GUEST', 'MEMBER'];

function toAttendanceType(value: string | null | undefined): AttendanceType {
  return ATTENDANCE_TYPES.includes(value as AttendanceType)
    ? (value as AttendanceType)
    : 'GUEST';
}

const CONTACT_TYPES: readonly ContactType[] = ['CONTACT', 'CONVERSION'];

function toContactType(value: string | null | undefined): ContactType {
  return CONTACT_TYPES.includes(value as ContactType)
    ? (value as ContactType)
    : 'CONTACT';
}

const CIVIL_STATES: readonly CivilState[] = [
  'MARRIED',
  'SINGLE',
  'DIVORCED',
  'SEPARATED',
  'WIDOW',
  'COHABITATION',
  'MISSING_INFORMATION',
];

function toCivilState(value: string | null | undefined): CivilState {
  return CIVIL_STATES.includes(value as CivilState)
    ? (value as CivilState)
    : 'MISSING_INFORMATION';
}

/** Map a raw outreach to the clean domain model. */
export function toOutreach(raw: RawOutreach): Outreach {
  const manager = raw.managedBy;
  const city = toCity(raw.city);
  return {
    uuid: raw.uuid ?? '',
    name: raw.name ?? '',
    location: raw.location ?? '',
    city,
    cityName: city?.officialName ?? raw.cityLabel ?? '',
    date: raw.date ?? null,
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    status: toStatus(raw.status),
    managedBy:
      manager && manager.uuid
        ? {
            uuid: manager.uuid,
            name: `${manager.firstname ?? ''} ${manager.lastname ?? ''}`.trim(),
          }
        : null,
  };
}

/** Map a raw Spring page of outreaches to a clean {@link OutreachPage}. */
export function toOutreachPage(raw: RawPage<RawOutreach>): OutreachPage {
  return {
    items: (raw.content ?? []).map(toOutreach),
    last: raw.last ?? true,
    totalElements: raw.totalElements ?? 0,
  };
}

/** Map a domain input to the raw `OutreachRequest`. */
export function toRawOutreachRequest(input: OutreachInput): RawOutreachRequest {
  return {
    name: input.name.trim(),
    location: input.location.trim(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    managedByUuid: input.managedByUuid || null,
  };
}

/** Map a raw attendance to the outreach feature's presence model. */
export function toOutreachAttendance(raw: RawOutreachAttendance): OutreachAttendance {
  return {
    uuid: raw.uuid ?? '',
    firstname: raw.firstname ?? '',
    lastname: raw.lastname ?? '',
    invitedBy: raw.invitedBy ?? '',
    type: toAttendanceType(raw.type),
  };
}

/** Map the raw nested `city` object to a clean {@link City}, or `null`. */
export function toCity(raw: RawCity | null | undefined): City | null {
  if (!raw) {
    return null;
  }
  return {
    uuid: raw.uuid ?? '',
    officialName: raw.officialName ?? '',
    postalCode: raw.postalCode ?? '',
    departmentName: raw.departmentName ?? '',
    departmentCode: raw.departmentCode ?? '',
    inseeCode: raw.inseeCode ?? null,
    sector: raw.sector ?? null,
  };
}

/** Map a raw contact entry to the clean domain model. */
export function toContactEntry(raw: RawContactEntry): ContactEntry {
  const city = toCity(raw.city);
  return {
    uuid: raw.uuid ?? '',
    outreachUuid: raw.outreachUuid ?? '',
    type: toContactType(raw.type),
    civilState: toCivilState(raw.civilState),
    firstname: raw.firstname ?? '',
    lastname: raw.lastname ?? '',
    city,
    cityName: city?.officialName ?? raw.cityLabel ?? '',
    evangelizedBy: raw.evangelizedBy ?? '',
    phoneNumber: raw.phoneNumber ?? '',
    observations: raw.observations ?? '',
  };
}
