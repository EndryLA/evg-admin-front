import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, type Observable } from 'rxjs';

import {
  toAttendance,
  toRawAttendanceRequest,
  type RawAttendance,
} from './attendance.adapter';
import type {
  Attendance,
  AttendanceInput,
  AttendanceOption,
  PublicAttendanceInput,
} from './attendance.models';

interface RawPage<T> {
  content?: T[];
}
interface RawProfileLite {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}
interface RawOutreachLite {
  uuid?: string;
  name?: string;
}
interface RawOutreachName {
  name?: string;
}

const BASE = '/api/attendances';

/**
 * Gateway to `/api/attendances`. Like the other collections, the backend
 * paginates without a search or per-outreach endpoint, so {@link list} fetches
 * the full set and the UI filters (e.g. by outreach) in memory.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient);

  list(): Observable<Attendance[]> {
    const params = new HttpParams().set('page', '0').set('size', '100');
    return this.http
      .get<RawPage<RawAttendance>>(BASE, { params })
      .pipe(map((page) => (page.content ?? []).map(toAttendance)));
  }

  /** Fetch a single attendance by id. */
  getOne(uuid: string): Observable<Attendance> {
    return this.http.get<RawAttendance>(`${BASE}/${uuid}`).pipe(map(toAttendance));
  }

  create(input: AttendanceInput): Observable<Attendance> {
    return this.http
      .post<RawAttendance>(BASE, toRawAttendanceRequest(input))
      .pipe(map(toAttendance));
  }

  update(uuid: string, input: AttendanceInput): Observable<Attendance> {
    return this.http
      .put<RawAttendance>(`${BASE}/${uuid}`, toRawAttendanceRequest(input))
      .pipe(map(toAttendance));
  }

  remove(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/${uuid}`).pipe(map(() => undefined));
  }

  /**
   * Name of an outreach, for the public form's context line. Best-effort:
   * resolves to an empty string if the lookup fails so the form still renders.
   */
  outreachName(uuid: string): Observable<string> {
    return this.http.get<RawOutreachName>(`/api/outreaches/${uuid}`).pipe(
      map((o) => o.name ?? ''),
      catchError(() => of('')),
    );
  }

  /**
   * Public presence submission for a given outreach. There is no outreach-scoped
   * attendance endpoint, so this posts to the collection with the outreach id in
   * the body; no member linkage is sent from the public form.
   */
  submitPublic(outreachUuid: string, input: PublicAttendanceInput): Observable<void> {
    return this.http
      .post(
        BASE,
        toRawAttendanceRequest({
          firstname: input.firstname,
          lastname: input.lastname,
          invitedBy: input.invitedBy,
          type: input.type,
          profileUuid: null,
          outreachUuid,
        }),
      )
      .pipe(map(() => undefined));
  }

  /**
   * Outreaches selectable in the form's "Sortie" dropdown. Reads the outreaches
   * endpoint directly to avoid a cross-feature import.
   */
  outreaches(): Observable<AttendanceOption[]> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '100')
      .set('sort', 'startTime,desc');
    return this.http.get<RawPage<RawOutreachLite>>('/api/outreaches', { params }).pipe(
      map((page) =>
        (page.content ?? []).map((o) => ({
          uuid: o.uuid ?? '',
          label: o.name ?? '',
        })),
      ),
    );
  }

  /** Members selectable as the linked profile of a MEMBER attendance. */
  members(): Observable<AttendanceOption[]> {
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
