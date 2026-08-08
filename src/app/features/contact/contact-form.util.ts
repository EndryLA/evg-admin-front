import {
  Validators,
  type AbstractControl,
  type FormBuilder,
  type ValidationErrors,
} from '@angular/forms';

import type { CityValue } from '../../shared/ui/city-autocomplete/city-autocomplete';
import type { Contact, CivilState, ContactType } from './contact.models';

/** Initial/reset value for the city field: no pick, empty label. */
export const EMPTY_CITY: CityValue = { inseeCode: null, label: '' };

/**
 * The city must be an actual suggestion picked from the list — free text that
 * resolves to no INSEE code is rejected, so the entry always links a commune.
 */
export function cityPicked(control: AbstractControl): ValidationErrors | null {
  const value = control.value as CityValue | null;
  return value && value.inseeCode != null ? null : { cityRequired: true };
}

/**
 * The reactive form backing both the public contact form and the anonymous edit
 * form. Kept in one place so the shared {@link ContactFields} component and both
 * callers agree on the exact shape.
 */
/**
 * A tri-state "wants to attend" answer as the `<select>` holds it: `''` (not
 * answered → null), `'true'` (yes), or `'false'` (no). Native selects carry
 * strings, so the boolean/null is converted at the form boundary.
 */
export type AttendChoice = '' | 'true' | 'false';

/** Select string → the nullable boolean the backend expects. */
export function attendToBool(choice: AttendChoice): boolean | null {
  return choice === '' ? null : choice === 'true';
}

/** Nullable boolean → the select string, for pre-filling the edit form. */
export function boolToAttend(value: boolean | null): AttendChoice {
  return value == null ? '' : value ? 'true' : 'false';
}

export function buildContactForm(fb: FormBuilder) {
  return fb.nonNullable.group({
    firstname: [''],
    lastname: [''],
    type: ['CONTACT' as ContactType, [Validators.required]],
    civilState: ['' as CivilState | '', [Validators.required]],
    city: [{ ...EMPTY_CITY } as CityValue, [cityPicked]],
    evangelizedBy: ['', [Validators.required]],
    phoneNumber: [''],
    wantsToAttendGF: ['' as AttendChoice],
    wantsToAttendChurch: ['' as AttendChoice],
    observations: [''],
  });
}

export type ContactFormGroup = ReturnType<typeof buildContactForm>;

/** City field value that pre-fills the form when editing an existing contact. */
export function contactToCityValue(contact: Contact): CityValue {
  if (contact.city && contact.city.inseeCode != null) {
    return { inseeCode: contact.city.inseeCode, label: contact.city.officialName };
  }
  // Out-of-region entry kept as free text — no INSEE code to link.
  return { inseeCode: null, label: contact.cityName };
}
