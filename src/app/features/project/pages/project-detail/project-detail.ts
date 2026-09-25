import { Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr } from '../../../../shared/util/date.util';
import { MemberList } from '../../components/member-list/member-list';
import { PhaseList } from '../../components/phase-list/phase-list';
import { TicketPanel } from '../../components/ticket-panel/ticket-panel';
import { TicketTable } from '../../components/ticket-table/ticket-table';
import { TicketTypeList } from '../../components/ticket-type-list/ticket-type-list';
import { ProjectService } from '../../project.service';
import {
  progress,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONES,
  type Project,
  type Ticket,
} from '../../project.models';
import { TicketService } from '../../ticket.service';

type Tab = 'tickets' | 'phases' | 'types' | 'members';

/**
 * One project: its tickets table (the main view), its phases and its members.
 * Ticket changes are merged locally; phase/member changes and ticket status
 * changes refresh the project so the counters stay right.
 */
@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, TicketTable, TicketPanel, PhaseList, TicketTypeList, MemberList],
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
  /** Ticket open in the panel; `'new'` while creating one. */
  protected readonly panel = signal<Ticket | 'new' | null>(null);

  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly statusTones = PROJECT_STATUS_TONES;
  protected readonly formatDate = formatDateFr;

  protected readonly percent = computed(() => {
    const p = this.project();
    return p ? progress(p.doneTicketCount, p.ticketCount) : 0;
  });
  /** Every tag used on this project's tickets, offered when tagging a ticket. */
  protected readonly ticketTags = computed(() => {
    const seen = new Map<string, string>();
    for (const ticket of this.tickets()) {
      for (const tag of ticket.tags) {
        if (!seen.has(tag.toLowerCase())) {
          seen.set(tag.toLowerCase(), tag);
        }
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr'));
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

  // ---- Tickets ----
  protected onTicketSaved(ticket: Ticket): void {
    const exists = this.tickets().some((t) => t.uuid === ticket.uuid);
    this.tickets.update((list) =>
      exists ? list.map((t) => (t.uuid === ticket.uuid ? ticket : t)) : [ticket, ...list],
    );
    if (this.panel() !== null && this.panel() !== 'new') {
      this.panel.set(ticket);
    }
    this.refreshProject();
  }

  protected onTicketDeleted(ticket: Ticket): void {
    this.tickets.update((list) => list.filter((t) => t.uuid !== ticket.uuid));
    this.panel.set(null);
    this.refreshProject();
  }

  protected panelTicket(): Ticket | null {
    const p = this.panel();
    return p === 'new' ? null : p;
  }
}
