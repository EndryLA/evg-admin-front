import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toRawCreateUserRequest,
  toRawUserStatusRequest,
  toUser,
  type RawPage,
  type RawProfile,
  type RawUser,
} from './user.adapter';
import type { Option, User, UserInput } from './user.models';

const BASE = '/api/users';

/**
 * Gateway to `/api/users`. The backend exposes list / get / create plus a
 * status patch — an account's e-mail, role and member are fixed once created;
 * only access can be granted or revoked ({@link setStatus}). There is no
 * delete. Like the other lists it paginates without a search endpoint, so
 * {@link list} pulls the full set and the UI filters/sorts in memory.
 * {@link profiles} feeds the member picker — it reads the profiles endpoint
 * directly to avoid a cross-feature import.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  /** Fetch every account. */
  list(): Observable<User[]> {
    const params = new HttpParams().set('page', '0').set('size', '2000');
    return this.http
      .get<RawPage<RawUser>>(BASE, { params })
      .pipe(map((page) => (page.content ?? []).map(toUser)));
  }

  get(uuid: string): Observable<User> {
    return this.http.get<RawUser>(`${BASE}/${uuid}`).pipe(map(toUser));
  }

  create(input: UserInput): Observable<User> {
    return this.http.post<RawUser>(BASE, toRawCreateUserRequest(input)).pipe(map(toUser));
  }

  /** Grant or revoke access for an account. Returns the updated account. */
  setStatus(uuid: string, enabled: boolean): Observable<User> {
    return this.http
      .patch<RawUser>(`${BASE}/${uuid}/status`, toRawUserStatusRequest(enabled))
      .pipe(map(toUser));
  }

  /** Members an account can be attached to. */
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
