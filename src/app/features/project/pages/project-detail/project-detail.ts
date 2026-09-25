import { Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr } from '../../../../shared/util/date.util';
import { MemberList } from '../../components/member-list/member-list';
import { PhaseList } from '../../components/phase-list/phase-list';
import { TicketTable } from '../../components/ticket-table/ticket-table';
import { TicketTypeList } from '../../components/ticket-type-list/ticket-type-list';
import { ProjectService } from '../../project.service';
import {
  progress,
  PROJECT_STATUS_LABELS,
  PROJECT_ROLE_HINTS,
  PROJECT_ROLE_LABELS,
  PROJECT_STATUS_TONES,
  type Project,
  type Ticket,
} from '../../project.models';
import { TicketService } from '../../ticket.service';

type Tab = 'tickets' | 'phases' | 'types' | 'members';

/**
 * One project: its tickets (the main view), its phases, types and members.
 * Tickets open on their own pages; cells edited in the table are merged
 * locally; phase/member changes and ticket edits refresh the project so the
 * counters stay right.
 */
@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, TicketTable, PhaseList, TicketTypeList, MemberList],
  host: { class: 'data-list' },
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
})
export class ProjectDetail implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly ticketService = inject(TicketService);

  readonly uuid = input.required<string>();

  protected readonly project = signal<Project | null>(null);
  protected readonly tickets = signal<Ticket[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly tab = signal<Tab>('tickets');
  /** Phones show two lines of the description until asked for more. */
  protected readonly descriptionOpen = signal(false);

  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly statusTones = PROJECT_STATUS_TONES;
  protected readonly roleLabels = PROJECT_ROLE_LABELS;
  protected readonly roleHints = PROJECT_ROLE_HINTS;
  protected readonly formatDate = formatDateFr;

  protected readonly percent = computed(() => {
    const p = this.project();
    return p ? progress(p.doneTicketCount, p.ticketCount) : 0;
  });
  protected readonly openCount = computed(
    () => this.tickets().filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED').length,
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.projectService.getOne(this.uuid()).subscribe({
      next: (project) => {
        this.project.set(project);
        this.loadTickets();
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Projet introuvable ou inaccessible.'));
        this.loading.set(false);
      },
    });
  }

  /** A deleted phase leaves its tickets without one, so both are reloaded. */
  protected onPhasesChanged(): void {
    this.refreshProject();
    this.loadTickets();
  }

  /** A renamed/recoloured type shows on the tickets, so both are reloaded. */
  protected onTypesChanged(): void {
    this.refreshProject();
    this.loadTickets();
  }

  /** A removed member's tickets become unassigned, so the tickets are reloaded. */
  protected onMembersChanged(project: Project): void {
    this.project.set(project);
    this.loadTickets();
  }

  private loadTickets(): void {
    this.ticketService.listForProject(this.uuid()).subscribe({
      next: (tickets) => {
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des tickets impossible.'));
        this.loading.set(false);
      },
    });
  }

  /** Refreshes counters (project and phases) without the loading state. */
  protected refreshProject(): void {
    this.projectService.getOne(this.uuid()).subscribe({
      next: (project) => this.project.set(project),
    });
  }

  /** A cell edited in the table: merge the row, refresh the counters. */
  protected onTicketSaved(ticket: Ticket): void {
    this.tickets.update((list) => list.map((t) => (t.uuid === ticket.uuid ? ticket : t)));
    this.refreshProject();
  }
}
