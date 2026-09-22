import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

/** A rail line serving a stop, from the IDFM-backed proxy. */
export interface TransitLine {
  lineId: string;
  shortName: string;
  /** Network name, e.g. `RER`, `METRO`, `TRAMWAY`, `TER`. */
  network: string | null;
  /** Hex without `#`, or null — used only to colour the picker chip. */
  color: string | null;
  textColor: string | null;
  /** IDFM file id of the official pictogram, or null. */
  pictoId: string | null;
}

/** A rail stop matched by name, with the lines that serve it. */
export interface TransitStop {
  stopId: string;
  name: string;
  city: string | null;
  lat: number | null;
  lon: number | null;
  routes: TransitLine[];
}

/**
 * Gateway to `/api/transit` — the backend proxy over Île-de-France Mobilités
 * open data. Base URL + auth token are attached by the core HTTP interceptor.
 */
@Injectable({ providedIn: 'root' })
export class TransitService {
  private readonly http = inject(HttpClient);

  /** Île-de-France rail stops matching `query`, each with the lines serving it. */
  searchStops(query: string): Observable<TransitStop[]> {
    return this.http.get<TransitStop[]>('/api/transit/stops', {
      params: new HttpParams().set('query', query),
    });
  }

  /** The official pictogram for a line, as a Blob (fetched with auth, so it can
   *  be turned into a same-origin object URL the canvas can export). */
  picto(pictoId: string): Observable<Blob> {
    return this.http.get(`/api/transit/picto/${pictoId}`, { responseType: 'blob' });
  }
}
