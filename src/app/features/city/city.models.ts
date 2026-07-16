/** A commune record, mapped from the backend `CityResponse`. */
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

/** One server-side page of cities, mapped from the Spring `Page<T>` envelope. */
export interface CityPage {
  items: City[];
  /** `true` when this is the final page (no more to load). */
  last: boolean;
  /** Total number of communes across all pages. */
  totalElements: number;
}

/**
 * A référentiel search hit, mapped from `CitySuggestion`. Informational only —
 * suggestions carry no uuid and are not directly assignable; `inDatabase` tells
 * whether the commune is already tracked.
 */
export interface CitySuggestion {
  label: string;
  inseeCode: number | null;
  inDatabase: boolean;
}
