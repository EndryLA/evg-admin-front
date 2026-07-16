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
  civilState: CivilState | 'ALL';
  sector: SectorFilter;
  evangelizedBy: string;
  /** Outreach date lower bound, `YYYY-MM-DD`, or '' for none. */
  minDate: string;
  /** Outreach date upper bound, `YYYY-MM-DD`, or '' for none. */
  maxDate: string;
}

/** A filter with no constraints — the list's default and reset target. */
export const EMPTY_CONTACT_FILTER: ContactFilter = {
  search: '',
  type: 'ALL',
  civilState: 'ALL',
  sector: 'ALL',
  evangelizedBy: '',
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
  observations: string;
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
  observations: string;
}

/** A page of results, mapped from a Spring `Page<T>` wrapper. */
export interface Page<T> {
  items: T[];
  /** Zero-based page index. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
