import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toPhase,
  toProject,
  toRawPhaseRequest,
  toRawProjectRequest,
  type RawPage,
  type RawPhase,
  type RawProject,
} from './project.adapter';
import type {
  Phase,
  PhaseInput,
  Project,
  ProjectInput,
  ProjectRole,
  TicketTypeInput,
} from './project.models';

const BASE = '/api/projects';

/**
 * Gateway to `/api/projects`: projects, their members, phases and ticket types. The
 * backend only returns projects the caller can see (all of them for super
 * admins), so {@link list} needs no client-side scoping.
 */
@Service()
export class ProjectService {
  private readonly http = inject(HttpClient);

  list(): Observable<Project[]> {
    const params = new HttpParams().set('page', '0').set('size', '200').set('sort', 'createdAt,desc');
    return this.http
      .get<RawPage<RawProject>>(BASE, { params })
      .pipe(map((page) => (page.content ?? []).map(toProject)));
  }

  getOne(uuid: string): Observable<Project> {
    return this.http.get<RawProject>(`${BASE}/${uuid}`).pipe(map(toProject));
  }

  create(input: ProjectInput): Observable<Project> {
    return this.http.post<RawProject>(BASE, toRawProjectRequest(input)).pipe(map(toProject));
  }

  addMember(uuid: string, profileUuid: string, role: ProjectRole): Observable<Project> {
    return this.http
      .post<RawProject>(`${BASE}/${uuid}/members`, { profileUuid, role })
      .pipe(map(toProject));
  }

  setMemberRole(uuid: string, profileUuid: string, role: ProjectRole): Observable<Project> {
    return this.http
      .put<RawProject>(`${BASE}/${uuid}/members/${profileUuid}/role`, { role })
      .pipe(map(toProject));
  }

  /** Makes the member the project's owner; the previous owner stays a manager. */
  transferOwnership(uuid: string, profileUuid: string): Observable<Project> {
    return this.http
      .put<RawProject>(`${BASE}/${uuid}/owner`, { profileUuid })
      .pipe(map(toProject));
  }

  removeMember(uuid: string, profileUuid: string): Observable<Project> {
    return this.http
      .delete<RawProject>(`${BASE}/${uuid}/members/${profileUuid}`)
      .pipe(map(toProject));
  }

  addPhase(uuid: string, input: PhaseInput): Observable<Phase> {
    return this.http
      .post<RawPhase>(`${BASE}/${uuid}/phases`, toRawPhaseRequest(input))
      .pipe(map(toPhase));
  }

  updatePhase(uuid: string, phaseUuid: string, input: PhaseInput): Observable<Phase> {
    return this.http
      .put<RawPhase>(`${BASE}/${uuid}/phases/${phaseUuid}`, toRawPhaseRequest(input))
      .pipe(map(toPhase));
  }

  removePhase(uuid: string, phaseUuid: string): Observable<void> {
    return this.http.delete(`${BASE}/${uuid}/phases/${phaseUuid}`).pipe(map(() => undefined));
  }

  /** Ticket type changes answer with the type only; callers reload the project. */
  addTicketType(uuid: string, input: TicketTypeInput): Observable<void> {
    return this.http
      .post(`${BASE}/${uuid}/ticket-types`, { ...input, name: input.name.trim() })
      .pipe(map(() => undefined));
  }

  updateTicketType(uuid: string, typeUuid: string, input: TicketTypeInput): Observable<void> {
    return this.http
      .put(`${BASE}/${uuid}/ticket-types/${typeUuid}`, { ...input, name: input.name.trim() })
      .pipe(map(() => undefined));
  }

  removeTicketType(uuid: string, typeUuid: string): Observable<void> {
    return this.http
      .delete(`${BASE}/${uuid}/ticket-types/${typeUuid}`)
      .pipe(map(() => undefined));
  }

  reorderPhases(uuid: string, phaseUuids: string[]): Observable<Phase[]> {
    return this.http
      .put<RawPhase[]>(`${BASE}/${uuid}/phases/order`, { phaseUuids })
      .pipe(map((list) => list.map(toPhase)));
  }
}
