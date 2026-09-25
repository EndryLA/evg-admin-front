import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toLinkableSuggestion,
  toRawTicketRequest,
  toTicket,
  type RawPage,
  type RawSuggestionSummary,
  type RawTicket,
} from './project.adapter';
import type { LinkableSuggestion, Ticket, TicketInput } from './project.models';

const BASE = '/api/tickets';

/**
 * Gateway to `/api/tickets` (and ticket creation under a project). A project's
 * tickets are loaded whole and filtered in memory by the table, like the other
 * lists of the app.
 */
@Service()
export class TicketService {
  private readonly http = inject(HttpClient);

  listForProject(projectUuid: string): Observable<Ticket[]> {
    const params = new HttpParams()
      .set('projectUuid', projectUuid)
      .set('page', '0')
      .set('size', '1000');
    return this.http
      .get<RawPage<RawTicket>>(BASE, { params })
      .pipe(map((page) => (page.content ?? []).map(toTicket)));
  }

  getOne(uuid: string): Observable<Ticket> {
    return this.http.get<RawTicket>(`${BASE}/${uuid}`).pipe(map(toTicket));
  }

  create(projectUuid: string, input: TicketInput): Observable<Ticket> {
    return this.http
      .post<RawTicket>(`/api/projects/${projectUuid}/tickets`, toRawTicketRequest(input))
      .pipe(map(toTicket));
  }

  update(uuid: string, input: TicketInput): Observable<Ticket> {
    return this.http.put<RawTicket>(`${BASE}/${uuid}`, toRawTicketRequest(input)).pipe(map(toTicket));
  }

  remove(uuid: string): Observable<void> {
    return this.http.delete(`${BASE}/${uuid}`).pipe(map(() => undefined));
  }

  /** Uploads files to a ticket (managers and contributors); answers with the updated ticket. */
  addAttachments(uuid: string, files: File[]): Observable<Ticket> {
    const body = new FormData();
    files.forEach((file) => body.append('files', file, file.name));
    return this.http.post<RawTicket>(`${BASE}/${uuid}/attachments`, body).pipe(map(toTicket));
  }

  removeAttachment(uuid: string, attachmentUuid: string): Observable<Ticket> {
    return this.http
      .delete<RawTicket>(`${BASE}/${uuid}/attachments/${attachmentUuid}`)
      .pipe(map(toTicket));
  }

  /** File bytes through the API, since `<img>`/links can't send the bearer token. */
  attachmentBlob(uuid: string, attachmentUuid: string): Observable<Blob> {
    return this.http.get(`${BASE}/${uuid}/attachments/${attachmentUuid}/content`, {
      responseType: 'blob',
    });
  }

  /** Replaces the ticket's linked suggestions (super admins only). */
  setSuggestions(uuid: string, suggestionUuids: string[]): Observable<Ticket> {
    return this.http
      .put<RawTicket>(`${BASE}/${uuid}/suggestions`, { suggestionUuids })
      .pipe(map(toTicket));
  }

  /**
   * Accepted suggestions, offered when linking. Read straight from the
   * suggestions endpoint so this feature doesn't import the suggestion one.
   */
  linkableSuggestions(): Observable<LinkableSuggestion[]> {
    const params = new HttpParams()
      .set('status', 'ACCEPTED')
      .set('page', '0')
      .set('size', '500')
      .set('sort', 'createdAt,desc');
    return this.http
      .get<RawPage<RawSuggestionSummary>>('/api/suggestions', { params })
      .pipe(map((page) => (page.content ?? []).map(toLinkableSuggestion)));
  }
}
