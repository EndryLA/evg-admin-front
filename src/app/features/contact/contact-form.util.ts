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
 * A person needs at least one of the two name fields — on the street either the
 * first or the last name may be all that was given, but not neither.
 */
export function nameGiven(group: AbstractControl): ValidationErrors | null {
  const firstname = (group.get('firstname')?.value as string | null)?.trim() ?? '';
  const lastname = (group.get('lastname')?.value as string | null)?.trim() ?? '';
  return firstname || lastname ? null : { nameRequired: true };
}

/**
 * The reactive form backing both the public contact form and the anonymous edit
 * form. Kept in one place so the shared {@link ContactFields} component and both
 * callers agree on the exact shape.
 */
/**
 * A "wants to attend" answer as the `<select>` holds it: `''` (nothing picked
 * yet — the "— Choisir —" placeholder), `'unknown'` ("Je ne sais pas"),
 * `'true'` (yes), or `'false'` (no). Native selects carry strings, so the
 * boolean/null is converted at the form boundary. Both `''` and `'unknown'`
 * mean "no answer" to the backend, which stores a plain nullable boolean.
 */
export type AttendChoice = '' | 'unknown' | 'true' | 'false';

/** Select string → the nullable boolean the backend expects. */
export function attendToBool(choice: AttendChoice): boolean | null {
  return choice === '' || choice === 'unknown' ? null : choice === 'true';
}

/**
 * Nullable boolean → the select string, for pre-filling the edit form. A stored
 * `null` maps back to `'unknown'`: the backend cannot tell "not answered" from
 * "Je ne sais pas", and showing the explicit answer avoids the field looking
 * unfilled on an already-saved contact.
 */
export function boolToAttend(value: boolean | null): AttendChoice {
  return value == null ? 'unknown' : value ? 'true' : 'false';
}

export function buildContactForm(fb: FormBuilder) {
  return fb.nonNullable.group(
    {
      firstname: [''],
      lastname: [''],
      type: ['' as ContactType | '', [Validators.required]],
      civilState: ['' as CivilState | '', [Validators.required]],
      // Optional: left empty, or free text when the commune is not in the list.
      city: [{ ...EMPTY_CITY } as CityValue],
      evangelizedBy: ['', [Validators.required]],
      phoneNumber: [''],
      wantsToAttendGF: ['' as AttendChoice],
      wantsToAttendChurch: ['' as AttendChoice],
      observations: [''],
    },
    { validators: [nameGiven] },
  );
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
