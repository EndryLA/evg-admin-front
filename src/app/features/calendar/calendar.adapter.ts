import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarEventType,
  CalendarItem,
  CalendarStatus,
  EventManager,
  EventStatus,
  OutreachDraft,
} from './calendar.models';

/** Nested profile as returned inside `managedBy`. */
export interface RawManager {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}

/** Raw `CalendarItem` from the merged agenda feed. */
export interface RawCalendarItem {
  uuid?: string;
  type?: string | null;
  name?: string;
  description?: string;
  location?: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
  cityLabel?: string | null;
  managedBy?: RawManager | null;
  outreachUuid?: string | null;
}

/** Raw `CalendarEventResponse` from the backend. */
export interface RawCalendarEvent {
  uuid?: string;
  name?: string;
  description?: string;
  location?: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  type?: string | null;
  status?: string | null;
  managedBy?: RawManager | null;
}

/** Raw `CalendarEventRequest` sent to the backend. */
export interface RawCalendarEventRequest {
  name: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  type: CalendarEventType;
  managedByUuid: string | null;
}

/** Raw `OutreachRequest` sent when the agenda plans a sortie. */
export interface RawOutreachRequest {
  name: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  managedByUuid: string | null;
  cityInseeCode?: number;
  cityLabel?: string;
}

const TYPES: readonly CalendarEventType[] = ['OUTREACH', 'REUNION', 'AGAPE', 'OTHER'];

function toType(value: string | null | undefined): CalendarEventType {
  return TYPES.includes(value as CalendarEventType)
    ? (value as CalendarEventType)
    : 'OTHER';
}

const STATUSES: readonly CalendarStatus[] = [
  'PLANNED',
  'IN_PROGRESS',
  'CANCELLED',
  'FINISHED',
];

function toStatus(value: string | null | undefined): CalendarStatus {
  return STATUSES.includes(value as CalendarStatus)
    ? (value as CalendarStatus)
    : 'PLANNED';
}

const EVENT_STATUSES: readonly EventStatus[] = ['PLANNED', 'CANCELLED', 'FINISHED'];

/** Narrow to the statuses a calendar event can hold — `IN_PROGRESS` is
 *  outreach-only, so anything unexpected falls back to `PLANNED`. */
function toEventStatus(value: string | null | undefined): EventStatus {
  return EVENT_STATUSES.includes(value as EventStatus)
    ? (value as EventStatus)
    : 'PLANNED';
}

function toManager(raw: RawManager | null | undefined): EventManager | null {
  if (!raw?.uuid) {
    return null;
  }
  return {
    uuid: raw.uuid,
    name: `${raw.firstname ?? ''} ${raw.lastname ?? ''}`.trim(),
  };
}

/** Map a raw agenda entry to the clean domain model. */
export function toCalendarItem(raw: RawCalendarItem): CalendarItem {
  return {
    uuid: raw.uuid ?? '',
    type: toType(raw.type),
    name: raw.name ?? '',
    description: raw.description ?? '',
    location: raw.location ?? '',
    date: raw.date ?? null,
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    status: toStatus(raw.status),
    cityLabel: raw.cityLabel ?? '',
    managedBy: toManager(raw.managedBy),
    outreachUuid: raw.outreachUuid ?? null,
  };
}

/** Map a raw calendar event to the clean domain model. */
export function toCalendarEvent(raw: RawCalendarEvent): CalendarEvent {
  return {
    uuid: raw.uuid ?? '',
    name: raw.name ?? '',
    description: raw.description ?? '',
    location: raw.location ?? '',
    date: raw.date ?? null,
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    type: toType(raw.type),
    status: toEventStatus(raw.status),
    managedBy: toManager(raw.managedBy),
  };
}

/** Map an outreach draft to the raw `OutreachRequest`. */
export function toRawOutreachRequest(input: OutreachDraft): RawOutreachRequest {
  const request: RawOutreachRequest = {
    name: input.name.trim(),
    location: input.location.trim(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    managedByUuid: input.managedByUuid || null,
  };

  // Send exactly one side: the INSEE code of a picked commune, else raw free text.
  if (input.cityInseeCode != null) {
    request.cityInseeCode = input.cityInseeCode;
  } else {
    const label = input.cityLabel?.trim();
    if (label) {
      request.cityLabel = label;
    }
  }

  return request;
}

/** Map a domain input to the raw `CalendarEventRequest`. */
export function toRawCalendarEventRequest(
  input: CalendarEventInput,
): RawCalendarEventRequest {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    location: input.location.trim(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    type: input.type,
    managedByUuid: input.managedByUuid || null,
  };
}
