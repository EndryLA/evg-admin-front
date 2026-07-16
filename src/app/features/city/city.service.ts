import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toCity,
  toCityPage,
  toCitySuggestion,
  type RawCity,
  type RawCitySuggestion,
  type RawPage,
} from './city.adapter';
import type { City, CityPage, CitySuggestion } from './city.models';

const BASE = '/api/cities';

/**
 * Gateway to `/api/cities`. The backend exposes: the full paginated list
 * ({@link list}), the sector-less triage subset ({@link unassigned}), a
 * référentiel autocomplete ({@link search}) and the sector assignment
 * ({@link assignSector}).
 */
@Injectable({ providedIn: 'root' })
export class CityService {
  private readonly http = inject(HttpClient);

  /**
   * One server-side page of communes, sorted by name — backs the infinite
   * scroll on the Annuaire. The backend paginates without sector/department
   * filters, so the UI filters the loaded rows in memory.
   */
  list(page: number, size: number): Observable<CityPage> {
    const params = new HttpParams().set('page', page).set('size', size).set('sort', 'officialName,asc');
    return this.http.get<RawPage<RawCity>>(BASE, { params }).pipe(map(toCityPage));
  }

  /** Communes tracked in the database that have no sector yet. */
  unassigned(): Observable<City[]> {
    return this.http
      .get<RawCity[]>(`${BASE}/unassigned`)
      .pipe(map((list) => (list ?? []).map(toCity)));
  }

  /** Référentiel lookup by name/postal code — informational suggestions. */
  search(q: string): Observable<CitySuggestion[]> {
    const params = new HttpParams().set('q', q);
    return this.http
      .get<RawCitySuggestion[]>(`${BASE}/search`, { params })
      .pipe(map((list) => (list ?? []).map(toCitySuggestion)));
  }

  /**
   * Register a commune in the database from a référentiel suggestion, keyed by
   * its INSEE code, with an optional sector. The backend resolves the official
   * name / postal code / department from the INSEE code.
   */
  register(inseeCode: number, sector: number | null): Observable<City> {
    const body: { inseeCode: number; sector?: number } = { inseeCode };
    if (sector != null) {
      body.sector = sector;
    }
    return this.http.post<RawCity>(BASE, body).pipe(map(toCity));
  }

  /** Assign a sector number to a commune. */
  assignSector(uuid: string, sector: number): Observable<City> {
    return this.http.patch<RawCity>(`${BASE}/${uuid}/sector`, { sector }).pipe(map(toCity));
  }
}
