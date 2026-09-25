import { Component, computed, inject, input, output, signal } from '@angular/core';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr } from '../../../../shared/util/date.util';
import {
  CLOSED_TICKET_STATUSES,
  personName,
  shortName,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_TONES,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  toTicketInput,
  type PersonRef,
  type Project,
  type Ticket,
  type TicketInput,
  type TicketPriority,
} from '../../project.models';
import { TicketService } from '../../ticket.service';

type SortKey = 'key' | 'type' | 'status' | 'priority' | 'assignee' | 'due' | 'phase';
type SortDir = 'asc' | 'desc';

/** A block of rows; a single unnamed group when grouping is off. */
interface Group {
  id: string;
  label: string | null;
  tickets: Ticket[];
}

const NONE = '__none__';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * The tickets table. Status, priority, assignee, phase and due date are edited
 * in place (the full row is resent, see `TicketRequest`); the rest opens the
 * ticket panel through {@link open}. Filtering, sorting and grouping by phase
 * happen in memory over {@link tickets}.
 *
 * Assignee and phase options come from {@link project}.
 */
@Component({
  selector: 'app-ticket-table',
  templateUrl: './ticket-table.html',
  styleUrl: './ticket-table.scss',
})
export class TicketTable {
  private readonly service = inject(TicketService);

  readonly tickets = input.required<Ticket[]>();
  /** The project the tickets belong to — source of the member and phase options. */
  readonly project = input.required<Project>();

  readonly updated = output<Ticket>();
  readonly open = output<Ticket>();
  /** "Nouveau ticket" in the toolbar; the parent opens the ticket modal. */
  readonly create = output<void>();

  // ---- Options ----
  /** Without phases the column (and grouping) would be noise. */
  protected readonly hasPhases = computed(() => this.project().phases.length > 0);
  protected readonly phases = computed(() => this.project().phases);
  protected readonly types = computed(() => this.project().ticketTypes);
  /** Every tag used on these tickets (first spelling wins), for the filter. */
  protected readonly tags = computed(() => {
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
  protected readonly members = computed<PersonRef[]>(() =>
    this.project()
      .members.map((m) => m.person)
      .sort((a, b) => personName(a).localeCompare(personName(b), 'fr')),
  );

  // ---- Filters / view state ----
  protected readonly query = signal('');
  protected readonly hideClosed = signal(true);
  /** A type uuid, {@link NONE} for tickets without type, or '' for all. */
  protected readonly typeFilter = signal<string>('');
  protected readonly priorityFilter = signal<TicketPriority | ''>('');
  protected readonly assigneeFilter = signal<string>('');
  /** A tag, lower-cased, or '' for all. */
  protected readonly tagFilter = signal<string>('');
  protected readonly grouped = signal(true);
  protected readonly sortKey = signal<SortKey>('priority');
  protected readonly sortDir = signal<SortDir>('asc');

  // ---- Row state ----
  /** Tickets with a request in flight — their controls are disabled. */
  protected readonly pending = signal<ReadonlySet<string>>(new Set());
  protected readonly error = signal<string | null>(null);

  protected readonly statuses = TICKET_STATUSES;
  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly statusTones = TICKET_STATUS_TONES;
  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;
  protected readonly priorityTones = TICKET_PRIORITY_TONES;
  protected readonly personName = personName;
  protected readonly shortName = shortName;
  protected readonly formatDate = formatDateFr;
  protected readonly none = NONE;

  protected readonly closedCount = computed(
    () => this.tickets().filter((t) => CLOSED_TICKET_STATUSES.includes(t.status)).length,
  );

  protected readonly filtered = computed(() => {
    const q = normalize(this.query().trim());
    const type = this.typeFilter();
    const priority = this.priorityFilter();
    const assignee = this.assigneeFilter();
    const tag = this.tagFilter();
    return this.tickets().filter(
      (t) =>
        !(this.hideClosed() && CLOSED_TICKET_STATUSES.includes(t.status)) &&
        (!type || (type === NONE ? !t.type : t.type?.uuid === type)) &&
        (!priority || t.priority === priority) &&
        (!assignee || (assignee === NONE ? !t.assignee : t.assignee?.uuid === assignee)) &&
        (!tag || t.tags.some((x) => x.toLowerCase() === tag)) &&
        (!q || normalize(`${t.key} ${t.title} ${t.description} ${t.tags.join(' ')}`).includes(q)),
    );
  });

  protected readonly sorted = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.filtered()].sort((a, b) => this.compare(a, b, key) * dir || b.number - a.number);
  });

  protected readonly groups = computed<Group[]>(() => {
    const rows = this.sorted();
    if (!this.hasPhases() || !this.grouped()) {
      return [{ id: 'all', label: null, tickets: rows }];
    }
    const groups: Group[] = this.phases().map((p) => ({
      id: p.uuid,
      label: p.name,
      tickets: rows.filter((t) => t.phase?.uuid === p.uuid),
    }));
    groups.push({ id: NONE, label: 'Sans phase', tickets: rows.filter((t) => !t.phase) });
    return groups.filter((g) => g.tickets.length > 0);
  });

  protected readonly filtersOpen = signal(false);
  /** Filters moved away from their default (search excluded: it stays visible). */
  protected readonly activeFilterCount = computed(
    () =>
      [this.typeFilter(), this.priorityFilter(), this.assigneeFilter(), this.tagFilter()].filter(Boolean)
        .length +
      (this.hideClosed() ? 0 : 1),
  );

  protected isPending(ticket: Ticket): boolean {
    return this.pending().has(ticket.uuid);
  }

  protected isOverdue(ticket: Ticket): boolean {
    if (!ticket.dueDate || CLOSED_TICKET_STATUSES.includes(ticket.status)) {
      return false;
    }
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return ticket.dueDate < iso;
  }

  // ---- Inline edits ----
  /**
   * Saves one changed cell. On failure the control is put back to the saved
   * value by hand — the bound data didn't change, so Angular wouldn't touch it.
   */
  protected onCellChange(ticket: Ticket, field: keyof TicketInput, event: Event): void {
    const control = event.target as HTMLSelectElement | HTMLInputElement;
    const saved = toTicketInput(ticket);
    const previous = String(saved[field] ?? '');
    const input = { ...saved, [field]: control.value || null } as TicketInput;

    this.error.set(null);
    this.pending.update((s) => new Set(s).add(ticket.uuid));
    this.service.update(ticket.uuid, input).subscribe({
      next: (result) => {
        this.done(ticket);
        this.updated.emit(result);
      },
      error: (err) => {
        this.done(ticket);
        control.value = previous;
        this.error.set(messageFromError(err, `Modification de ${ticket.key} impossible.`));
      },
    });
  }

  private done(ticket: Ticket): void {
    this.pending.update((s) => {
      const next = new Set(s);
      next.delete(ticket.uuid);
      return next;
    });
  }

  // ---- Filters / sort ----
  protected resetFilters(): void {
    this.hideClosed.set(true);
    this.typeFilter.set('');
    this.priorityFilter.set('');
    this.assigneeFilter.set('');
    this.tagFilter.set('');
  }

  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  protected sortIndicator(key: SortKey): string {
    return this.sortKey() !== key ? '' : this.sortDir() === 'asc' ? '↑' : '↓';
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    return this.sortKey() !== key ? 'none' : this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  /** Position of the ticket's type in the project; untyped tickets last. */
  private typeRank(ticket: Ticket): number {
    const index = this.types().findIndex((t) => t.uuid === ticket.type?.uuid);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  }

  private compare(a: Ticket, b: Ticket, key: SortKey): number {
    switch (key) {
      case 'key':
        return a.key.localeCompare(b.key, 'fr', { numeric: true });
      case 'type':
        return this.typeRank(a) - this.typeRank(b);
      case 'status':
        return TICKET_STATUSES.indexOf(a.status) - TICKET_STATUSES.indexOf(b.status);
      case 'priority':
        return (
          TICKET_PRIORITIES.indexOf(a.priority) - TICKET_PRIORITIES.indexOf(b.priority) ||
          byDue(a, b)
        );
      case 'assignee':
        return personName(a.assignee).localeCompare(personName(b.assignee), 'fr');
      case 'due':
        return byDue(a, b);
      case 'phase':
        return (a.phase?.name ?? '~').localeCompare(b.phase?.name ?? '~', 'fr');
    }
  }
}

/** Earliest due date first; tickets without one go last. */
function byDue(a: Ticket, b: Ticket): number {
  return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
}
