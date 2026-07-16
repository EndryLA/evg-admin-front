import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toAttendanceSummary,
  toOutreachAttendance,
  toProfilePresence,
  toTeamStats,
  type RawAttendanceSummary,
  type RawOutreachAttendance,
  type RawProfilePresence,
  type RawTeamStats,
} from './attendance-stats.adapter';
import type {
  AttendanceSummary,
  OutreachAttendance,
  ProfilePresence,
  StatsQuery,
  TeamStats,
} from './attendance-stats.models';

const BASE = '/api/stats';

/**
 * Gateway to `/api/stats` — the department-wide presence statistics that back
 * the Présences dashboard. Every endpoint takes an optional query (server-side
 * `period` preset or custom `from`/`to`, plus optional team/outreach/city
 * scoping); omit everything for department-wide, all-time figures.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceStatsService {
  private readonly http = inject(HttpClient);

  /** Attach every set query field as a request param. */
  private queryParams(query: StatsQuery): HttpParams {
    let params = new HttpParams();
    if (query.period) {
      params = params.set('period', query.period);
    }
    if (query.from) {
      params = params.set('from', query.from);
    }
    if (query.to) {
      params = params.set('to', query.to);
    }
    if (query.teamLeader) {
      params = params.set('teamLeader', query.teamLeader);
    }
    if (query.outreach) {
      params = params.set('outreach', query.outreach);
    }
    if (query.city) {
      params = params.set('city', query.city);
    }
    return params;
  }

  /** Aggregate totals over the range. */
  summary(query: StatsQuery): Observable<AttendanceSummary> {
    return this.http
      .get<RawAttendanceSummary>(`${BASE}/summary`, { params: this.queryParams(query) })
      .pipe(map(toAttendanceSummary));
  }

  /** Per-outreach attendance breakdown (chronological). */
  outreaches(query: StatsQuery): Observable<OutreachAttendance[]> {
    return this.http
      .get<RawOutreachAttendance[]>(`${BASE}/outreaches`, { params: this.queryParams(query) })
      .pipe(map((list) => (list ?? []).map(toOutreachAttendance)));
  }

  /** Top members by number of attendances (capped at `limit`). */
  profiles(query: StatsQuery, limit = 10): Observable<ProfilePresence[]> {
    const params = this.queryParams(query).set('limit', String(limit));
    return this.http
      .get<RawProfilePresence[]>(`${BASE}/profiles`, { params })
      .pipe(map((list) => (list ?? []).map(toProfilePresence)));
  }

  /** All members with their presence figures. */
  allProfiles(query: StatsQuery): Observable<ProfilePresence[]> {
    return this.http
      .get<RawProfilePresence[]>(`${BASE}/profiles/all`, { params: this.queryParams(query) })
      .pipe(map((list) => (list ?? []).map(toProfilePresence)));
  }

  /** Per team-leader aggregate presence figures. */
  teams(query: StatsQuery): Observable<TeamStats[]> {
    return this.http
      .get<RawTeamStats[]>(`${BASE}/teams`, { params: this.queryParams(query) })
      .pipe(map((list) => (list ?? []).map(toTeamStats)));
  }
}
