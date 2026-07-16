import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ContactService } from '../../contact.service';
import {
  CIVIL_STATE_LABELS,
  CONTACT_TYPE_LABELS,
  CONTACT_TYPE_TONES,
  type Contact,
} from '../../contact.models';

/** Full-page, read-only detail for one contact (`/contacts/:uuid`). */
@Component({
  selector: 'app-contact-detail',
  imports: [RouterLink],
  host: { class: 'detail-page' },
  templateUrl: './contact-detail.html',
  styleUrl: './contact-detail.scss',
})
export class ContactDetail implements OnInit {
  private readonly service = inject(ContactService);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly contact = signal<Contact | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly outreachName = signal('');

  protected readonly fullName = computed(() => {
    const c = this.contact();
    if (!c) {
      return '';
    }
    return `${c.firstname} ${c.lastname}`.trim() || 'Contact';
  });
  protected readonly typeLabel = computed(() => {
    const c = this.contact();
    return c ? CONTACT_TYPE_LABELS[c.type] : '';
  });
  protected readonly typeTone = computed(() => {
    const c = this.contact();
    return c ? CONTACT_TYPE_TONES[c.type] : 'grey';
  });
  protected readonly civilStateLabel = computed(() => {
    const c = this.contact();
    return c ? CIVIL_STATE_LABELS[c.civilState] : '';
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const id = this.uuid();
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getOne(id).subscribe({
      next: (data) => {
        this.contact.set(data);
        this.loading.set(false);
        if (data.outreachUuid) {
          this.service
            .outreachName(data.outreachUuid)
            .subscribe((name) => this.outreachName.set(name));
        }
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement du contact impossible.'));
        this.loading.set(false);
      },
    });
  }
}
