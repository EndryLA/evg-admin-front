import { NgOptimizedImage } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';

import { messageFromError } from '../../../../core/http/http-error.util';
import {
  CityAutocomplete,
  type CityValue,
} from '../../../../shared/ui/city-autocomplete/city-autocomplete';
import {
  formatPhoneFr,
  toNameCase,
  unformatPhone,
} from '../../../../shared/util/text.util';
import { ContactService } from '../../contact.service';
import {
  CIVIL_STATE_OPTIONS,
  type CivilState,
  type ContactType,
} from '../../contact.models';

/** Initial/reset value for the city field: no pick, empty label. */
const EMPTY_CITY: CityValue = { inseeCode: null, label: '' };

/**
 * The city must be an actual suggestion picked from the list — free text that
 * resolves to no INSEE code is rejected, so the entry always links a commune.
 */
function cityPicked(control: AbstractControl): ValidationErrors | null {
  const value = control.value as CityValue | null;
  return value && value.inseeCode != null ? null : { cityRequired: true };
}

/**
 * Public, unauthenticated form (`/sortie/:uuid/contact`) for recording a person
 * met during an outreach — filled in by whoever evangelized them. Submits to the
 * outreach's public contact endpoint and shows a confirmation.
 */
@Component({
  selector: 'app-public-contact-form',
  imports: [ReactiveFormsModule, NgOptimizedImage, CityAutocomplete],
  templateUrl: './public-contact-form.html',
  styleUrl: './public-contact-form.scss',
})
export class PublicContactForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ContactService);

  /** Outreach id from the route, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly civilStates = CIVIL_STATE_OPTIONS;

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly outreachName = signal('');

  protected readonly form = this.fb.nonNullable.group({
    firstname: [''],
    lastname: [''],
    type: ['CONTACT' as ContactType, [Validators.required]],
    civilState: ['' as CivilState | '', [Validators.required]],
    city: [{ ...EMPTY_CITY } as CityValue, [cityPicked]],
    evangelizedBy: ['', [Validators.required]],
    phoneNumber: [''],
    observations: [''],
  });

  ngOnInit(): void {
    // Best-effort context: show which outreach this is, if the lookup succeeds.
    this.service.outreachName(this.uuid()).subscribe((name) => this.outreachName.set(name));
  }

  /** Group the phone as `XX XX XX XX XX` while it is typed. */
  protected formatPhone(): void {
    const control = this.form.controls.phoneNumber;
    control.setValue(formatPhoneFr(control.value), { emitEvent: false });
  }

  /**
   * Capitalize a name field once the user leaves it — doing it per keystroke
   * would send the caret to the end mid-word.
   */
  protected capitalize(field: 'firstname' | 'lastname'): void {
    const control = this.form.controls[field];
    control.setValue(toNameCase(control.value.trim()), { emitEvent: false });
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.service
      .submitPublic(this.uuid(), {
        firstname: v.firstname,
        lastname: v.lastname,
        type: v.type,
        civilState: v.civilState as CivilState,
        // A picked suggestion carries an INSEE code; free text keeps its label.
        cityInseeCode: v.city.inseeCode,
        cityLabel: v.city.inseeCode == null ? v.city.label : null,
        evangelizedBy: v.evangelizedBy,
        // Stored bare, matching existing rows and the phone search filter.
        phoneNumber: unformatPhone(v.phoneNumber),
        observations: v.observations,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(messageFromError(err, 'Envoi impossible. Veuillez réessayer.'));
        },
      });
  }

  /** Reset the form to accept another submission. */
  protected again(): void {
    this.form.reset({ type: 'CONTACT', civilState: '', city: { ...EMPTY_CITY } });
    this.submitted.set(false);
  }
}
