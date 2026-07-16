import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toContactEntry,
  toOutreach,
  toOutreachAttendance,
  toOutreachPage,
  toRawOutreachRequest,
  type RawContactEntry,
  type RawOutreach,
  type RawOutreachAttendance,
  type RawPage,
} from './outreach.adapter';
import {
  EMPTY_OUTREACH_FILTER,
  type ContactEntry,
  type ManagerOption,
  type Outreach,
  type OutreachAttendance,
  type OutreachFilter,
  type OutreachInput,
  type OutreachPage,
  type OutreachStatus,
} from './outreach.models';

interface RawProfileLite {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}

const BASE = '/api/outreaches';

/**
 * Gateway to `/api/outreaches`. Like profiles, the backend paginates without a
 * search endpoint, so {@link list} fetches the full set and the UI filters in
 * memory. {@link managers} feeds the "responsable" selector — it reads the
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
   * attendance endpoint, so this pulls the collection and filters in memory —
   * reading `/api/attendances` directly to avoid a cross-feature import.
   */
  attendances(uuid: string): Observable<OutreachAttendance[]> {
    const params = new HttpParams().set('page', '0').set('size', '2000');
    return this.http.get<RawPage<RawOutreachAttendance>>('/api/attendances', { params }).pipe(
      map((page) =>
        (page.content ?? [])
          .filter((a) => a.outreachUuid === uuid)
          .map(toOutreachAttendance),
      ),
    );
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

  /** Manage-page operation: set the lifecycle status. */
  setStatus(uuid: string, status: OutreachStatus): Observable<Outreach> {
    return this.http
      .patch<RawOutreach>(`${BASE}/${uuid}/status`, { status })
      .pipe(map(toOutreach));
  }

  remove(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/${uuid}`).pipe(map(() => undefined));
  }

  /** Members selectable as the outreach's responsible person. */
  managers(): Observable<ManagerOption[]> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '2000')
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
