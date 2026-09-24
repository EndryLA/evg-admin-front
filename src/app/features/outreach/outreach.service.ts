import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, reduce, type Observable } from 'rxjs';

import {
  toContactEntry,
  toOutreach,
  toOutreachAttendance,
  toOutreachPage,
  toOutreachPreAttendance,
  toRawAttendanceRequest,
  toRawOutreachRequest,
  type RawContactEntry,
  type RawOutreach,
  type RawOutreachAttendance,
  type RawOutreachPreAttendance,
  type RawPage,
} from './outreach.adapter';
import {
  EMPTY_OUTREACH_FILTER,
  type ContactEntry,
  type ManagerOption,
  type Outreach,
  type OutreachAttendance,
  type OutreachAttendanceInput,
  type OutreachFilter,
  type OutreachInput,
  type OutreachPage,
  type OutreachPreAttendance,
  type OutreachStatus,
} from './outreach.models';

interface RawProfileLite {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}

const BASE = '/api/outreaches';

/** Attendances per request when walking every page (the backend caps a page at 2000). */
const ATTENDANCE_FETCH_SIZE = 1000;

/**
 * Gateway to `/api/outreaches`. Like profiles, the backend paginates without a
 * search endpoint, so {@link list} fetches the full set and the UI filters in
 * memory. {@link managers} feeds the "superviseur" selector — it reads the
 * profiles endpoint directly to avoid a cross-feature import.
 */
@Injectable({ providedIn: 'root' })
export class OutreachService {
  private readonly http = inject(HttpClient);

  /**
   * One server-side page of outreaches (zero-based `page`), narrowed by the
   * given {@link OutreachFilter} and ordered by `sort` (e.g. `startTime,desc`).
   * Only constrained filter fields are sent as query params.
   */
  list(
    page: number,
    size: number,
    filter: OutreachFilter = EMPTY_OUTREACH_FILTER,
    sort = 'startTime,desc',
  ): Observable<OutreachPage> {
    let params = new HttpParams().set('page', page).set('size', size).set('sort', sort);

    const search = filter.search.trim();
    if (search) {
      params = params.set('search', search);
    }
    if (filter.status !== 'ALL') {
      params = params.set('status', filter.status);
    }
    if (typeof filter.sector === 'number') {
      params = params.set('sector', filter.sector);
    } else if (filter.sector === 'UNASSIGNED') {
      params = params.set('hasSector', false);
    }
    if (filter.managedByUuid !== 'ALL') {
      params = params.set('managedByUuid', filter.managedByUuid);
    }
    if (filter.minDate) {
      params = params.set('minDate', filter.minDate);
    }
    if (filter.maxDate) {
      params = params.set('maxDate', filter.maxDate);
    }

    return this.http.get<RawPage<RawOutreach>>(BASE, { params }).pipe(map(toOutreachPage));
  }

  /** Fetch a single outreach by id — backs the detail page. */
  getOne(uuid: string): Observable<Outreach> {
    return this.http.get<RawOutreach>(`${BASE}/${uuid}`).pipe(map(toOutreach));
  }

  /** People met during the given outreach (`ContactEntryResponse[]`). */
  contactEntries(uuid: string): Observable<ContactEntry[]> {
    return this.http
      .get<RawContactEntry[]>(`/api/contact-entries/outreach/${uuid}`)
      .pipe(map((list) => (list ?? []).map(toContactEntry)));
  }

  /**
   * Presences recorded for the given outreach. The backend has no per-outreach
   * attendance endpoint, so this pulls the whole collection and filters in
   * memory — reading `/api/attendances` directly to avoid a cross-feature
   * import. Every page is walked: stopping at the first one would silently drop
   * the presences of all but the most recent sorties.
   */
  attendances(uuid: string): Observable<OutreachAttendance[]> {
    const fetchPage = (page: number) =>
      this.http.get<RawPage<RawOutreachAttendance>>('/api/attendances', {
        params: new HttpParams().set('page', page).set('size', ATTENDANCE_FETCH_SIZE),
      });
    return fetchPage(0).pipe(
      expand((res, i) => (res.last === false ? fetchPage(i + 1) : EMPTY)),
      reduce<RawPage<RawOutreachAttendance>, OutreachAttendance[]>(
        (all, res) =>
          all.concat(
            (res.content ?? [])
              .filter((a) => a.outreachUuid === uuid)
              .map(toOutreachAttendance),
          ),
        [],
      ),
    );
  }

  /**
   * Record a presence for this outreach. Goes to the authenticated collection
   * endpoint (not the public outreach-scoped one), so staff can add someone
   * whatever the sortie's status.
   */
  createAttendance(
    outreachUuid: string,
    input: OutreachAttendanceInput,
  ): Observable<OutreachAttendance> {
    return this.http
      .post<RawOutreachAttendance>(
        '/api/attendances',
        toRawAttendanceRequest({ outreachUuid }, input),
      )
      .pipe(map(toOutreachAttendance));
  }

  /** Remove a presence recorded by mistake. */
  removeAttendance(uuid: string): Observable<void> {
    return this.http.delete(`/api/attendances/${uuid}`).pipe(map(() => undefined));
  }

  /** People who signed up before the outreach started, oldest first. */
  preAttendances(uuid: string): Observable<OutreachPreAttendance[]> {
    return this.http
      .get<RawOutreachPreAttendance[]>(`${BASE}/${uuid}/pre-attendances`)
      .pipe(map((list) => (list ?? []).map(toOutreachPreAttendance)));
  }

  /** Turn a sign-up into an actual presence (creates the attendance server-side). */
  confirmPreAttendance(uuid: string): Observable<OutreachPreAttendance> {
    return this.http
      .post<RawOutreachPreAttendance>(`/api/pre-attendances/${uuid}/confirm`, null)
      .pipe(map(toOutreachPreAttendance));
  }

  removePreAttendance(uuid: string): Observable<void> {
    return this.http.delete(`/api/pre-attendances/${uuid}`).pipe(map(() => undefined));
  }

  create(input: OutreachInput): Observable<Outreach> {
    return this.http
      .post<RawOutreach>(BASE, toRawOutreachRequest(input))
      .pipe(map(toOutreach));
  }

  update(uuid: string, input: OutreachInput): Observable<Outreach> {
    return this.http
      .put<RawOutreach>(`${BASE}/${uuid}`, toRawOutreachRequest(input))
      .pipe(map(toOutreach));
  }

  /**
   * Manage-page operation: set the lifecycle status. Closing a sortie also
   * records the head count — `totalPresences` is sent only when given, so the
   * other transitions leave it untouched.
   */
  setStatus(
    uuid: string,
    status: OutreachStatus,
    totalPresences: number | null = null,
  ): Observable<Outreach> {
    const body: { status: OutreachStatus; totalPresences?: number } = { status };
    if (totalPresences !== null) {
      body.totalPresences = totalPresences;
    }
    return this.http
      .patch<RawOutreach>(`${BASE}/${uuid}/status`, body)
      .pipe(map(toOutreach));
  }

  remove(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/${uuid}`).pipe(map(() => undefined));
  }

  /** Members selectable as the outreach's responsible person, or as the linked
   *  profile of a MEMBER presence. */
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
