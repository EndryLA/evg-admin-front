import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

/** One web image hit, from the SerpAPI-backed proxy. */
export interface WebImage {
  title: string | null;
  /** Site the image comes from, e.g. `Wikipedia`. */
  source: string | null;
  /** Small preview — reliable, used for the grid and as a fallback. */
  thumbnail: string;
  /** Full-size image on its source site; may refuse to be fetched. */
  original: string | null;
  width: number | null;
  height: number | null;
}

/**
 * Gateway to `/api/images` — web image search (SerpAPI, Google Images) and the
 * same-origin image proxy. Base URL + auth token come from the core interceptor.
 */
@Injectable({ providedIn: 'root' })
export class ImageSearchService {
  private readonly http = inject(HttpClient);

  /** Images matching `query` (SafeSearch on, French results). */
  search(query: string): Observable<WebImage[]> {
    return this.http.get<WebImage[]>('/api/images/search', {
      params: new HttpParams().set('query', query),
    });
  }

  /** A remote image as a Blob, fetched through the backend so the canvas can
   *  export it (a cross-origin image would taint the canvas). */
  fetch(url: string): Observable<Blob> {
    return this.http.get('/api/images/proxy', {
      params: new HttpParams().set('url', url),
      responseType: 'blob',
    });
  }
}
