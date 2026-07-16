import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toProfile,
  toProfilePage,
  toRawProfileRequest,
  type RawPage,
  type RawProfile,
} from './profile.adapter';
import {
  EMPTY_PROFILE_FILTER,
  type Page,
  type Profile,
  type ProfileFilter,
  type ProfileInput,
} from './profile.models';

const BASE = '/api/profiles';

/** Upper bound for {@link ProfileService.listAll} — the department is small. */
const ALL_SIZE = 2000;

/**
 * Gateway to `/api/profiles`. The list is paged and filtered server-side
 * (`GET /api/profiles?page&size&sort` + `ProfileFilter` fields); {@link listAll}
 * stays for the few places that need the whole set at once (team leaders).
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  /**
   * One server-side page of profiles (zero-based `page`), narrowed by the given
   * {@link ProfileFilter} and ordered by `sort` (a Spring `field,dir` string).
   * Only constrained fields are sent; `'ALL'`/`null`/empty values are omitted.
   */
  list(
    page: number,
    size: number,
    filter: ProfileFilter = EMPTY_PROFILE_FILTER,
    sort = 'lastname,asc',
  ): Observable<Page<Profile>> {
    let params = new HttpParams().set('page', page).set('size', size).set('sort', sort);

    const search = filter.search.trim();
    if (search) {
      params = params.set('search', search);
    }
    if (filter.membershipType !== 'ALL') {
      params = params.set('membershipType', filter.membershipType);
    }
    if (filter.firstDepartment !== null) {
      params = params.set('firstDepartment', filter.firstDepartment);
    }
    if (filter.leaderUuid) {
      params = params.set('leaderUuid', filter.leaderUuid);
    }
    if (filter.minJoinedAt !== null) {
      params = params.set('minJoinedAt', filter.minJoinedAt);
    }
    if (filter.maxJoinedAt !== null) {
      params = params.set('maxJoinedAt', filter.maxJoinedAt);
    }

    return this.http.get<RawPage<RawProfile>>(BASE, { params }).pipe(map(toProfilePage));
  }

  /** Fetch every profile, sorted by last name. */
  listAll(): Observable<Profile[]> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', ALL_SIZE)
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
