import { Component, computed, inject, input, type OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ACCESS } from '../../../../core/auth/access';
import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { formatDateFr } from '../../../../shared/util/date.util';
import {
  LINKED_SUGGESTION_LABELS,
  LINKED_SUGGESTION_TONES,
  personName,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  type Project,
  type Ticket,
  type TicketInput,
  type TicketPriority,
  type TicketStatus,
} from '../../project.models';
import { TicketService } from '../../ticket.service';
import { SuggestionPicker } from '../suggestion-picker/suggestion-picker';
import { TagInput } from '../tag-input/tag-input';
import { TicketAttachments } from '../ticket-attachments/ticket-attachments';

/**
 * Modal for one ticket: every field, its attachments and the suggestions it
 * takes into account. With no {@link ticket} it creates one in {@link project}
 * (files picked meanwhile are uploaded right after). Read-only for viewers.
 */
@Component({
  selector: 'app-ticket-panel',
  imports: [ReactiveFormsModule, RouterLink, ConfirmDialog, SuggestionPicker, TagInput, TicketAttachments],
  host: { class: 'modal-form', '(keydown.escape)': 'close.emit()' },
  templateUrl: './ticket-panel.html',
  styleUrl: './ticket-panel.scss',
})
export class TicketPanel implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TicketService);
  private readonly auth = inject(AuthService);

  /** Ticket to show, or `null` to create one. */
  readonly ticket = input<Ticket | null>(null);
  readonly project = input.required<Project>();
  /** Tags already used in the project, suggested while typing. */
  readonly tagSuggestions = input<string[]>([]);

  readonly saved = output<Ticket>();
  readonly deleted = output<Ticket>();
  readonly close = output<void>();

  /**
   * Ticket created by this modal whose file upload then failed: the modal stays
   * open on it (instead of the create form) so it can't be created twice.
   */
  private readonly created = signal<Ticket | null>(null);
  protected readonly current = computed(() => this.ticket() ?? this.created());
  protected readonly isNew = computed(() => this.current() === null);
  /** Viewers see everything but change nothing. */
  protected readonly readOnly = computed(() => !this.project().canWork);
  /** Files picked before the ticket exists. */
  private readonly pendingFiles = signal<File[]>([]);
  /** Viewers can't be assigned; a current assignee stays listed whatever their role. */
  protected readonly assignable = computed(() =>
    this.project().members.filter(
      (m) => m.role !== 'VIEWER' || m.person.uuid === this.current()?.assignee?.uuid,
    ),
  );
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmDelete = signal(false);
  protected readonly linking = signal(false);

  protected readonly statuses = TICKET_STATUSES;
  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;
  protected readonly suggestionLabels = LINKED_SUGGESTION_LABELS;
  protected readonly suggestionTones = LINKED_SUGGESTION_TONES;
  protected readonly personName = personName;
  protected readonly formatDate = formatDateFr;

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    typeUuid: [''],
    status: ['TODO' as TicketStatus],
    priority: ['NORMAL' as TicketPriority],
    assigneeUuid: [''],
    phaseUuid: [''],
    dueDate: [''],
    tags: [[] as string[]],
  });

  protected readonly canLink = computed(
    () => !this.isNew() && !this.readOnly() && this.auth.hasAnyRole(ACCESS.suggestionReview),
  );
  /** Mirrors the backend: managers delete any ticket, contributors their own. */
  protected readonly canDelete = computed(() => {
    const t = this.current();
    if (!t) {
      return false;
    }
    const me = this.auth.currentUser()?.profileUuid;
    return this.project().canManage || (this.project().canWork && !!me && t.createdBy?.uuid === me);
  });

  ngOnInit(): void {
    const t = this.ticket();
    if (this.readOnly()) {
      this.form.disable();
    }
    this.form.patchValue({
      title: t?.title ?? '',
      description: t?.description ?? '',
      typeUuid: t?.type?.uuid ?? '',
      status: t?.status ?? 'TODO',
      priority: t?.priority ?? 'NORMAL',
      assigneeUuid: t?.assignee?.uuid ?? '',
      phaseUuid: t?.phase?.uuid ?? '',
      dueDate: t?.dueDate ?? '',
      tags: t?.tags ?? [],
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const input: TicketInput = {
      title: v.title,
      description: v.description,
      typeUuid: v.typeUuid || null,
      status: v.status,
      priority: v.priority,
      assigneeUuid: v.assigneeUuid || null,
      phaseUuid: v.phaseUuid || null,
      dueDate: v.dueDate || null,
      tags: v.tags,
    };
    const t = this.current();
    const request = t
      ? this.service.update(t.uuid, input)
      : this.service.create(this.project().uuid, input);
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (result) => {
        this.form.markAsPristine();
        if (!t && this.pendingFiles().length) {
          this.uploadAfterCreate(result);
          return;
        }
        this.busy.set(false);
        this.saved.emit(result);
        if (!t) {
          this.close.emit();
        }
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(messageFromError(err, 'Enregistrement du ticket impossible.'));
      },
    });
  }

  protected onPendingFiles(files: File[]): void {
    this.pendingFiles.set(files);
  }

  /** Attachment added/removed on an existing ticket: the parent refreshes its row. */
  protected onAttachmentsChanged(ticket: Ticket): void {
    if (this.created()) {
      this.created.set(ticket);
    }
    this.saved.emit(ticket);
  }

  /** New ticket saved: send the files picked meanwhile, then close. */
  private uploadAfterCreate(ticket: Ticket): void {
    this.service.addAttachments(ticket.uuid, this.pendingFiles()).subscribe({
      next: (withFiles) => {
        this.busy.set(false);
        this.saved.emit(withFiles);
        this.close.emit();
      },
      error: (err) => {
        // The ticket exists: stay on it so the files can be sent again.
        this.busy.set(false);
        this.pendingFiles.set([]);
        this.created.set(ticket);
        this.saved.emit(ticket);
        this.error.set(
          `Ticket ${ticket.key} créé, mais les fichiers n'ont pas pu être envoyés : ` +
            messageFromError(err, 'erreur inconnue.'),
        );
      },
    });
  }

  protected onDelete(): void {
    const t = this.current();
    if (!t) {
      return;
    }
    this.busy.set(true);
    this.service.remove(t.uuid).subscribe({
      next: () => {
        this.busy.set(false);
        this.deleted.emit(t);
      },
      error: (err) => {
        this.busy.set(false);
        this.confirmDelete.set(false);
        this.error.set(messageFromError(err, 'Suppression impossible.'));
      },
    });
  }

  protected onLinked(ticket: Ticket): void {
    this.linking.set(false);
    this.saved.emit(ticket);
  }
}
