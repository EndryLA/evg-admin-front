import { Component, input } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';

import { CityAutocomplete } from '../../../../shared/ui/city-autocomplete/city-autocomplete';
import { formatPhoneFr, toNameCase } from '../../../../shared/util/text.util';
import { CIVIL_STATE_OPTIONS } from '../../contact.models';
import type { ContactFormGroup } from '../../contact-form.util';

/**
 * The contact field group (name, type, civil state, city, phone, evangelizer,
 * observations), shared by the public create form and the anonymous edit form.
 * Purely presentational — it renders and lightly formats the controls; the
 * parent owns the form instance, submission, and any surrounding chrome.
 *
 * Its `formControlName`s bind to the parent's form by reusing the ancestor
 * `FormGroupDirective` as this component's {@link ControlContainer}.
 */
@Component({
  selector: 'app-contact-fields',
  imports: [ReactiveFormsModule, CityAutocomplete],
  templateUrl: './contact-fields.html',
  styleUrl: './contact-fields.scss',
  viewProviders: [
    { provide: ControlContainer, useExisting: FormGroupDirective },
  ],
})
export class ContactFields {
  /** The form to render — built via `buildContactForm`. */
  readonly form = input.required<ContactFormGroup>();

  protected readonly civilStates = CIVIL_STATE_OPTIONS;

  /** Group the phone as `XX XX XX XX XX` while it is typed. */
  protected formatPhone(): void {
    const control = this.form().controls.phoneNumber;
    control.setValue(formatPhoneFr(control.value), { emitEvent: false });
  }

  /**
   * Capitalize a name field once the user leaves it — doing it per keystroke
   * would send the caret to the end mid-word.
   */
  protected capitalize(field: 'firstname' | 'lastname'): void {
    const control = this.form().controls[field];
    control.setValue(toNameCase(control.value.trim()), { emitEvent: false });
  }
}
