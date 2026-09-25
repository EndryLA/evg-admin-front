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

/** A member's role in a project — mirrors the backend `ProjectRole`. */
export type ProjectRole = 'MANAGER' | 'CONTRIBUTOR' | 'VIEWER';
export const PROJECT_ROLES: readonly ProjectRole[] = ['MANAGER', 'CONTRIBUTOR', 'VIEWER'];
export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  MANAGER: 'Gestionnaire',
  CONTRIBUTOR: 'Contributeur',
  VIEWER: 'Lecteur',
};
export const PROJECT_ROLE_HINTS: Record<ProjectRole, string> = {
  MANAGER: 'Gère le projet : phases, types, membres et rôles, tous les tickets.',
  CONTRIBUTOR: 'Crée, modifie et assigne les tickets, ajoute des pièces jointes.',
  VIEWER: 'Consulte le projet sans rien modifier ; ne peut pas être assigné.',
};
export const PROJECT_ROLE_TONES: Record<ProjectRole, string> = {
  MANAGER: 'red',
  CONTRIBUTOR: 'blue',
  VIEWER: 'grey',
};

export type AttachmentKind = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

/** Upload rules for ticket attachments, mirroring the backend `UploadType` (checked again there). */
export const TICKET_ATTACHMENT_RULES = {
  maxFiles: 10,
  maxBytes: { IMAGE: 10, VIDEO: 100, DOCUMENT: 20 } as Record<AttachmentKind, number>,
  types: {
    'image/jpeg': 'IMAGE',
    'image/png': 'IMAGE',
    'image/webp': 'IMAGE',
    'video/mp4': 'VIDEO',
    'video/quicktime': 'VIDEO',
    'video/webm': 'VIDEO',
    'application/pdf': 'DOCUMENT',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCUMENT',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'DOCUMENT',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'DOCUMENT',
  } as Record<string, AttachmentKind>,
  extensions: {
    jpg: 'IMAGE', jpeg: 'IMAGE', png: 'IMAGE', webp: 'IMAGE',
    mp4: 'VIDEO', mov: 'VIDEO', webm: 'VIDEO',
    pdf: 'DOCUMENT', docx: 'DOCUMENT', xlsx: 'DOCUMENT', pptx: 'DOCUMENT',
  } as Record<string, AttachmentKind>,
};

/** `accept` attribute for the ticket file picker. */
export const TICKET_ATTACHMENT_ACCEPT = [
  ...Object.keys(TICKET_ATTACHMENT_RULES.types),
  ...Object.keys(TICKET_ATTACHMENT_RULES.extensions).map((e) => `.${e}`),
].join(',');

/** Why `file` would be refused for a ticket, or `null` when acceptable. */
export function ticketAttachmentProblem(file: File): string | null {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const kind = TICKET_ATTACHMENT_RULES.types[file.type] ?? TICKET_ATTACHMENT_RULES.extensions[ext];
  if (!kind) {
    return `« ${file.name} » : format non pris en charge (images, vidéos, PDF, Word, Excel, PowerPoint).`;
  }
  const maxMb = TICKET_ATTACHMENT_RULES.maxBytes[kind];
  if (file.size > maxMb * 1024 * 1024) {
    return `« ${file.name} » dépasse ${maxMb} Mo.`;
  }
  return null;
}

/** `2,4 Mo` / `830 Ko`. */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

// ---- Domain models ----

export interface ProjectMember {
  person: PersonRef;
  /** The creator is always MANAGER. */
  role: ProjectRole;
  creator: boolean;
  addedAt: string;
}

export interface TicketAttachment {
  uuid: string;
  kind: AttachmentKind;
  fileName: string;
  contentType: string;
  size: number;
  addedBy: PersonRef | null;
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
  /** Whether the caller may create/edit tickets and attachments (managers and contributors). */
  canWork: boolean;
  /** The caller's role; `null` for a super admin who isn't a member. */
  myRole: ProjectRole | null;
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
  attachments: TicketAttachment[];
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
