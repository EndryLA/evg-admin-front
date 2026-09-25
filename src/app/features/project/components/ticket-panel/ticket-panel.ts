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

/**
 * Modal for one ticket: every field, plus the suggestions it takes into
 * account. With no {@link ticket} it creates one in {@link project}.
 */
@Component({
  selector: 'app-ticket-panel',
  imports: [ReactiveFormsModule, RouterLink, ConfirmDialog, SuggestionPicker, TagInput],
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

  protected readonly isNew = computed(() => this.ticket() === null);
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
    () => !this.isNew() && this.auth.hasAnyRole(ACCESS.suggestionReview),
  );
  /** Mirrors the backend: the ticket's author or whoever manages the project. */
  protected readonly canDelete = computed(() => {
    const t = this.ticket();
    if (!t) {
      return false;
    }
    const me = this.auth.currentUser()?.profileUuid;
    return this.project().canManage || (!!me && t.createdBy?.uuid === me);
  });

  ngOnInit(): void {
    const t = this.ticket();
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
    const t = this.ticket();
    const request = t
      ? this.service.update(t.uuid, input)
      : this.service.create(this.project().uuid, input);
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (result) => {
        this.busy.set(false);
        this.form.markAsPristine();
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

  protected onDelete(): void {
    const t = this.ticket();
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
