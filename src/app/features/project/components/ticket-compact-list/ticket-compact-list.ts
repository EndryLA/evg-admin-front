import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { formatDateFr } from '../../../../shared/util/date.util';
import {
  CLOSED_TICKET_STATUSES,
  shortName,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_TONES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  type Ticket,
} from '../../project.models';

/** A block of tickets under an optional phase heading. */
export interface TicketGroup {
  id: string;
  label: string | null;
  tickets: Ticket[];
}

/**
 * The phone version of the tickets table: one tappable line per ticket (key,
 * status, title, assignee, due date) leading to its detail page. Nothing is
 * edited here. Filtering and grouping are done by the table.
 */
@Component({
  selector: 'app-ticket-compact-list',
  imports: [RouterLink],
  templateUrl: './ticket-compact-list.html',
  styleUrl: './ticket-compact-list.scss',
})
export class TicketCompactList {
  readonly projectUuid = input.required<string>();
  readonly groups = input.required<TicketGroup[]>();

  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly statusTones = TICKET_STATUS_TONES;
  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;
  protected readonly priorityTones = TICKET_PRIORITY_TONES;
  protected readonly shortName = shortName;
  protected readonly formatDate = formatDateFr;

  /** Only the priorities worth flagging on a small screen. */
  protected isPressing(ticket: Ticket): boolean {
    return ticket.priority === 'URGENT' || ticket.priority === 'HIGH';
  }

  protected isOverdue(ticket: Ticket): boolean {
    if (!ticket.dueDate || CLOSED_TICKET_STATUSES.includes(ticket.status)) {
      return false;
    }
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return ticket.dueDate < today;
  }
}
