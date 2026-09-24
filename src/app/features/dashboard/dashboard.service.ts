import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import {
  toDashboardOutreach,
  toMonthPreAttendance,
  type RawMonthPreAttendance,
  type RawOutreach,
  type RawPage,
} from './dashboard.adapter';
import type {
  DashboardData,
  DashboardOutreach,
  MonthPreAttendance,
} from './dashboard.models';

/**
 * How many sorties are scanned when looking for the next one. The department
 * runs a handful a month, so this comfortably covers everything still ahead —
 * the soonest is picked from the batch once it is in chronological order.
 */
const UPCOMING_LIMIT = 50;

/** `ProfileResponse`, narrowed to the one field the greeting needs. */
interface RawProfileName {
  firstname?: string;
}

/** What the access token knows about the signed-in user. Either field may be
 *  absent, depending on the claims the backend puts in the token. */
export interface Account {
  profileUuid: string | null;
  email: string | null;
}

/**
 * Gateway for the dashboard.
 *
 * The dashboard is a read-only overview stitched from collections that belong
 * to other features, so it reads their endpoints directly rather than importing
 * their services — features never depend on each other. The name lookup is
 * best-effort: it degrades to an empty string rather than blanking the page.
 */
@Service()
export class DashboardService {
  private readonly http = inject(HttpClient);

  /**
   * Every piece of the dashboard, in one pass. `account` carries what the access
   * token knows about the signed-in user — both fields may be absent, and the
   * greeting then falls back to a name-less one.
   */
  load(today: string, account: Account): Observable<DashboardData> {
    return forkJoin({
      firstname: this.firstname(account),
      next: this.nextOutreach(today),
    });
  }

  /** Every sortie of `month` (`YYYY-MM`) with its pre-registration counts. */
  preAttendanceMonth(month: string): Observable<MonthPreAttendance[]> {
    return this.http
      .get<RawMonthPreAttendance[]>(`/api/pre-attendances/months/${month}/summary`)
      .pipe(map((list) => list.map(toMonthPreAttendance)));
  }

  /**
   * First name of the signed-in member, for the greeting.
   *
   * The token carries no name of its own, so the profile has to be looked up.
   * `profileUuid` is the direct route, but the claim isn't always present —
   * the account's e-mail is then searched against the roster, which indexes it.
   * Best-effort throughout: an empty string when neither route resolves.
   */
  private firstname({ profileUuid, email }: Account): Observable<string> {
    return this.firstnameByUuid(profileUuid).pipe(
      switchMap((name) => (name ? of(name) : this.firstnameByEmail(email))),
    );
  }

  private firstnameByUuid(profileUuid: string | null): Observable<string> {
    if (!profileUuid) {
      return of('');
    }
    return this.http.get<RawProfileName>(`/api/profiles/${profileUuid}`).pipe(
      map((profile) => profile.firstname ?? ''),
      catchError(() => of('')),
    );
  }

  private firstnameByEmail(email: string | null): Observable<string> {
    // The `sub` claim stands in for the e-mail and may hold a uuid instead;
    // only an actual address is worth searching for.
    if (!email?.includes('@')) {
      return of('');
    }
    const params = new HttpParams().set('page', 0).set('size', 1).set('search', email);
    return this.http.get<RawPage<RawProfileName>>('/api/profiles', { params }).pipe(
      map((page) => page.content?.[0]?.firstname ?? ''),
      catchError(() => of('')),
    );
  }

  /**
   * The soonest sortie dated `from` or later, cancelled ones dropped, or `null`
   * when none is planned. The backend sorts by `startTime` — a wall-clock time
   * carrying no date — so the chronological order is settled here, on the
   * date/time pair, over a window wide enough to hold every upcoming sortie.
   */
  private nextOutreach(from: string): Observable<DashboardOutreach | null> {
    const params = new HttpParams()
      .set('page', 0)
      .set('size', UPCOMING_LIMIT)
      .set('minDate', from);

    return this.http.get<RawPage<RawOutreach>>('/api/outreaches', { params }).pipe(
      map(
        (page) =>
          (page.content ?? [])
            .map(toDashboardOutreach)
            .filter((o) => o.status !== 'CANCELLED')
            .sort(byScheduleAsc)[0] ?? null,
      ),
    );
  }
}

/** Chronological order over the `date` + `startTime` pair; undated entries last. */
function byScheduleAsc(
  a: { date: string | null; startTime: string | null },
  b: { date: string | null; startTime: string | null },
): number {
  const left = `${a.date ?? '9999-12-31'} ${a.startTime ?? '99:99'}`;
  const right = `${b.date ?? '9999-12-31'} ${b.startTime ?? '99:99'}`;
  return left.localeCompare(right);
}
