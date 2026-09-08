import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toCityContacts,
  toOutreachPresenceCounts,
  toSectorContacts,
  toTerrainReport,
  type RawCityContacts,
  type RawOutreachPresenceCounts,
  type RawSectorContacts,
  type RawTerrainReport,
} from './terrain-stats.adapter';
import type {
  CityContacts,
  OutreachPresenceCounts,
  SectorContacts,
  StatsQuery,
  TerrainReport,
} from './terrain-stats.models';

const BASE = '/api/stats';

/**
 * Gateway to the field statistics behind the "Stats terrain" bilan. Both calls
 * take the same optional query (server-side `period` preset or custom
 * `from`/`to`, plus team/outreach/city scoping); omit everything for
 * department-wide, all-time figures.
 */
@Injectable({ providedIn: 'root' })
export class TerrainStatsService {
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

  /** Contacts/conversions over the range: headline summary, monthly totals, per sortie. */
  terrain(query: StatsQuery): Observable<TerrainReport> {
    return this.http
      .get<RawTerrainReport>(`${BASE}/outreach`, { params: this.queryParams(query) })
      .pipe(map(toTerrainReport));
  }

  /** The same figures broken down by city, most conversions first is left to the caller. */
  cities(query: StatsQuery): Observable<CityContacts[]> {
    return this.http
      .get<RawCityContacts[]>(`${BASE}/outreach/cities`, { params: this.queryParams(query) })
      .pipe(map((list) => (list ?? []).map(toCityContacts)));
  }

  /** The same figures broken down by sector. */
  sectors(query: StatsQuery): Observable<SectorContacts[]> {
    return this.http
      .get<RawSectorContacts[]>(`${BASE}/outreach/sectors`, { params: this.queryParams(query) })
      .pipe(map((list) => (list ?? []).map(toSectorContacts)));
  }

  /**
   * Per-sortie presence counts, used for the effectif columns. The contacts
   * endpoint carries no attendance figures, so the two are joined on
   * `outreachUuid` in the page.
   */
  presences(query: StatsQuery): Observable<OutreachPresenceCounts[]> {
    return this.http
      .get<RawOutreachPresenceCounts[]>(`${BASE}/outreaches`, {
        params: this.queryParams(query),
      })
      .pipe(map((list) => (list ?? []).map(toOutreachPresenceCounts)));
  }
}
