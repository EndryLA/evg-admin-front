import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toInventoryOperation,
  toRawOperationRequest,
  type RawInventoryOperation,
  type RawPage,
} from './inventory.adapter';
import type { InventoryOperation, InventoryOperationInput } from './inventory.models';

const BASE = '/api/inventory-operations';

/**
 * Gateway to `/api/inventory-operations` — the stock movements recorded against
 * an item. Unlike the item list, this endpoint filters server-side, so
 * {@link listForItem} asks for one item's history rather than pulling all of it.
 *
 * Recording an operation moves the item's quantity backend-side, so callers
 * must refresh the item afterwards rather than adjusting it themselves.
 */
@Injectable({ providedIn: 'root' })
export class InventoryOperationService {
  private readonly http = inject(HttpClient);

  /** One item's history, most recent first. */
  listForItem(itemUuid: string): Observable<InventoryOperation[]> {
    const params = new HttpParams()
      .set('itemUuid', itemUuid)
      .set('page', '0')
      .set('size', '100')
      .set('sort', 'createdAt,desc');
    return this.http
      .get<RawPage<RawInventoryOperation>>(BASE, { params })
      .pipe(map((page) => (page.content ?? []).map(toInventoryOperation)));
  }

  /** Record a movement. Rejected by the backend if it doesn't match the item's
   *  type, or would drive the stock below zero. */
  create(input: InventoryOperationInput): Observable<InventoryOperation> {
    return this.http
      .post<RawInventoryOperation>(BASE, toRawOperationRequest(input))
      .pipe(map(toInventoryOperation));
  }
}
