import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toCalendarEvent,
  toCalendarItem,
  toRawCalendarEventRequest,
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
 * profiles endpoint directly to avoid a cross-feature import.
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

  removeEvent(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/events/${uuid}`).pipe(map(() => undefined));
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
