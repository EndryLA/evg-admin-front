import { Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ACCESS } from '../../../../core/auth/access';
import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { formatDateFr } from '../../../../shared/util/date.util';
import { SuggestionPicker } from '../../components/suggestion-picker/suggestion-picker';
import { TicketAttachments } from '../../components/ticket-attachments/ticket-attachments';
import { ProjectService } from '../../project.service';
import {
  CLOSED_TICKET_STATUSES,
  LINKED_SUGGESTION_LABELS,
  LINKED_SUGGESTION_TONES,
  personName,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_TONES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  type PersonRef,
  type Project,
  type Ticket,
} from '../../project.models';
import { TicketService } from '../../ticket.service';
import type { TicketEditNotice } from '../ticket-edit/ticket-edit';

/**
 * One ticket, read-only: its fields, description, files and linked
 * suggestions. Changes go through « Modifier » (the edit page); only files
 * are added or removed here directly. Viewers see the same page without the
 * actions.
 */
@Component({
  selector: 'app-ticket-detail',
  imports: [RouterLink, ConfirmDialog, SuggestionPicker, TicketAttachments],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.scss',
})
export class TicketDetail implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly ticketService = inject(TicketService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Project and ticket ids from the route. */
  readonly uuid = input.required<string>();
  readonly ticketUuid = input.required<string>();

  protected readonly project = signal<Project | null>(null);
  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmDelete = signal(false);
  protected readonly linking = signal(false);

  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly statusTones = TICKET_STATUS_TONES;
  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;
  protected readonly priorityTones = TICKET_PRIORITY_TONES;
  protected readonly suggestionLabels = LINKED_SUGGESTION_LABELS;
  protected readonly suggestionTones = LINKED_SUGGESTION_TONES;
  protected readonly personName = personName;
  protected readonly formatDate = formatDateFr;

  protected readonly canWork = computed(() => !!this.project()?.canWork);
  /** Mirrors the backend: managers delete any ticket, contributors their own. */
  protected readonly canDelete = computed(() => {
    const p = this.project();
    const t = this.ticket();
    if (!p || !t) {
      return false;
    }
    const me = this.auth.currentUser()?.profileUuid;
    return p.canManage || (p.canWork && !!me && t.createdBy?.uuid === me);
  });
  protected readonly canLink = computed(
    () => this.canWork() && this.auth.hasAnyRole(ACCESS.suggestionReview),
  );
  protected readonly overdue = computed(() => {
    const t = this.ticket();
    if (!t?.dueDate || CLOSED_TICKET_STATUSES.includes(t.status)) {
      return false;
    }
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return t.dueDate < today;
  });

  protected initials(person: PersonRef): string {
    return `${person.firstname.charAt(0)}${person.lastname.charAt(0)}`.toUpperCase() || '?';
  }

  ngOnInit(): void {
    // Files that failed right after the ticket was created (see TicketEdit).
    const notice = history.state as TicketEditNotice | null;
    if (notice?.uploadError) {
      this.error.set(notice.uploadError);
    }
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      project: this.projectService.getOne(this.uuid()),
      ticket: this.ticketService.getOne(this.ticketUuid()),
    }).subscribe({
      next: ({ project, ticket }) => {
        this.project.set(project);
        this.ticket.set(ticket);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Ticket introuvable ou inaccessible.'));
        this.loading.set(false);
      },
    });
  }

  protected onTicketChanged(ticket: Ticket): void {
    this.linking.set(false);
    this.ticket.set(ticket);
  }

  protected onDelete(): void {
    this.busy.set(true);
    this.ticketService.remove(this.ticketUuid()).subscribe({
      next: () => void this.router.navigate(['/projets', this.uuid()]),
      error: (err) => {
        this.busy.set(false);
        this.confirmDelete.set(false);
        this.error.set(messageFromError(err, 'Suppression impossible.'));
      },
    });
  }
}
