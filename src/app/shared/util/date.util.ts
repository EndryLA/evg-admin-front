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

const WEEKDAYS_FR = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
];

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** `samedi 3 septembre 1998` — spelled out, for headline dates. Returns `—`
 *  when absent/invalid. Written out rather than left to `toLocaleDateString`,
 *  which depends on the runtime's locale data. */
export function formatLongDateFr(value?: string | null): string {
  if (!value) {
    return PLACEHOLDER;
  }
  const date = parseDate(value);
  if (!date) {
    return PLACEHOLDER;
  }
  // 1ᵉʳ, then plain numerals — French ordinals only mark the first of the month.
  const day = date.getDate() === 1 ? '1ᵉʳ' : String(date.getDate());
  return `${WEEKDAYS_FR[date.getDay()]} ${day} ${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

/** `03/09/98` — two-digit year, for tight rows where the century is obvious.
 *  Returns `—` when absent/invalid. */
export function formatDateShortFr(value?: string | null): string {
  if (!value) {
    return PLACEHOLDER;
  }
  const date = parseDate(value);
  if (!date) {
    return PLACEHOLDER;
  }
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/** `03/09/98 - 14:30` — a short date and a clock-time on one line, to save space
 *  on mobile. Falls back to the short date alone when the time is absent, or `—`
 *  when there's no date. */
export function formatDateTimeShortFr(date?: string | null, time?: string | null): string {
  const d = formatDateShortFr(date);
  if (d === PLACEHOLDER) {
    return PLACEHOLDER;
  }
  const t = time ? formatTimeFr(time) : PLACEHOLDER;
  return t === PLACEHOLDER ? d : `${d} - ${t}`;
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
