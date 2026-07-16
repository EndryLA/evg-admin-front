import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toBranchMember,
  toRawProfileBranchRequest,
  type RawPage,
  type RawProfileBranch,
} from './branch.adapter';
import type { BranchMember, BranchMemberInput } from './branch.models';

const BASE = '/api/profile-branches';

/**
 * Gateway to `/api/profile-branches` — the member↔branch assignments (formerly
 * "affectations"). The backend offers no by-branch filter, so {@link list}
 * pulls every assignment and the branch UI groups them by branch in memory.
 */
@Injectable({ providedIn: 'root' })
export class BranchMembershipService {
  private readonly http = inject(HttpClient);

  /** Fetch every assignment across all branches. */
  list(): Observable<BranchMember[]> {
    const params = new HttpParams().set('page', '0').set('size', '2000');
    return this.http
      .get<RawPage<RawProfileBranch>>(BASE, { params })
      .pipe(map((page) => (page.content ?? []).map(toBranchMember)));
  }

  /** Assign a member to a branch. */
  add(input: BranchMemberInput): Observable<BranchMember> {
    return this.http
      .post<RawProfileBranch>(BASE, toRawProfileBranchRequest(input))
      .pipe(map(toBranchMember));
  }

  /** Remove an assignment. */
  remove(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/${uuid}`).pipe(map(() => undefined));
  }
}
