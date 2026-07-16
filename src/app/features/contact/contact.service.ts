import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, type Observable } from 'rxjs';

import {
  toContact,
  toContactPage,
  toRawPublicContactRequest,
  type RawContactEntry,
  type RawPage,
} from './contact.adapter';
import {
  EMPTY_CONTACT_FILTER,
  type Contact,
  type ContactFilter,
  type Page,
  type PublicContactInput,
} from './contact.models';

interface RawOutreachLite {
  name?: string;
}

const BASE = '/api/contact-entries';

/**
 * Gateway to the contact-entry API. Unlike the profile/outreach lists — which
 * pull the whole set and page in memory — contacts are paged server-side
 * through the `Page<T>` wrapper, since they can grow without bound.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);

  /**
   * One server-side page of contacts (zero-based `page`), narrowed by the given
   * {@link ContactFilter}. Only constrained fields are sent as query params;
   * `'ALL'`/empty values are omitted.
   */
  list(
    page: number,
    size: number,
    filter: ContactFilter = EMPTY_CONTACT_FILTER,
  ): Observable<Page<Contact>> {
    let params = new HttpParams().set('page', page).set('size', size);

    const search = filter.search.trim();
    if (search) {
      params = params.set('search', search);
    }
    if (filter.type !== 'ALL') {
      params = params.set('type', filter.type);
    }
    if (filter.civilState !== 'ALL') {
      params = params.set('civilState', filter.civilState);
    }
    // A specific sector filters by number; "Non renseigné" asks the backend for
    // contacts not routable to any sector via the dedicated `hasSector` flag.
    if (typeof filter.sector === 'number') {
      params = params.set('sector', filter.sector);
    } else if (filter.sector === 'UNASSIGNED') {
      params = params.set('hasSector', false);
    }
    const evangelizedBy = filter.evangelizedBy.trim();
    if (evangelizedBy) {
      params = params.set('evangelizedBy', evangelizedBy);
    }
    if (filter.minDate) {
      params = params.set('minOutreachDate', filter.minDate);
    }
    if (filter.maxDate) {
      params = params.set('maxOutreachDate', filter.maxDate);
    }

    return this.http
      .get<RawPage<RawContactEntry>>(BASE, { params })
      .pipe(map(toContactPage));
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

  /** Public submission for a given outreach — no authentication required. */
  submitPublic(outreachUuid: string, input: PublicContactInput): Observable<void> {
    return this.http
      .post(`/api/outreaches/${outreachUuid}/contact-entries`, toRawPublicContactRequest(input))
      .pipe(map(() => undefined));
  }
}
