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

/** Lifecycle of a suggestion, as emitted by the backend `Suggestion.SuggestionStatus`. */
export type SuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IMPLEMENTED';

export const SUGGESTION_STATUSES: readonly SuggestionStatus[] = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'IMPLEMENTED',
];

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  IMPLEMENTED: 'Réalisée',
};

/** Pill colour per status (maps to the global `.pill--*` modifiers). */
export const SUGGESTION_STATUS_TONES: Record<SuggestionStatus, string> = {
  PENDING: 'amber',
  ACCEPTED: 'blue',
  REJECTED: 'red',
  IMPLEMENTED: 'green',
};

export type AttachmentKind = 'IMAGE' | 'VIDEO';

export interface SuggestionAttachment {
  uuid: string;
  kind: AttachmentKind;
  fileName: string;
  contentType: string;
  size: number;
}

/** A suggestion, mapped from the backend `SuggestionResponse`. */
export interface Suggestion {
  uuid: string;
  title: string;
  description: string;
  status: SuggestionStatus;
  author: PersonRef | null;
  reviewMessage: string;
  reviewedBy: PersonRef | null;
  reviewedAt: string;
  attachments: SuggestionAttachment[];
  /** Number of tickets that take this suggestion into account. */
  ticketCount: number;
  createdAt: string;
}

/** Editable text of a suggestion (`SuggestionRequest`). */
export interface SuggestionInput {
  title: string;
  description: string;
}

export type ReviewDecision = 'ACCEPT' | 'REJECT';

/**
 * Upload rules, mirroring the backend `AttachmentType` so the form can refuse a
 * file before sending it. The backend still checks every file's content.
 */
export const ATTACHMENT_RULES = {
  maxFiles: 5,
  maxImageBytes: 10 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
  imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  videoTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
} as const;

/** `accept` attribute for the file picker. */
export const ATTACHMENT_ACCEPT = [
  ...ATTACHMENT_RULES.imageTypes,
  ...ATTACHMENT_RULES.videoTypes,
].join(',');

/** Why `file` would be refused, or `null` when it is acceptable. */
export function attachmentProblem(file: File): string | null {
  const isImage = (ATTACHMENT_RULES.imageTypes as readonly string[]).includes(file.type);
  const isVideo = (ATTACHMENT_RULES.videoTypes as readonly string[]).includes(file.type);
  if (!isImage && !isVideo) {
    return `« ${file.name} » : format non pris en charge (JPG, PNG, WebP, MP4, MOV, WebM).`;
  }
  const max = isImage ? ATTACHMENT_RULES.maxImageBytes : ATTACHMENT_RULES.maxVideoBytes;
  if (file.size > max) {
    return `« ${file.name} » dépasse ${max / (1024 * 1024)} Mo.`;
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

/** Statuses a suggestion must have to be taken into account by a ticket. */
export const LINKABLE_STATUSES: readonly SuggestionStatus[] = ['ACCEPTED', 'IMPLEMENTED'];

/** A project a ticket can be created in, with its ticket types (from `/api/projects`). */
export interface ProjectOption {
  uuid: string;
  key: string;
  name: string;
  archived: boolean;
  types: { uuid: string; name: string }[];
}

export type TicketPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
export const TICKET_PRIORITIES: readonly TicketPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  URGENT: 'Urgente',
  HIGH: 'Haute',
  NORMAL: 'Normale',
  LOW: 'Basse',
};

/** Payload of "Créer un ticket" from suggestions (`TicketFromSuggestionsRequest`). */
export interface TicketFromSuggestionsInput {
  projectUuid: string;
  suggestionUuids: string[];
  title: string;
  description: string;
  typeUuid: string | null;
  priority: TicketPriority;
}

/** The created ticket, as far as the suggestion screens need it. */
export interface CreatedTicket {
  uuid: string;
  key: string;
  projectUuid: string;
}

/**
 * Prefilled ticket text: a single suggestion gives its title and description;
 * several give a neutral title to edit and one bullet per suggestion.
 */
export function ticketDraftFrom(suggestions: Suggestion[]): { title: string; description: string } {
  if (suggestions.length === 1) {
    const s = suggestions[0];
    return { title: s.title, description: s.description };
  }
  return {
    title: '',
    description:
      'Suggestions prises en compte :\n' +
      suggestions.map((s) => `- ${s.title} — ${s.description}`).join('\n'),
  };
}
