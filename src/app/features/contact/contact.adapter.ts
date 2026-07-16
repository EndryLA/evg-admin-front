import type {
  City,
  CivilState,
  Contact,
  ContactType,
  Page,
  PublicContactInput,
} from './contact.models';

/** Raw `CityResponse`, as nested in `ContactEntryResponse.city`. */
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

/** Raw Spring `Page<T>` wrapper. */
export interface RawPage<T> {
  content?: T[];
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  first?: boolean;
  last?: boolean;
}

/** Raw `PublicContactEntryRequest` sent to the backend. */
export interface RawPublicContactRequest {
  type: ContactType;
  civilState: CivilState;
  firstname?: string;
  lastname?: string;
  /** Send one of the two: `cityInseeCode` for a picked suggestion… */
  cityInseeCode?: number;
  /** …otherwise `cityLabel` for raw free text. Never both. */
  cityLabel?: string;
  evangelizedBy: string;
  phoneNumber?: string;
  observations?: string;
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
export function toContact(raw: RawContactEntry): Contact {
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

/** Map a raw Spring page of contact entries to a clean {@link Page}. */
export function toContactPage(raw: RawPage<RawContactEntry>): Page<Contact> {
  return {
    items: (raw.content ?? []).map(toContact),
    page: raw.number ?? 0,
    size: raw.size ?? 0,
    totalElements: raw.totalElements ?? 0,
    totalPages: raw.totalPages ?? 0,
    first: raw.first ?? true,
    last: raw.last ?? true,
  };
}

/** Map a public submission to the raw `PublicContactEntryRequest`. */
export function toRawPublicContactRequest(
  input: PublicContactInput,
): RawPublicContactRequest {
  const request: RawPublicContactRequest = {
    type: input.type,
    civilState: input.civilState,
    firstname: input.firstname.trim() || undefined,
    lastname: input.lastname.trim() || undefined,
    evangelizedBy: input.evangelizedBy.trim(),
    phoneNumber: input.phoneNumber.trim() || undefined,
    observations: input.observations.trim() || undefined,
  };

  // Send exactly one side: the INSEE code of a picked suggestion, else the raw
  // free-text label. A picked suggestion never also carries its label.
  if (input.cityInseeCode != null) {
    request.cityInseeCode = input.cityInseeCode;
  } else {
    const label = input.cityLabel?.trim();
    if (label) {
      request.cityLabel = label;
    }
  }

  return request;
}
