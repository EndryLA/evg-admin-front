import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toInventoryItem,
  toRawInventoryRequest,
  type RawInventoryItem,
  type RawPage,
  type RawProfile,
} from './inventory.adapter';
import type { InventoryInput, InventoryItem, Option } from './inventory.models';

const BASE = '/api/inventory-items';

/**
 * Gateway to `/api/inventory-items`. Like the profile/branch lists, the backend
 * paginates without a search endpoint, so {@link list} pulls the full set and
 * the UI filters/sorts in memory. {@link profiles} feeds the "responsable"
 * picker — it reads the profiles endpoint directly to avoid a cross-feature
 * import.
 */
@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);

  /** Fetch every inventory item, sorted by name. */
  list(): Observable<InventoryItem[]> {
    const params = new HttpParams().set('page', '0').set('size', '2000').set('sort', 'name,asc');
    return this.http
      .get<RawPage<RawInventoryItem>>(BASE, { params })
      .pipe(map((page) => (page.content ?? []).map(toInventoryItem)));
  }

  create(input: InventoryInput): Observable<InventoryItem> {
    return this.http.post<RawInventoryItem>(BASE, toRawInventoryRequest(input)).pipe(map(toInventoryItem));
  }

  update(uuid: string, input: InventoryInput): Observable<InventoryItem> {
    return this.http
      .put<RawInventoryItem>(`${BASE}/${uuid}`, toRawInventoryRequest(input))
      .pipe(map(toInventoryItem));
  }

  remove(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/${uuid}`).pipe(map(() => undefined));
  }

  /** Members selectable as the item's responsible. */
  profiles(): Observable<Option[]> {
    const params = new HttpParams().set('page', '0').set('size', '2000').set('sort', 'lastname,asc');
    return this.http.get<RawPage<RawProfile>>('/api/profiles', { params }).pipe(
      map((page) =>
        (page.content ?? []).map((p) => ({
          uuid: p.uuid ?? '',
          label: `${p.firstname ?? ''} ${p.lastname ?? ''}`.trim(),
        })),
      ),
    );
  }
}
