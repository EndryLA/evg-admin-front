/** Kind of person met during an outreach. */
export type ContactType = 'CONTACT' | 'CONVERSION';

/** French labels for {@link ContactType}. */
export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  CONTACT: 'Contact',
  CONVERSION: 'Conversion',
};

/** Labels used in spreadsheet exports — colour-coded to mirror the in-app pills. */
export const CONTACT_TYPE_EXPORT_LABELS: Record<ContactType, string> = {
  CONTACT: '🔵  Contact',
  CONVERSION: '🔴  Conversion',
};

/** Badge tone (see global `.pill--*`) per contact type. */
export const CONTACT_TYPE_TONES: Record<ContactType, string> = {
  CONTACT: 'blue',
  CONVERSION: 'red',
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

/**
 * A commune, mapped from the backend `CityResponse` (nested inside
 * `ContactEntryResponse.city`). Present only for in-region entries; out-of-region
 * entries carry a free-text {@link Contact.cityName} instead.
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
 * for contacts with no sector (out-of-region, or a commune awaiting assignment).
 */
export type SectorFilter = 'ALL' | 'UNASSIGNED' | number;

/**
 * All filters the contacts list can apply, mapped server-side to the backend's
 * `ContactEntryFilter`. Sentinel `'ALL'`/empty values mean "no constraint".
 */
export interface ContactFilter {
  /** Free-text search across name, phone, city… (`search`). */
  search: string;
  type: ContactType | 'ALL';
  sector: SectorFilter;
  /** Outreach date lower bound, `YYYY-MM-DD`, or '' for none. Set from the
   *  list's year navigator rather than by the user. */
  minDate: string;
  /** Outreach date upper bound, `YYYY-MM-DD`, or '' for none. See {@link minDate}. */
  maxDate: string;
}

/** A filter with no constraints — the list's default and reset target. */
export const EMPTY_CONTACT_FILTER: ContactFilter = {
  search: '',
  type: 'ALL',
  sector: 'ALL',
  minDate: '',
  maxDate: '',
};

/** A person met during an outreach, mapped from `ContactEntryResponse`. */
export interface Contact {
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
  /** Wants to attend the GF: yes/no, or `null` when not asked/answered. */
  wantsToAttendGF: boolean | null;
  /** Wants to attend church: yes/no, or `null` when not asked/answered. */
  wantsToAttendChurch: boolean | null;
  observations: string;
}

/**
 * The outreach a group of contacts belongs to — the subset of `OutreachResponse`
 * the grouped list and the Excel export need. Read straight off the grouped
 * endpoint, so no separate lookup is required.
 */
export interface GroupOutreach {
  uuid: string;
  name: string;
  location: string;
  /** Calendar day of the outreach, `YYYY-MM-DD`, or `null` when unknown. */
  date: string | null;
  /** Wall-clock start, `HH:mm:ss`, or `null`. */
  startTime: string | null;
  status: OutreachStatus;
  /** The outreach's commune: official name, else free-text label, else empty. */
  cityName: string;
  /** INSEE code of that commune, or `null` when it is only free text. */
  cityInseeCode: number | null;
  /** Head count recorded at clôture, or `null` when the sortie has none. */
  totalPresences: number | null;
}

/**
 * One outreach and the people met during it, mapped from the backend's
 * `OutreachContactEntries`. The counts are server-side totals for the applied
 * filter — they match `entries`, which the endpoint returns in full (it does
 * not paginate).
 */
export interface ContactGroup {
  outreach: GroupOutreach;
  /** Entries in this group — `contacts` + `conversions`. */
  total: number;
  contacts: number;
  conversions: number;
  entries: Contact[];
}

/** Fields a member of the public submits for an outreach (`PublicContactEntryRequest`). */
export interface PublicContactInput {
  type: ContactType;
  civilState: CivilState;
  firstname: string;
  lastname: string;
  /** INSEE code of a picked suggestion, or `null` for free-text-only. */
  cityInseeCode: number | null;
  /** Raw city label when no suggestion was picked; `null` otherwise. */
  cityLabel: string | null;
  evangelizedBy: string;
  phoneNumber: string;
  /** Wants to attend the GF: yes/no, or `null` when left unspecified. */
  wantsToAttendGF: boolean | null;
  /** Wants to attend church: yes/no, or `null` when left unspecified. */
  wantsToAttendChurch: boolean | null;
  observations: string;
}

/** Lifecycle status of an outreach (mirrors the backend `OutreachStatus`). */
export type OutreachStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

/** French labels for {@link OutreachStatus}. */
export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  SCHEDULED: 'Planifiée',
  IN_PROGRESS: 'En cours',
  FINISHED: 'Terminée',
  CANCELLED: 'Annulée',
};

/** Badge tone (see global `.pill--*`) per outreach status. */
export const OUTREACH_STATUS_TONES: Record<OutreachStatus, string> = {
  SCHEDULED: 'blue',
  IN_PROGRESS: 'amber',
  FINISHED: 'green',
  CANCELLED: 'grey',
};

/**
 * Result of the anonymous "my contacts" lookup: the outreach status (so the
 * front can drop the token once it is no longer open) and the submitter's own
 * contacts — non-empty only while the outreach is IN_PROGRESS.
 */
export interface MyContacts {
  status: OutreachStatus;
  contacts: Contact[];
}

