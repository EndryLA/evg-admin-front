import { NgOptimizedImage } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ContactEditTokenStore } from '../../../../core/contact-edit/contact-edit-token.store';
import { messageFromError } from '../../../../core/http/http-error.util';
import { formatPhoneFr, unformatPhone } from '../../../../shared/util/text.util';
import { ContactFields } from '../../components/contact-fields/contact-fields';
import {
  attendToBool,
  boolToAttend,
  buildContactForm,
  contactToCityValue,
} from '../../contact-form.util';
import { ContactService } from '../../contact.service';
import {
  CONTACT_TYPE_LABELS,
  type CivilState,
  type Contact,
  type ContactType,
} from '../../contact.models';

/** What the page is currently doing — drives which section renders. */
type ViewState = 'loading' | 'error' | 'closed' | 'empty' | 'list';

/**
 * Public, unauthenticated page (`/sortie/:uuid/mes-contacts`) where a submitter
 * reviews and edits the contacts they added, using the edit token stored on
 * their device. If the outreach is closed (or no token is held), the token is
 * dropped and nothing editable is shown.
 */
@Component({
  selector: 'app-public-contact-edit',
  imports: [ReactiveFormsModule, NgOptimizedImage, ContactFields],
  templateUrl: './public-contact-edit.html',
  styleUrl: './public-contact-edit.scss',
})
export class PublicContactEdit implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ContactService);
  private readonly tokens = inject(ContactEditTokenStore);
  private readonly router = inject(Router);

  /** Outreach id from the route, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly state = signal<ViewState>('loading');
  protected readonly error = signal<string | null>(null);
  protected readonly contacts = signal<Contact[]>([]);

  /** The contact being edited, or null when showing the list. */
  protected readonly editing = signal<Contact | null>(null);
  protected readonly saving = signal(false);
  protected readonly editError = signal<string | null>(null);

  protected readonly typeLabels = CONTACT_TYPE_LABELS;
  protected readonly form = buildContactForm(this.fb);

  private token: string | null = null;

  ngOnInit(): void {
    this.token = this.tokens.read(this.uuid());
    if (!this.token) {
      // Nothing stored (or expired) — treat as no contacts to edit.
      this.state.set('empty');
      return;
    }
    this.load();
  }

  protected load(): void {
    const token = this.token;
    if (!token) {
      this.state.set('empty');
      return;
    }
    this.state.set('loading');
    this.error.set(null);
    this.service.myContacts(this.uuid(), token).subscribe({
      next: (result) => {
        if (result.status !== 'IN_PROGRESS') {
          // Editing window is over — drop the token so it stops resurfacing.
          this.tokens.clear(this.uuid());
          this.token = null;
          this.state.set('closed');
          return;
        }
        this.contacts.set(result.contacts);
        this.state.set(result.contacts.length ? 'list' : 'empty');
      },
      error: (err) => {
        this.error.set(messageFromError(err, 'Chargement impossible. Veuillez réessayer.'));
        this.state.set('error');
      },
    });
  }

  protected contactName(c: Contact): string {
    return `${c.firstname} ${c.lastname}`.trim() || '—';
  }

  /** Open the edit form for a contact, pre-filled with its current values. */
  protected startEdit(contact: Contact): void {
    this.editError.set(null);
    this.form.reset({
      firstname: contact.firstname,
      lastname: contact.lastname,
      type: contact.type,
      civilState: contact.civilState,
      city: contactToCityValue(contact),
      evangelizedBy: contact.evangelizedBy,
      phoneNumber: formatPhoneFr(contact.phoneNumber),
      wantsToAttendGF: boolToAttend(contact.wantsToAttendGF),
      wantsToAttendChurch: boolToAttend(contact.wantsToAttendChurch),
      observations: contact.observations,
    });
    this.editing.set(contact);
  }

  protected cancelEdit(): void {
    this.editing.set(null);
  }

  protected saveEdit(): void {
    const target = this.editing();
    const token = this.token;
    if (!target || !token || this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.editError.set(null);
    this.service
      .updatePublic(this.uuid(), target.uuid, token, {
        firstname: v.firstname,
        lastname: v.lastname,
        type: v.type as ContactType,
        civilState: v.civilState as CivilState,
        cityInseeCode: v.city.inseeCode,
        cityLabel: v.city.inseeCode == null ? v.city.label : null,
        evangelizedBy: v.evangelizedBy,
        phoneNumber: unformatPhone(v.phoneNumber),
        wantsToAttendGF: attendToBool(v.wantsToAttendGF),
        wantsToAttendChurch: attendToBool(v.wantsToAttendChurch),
        observations: v.observations,
      })
      .subscribe({
        next: (updated) => {
          this.contacts.update((list) =>
            list.map((c) => (c.uuid === updated.uuid ? updated : c)),
          );
          this.saving.set(false);
          this.editing.set(null);
        },
        error: (err) => {
          this.saving.set(false);
          this.editError.set(messageFromError(err, 'Enregistrement impossible. Veuillez réessayer.'));
        },
      });
  }

  /** Back to the contact form. */
  protected addMore(): void {
    this.router.navigate(['/sortie', this.uuid(), 'contact']);
  }
}
