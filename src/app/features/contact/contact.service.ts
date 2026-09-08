import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, type Observable } from 'rxjs';

import {
  toContact,
  toContactGroup,
  toMyContacts,
  toRawPublicContactRequest,
  type RawContactEntry,
  type RawContactGroup,
  type RawMyContacts,
} from './contact.adapter';
import {
  EMPTY_CONTACT_FILTER,
  type Contact,
  type ContactFilter,
  type ContactGroup,
  type MyContacts,
  type PublicContactInput,
} from './contact.models';

/** The slice of `OutreachResponse` this feature reads directly (see below). */
interface RawOutreachLite {
  name?: string;
}

const BASE = '/api/contact-entries';

/**
 * Gateway to the contact-entry API. The list is read through the grouped
 * endpoint, which buckets every matching entry under its outreach — it does not
 * paginate, so the caller is responsible for bounding the query (the list does
 * it with a one-year date window).
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);

  /**
   * Every contact matching the given {@link ContactFilter}, bucketed under the
   * outreach it was collected at (`GET /api/contact-entries/grouped`). Only
   * constrained filter fields are sent as query params; `'ALL'`/empty values are
   * omitted. The endpoint returns the full result set — always narrow it by a
   * date window.
   */
  grouped(filter: ContactFilter = EMPTY_CONTACT_FILTER): Observable<ContactGroup[]> {
    let params = new HttpParams();

    const search = filter.search.trim();
    if (search) {
      params = params.set('search', search);
    }
    if (filter.type !== 'ALL') {
      params = params.set('type', filter.type);
    }
    // A specific sector filters by number; "Non renseigné" asks the backend for
    // contacts not routable to any sector via the dedicated `hasSector` flag.
    if (typeof filter.sector === 'number') {
      params = params.set('sector', filter.sector);
    } else if (filter.sector === 'UNASSIGNED') {
      params = params.set('hasSector', false);
    }
    if (filter.minDate) {
      params = params.set('minOutreachDate', filter.minDate);
    }
    if (filter.maxDate) {
      params = params.set('maxOutreachDate', filter.maxDate);
    }

    return this.http
      .get<RawContactGroup[]>(`${BASE}/grouped`, { params })
      .pipe(map((groups) => (groups ?? []).map(toContactGroup)));
  }

  /** A single contact by id — backs the detail page. */
  getOne(uuid: string): Observable<Contact> {
    return this.http.get<RawContactEntry>(`${BASE}/${uuid}`).pipe(map(toContact));
  }

  /**
   * Name of the outreach a contact belongs to, for the detail page's link.
   * Best-effort: resolves to an empty string if the lookup fails (e.g. the
   * outreach endpoint is unavailable), so the detail still renders.
   */
  outreachName(uuid: string): Observable<string> {
    return this.http.get<RawOutreachLite>(`/api/outreaches/${uuid}`).pipe(
      map((o) => o.name ?? ''),
      catchError(() => of('')),
    );
  }

  /**
   * Public submission for a given outreach — no authentication required. Passes
   * the caller's edit token (if any) so their contacts group together, and
   * returns the token from the response so the front can store it.
   */
  submitPublic(
    outreachUuid: string,
    input: PublicContactInput,
    token: string | null,
  ): Observable<string> {
    let params = new HttpParams();
    if (token) {
      params = params.set('token', token);
    }
    return this.http
      .post<RawContactEntry>(
        `/api/outreaches/${outreachUuid}/contact-entries`,
        toRawPublicContactRequest(input),
        { params },
      )
      .pipe(map((raw) => raw.submitterToken ?? ''));
  }

  /**
   * The contacts a submitter added to an outreach, by their edit token, plus the
   * outreach status. The list is empty once the outreach is no longer open.
   */
  myContacts(outreachUuid: string, token: string): Observable<MyContacts> {
    const params = new HttpParams().set('token', token);
    return this.http
      .get<RawMyContacts>(`/api/outreaches/${outreachUuid}/contact-entries/mine`, { params })
      .pipe(map(toMyContacts));
  }

  /** Public edit of one of the submitter's contacts, while the outreach is open. */
  updatePublic(
    outreachUuid: string,
    contactUuid: string,
    token: string,
    input: PublicContactInput,
  ): Observable<Contact> {
    const params = new HttpParams().set('token', token);
    return this.http
      .put<RawContactEntry>(
        `/api/outreaches/${outreachUuid}/contact-entries/${contactUuid}`,
        toRawPublicContactRequest(input),
        { params },
      )
      .pipe(map(toContact));
  }
}
