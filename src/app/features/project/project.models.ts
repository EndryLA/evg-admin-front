/** Minimal reference to a member (`ProfileRef` on the backend). */
export interface PersonRef {
  uuid: string;
  firstname: string;
  lastname: string;
}

/** Full name helper for a {@link PersonRef}. */
export function personName(person: PersonRef | null): string {
  if (!person) {
    return '—';
  }
  return `${person.firstname} ${person.lastname}`.trim() || '—';
}

/** `Marie D.` — short form for dense table cells. */
export function shortName(person: PersonRef | null): string {
  if (!person) {
    return '—';
  }
  const initial = person.lastname ? ` ${person.lastname.charAt(0)}.` : '';
  return `${person.firstname}${initial}`.trim() || '—';
}

// ---- Enums (labels + pill tones, see design.md "Status / badge tones") ----

export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'DONE' | 'ARCHIVED';
export const PROJECT_STATUSES: readonly ProjectStatus[] = ['PLANNED', 'ACTIVE', 'DONE', 'ARCHIVED'];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: 'Planifié',
  ACTIVE: 'En cours',
  DONE: 'Terminé',
  ARCHIVED: 'Archivé',
};
export const PROJECT_STATUS_TONES: Record<ProjectStatus, string> = {
  PLANNED: 'blue',
  ACTIVE: 'amber',
  DONE: 'green',
  ARCHIVED: 'grey',
};

export type PhaseStatus = 'PLANNED' | 'ACTIVE' | 'DONE';
export const PHASE_STATUSES: readonly PhaseStatus[] = ['PLANNED', 'ACTIVE', 'DONE'];
export const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  PLANNED: 'Planifiée',
  ACTIVE: 'En cours',
  DONE: 'Terminée',
};
export const PHASE_STATUS_TONES: Record<PhaseStatus, string> = {
  PLANNED: 'blue',
  ACTIVE: 'amber',
  DONE: 'green',
};

/** Kind of project, chosen at creation; it seeds the project's ticket types. */
export type ProjectCategory = 'DEVELOPMENT' | 'DIGITAL' | 'WRITING' | 'OTHER';
export const PROJECT_CATEGORIES: readonly ProjectCategory[] = ['DEVELOPMENT', 'DIGITAL', 'WRITING', 'OTHER'];
export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  DEVELOPMENT: 'Développement',
  DIGITAL: 'Digital',
  WRITING: 'Rédaction',
  OTHER: 'Autre',
};
/** Starter ticket types per category — mirrors the backend `ProjectCategory`, shown as a preview. */
export const PROJECT_CATEGORY_STARTERS: Record<ProjectCategory, string> = {
  DEVELOPMENT: 'Fonctionnalité, Bug, Amélioration, Tâche technique',
  DIGITAL: 'Visuel, Vidéo, Publication, Story / Reel, Montage',
  WRITING: 'Rédaction, Relecture, Traduction, Mise en page, Validation',
  OTHER: 'Tâche, Problème, Amélioration, Idée',
};

/** Pill tones a ticket type can take (the global `.pill--*` modifiers). */
export type TypeColor = 'grey' | 'red' | 'amber' | 'green' | 'blue' | 'violet';
export const TYPE_COLORS: readonly TypeColor[] = ['grey', 'red', 'amber', 'green', 'blue', 'violet'];
export const TYPE_COLOR_LABELS: Record<TypeColor, string> = {
  grey: 'Gris',
  red: 'Rouge',
  amber: 'Orange',
  green: 'Vert',
  blue: 'Bleu',
  violet: 'Violet',
};

/** In workflow order — also the order of the status filter and select. */
export type TicketStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
export const TICKET_STATUSES: readonly TicketStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
];
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  IN_REVIEW: 'En revue',
  DONE: 'Terminé',
  CANCELLED: 'Annulé',
};
export const TICKET_STATUS_TONES: Record<TicketStatus, string> = {
  TODO: 'grey',
  IN_PROGRESS: 'amber',
  IN_REVIEW: 'violet',
  DONE: 'green',
  CANCELLED: 'red',
};
/** Statuses hidden by the "masquer les tickets clos" filter. */
export const CLOSED_TICKET_STATUSES: readonly TicketStatus[] = ['DONE', 'CANCELLED'];

/** Most urgent first — also the sort order. */
export type TicketPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
export const TICKET_PRIORITIES: readonly TicketPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  URGENT: 'Urgente',
  HIGH: 'Haute',
  NORMAL: 'Normale',
  LOW: 'Basse',
};
export const TICKET_PRIORITY_TONES: Record<TicketPriority, string> = {
  URGENT: 'red',
  HIGH: 'amber',
  NORMAL: 'blue',
  LOW: 'grey',
};

/** Suggestion statuses as far as tickets are concerned (linked ones are accepted or implemented). */
export type LinkedSuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IMPLEMENTED';
export const LINKED_SUGGESTION_LABELS: Record<LinkedSuggestionStatus, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  IMPLEMENTED: 'Réalisée',
};
export const LINKED_SUGGESTION_TONES: Record<LinkedSuggestionStatus, string> = {
  PENDING: 'amber',
  ACCEPTED: 'blue',
  REJECTED: 'red',
  IMPLEMENTED: 'green',
};

// ---- Domain models ----

export interface ProjectMember {
  person: PersonRef;
  creator: boolean;
  addedAt: string;
}

export interface Phase {
  uuid: string;
  name: string;
  description: string;
  position: number;
  status: PhaseStatus;
  startDate: string;
  endDate: string;
  ticketCount: number;
  doneTicketCount: number;
}

/** A ticket type owned by a project (e.g. "Relecture"). */
export interface TicketTypeRef {
  uuid: string;
  name: string;
  color: TypeColor;
}

export interface ProjectTicketType extends TicketTypeRef {
  position: number;
  /** Tickets using it — a used type can't be deleted. */
  ticketCount: number;
}

export interface TicketTypeInput {
  name: string;
  color: TypeColor;
}

export interface Project {
  uuid: string;
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  category: ProjectCategory;
  startDate: string;
  targetDate: string;
  createdBy: PersonRef | null;
  members: ProjectMember[];
  /** Ordered by position; may be empty. */
  phases: Phase[];
  /** Ordered by position. */
  ticketTypes: ProjectTicketType[];
  ticketCount: number;
  doneTicketCount: number;
  /** Whether the caller may edit the project, its phases and its members. */
  canManage: boolean;
}

export interface SuggestionRef {
  uuid: string;
  title: string;
  status: LinkedSuggestionStatus;
}

export interface Ticket {
  uuid: string;
  /** Display key, e.g. `EVG-42`. */
  key: string;
  number: number;
  title: string;
  description: string;
  type: TicketTypeRef | null;
  status: TicketStatus;
  priority: TicketPriority;
  project: { uuid: string; key: string; name: string };
  phase: { uuid: string; name: string } | null;
  assignee: PersonRef | null;
  createdBy: PersonRef | null;
  dueDate: string;
  /** Free labels, as typed. */
  tags: string[];
  /** `null` when the caller may not see suggestions — hide the section entirely. */
  suggestions: SuggestionRef[] | null;
  createdAt: string;
}

/** Full editable state of a ticket (`TicketRequest`) — inline edits resend the whole row. */
export interface TicketInput {
  title: string;
  description: string;
  typeUuid: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  phaseUuid: string | null;
  assigneeUuid: string | null;
  dueDate: string | null;
  tags: string[];
}

export interface ProjectInput {
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  category: ProjectCategory;
  startDate: string | null;
  targetDate: string | null;
}

export interface PhaseInput {
  name: string;
  description: string;
  status: PhaseStatus;
  startDate: string | null;
  endDate: string | null;
}

/** An accepted suggestion offered by the link picker. */
export interface LinkableSuggestion {
  uuid: string;
  title: string;
  description: string;
  authorName: string;
}

/** The editable part of a ticket, taken from the ticket itself. */
export function toTicketInput(ticket: Ticket): TicketInput {
  return {
    title: ticket.title,
    description: ticket.description,
    typeUuid: ticket.type?.uuid ?? null,
    status: ticket.status,
    priority: ticket.priority,
    phaseUuid: ticket.phase?.uuid ?? null,
    assigneeUuid: ticket.assignee?.uuid ?? null,
    dueDate: ticket.dueDate || null,
    tags: ticket.tags,
  };
}

/** Rounded completion percentage, 0 when there is nothing to do. */
export function progress(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
