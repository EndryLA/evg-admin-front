import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toCreatedTicket,
  toProjectOption,
  toSuggestion,
  type RawCreatedTicket,
  type RawPage,
  type RawProjectOption,
  type RawSuggestion,
} from './suggestion.adapter';
import type {
  CreatedTicket,
  ProjectOption,
  ReviewDecision,
  Suggestion,
  SuggestionInput,
  TicketFromSuggestionsInput,
} from './suggestion.models';

const BASE = '/api/suggestions';

/** Upper bound for "load everything" lists; filtering and sorting happen in memory. */
const ALL = '500';

/**
 * Gateway to `/api/suggestions`. Creation and new attachments go as multipart
 * (a JSON `suggestion` part plus `files`); attachment bytes are fetched as blobs
 * because `<img>`/`<video>` can't send the bearer token themselves.
 */
@Service()
export class SuggestionService {
  private readonly http = inject(HttpClient);

  /** Every suggestion (admins only). */
  list(): Observable<Suggestion[]> {
    return this.page(BASE);
  }

  /** The signed-in member's own suggestions, with their status and reply. */
  mine(): Observable<Suggestion[]> {
    return this.page(`${BASE}/mine`);
  }

  getOne(uuid: string): Observable<Suggestion> {
    return this.http.get<RawSuggestion>(`${BASE}/${uuid}`).pipe(map(toSuggestion));
  }

  create(input: SuggestionInput, files: File[]): Observable<Suggestion> {
    const body = new FormData();
    body.append(
      'suggestion',
      new Blob([JSON.stringify(clean(input))], { type: 'application/json' }),
    );
    files.forEach((file) => body.append('files', file, file.name));
    return this.http.post<RawSuggestion>(BASE, body).pipe(map(toSuggestion));
  }

  update(uuid: string, input: SuggestionInput): Observable<Suggestion> {
    return this.http.put<RawSuggestion>(`${BASE}/${uuid}`, clean(input)).pipe(map(toSuggestion));
  }

  remove(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/${uuid}`).pipe(map(() => undefined));
  }

  addAttachments(uuid: string, files: File[]): Observable<Suggestion> {
    const body = new FormData();
    files.forEach((file) => body.append('files', file, file.name));
    return this.http
      .post<RawSuggestion>(`${BASE}/${uuid}/attachments`, body)
      .pipe(map(toSuggestion));
  }

  removeAttachment(uuid: string, attachmentUuid: string): Observable<Suggestion> {
    return this.http
      .delete<RawSuggestion>(`${BASE}/${uuid}/attachments/${attachmentUuid}`)
      .pipe(map(toSuggestion));
  }

  attachmentBlob(uuid: string, attachmentUuid: string): Observable<Blob> {
    return this.http.get(`${BASE}/${uuid}/attachments/${attachmentUuid}/content`, {
      responseType: 'blob',
    });
  }

  review(uuid: string, decision: ReviewDecision, message: string): Observable<Suggestion> {
    return this.http
      .post<RawSuggestion>(`${BASE}/${uuid}/review`, { decision, message: message.trim() })
      .pipe(map(toSuggestion));
  }

  /**
   * Projects a ticket can be created in. Read straight from `/api/projects` so
   * this feature doesn't import the project one.
   */
  projectOptions(): Observable<ProjectOption[]> {
    const params = new HttpParams().set('page', '0').set('size', '200').set('sort', 'name,asc');
    return this.http
      .get<RawPage<RawProjectOption>>('/api/projects', { params })
      .pipe(map((page) => (page.content ?? []).map(toProjectOption)));
  }

  /** Creates a ticket that takes the given accepted suggestions into account (one request). */
  createTicket(input: TicketFromSuggestionsInput): Observable<CreatedTicket> {
    return this.http
      .post<RawCreatedTicket>('/api/tickets/from-suggestions', {
        ...input,
        title: input.title.trim(),
        description: input.description.trim(),
        typeUuid: input.typeUuid || null,
      })
      .pipe(map(toCreatedTicket));
  }

  private page(url: string): Observable<Suggestion[]> {
    return this.http
      .get<RawPage<RawSuggestion>>(url, {
        params: new HttpParams().set('page', '0').set('size', ALL).set('sort', 'createdAt,desc'),
      })
      .pipe(map((page) => (page.content ?? []).map(toSuggestion)));
  }
}

function clean(input: SuggestionInput): SuggestionInput {
  return { title: input.title.trim(), description: input.description.trim() };
}
