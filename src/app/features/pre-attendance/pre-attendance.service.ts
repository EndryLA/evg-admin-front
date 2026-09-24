import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import {
  toMonthRegistrationResult,
  toMonthSlot,
  toRawPreRegistrationRequest,
  toSignUpOutreach,
  type RawMonthRegistrationResult,
  type RawMonthSlot,
  type RawSignUpOutreach,
} from './pre-attendance.adapter';
import type {
  MonthRegistrationResult,
  MonthSlot,
  PreRegistrationInput,
  SignUpOutreach,
} from './pre-attendance.models';

/**
 * Gateway for the public sign-up pages. Every call is open to anonymous
 * visitors: reading the outreach (or the month's open ones), and posting a
 * pre-registration (accepted only while the outreach is SCHEDULED).
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

  /** The month's sorties and events still open to sign-ups; `month` is `YYYY-MM`. */
  monthSlots(month: string): Observable<MonthSlot[]> {
    return this.http
      .get<RawMonthSlot[]>(`/api/pre-attendances/months/${month}/slots`)
      .pipe(map((list) => list.map(toMonthSlot)));
  }

  /** Sign one person up for several of the month's slots, with the fate of each. */
  registerForMonth(
    month: string,
    input: PreRegistrationInput,
    slots: readonly MonthSlot[],
  ): Observable<MonthRegistrationResult[]> {
    const { outreachUuid: _, ...person } = toRawPreRegistrationRequest('', input);
    return this.http
      .post<RawMonthRegistrationResult[]>(`/api/pre-attendances/months/${month}`, {
        ...person,
        outreachUuids: slots.filter((s) => s.kind === 'OUTREACH').map((s) => s.uuid),
        eventUuids: slots.filter((s) => s.kind === 'EVENT').map((s) => s.uuid),
      })
      .pipe(map((list) => list.map(toMonthRegistrationResult)));
  }
}
