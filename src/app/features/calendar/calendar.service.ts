import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toPreRegistration,
  toPresence,
  toRawAttendanceRequest,
  type RawPreRegistration,
  type RawPresence,
} from '../../shared/attendance/attendance.adapter';
import type {
  PreRegistration,
  Presence,
  PresenceInput,
} from '../../shared/attendance/attendance.models';
import {
  toCalendarEvent,
  toCalendarItem,
  toRawCalendarEventRequest,
  toRawOutreachRequest,
  type RawCalendarEvent,
  type RawCalendarItem,
} from './calendar.adapter';
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarFilter,
  CalendarItem,
  EventStatus,
  ManagerOption,
  OutreachDraft,
} from './calendar.models';

interface RawPage<T> {
  content?: T[];
}

interface RawProfileLite {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}

const BASE = '/api/calendar';

/**
 * Gateway to `/api/calendar`. Two surfaces sit behind it: `GET /api/calendar`
 * is the read-only merged feed the grid renders (calendar events *and*
 * outreaches), while `/api/calendar/events` is CRUD over standalone events
 * only. {@link managers} feeds the "responsable" selectors — it reads the
 * profiles endpoint directly to avoid a cross-feature import. Events open to
 * sign-ups also carry pre-registrations and presences, read and written
 * through the shared attendance endpoints.
 */
@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);

  /**
   * Every agenda entry inside the filter's date window. The backend requires
   * `from`/`to`, so the caller passes the visible view range; the remaining
   * fields are sent only when they narrow the feed.
   */
  items(filter: CalendarFilter): Observable<CalendarItem[]> {
    let params = new HttpParams().set('from', filter.from).set('to', filter.to);

    for (const type of filter.types) {
      params = params.append('types', type);
    }
    if (filter.status !== 'ALL') {
      params = params.set('status', filter.status);
    }
    if (filter.managedByUuid !== 'ALL') {
      params = params.set('managedByUuid', filter.managedByUuid);
    }
    const search = filter.search.trim();
    if (search) {
      params = params.set('search', search);
    }

    return this.http
      .get<RawCalendarItem[]>(BASE, { params })
      .pipe(map((list) => (list ?? []).map(toCalendarItem)));
  }

  /** Fetch a single calendar event by id — backs the edit form. */
  getEvent(uuid: string): Observable<CalendarEvent> {
    return this.http
      .get<RawCalendarEvent>(`${BASE}/events/${uuid}`)
      .pipe(map(toCalendarEvent));
  }

  createEvent(input: CalendarEventInput): Observable<CalendarEvent> {
    return this.http
      .post<RawCalendarEvent>(`${BASE}/events`, toRawCalendarEventRequest(input))
      .pipe(map(toCalendarEvent));
  }

  updateEvent(uuid: string, input: CalendarEventInput): Observable<CalendarEvent> {
    return this.http
      .put<RawCalendarEvent>(`${BASE}/events/${uuid}`, toRawCalendarEventRequest(input))
      .pipe(map(toCalendarEvent));
  }

  /** Move an event through its lifecycle (planned → terminé / annulé). */
  setEventStatus(uuid: string, status: EventStatus): Observable<CalendarEvent> {
    return this.http
      .patch<RawCalendarEvent>(`${BASE}/events/${uuid}/status`, { status })
      .pipe(map(toCalendarEvent));
  }

  /**
   * Plan an outreach from the agenda. Outreaches live in the sorties feature,
   * but they are scheduled here alongside everything else — so this posts
   * `/api/outreaches` directly rather than importing that feature's service,
   * the same way {@link managers} reads the profiles endpoint. The response is
   * dropped: the agenda refetches its window, where the new sortie arrives
   * mirrored into the merged feed.
   */
  createOutreach(input: OutreachDraft): Observable<void> {
    return this.http
      .post('/api/outreaches', toRawOutreachRequest(input))
      .pipe(map(() => undefined));
  }

  removeEvent(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/events/${uuid}`).pipe(map(() => undefined));
  }

  /** People who signed up for the event ahead of time, oldest first. */
  preRegistrations(eventUuid: string): Observable<PreRegistration[]> {
    return this.http
      .get<RawPreRegistration[]>(`${BASE}/events/${eventUuid}/pre-attendances`)
      .pipe(map((list) => (list ?? []).map(toPreRegistration)));
  }

  /** Turn a sign-up into an actual presence (creates the attendance server-side). */
  confirmPreRegistration(uuid: string): Observable<PreRegistration> {
    return this.http
      .post<RawPreRegistration>(`/api/pre-attendances/${uuid}/confirm`, null)
      .pipe(map(toPreRegistration));
  }

  /** Everyone marked present at the event, oldest first. */
  presences(eventUuid: string): Observable<Presence[]> {
    return this.http
      .get<RawPresence[]>(`${BASE}/events/${eventUuid}/attendances`)
      .pipe(map((list) => (list ?? []).map(toPresence)));
  }

  /** Record someone present at the event, whatever its status. */
  addPresence(eventUuid: string, input: PresenceInput): Observable<Presence> {
    return this.http
      .post<RawPresence>('/api/attendances', toRawAttendanceRequest({ eventUuid }, input))
      .pipe(map(toPresence));
  }

  /** Remove a presence recorded by mistake. */
  removePresence(uuid: string): Observable<void> {
    return this.http.delete(`/api/attendances/${uuid}`).pipe(map(() => undefined));
  }

  /** Members selectable as an event's responsible person. */
  managers(): Observable<ManagerOption[]> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '100')
      .set('sort', 'lastname,asc');
    return this.http.get<RawPage<RawProfileLite>>('/api/profiles', { params }).pipe(
      map((page) =>
        (page.content ?? []).map((p) => ({
          uuid: p.uuid ?? '',
          label: `${p.firstname ?? ''} ${p.lastname ?? ''}`.trim(),
        })),
      ),
    );
  }
}
