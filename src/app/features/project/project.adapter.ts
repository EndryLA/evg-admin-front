import type {
  LinkableSuggestion,
  LinkedSuggestionStatus,
  PersonRef,
  Phase,
  PhaseInput,
  PhaseStatus,
  Project,
  ProjectCategory,
  ProjectInput,
  ProjectStatus,
  Ticket,
  TicketInput,
  TicketPriority,
  TicketStatus,
  TicketTypeRef,
  TypeColor,
} from './project.models';

/** Raw Spring `Page<T>` envelope (only fields we consume). */
export interface RawPage<T> {
  content?: T[];
}

interface RawPerson {
  uuid?: string;
  firstname?: string | null;
  lastname?: string | null;
}

interface RawMember {
  profile?: RawPerson | null;
  creator?: boolean | null;
  addedAt?: string | null;
}

export interface RawPhase {
  uuid?: string;
  name?: string | null;
  description?: string | null;
  position?: number | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  ticketCount?: number | null;
  doneTicketCount?: number | null;
}

interface RawTicketType {
  uuid?: string;
  name?: string | null;
  color?: string | null;
  position?: number | null;
  ticketCount?: number | null;
}

export interface RawProject {
  uuid?: string;
  key?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  category?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  createdBy?: RawPerson | null;
  members?: RawMember[] | null;
  phases?: RawPhase[] | null;
  ticketTypes?: RawTicketType[] | null;
  ticketCount?: number | null;
  doneTicketCount?: number | null;
  canManage?: boolean | null;
}

export interface RawTicket {
  uuid?: string;
  key?: string | null;
  number?: number | null;
  title?: string | null;
  description?: string | null;
  type?: RawTicketType | null;
  status?: string | null;
  priority?: string | null;
  project?: { uuid?: string; key?: string | null; name?: string | null } | null;
  phase?: { uuid?: string; name?: string | null } | null;
  assignee?: RawPerson | null;
  createdBy?: RawPerson | null;
  dueDate?: string | null;
  tags?: string[] | null;
  suggestions?: { uuid?: string; title?: string | null; status?: string | null }[] | null;
  createdAt?: string | null;
}

/** Raw `SuggestionResponse`, narrowed to what the link picker shows. */
export interface RawSuggestionSummary {
  uuid?: string;
  title?: string | null;
  description?: string | null;
  author?: RawPerson | null;
}

/** Picks `value` when it is one of `allowed`, else `fallback`. */
function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}

const COLORS: readonly TypeColor[] = ['grey', 'red', 'amber', 'green', 'blue', 'violet'];

function toTypeRef(raw: RawTicketType | null | undefined): TicketTypeRef | null {
  if (!raw?.uuid) {
    return null;
  }
  return { uuid: raw.uuid, name: raw.name ?? '', color: oneOf<TypeColor>(raw.color, COLORS, 'grey') };
}

function toPerson(raw: RawPerson | null | undefined): PersonRef | null {
  if (!raw?.uuid) {
    return null;
  }
  return { uuid: raw.uuid, firstname: raw.firstname ?? '', lastname: raw.lastname ?? '' };
}

export function toPhase(raw: RawPhase): Phase {
  return {
    uuid: raw.uuid ?? '',
    name: raw.name ?? '',
    description: raw.description ?? '',
    position: raw.position ?? 0,
    status: oneOf<PhaseStatus>(raw.status, ['PLANNED', 'ACTIVE', 'DONE'], 'PLANNED'),
    startDate: raw.startDate ?? '',
    endDate: raw.endDate ?? '',
    ticketCount: raw.ticketCount ?? 0,
    doneTicketCount: raw.doneTicketCount ?? 0,
  };
}

export function toProject(raw: RawProject): Project {
  return {
    uuid: raw.uuid ?? '',
    key: raw.key ?? '',
    name: raw.name ?? '',
    description: raw.description ?? '',
    status: oneOf<ProjectStatus>(raw.status, ['PLANNED', 'ACTIVE', 'DONE', 'ARCHIVED'], 'PLANNED'),
    category: oneOf<ProjectCategory>(raw.category, ['DEVELOPMENT', 'DIGITAL', 'WRITING', 'OTHER'], 'OTHER'),
    startDate: raw.startDate ?? '',
    targetDate: raw.targetDate ?? '',
    createdBy: toPerson(raw.createdBy),
    members: (raw.members ?? [])
      .map((m) => ({ person: toPerson(m.profile), creator: !!m.creator, addedAt: m.addedAt ?? '' }))
      .filter((m): m is Project['members'][number] => m.person !== null),
    phases: (raw.phases ?? []).map(toPhase).sort((a, b) => a.position - b.position),
    ticketTypes: (raw.ticketTypes ?? [])
      .map((t) => ({ ...toTypeRef(t)!, position: t.position ?? 0, ticketCount: t.ticketCount ?? 0 }))
      .filter((t) => !!t.uuid)
      .sort((a, b) => a.position - b.position),
    ticketCount: raw.ticketCount ?? 0,
    doneTicketCount: raw.doneTicketCount ?? 0,
    canManage: !!raw.canManage,
  };
}

export function toTicket(raw: RawTicket): Ticket {
  return {
    uuid: raw.uuid ?? '',
    key: raw.key ?? '',
    number: raw.number ?? 0,
    title: raw.title ?? '',
    description: raw.description ?? '',
    type: toTypeRef(raw.type),
    status: oneOf<TicketStatus>(
      raw.status,
      ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'],
      'TODO',
    ),
    priority: oneOf<TicketPriority>(raw.priority, ['URGENT', 'HIGH', 'NORMAL', 'LOW'], 'NORMAL'),
    project: {
      uuid: raw.project?.uuid ?? '',
      key: raw.project?.key ?? '',
      name: raw.project?.name ?? '',
    },
    phase: raw.phase?.uuid ? { uuid: raw.phase.uuid, name: raw.phase.name ?? '' } : null,
    assignee: toPerson(raw.assignee),
    createdBy: toPerson(raw.createdBy),
    dueDate: raw.dueDate ?? '',
    tags: raw.tags ?? [],
    suggestions:
      raw.suggestions == null
        ? null
        : raw.suggestions.map((s) => ({
            uuid: s.uuid ?? '',
            title: s.title ?? '',
            status: oneOf<LinkedSuggestionStatus>(
              s.status,
              ['PENDING', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED'],
              'ACCEPTED',
            ),
          })),
    createdAt: raw.createdAt ?? '',
  };
}

export function toLinkableSuggestion(raw: RawSuggestionSummary): LinkableSuggestion {
  const author = toPerson(raw.author);
  return {
    uuid: raw.uuid ?? '',
    title: raw.title ?? '',
    description: raw.description ?? '',
    authorName: author ? `${author.firstname} ${author.lastname}`.trim() : '',
  };
}

// ---- Requests: blank strings become null so the backend sees "no value" ----

const orNull = (value: string | null | undefined): string | null => value?.trim() || null;

export function toRawTicketRequest(input: TicketInput): TicketInput {
  return {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    typeUuid: orNull(input.typeUuid),
    phaseUuid: orNull(input.phaseUuid),
    assigneeUuid: orNull(input.assigneeUuid),
    dueDate: orNull(input.dueDate),
  };
}

export function toRawProjectRequest(input: ProjectInput): ProjectInput {
  return {
    ...input,
    name: input.name.trim(),
    key: input.key.trim().toUpperCase(),
    description: input.description.trim(),
    startDate: orNull(input.startDate),
    targetDate: orNull(input.targetDate),
  };
}

export function toRawPhaseRequest(input: PhaseInput): PhaseInput {
  return {
    ...input,
    name: input.name.trim(),
    description: input.description.trim(),
    startDate: orNull(input.startDate),
    endDate: orNull(input.endDate),
  };
}
