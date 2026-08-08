/** Comparing communes across features, where the data is unevenly identified. */

/**
 * A commune identified as precisely as the record allows: by INSEE code when a
 * known commune is linked, otherwise only by its free-text label.
 */
export interface CityRef {
  inseeCode: number | null;
  name: string;
}

/** Fold a city label for comparison: accent-free, case-free, letters/digits only,
 *  so `Saint-Étienne`, `saint etienne` and `SAINT ETIENNE` all match. */
function foldCityName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Whether two records point at the same commune. INSEE codes decide it when both
 * sides carry one; otherwise the labels are compared loosely.
 *
 * Returns `true` when either side is unidentified (no code and no label) — an
 * unknown city is never reported as a mismatch, so missing data isn't flagged as
 * a difference.
 */
export function isSameCity(a: CityRef, b: CityRef): boolean {
  if (a.inseeCode != null && b.inseeCode != null) {
    return a.inseeCode === b.inseeCode;
  }
  const left = foldCityName(a.name);
  const right = foldCityName(b.name);
  if (!left || !right) {
    return true;
  }
  return left === right;
}
