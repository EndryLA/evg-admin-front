/** Kind of entry shown on the agenda. Outreaches are mirrored in by the
 *  backend; the other three are standalone calendar events. */
export type CalendarEventType = 'OUTREACH' | 'REUNION' | 'AGAPE' | 'OTHER';

/** French labels for {@link CalendarEventType}. */
export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  OUTREACH: 'Sortie',
  REUNION: 'Réunion',
  AGAPE: 'Agapè',
  OTHER: 'Autre',
};

/** Selectable type options, in display order. */
export const EVENT_TYPE_OPTIONS: readonly { value: CalendarEventType; label: string }[] = [
  { value: 'OUTREACH', label: EVENT_TYPE_LABELS.OUTREACH },
  { value: 'REUNION', label: EVENT_TYPE_LABELS.REUNION },
  { value: 'AGAPE', label: EVENT_TYPE_LABELS.AGAPE },
  { value: 'OTHER', label: EVENT_TYPE_LABELS.OTHER },
];

/**
 * Lifecycle status of an agenda entry. `IN_PROGRESS` only ever reaches the UI
 * on mirrored outreaches — it is computed from their schedule server-side and
 * cannot be set on a calendar event (see {@link EventStatus}).
 */
export type CalendarStatus = 'PLANNED' | 'IN_PROGRESS' | 'CANCELLED' | 'FINISHED';

/** French labels for {@link CalendarStatus}. */
export const CALENDAR_STATUS_LABELS: Record<CalendarStatus, string> = {
  PLANNED: 'Planifié',
  IN_PROGRESS: 'En cours',
  CANCELLED: 'Annulé',
  FINISHED: 'Terminé',
};

/** Badge tone (see global `.pill--*`) per status. */
export const CALENDAR_STATUS_TONES: Record<CalendarStatus, string> = {
  PLANNED: 'blue',
  IN_PROGRESS: 'amber',
  FINISHED: 'green',
  CANCELLED: 'grey',
};

/** The statuses a calendar event can be moved to (`CalendarEventStatusRequest`). */
export type EventStatus = 'PLANNED' | 'CANCELLED' | 'FINISHED';

/** Status transitions offered in the detail panel, in display order. */
export const EVENT_STATUS_OPTIONS: readonly { value: EventStatus; label: string }[] = [
  { value: 'PLANNED', label: CALENDAR_STATUS_LABELS.PLANNED },
  { value: 'FINISHED', label: CALENDAR_STATUS_LABELS.FINISHED },
  { value: 'CANCELLED', label: CALENDAR_STATUS_LABELS.CANCELLED },
];

/** The person responsible for an entry (subset of a profile). */
export interface EventManager {
  uuid: string;
  name: string;
}

/**
 * One entry on the agenda, mapped from the backend `CalendarItem` — the merged
 * feed of standalone calendar events *and* outreaches. Entries carrying an
 * {@link outreachUuid} are mirrored outreaches: read-only here, they are
 * edited from the sorties feature.
 */
export interface CalendarItem {
  uuid: string;
  type: CalendarEventType;
  name: string;
  description: string;
  location: string;
  /** Calendar day, `YYYY-MM-DD`. */
  date: string | null;
  /** Wall-clock time, `HH:mm:ss` — carries no date, see {@link date}. */
  startTime: string | null;
  /** Wall-clock time, `HH:mm:ss` — carries no date, see {@link date}. */
  endTime: string | null;
  status: CalendarStatus;
  /** Commune label, on mirrored outreaches only. */
  cityLabel: string;
  managedBy: EventManager | null;
  /** Set when this entry mirrors an outreach — links to `/sorties/:uuid`. */
  outreachUuid: string | null;
}

/** A standalone calendar event, mapped from `CalendarEventResponse`. */
export interface CalendarEvent {
  uuid: string;
  name: string;
  description: string;
  location: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  type: CalendarEventType;
  status: EventStatus;
  managedBy: EventManager | null;
}

/**
 * Editable fields when creating or updating a calendar event
 * (`CalendarEventRequest`). `status` is not sent — it moves through the
 * dedicated status endpoint.
 */
export interface CalendarEventInput {
  name: string;
  description: string;
  location: string;
  /** Calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Wall-clock time, `HH:MM`. */
  startTime: string;
  /** Wall-clock time, `HH:MM`. */
  endTime: string;
  type: CalendarEventType;
  managedByUuid: string | null;
}

/**
 * Filters the agenda applies server-side, mapped to the backend
 * `CalendarFilter`. The date window is required — it tracks the visible view
 * range. An empty {@link types} means "no type constraint" rather than "none".
 */
export interface CalendarFilter {
  /** Window lower bound, `YYYY-MM-DD` — inclusive. */
  from: string;
  /** Window upper bound, `YYYY-MM-DD` — inclusive. */
  to: string;
  /** Types to keep; empty for all. */
  types: CalendarEventType[];
  status: CalendarStatus | 'ALL';
  /** Responsible profile's uuid, or `'ALL'`. */
  managedByUuid: string;
  /** Free-text search across name, lieu… (`search`). */
  search: string;
}

/** Selectable manager option for the form and the filter bar. */
export interface ManagerOption {
  uuid: string;
  label: string;
}
