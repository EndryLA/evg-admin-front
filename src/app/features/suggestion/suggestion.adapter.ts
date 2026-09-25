import type {
  AttachmentKind,
  CreatedTicket,
  ProjectOption,
  PersonRef,
  Suggestion,
  SuggestionAttachment,
  SuggestionStatus,
} from './suggestion.models';

/** Raw Spring `Page<T>` envelope (only fields we consume). */
export interface RawPage<T> {
  content?: T[];
  totalElements?: number;
}

export interface RawPerson {
  uuid?: string;
  firstname?: string | null;
  lastname?: string | null;
}

interface RawAttachment {
  uuid?: string;
  kind?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  size?: number | null;
}

/** Raw `SuggestionResponse`. */
export interface RawSuggestion {
  uuid?: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  author?: RawPerson | null;
  reviewMessage?: string | null;
  reviewedBy?: RawPerson | null;
  reviewedAt?: string | null;
  attachments?: RawAttachment[] | null;
  ticketCount?: number | null;
  createdAt?: string | null;
}

const STATUSES: readonly SuggestionStatus[] = ['PENDING', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED'];

export function toPersonRef(raw: RawPerson | null | undefined): PersonRef | null {
  if (!raw?.uuid) {
    return null;
  }
  return { uuid: raw.uuid, firstname: raw.firstname ?? '', lastname: raw.lastname ?? '' };
}

function toAttachment(raw: RawAttachment): SuggestionAttachment {
  return {
    uuid: raw.uuid ?? '',
    kind: (raw.kind === 'VIDEO' ? 'VIDEO' : 'IMAGE') as AttachmentKind,
    fileName: raw.fileName ?? '',
    contentType: raw.contentType ?? '',
    size: raw.size ?? 0,
  };
}

export function toSuggestion(raw: RawSuggestion): Suggestion {
  const status = STATUSES.find((s) => s === raw.status) ?? 'PENDING';
  return {
    uuid: raw.uuid ?? '',
    title: raw.title ?? '',
    description: raw.description ?? '',
    status,
    author: toPersonRef(raw.author),
    reviewMessage: raw.reviewMessage ?? '',
    reviewedBy: toPersonRef(raw.reviewedBy),
    reviewedAt: raw.reviewedAt ?? '',
    attachments: (raw.attachments ?? []).map(toAttachment),
    ticketCount: raw.ticketCount ?? 0,
    createdAt: raw.createdAt ?? '',
  };
}

/** Raw `ProjectResponse`, narrowed to what the ticket dialog needs. */
export interface RawProjectOption {
  uuid?: string;
  key?: string | null;
  name?: string | null;
  status?: string | null;
  ticketTypes?: { uuid?: string; name?: string | null }[] | null;
}

export function toProjectOption(raw: RawProjectOption): ProjectOption {
  return {
    uuid: raw.uuid ?? '',
    key: raw.key ?? '',
    name: raw.name ?? '',
    archived: raw.status === 'ARCHIVED',
    types: (raw.ticketTypes ?? [])
      .filter((t) => !!t.uuid)
      .map((t) => ({ uuid: t.uuid ?? '', name: t.name ?? '' })),
  };
}

/** Raw `TicketResponse`, narrowed to what the dialog shows after creation. */
export interface RawCreatedTicket {
  uuid?: string;
  key?: string | null;
  project?: { uuid?: string } | null;
}

export function toCreatedTicket(raw: RawCreatedTicket): CreatedTicket {
  return { uuid: raw.uuid ?? '', key: raw.key ?? '', projectUuid: raw.project?.uuid ?? '' };
}
