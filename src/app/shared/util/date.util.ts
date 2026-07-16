/** Date helpers shared across features. All display output is French `DD/MM/YYYY`. */

const PLACEHOLDER = '—';

/** Parse `YYYY-MM-DD` (as local, avoiding UTC off-by-one) or any ISO datetime. */
function parseDate(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `03/09/1998`, or `—` when absent/invalid. */
export function formatDateFr(value?: string | null): string {
  if (!value) {
    return PLACEHOLDER;
  }
  const date = parseDate(value);
  if (!date) {
    return PLACEHOLDER;
  }
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** Match a bare clock-time, `HH:mm` or `HH:mm:ss`, as the backend sends for
 *  outreach `startTime`/`endTime` (a Java `LocalTime`, with no date part). */
const TIME_ONLY = /^(\d{2}):(\d{2})(?::\d{2})?$/;

/** `14:30`, or `—`. For bare clock-times carrying no date. */
export function formatTimeFr(value?: string | null): string {
  if (!value) {
    return PLACEHOLDER;
  }
  const match = TIME_ONLY.exec(value.trim());
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  const date = parseDate(value);
  if (!date) {
    return PLACEHOLDER;
  }
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

/** `03/09/1998 · 14:30`, or `—`. For datetime values like outreach times.
 *  Falls back to `14:30` when the value carries a time but no date. */
export function formatDateTimeFr(value?: string | null): string {
  if (!value) {
    return PLACEHOLDER;
  }
  if (TIME_ONLY.test(value.trim())) {
    return formatTimeFr(value);
  }
  const date = parseDate(value);
  if (!date) {
    return PLACEHOLDER;
  }
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()} · ${hh}:${min}`;
}

/** Four-digit year, or `—`. */
export function yearOf(value?: string | null): string {
  if (!value) {
    return PLACEHOLDER;
  }
  const date = parseDate(value);
  return date ? String(date.getFullYear()) : PLACEHOLDER;
}

/** Whole years since `birthDate`, e.g. `27 ans`. Empty string when unknown. */
export function ageLabel(birthDate?: string | null): string {
  if (!birthDate) {
    return '';
  }
  const date = parseDate(birthDate);
  if (!date) {
    return '';
  }
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDelta = now.getMonth() - date.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? `${age} ans` : '';
}
