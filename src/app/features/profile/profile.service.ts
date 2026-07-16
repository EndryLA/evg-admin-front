import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toProfile,
  toRawProfileRequest,
  type RawPage,
  type RawProfile,
} from './profile.adapter';
import type { Profile, ProfileInput } from './profile.models';

const BASE = '/api/profiles';

/**
 * Gateway to `/api/profiles`. The backend paginates but offers no search
 * endpoint, so {@link list} pulls the full set and the UI filters/sorts in
 * memory (department membership is small enough for this to be cheap).
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  /** Fetch every profile, sorted by last name. */
  list(): Observable<Profile[]> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '2000')
      .set('sort', 'lastname,asc');
    return this.http
      .get<RawPage<RawProfile>>(BASE, { params })
      .pipe(map((page) => (page.content ?? []).map(toProfile)));
  }

  get(uuid: string): Observable<Profile> {
    return this.http.get<RawProfile>(`${BASE}/${uuid}`).pipe(map(toProfile));
  }

  create(input: ProfileInput): Observable<Profile> {
    return this.http
      .post<RawProfile>(BASE, toRawProfileRequest(input))
      .pipe(map(toProfile));
  }

  update(uuid: string, input: ProfileInput): Observable<Profile> {
    return this.http
      .put<RawProfile>(`${BASE}/${uuid}`, toRawProfileRequest(input))
      .pipe(map(toProfile));
  }

  remove(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/${uuid}`).pipe(map(() => undefined));
  }

  /** Promote or demote a member as a team leader (`SetTeamLeaderRequest`). */
  setTeamLeader(uuid: string, teamLeader: boolean): Observable<Profile> {
    return this.http
      .patch<RawProfile>(`${BASE}/${uuid}/team-leader`, { teamLeader })
      .pipe(map(toProfile));
  }

  /** Assign the team leader a member reports to (`AssignLeaderRequest`). */
  assignLeader(uuid: string, leaderUuid: string): Observable<Profile> {
    return this.http
      .patch<RawProfile>(`${BASE}/${uuid}/leader`, { leaderUuid })
      .pipe(map(toProfile));
  }
}
