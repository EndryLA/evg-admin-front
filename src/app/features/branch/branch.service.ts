import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toBranch,
  toBranchRole,
  toRawBranchRequest,
  type RawBranch,
  type RawBranchRole,
  type RawPage,
  type RawProfile,
} from './branch.adapter';
import type { Branch, BranchInput, BranchRole, Option } from './branch.models';

const BASE = '/api/branches';

/**
 * Gateway to `/api/branches`. Like the other features, the backend paginates
 * without a search endpoint, so {@link list} pulls the full set and the UI
 * filters/sorts in memory. {@link profiles} and {@link roles} feed the form
 * pickers — they read the profiles / branch-roles endpoints directly to avoid a
 * cross-feature import.
 */
@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly http = inject(HttpClient);

  /** Fetch every branch, sorted by name. */
  list(): Observable<Branch[]> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '100')
      .set('sort', 'name,asc');
    return this.http
      .get<RawPage<RawBranch>>(BASE, { params })
      .pipe(map((page) => (page.content ?? []).map(toBranch)));
  }

  get(uuid: string): Observable<Branch> {
    return this.http.get<RawBranch>(`${BASE}/${uuid}`).pipe(map(toBranch));
  }

  create(input: BranchInput): Observable<Branch> {
    return this.http
      .post<RawBranch>(BASE, toRawBranchRequest(input))
      .pipe(map(toBranch));
  }

  update(uuid: string, input: BranchInput): Observable<Branch> {
    return this.http
      .put<RawBranch>(`${BASE}/${uuid}`, toRawBranchRequest(input))
      .pipe(map(toBranch));
  }

  remove(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/${uuid}`).pipe(map(() => undefined));
  }

  /** Members selectable as a branch responsible or assignee. */
  profiles(): Observable<Option[]> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '100')
      .set('sort', 'lastname,asc');
    return this.http.get<RawPage<RawProfile>>('/api/profiles', { params }).pipe(
      map((page) =>
        (page.content ?? []).map((p) => ({
          uuid: p.uuid ?? '',
          label: `${p.firstname ?? ''} ${p.lastname ?? ''}`.trim(),
        })),
      ),
    );
  }

  /** The assignable branch-role catalog, for the role picker. */
  roles(): Observable<BranchRole[]> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '100')
      .set('sort', 'name,asc');
    return this.http
      .get<RawPage<RawBranchRole>>('/api/branch-roles', { params })
      .pipe(map((page) => (page.content ?? []).map(toBranchRole)));
  }
}
