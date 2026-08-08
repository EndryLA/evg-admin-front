import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { unformatPhone } from '../../../../shared/util/text.util';
import { ContactFields } from '../../components/contact-fields/contact-fields';
import { ContactEditTokenStore } from '../../../../core/contact-edit/contact-edit-token.store';
import { attendToBool, buildContactForm, EMPTY_CITY } from '../../contact-form.util';
import { ContactService } from '../../contact.service';
import type { CivilState, ContactType } from '../../contact.models';

/**
 * Public, unauthenticated form (`/sortie/:uuid/contact`) for recording a person
 * met during an outreach — filled in by whoever evangelized them. Submits to the
 * outreach's public contact endpoint and shows a confirmation.
 *
 * On the first submission the backend mints an edit token, stored per outreach so
 * the submitter can come back and modify their contacts (see the "mes contacts"
 * page) while the outreach stays open.
 */
@Component({
  selector: 'app-public-contact-form',
  imports: [ReactiveFormsModule, NgOptimizedImage, ContactFields, RouterLink],
  templateUrl: './public-contact-form.html',
  styleUrl: './public-contact-form.scss',
})
export class PublicContactForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ContactService);
  private readonly tokens = inject(ContactEditTokenStore);
  private readonly router = inject(Router);

  /** Outreach id from the route, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly outreachName = signal('');

  protected readonly form = buildContactForm(this.fb);

  ngOnInit(): void {
    // Best-effort context: show which outreach this is, if the lookup succeeds.
    this.service.outreachName(this.uuid()).subscribe((name) => this.outreachName.set(name));
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
        type: v.type as ContactType,
        civilState: v.civilState as CivilState,
        // A picked suggestion carries an INSEE code; free text keeps its label.
        cityInseeCode: v.city.inseeCode,
        cityLabel: v.city.inseeCode == null ? v.city.label : null,
        evangelizedBy: v.evangelizedBy,
        // Stored bare, matching existing rows and the phone search filter.
        phoneNumber: unformatPhone(v.phoneNumber),
        wantsToAttendGF: attendToBool(v.wantsToAttendGF),
        wantsToAttendChurch: attendToBool(v.wantsToAttendChurch),
        observations: v.observations,
      }, this.tokens.read(this.uuid()))
      .subscribe({
        next: (token) => {
          // Remember the token so this person can edit their contacts later.
          if (token) {
            this.tokens.write(this.uuid(), token);
          }
          this.submitting.set(false);
          this.submitted.set(true);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(messageFromError(err, 'Envoi impossible. Veuillez réessayer.'));
        },
      });
  }

  /** Go to the editable list of contacts this person has submitted. */
  protected editMine(): void {
    this.router.navigate(['/sortie', this.uuid(), 'mes-contacts']);
  }

  /** Reset the form to accept another submission. */
  protected again(): void {
    this.form.reset({ type: '', civilState: '', city: { ...EMPTY_CITY } });
    this.submitted.set(false);
  }
}
