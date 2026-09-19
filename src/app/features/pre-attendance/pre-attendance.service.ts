import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toRawPreRegistrationRequest,
  toSignUpOutreach,
  type RawSignUpOutreach,
} from './pre-attendance.adapter';
import type { PreRegistrationInput, SignUpOutreach } from './pre-attendance.models';

/**
 * Gateway for the public sign-up page. Both calls are open to anonymous
 * visitors: reading the outreach, and posting a pre-registration (accepted only
 * while the outreach is SCHEDULED).
 */
@Injectable({ providedIn: 'root' })
export class PreAttendanceService {
  private readonly http = inject(HttpClient);

  outreach(uuid: string): Observable<SignUpOutreach> {
    return this.http
      .get<RawSignUpOutreach>(`/api/outreaches/${uuid}`)
      .pipe(map(toSignUpOutreach));
  }

  register(outreachUuid: string, input: PreRegistrationInput): Observable<void> {
    return this.http
      .post(
        `/api/outreaches/${outreachUuid}/pre-attendances`,
        toRawPreRegistrationRequest(outreachUuid, input),
      )
      .pipe(map(() => undefined));
  }
}
