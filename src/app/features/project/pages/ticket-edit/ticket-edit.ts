import { Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { messageFromError } from '../../../../core/http/http-error.util';
import { TagInput } from '../../components/tag-input/tag-input';
import { TicketAttachments } from '../../components/ticket-attachments/ticket-attachments';
import { ProjectService } from '../../project.service';
import {
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

/** History state handed to the detail page when files failed after a creation. */
export interface TicketEditNotice {
  uploadError?: string;
}

/**
 * Full-page ticket form: creates a ticket in the project (route `nouveau`, files
 * picked meanwhile are uploaded right after) or edits one (`…/modifier`). Saving
 * lands on the ticket's detail page, replacing the form in the history so « back »
 * doesn't reopen it. Managers and contributors only.
 */
@Component({
  selector: 'app-ticket-edit',
  imports: [ReactiveFormsModule, RouterLink, TagInput, TicketAttachments],
  templateUrl: './ticket-edit.html',
  styleUrl: './ticket-edit.scss',
})
export class TicketEdit implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly ticketService = inject(TicketService);
  private readonly router = inject(Router);

  /** Project id; ticket id only when editing. */
  readonly uuid = input.required<string>();
  readonly ticketUuid = input<string>();

  protected readonly project = signal<Project | null>(null);
  protected readonly ticket = signal<Ticket | null>(null);
  /** Tags already used in the project, suggested while typing. */
  protected readonly tagSuggestions = signal<string[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly pendingFiles = signal<File[]>([]);

  protected readonly isNew = computed(() => !this.ticketUuid());
  /** Viewers can't be assigned; a current assignee stays listed whatever their role. */
  protected readonly assignable = computed(() =>
    (this.project()?.members ?? []).filter(
      (m) => m.role !== 'VIEWER' || m.person.uuid === this.ticket()?.assignee?.uuid,
    ),
  );
  /** Where « Annuler » and the back link go. */
  protected readonly backLink = computed(() =>
    this.isNew()
      ? ['/projets', this.uuid()]
      : ['/projets', this.uuid(), 'tickets', this.ticketUuid()!],
  );

  protected readonly statuses = TICKET_STATUSES;
  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;
  protected readonly personName = personName;

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

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const ticketUuid = this.ticketUuid();
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      project: this.projectService.getOne(this.uuid()),
      tickets: this.ticketService.listForProject(this.uuid()),
      ticket: ticketUuid ? this.ticketService.getOne(ticketUuid) : of(null),
    }).subscribe({
      next: ({ project, tickets, ticket }) => {
        this.project.set(project);
        this.ticket.set(ticket);
        this.tagSuggestions.set(collectTags(tickets));
        this.fill(ticket);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Ticket introuvable ou inaccessible.'));
        this.loading.set(false);
      },
    });
  }

  private fill(t: Ticket | null): void {
    this.form.reset({
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

  protected onPendingFiles(files: File[]): void {
    this.pendingFiles.set(files);
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
    const ticketUuid = this.ticketUuid();
    const request = ticketUuid
      ? this.ticketService.update(ticketUuid, input)
      : this.ticketService.create(this.uuid(), input);
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (saved) => {
        if (!ticketUuid && this.pendingFiles().length) {
          this.uploadThenOpen(saved);
        } else {
          this.open(saved);
        }
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(messageFromError(err, 'Enregistrement du ticket impossible.'));
      },
    });
  }

  /** The ticket exists either way: a failed upload is reported on its page, where files can be sent again. */
  private uploadThenOpen(ticket: Ticket): void {
    this.ticketService.addAttachments(ticket.uuid, this.pendingFiles()).subscribe({
      next: () => this.open(ticket),
      error: (err) =>
        this.open(ticket, {
          uploadError: `Ticket créé, mais les fichiers n'ont pas pu être envoyés : ${messageFromError(err, 'erreur inconnue.')}`,
        }),
    });
  }

  private open(ticket: Ticket, notice?: TicketEditNotice): void {
    void this.router.navigate(['/projets', this.uuid(), 'tickets', ticket.uuid], {
      replaceUrl: true,
      state: notice,
    });
  }
}

/** Every tag used on the tickets (first spelling wins), sorted. */
function collectTags(tickets: Ticket[]): string[] {
  const seen = new Map<string, string>();
  for (const ticket of tickets) {
    for (const tag of ticket.tags) {
      if (!seen.has(tag.toLowerCase())) {
        seen.set(tag.toLowerCase(), tag);
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}
