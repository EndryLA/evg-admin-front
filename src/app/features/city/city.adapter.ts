import type { City, CityPage, CitySuggestion } from './city.models';

/** Raw Spring `Page<T>` envelope (only fields we consume). */
export interface RawPage<T> {
  content?: T[];
  last?: boolean;
  totalElements?: number;
}

/** Map a raw page of cities to the clean {@link CityPage}. */
export function toCityPage(raw: RawPage<RawCity>): CityPage {
  const items = (raw.content ?? []).map(toCity);
  return {
    items,
    last: raw.last ?? items.length === 0,
    totalElements: raw.totalElements ?? items.length,
  };
}

/** Raw `CityResponse`. */
export interface RawCity {
  uuid?: string;
  officialName?: string;
  postalCode?: string;
  departmentName?: string;
  departmentCode?: string;
  inseeCode?: number | null;
  sector?: number | null;
}

/** Raw `CitySuggestion`. */
export interface RawCitySuggestion {
  label?: string;
  inseeCode?: number | null;
  inDatabase?: boolean;
}

/** Map a raw city to the clean domain model. */
export function toCity(raw: RawCity): City {
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

/** Map a raw suggestion to the clean domain model. */
export function toCitySuggestion(raw: RawCitySuggestion): CitySuggestion {
  return {
    label: raw.label ?? '',
    inseeCode: raw.inseeCode ?? null,
    inDatabase: raw.inDatabase ?? false,
  };
}
