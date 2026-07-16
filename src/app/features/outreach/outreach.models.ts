/** Lifecycle status of an outreach event. Read-only — computed by the backend. */
export type OutreachStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

/** French labels for {@link OutreachStatus}. */
export const STATUS_LABELS: Record<OutreachStatus, string> = {
  SCHEDULED: 'Planifiée',
  IN_PROGRESS: 'En cours',
  FINISHED: 'Terminée',
  CANCELLED: 'Annulée',
};

/** Badge tone (see global `.pill--*`) per status. */
export const STATUS_TONES: Record<OutreachStatus, string> = {
  SCHEDULED: 'blue',
  IN_PROGRESS: 'amber',
  FINISHED: 'green',
  CANCELLED: 'grey',
};

/** The person responsible for an outreach (subset of a profile). */
export interface OutreachManager {
  uuid: string;
  name: string;
}

/**
 * A commune, mapped from the backend `CityResponse` (nested inside
 * `OutreachResponse.city` and `ContactEntryResponse.city`). Present only when a
 * known commune is linked; otherwise a free-text `cityName`/`cityLabel` is used.
 */
export interface City {
  uuid: string;
  officialName: string;
  postalCode: string;
  departmentName: string;
  departmentCode: string;
  inseeCode: number | null;
  /** Assigned sector number, or `null` while awaiting assignment. */
  sector: number | null;
}

/** Sectors are numbered 1–12. */
export const SECTORS: readonly number[] = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Sector filter selection: every sector, a specific one (1–12), or `UNASSIGNED`
 * for outreaches with no sector (no linked commune, or one awaiting assignment).
 */
export type SectorFilter = 'ALL' | 'UNASSIGNED' | number;

/**
 * All filters the sorties list applies server-side, mapped to the backend's
 * `OutreachFilter`. Sentinel `'ALL'`/empty values mean "no constraint".
 */
export interface OutreachFilter {
  /** Free-text search across name, lieu, commune… (`search`). */
  search: string;
  status: OutreachStatus | 'ALL';
  sector: SectorFilter;
  /** Responsible profile's uuid, or `'ALL'`. */
  managedByUuid: string;
  /** Date lower bound, `YYYY-MM-DD`, or '' for none. */
  minDate: string;
  /** Date upper bound, `YYYY-MM-DD`, or '' for none. */
  maxDate: string;
}

/** A filter with no constraints — the list's default and reset target. */
export const EMPTY_OUTREACH_FILTER: OutreachFilter = {
  search: '',
  status: 'ALL',
  sector: 'ALL',
  managedByUuid: 'ALL',
  minDate: '',
  maxDate: '',
};

/** One server-side page of outreaches, mapped from the Spring `Page<T>` envelope. */
export interface OutreachPage {
  items: Outreach[];
  /** `true` when this is the final page (no more to load). */
  last: boolean;
  /** Total number of outreaches matching the filter across all pages. */
  totalElements: number;
}

/** An outreach event, mapped from the backend `OutreachResponse`. */
export interface Outreach {
  uuid: string;
  name: string;
  location: string;
  /** Linked commune, or `null` when none is set. */
  city: City | null;
  /** Display name for the linked city: commune's official name, else the
   * free-text label, else empty. Derived in the adapter. */
  cityName: string;
  /** ISO datetime. */
  startTime: string | null;
  /** ISO datetime. */
  endTime: string | null;
  /** Read-only, computed by the backend from the schedule. */
  status: OutreachStatus;
  /** Read-only, computed by the backend from contact entries. */
  totalParticipants: number | null;
  managedBy: OutreachManager | null;
}

/**
 * Editable fields when creating or updating an outreach (`OutreachRequest`).
 * The backend splits the schedule into a calendar `date` plus wall-clock
 * `startTime`/`endTime`; `status` and `totalParticipants` are no longer sent —
 * they are derived server-side.
 */
export interface OutreachInput {
  name: string;
  location: string;
  /** Calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Wall-clock time, `HH:MM`. */
  startTime: string;
  /** Wall-clock time, `HH:MM`. */
  endTime: string;
  managedByUuid: string | null;
}

/** Selectable manager option for the form. */
export interface ManagerOption {
  uuid: string;
  label: string;
}

/** Kind of person met during an outreach. */
export type ContactType = 'CONTACT' | 'CONVERSION';

/** French labels for {@link ContactType}. */
export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  CONTACT: 'Contact',
  CONVERSION: 'Conversion',
};

/** Badge tone (see global `.pill--*`) per contact type. */
export const CONTACT_TYPE_TONES: Record<ContactType, string> = {
  CONTACT: 'grey',
  CONVERSION: 'green',
};

/** Marital / civil situation of a contact. */
export type CivilState =
  | 'MARRIED'
  | 'SINGLE'
  | 'DIVORCED'
  | 'SEPARATED'
  | 'WIDOW'
  | 'COHABITATION'
  | 'MISSING_INFORMATION';

/** French labels for {@link CivilState}. */
export const CIVIL_STATE_LABELS: Record<CivilState, string> = {
  MARRIED: 'Marié(e)',
  SINGLE: 'Célibataire',
  DIVORCED: 'Divorcé(e)',
  SEPARATED: 'Séparé(e)',
  WIDOW: 'Veuf(ve)',
  COHABITATION: 'Concubinage',
  MISSING_INFORMATION: 'Non renseigné',
};

/** Selectable civil-state options, in display order. */
export const CIVIL_STATE_OPTIONS: readonly { value: CivilState; label: string }[] = [
  { value: 'SINGLE', label: CIVIL_STATE_LABELS.SINGLE },
  { value: 'MARRIED', label: CIVIL_STATE_LABELS.MARRIED },
  { value: 'COHABITATION', label: CIVIL_STATE_LABELS.COHABITATION },
  { value: 'DIVORCED', label: CIVIL_STATE_LABELS.DIVORCED },
  { value: 'SEPARATED', label: CIVIL_STATE_LABELS.SEPARATED },
  { value: 'WIDOW', label: CIVIL_STATE_LABELS.WIDOW },
  { value: 'MISSING_INFORMATION', label: CIVIL_STATE_LABELS.MISSING_INFORMATION },
];

/** Whether an attendee is a first-time guest or an existing department member. */
export type AttendanceType = 'GUEST' | 'MEMBER';

/** French labels for {@link AttendanceType}. */
export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  GUEST: 'Invité',
  MEMBER: 'Membre',
};

/** Badge tone (see global `.pill--*`) per attendance type. */
export const ATTENDANCE_TYPE_TONES: Record<AttendanceType, string> = {
  GUEST: 'grey',
  MEMBER: 'red',
};

/**
 * A presence recorded at an outreach, mapped from the backend
 * `AttendanceResponse`. A local subset — the outreach feature reads the
 * attendance endpoint directly rather than importing the attendance feature.
 */
export interface OutreachAttendance {
  uuid: string;
  firstname: string;
  lastname: string;
  invitedBy: string;
  type: AttendanceType;
}

/** A person met during an outreach, mapped from `ContactEntryResponse`. */
export interface ContactEntry {
  uuid: string;
  outreachUuid: string;
  type: ContactType;
  civilState: CivilState;
  firstname: string;
  lastname: string;
  /** Linked commune (in-region), or `null` for out-of-region entries. */
  city: City | null;
  /** Display name for the city: the commune's official name, else the
   * free-text label, else empty. Derived in the adapter. */
  cityName: string;
  evangelizedBy: string;
  phoneNumber: string;
  observations: string;
}
