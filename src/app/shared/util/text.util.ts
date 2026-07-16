/** Text-input formatting helpers shared across features. */

/** Digits of a French phone number, once grouping/spacing is stripped. */
const PHONE_DIGITS = 10;

/**
 * Group a phone number as `XX XX XX XX XX` for display in an input.
 * Non-digits are dropped and anything past {@link PHONE_DIGITS} is ignored, so
 * the helper is safe to run on every keystroke.
 */
export function formatPhoneFr(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, PHONE_DIGITS);
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ');
}

/** Strip a formatted phone back to bare digits, the form the backend stores. */
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Group a stored phone as `XX XX XX XX XX` for display, or `—` when absent.
 * Anything that is not exactly {@link PHONE_DIGITS} digits (a foreign or
 * malformed number) is shown untouched rather than truncated.
 */
export function displayPhoneFr(value?: string | null): string {
  if (!value?.trim()) {
    return '—';
  }
  const digits = unformatPhone(value);
  return digits.length === PHONE_DIGITS ? formatPhoneFr(digits) : value.trim();
}

/**
 * Capitalize a person's name: `Xxxxx`, and `Xxxxx-Xxxxx` for compound names.
 * Each part split on a hyphen, space, or apostrophe is capitalized, so
 * `jean-pierre` → `Jean-Pierre` and `d'artagnan` → `D'Artagnan`.
 */
export function toNameCase(value: string): string {
  return value
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[-\s'’])(\p{L})/gu, (_, separator: string, letter: string) =>
      separator + letter.toLocaleUpperCase('fr-FR'),
    );
}
