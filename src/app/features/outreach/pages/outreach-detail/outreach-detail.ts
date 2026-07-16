import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { formatDateFr, formatDateTimeFr } from '../../../../shared/util/date.util';
import { OutreachForm } from '../../components/outreach-form/outreach-form';
import { OutreachPresences } from '../../components/outreach-presences/outreach-presences';
import { OutreachService } from '../../outreach.service';
import {
  CIVIL_STATE_LABELS,
  CONTACT_TYPE_LABELS,
  CONTACT_TYPE_TONES,
  STATUS_LABELS,
  STATUS_TONES,
  type ContactEntry,
  type ContactType,
  type ManagerOption,
  type Outreach,
  type OutreachAttendance,
  type OutreachInput,
} from '../../outreach.models';

/**
 * Full-page detail for one outreach (`/sorties/:uuid`). Loads the outreach and
 * its contact entries, and hosts the edit modal and delete confirmation that
 * previously lived in the list's slide-over.
 */
@Component({
  selector: 'app-outreach-detail',
  imports: [RouterLink, OutreachForm, OutreachPresences, ConfirmDialog],
  host: { class: 'detail-page' },
  templateUrl: './outreach-detail.html',
  styleUrl: './outreach-detail.scss',
})
export class OutreachDetail implements OnInit {
  private readonly service = inject(OutreachService);
  private readonly router = inject(Router);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly outreach = signal<Outreach | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly contacts = signal<ContactEntry[]>([]);
  protected readonly contactsLoading = signal(true);
  protected readonly contactsError = signal<string | null>(null);

  protected readonly presences = signal<OutreachAttendance[]>([]);
  protected readonly presencesLoading = signal(true);
  protected readonly presencesError = signal<string | null>(null);

  protected readonly managers = signal<ManagerOption[]>([]);
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly deleting = signal(false);

  protected readonly fmtDate = formatDateFr;
  protected readonly fmtDateTime = formatDateTimeFr;

  protected readonly publicPresencePath = computed(() => `/sortie/${this.uuid()}/presence`);

  protected readonly statusLabel = computed(() => {
    const o = this.outreach();
    return o ? STATUS_LABELS[o.status] : '';
  });
  protected readonly statusTone = computed(() => {
    const o = this.outreach();
    return o ? STATUS_TONES[o.status] : 'grey';
  });

  protected typeLabel(type: ContactType): string {
    return CONTACT_TYPE_LABELS[type];
  }
  protected typeTone(type: ContactType): string {
    return CONTACT_TYPE_TONES[type];
  }
  protected civilStateLabel(entry: ContactEntry): string {
    return CIVIL_STATE_LABELS[entry.civilState];
  }
  protected contactName(entry: ContactEntry): string {
    return `${entry.firstname} ${entry.lastname}`.trim() || '—';
  }

  constructor() {
    this.service.managers().subscribe({
      next: (list) => this.managers.set(list),
      error: () => this.managers.set([]),
    });
  }

  ngOnInit(): void {
    // `uuid` (a required route input) is only bound after construction, so the
    // initial load must wait until here.
    this.load();
  }

  protected load(): void {
    const id = this.uuid();
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getOne(id).subscribe({
      next: (data) => {
        this.outreach.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement de la sortie impossible.'));
        this.loading.set(false);
      },
    });

    this.contactsLoading.set(true);
    this.contactsError.set(null);
    this.service.contactEntries(id).subscribe({
      next: (data) => {
        this.contacts.set(data);
        this.contactsLoading.set(false);
      },
      error: (err) => {
        this.contactsError.set(messageFromError(err, 'Chargement des contacts impossible.'));
        this.contactsLoading.set(false);
      },
    });

    this.presencesLoading.set(true);
    this.presencesError.set(null);
    this.service.attendances(id).subscribe({
      next: (data) => {
        this.presences.set(data);
        this.presencesLoading.set(false);
      },
      error: (err) => {
        this.presencesError.set(messageFromError(err, 'Chargement des présences impossible.'));
        this.presencesLoading.set(false);
      },
    });
  }

  protected openEdit(): void {
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
  }
  protected onSave(input: OutreachInput): void {
    const current = this.outreach();
    if (!current) {
      return;
    }
    this.saving.set(true);
    this.service.update(current.uuid, input).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.outreach.set(updated);
        this.formOpen.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  protected askDelete(): void {
    this.confirmOpen.set(true);
  }
  protected cancelDelete(): void {
    this.confirmOpen.set(false);
  }
  protected confirmDelete(): void {
    const current = this.outreach();
    if (!current) {
      return;
    }
    this.deleting.set(true);
    this.service.remove(current.uuid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmOpen.set(false);
        this.router.navigate(['/sorties']);
      },
      error: () => this.deleting.set(false),
    });
  }
}
