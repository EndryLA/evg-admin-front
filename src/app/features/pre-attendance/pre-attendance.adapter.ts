import {
  EVENT_TYPE_LABELS,
  type MonthRegistrationOutcome,
  type MonthRegistrationResult,
  type MonthSlot,
  type PreAttendanceReason,
  type PreRegistrationInput,
  type SignUpOutreach,
  type SignUpOutreachStatus,
  type SlotKind,
} from './pre-attendance.models';

/** Raw `OutreachResponse` — only the fields the sign-up page reads. */
export interface RawSignUpOutreach {
  name?: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string;
  city?: { officialName?: string } | null;
  cityLabel?: string | null;
  status?: string | null;
}

/** Raw `PublicAttendanceRequest` sent to `/api/outreaches/{uuid}/pre-attendances`. */
export interface RawPreRegistrationRequest {
  type: 'GUEST' | 'MEMBER';
  outreachUuid: string;
  profileUuid?: string;
  firstname?: string;
  lastname?: string;
  reason?: PreAttendanceReason;
  invitedBy?: string;
}

/** Raw `PublicSignupSlot` from `/api/pre-attendances/months/{month}/slots`. */
export interface RawMonthSlot {
  kind?: string;
  uuid?: string;
  name?: string;
  location?: string | null;
  cityName?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  eventType?: string | null;
}

/** Raw `MonthlyPreAttendanceResult`, one per ticked slot. */
export interface RawMonthRegistrationResult {
  kind?: string;
  uuid?: string;
  outcome?: string;
}

function toSlotKind(value: string | undefined): SlotKind {
  return value === 'EVENT' ? 'EVENT' : 'OUTREACH';
}

const OUTCOMES: readonly MonthRegistrationOutcome[] = ['REGISTERED', 'ALREADY_REGISTERED', 'CLOSED'];

const STATUSES: readonly SignUpOutreachStatus[] = [
  'SCHEDULED',
  'IN_PROGRESS',
  'FINISHED',
  'CANCELLED',
];

function toStatus(value: string | null | undefined): SignUpOutreachStatus {
  return STATUSES.includes(value as SignUpOutreachStatus)
    ? (value as SignUpOutreachStatus)
    : 'SCHEDULED';
}

/** Map a raw outreach to what the sign-up page displays. */
export function toSignUpOutreach(raw: RawSignUpOutreach): SignUpOutreach {
  return {
    name: raw.name ?? '',
    date: raw.date ?? null,
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    location: raw.location ?? '',
    cityName: raw.city?.officialName || raw.cityLabel || '',
    status: toStatus(raw.status),
  };
}

export function toMonthSlot(raw: RawMonthSlot): MonthSlot {
  const kind = toSlotKind(raw.kind);
  return {
    kind,
    uuid: raw.uuid ?? '',
    name: raw.name ?? '',
    date: raw.date ?? null,
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    location: raw.location ?? '',
    cityName: raw.cityName ?? '',
    typeLabel: kind === 'EVENT' ? (EVENT_TYPE_LABELS[raw.eventType ?? ''] ?? 'Événement') : '',
  };
}

/** An unrecognised outcome is read as `CLOSED` — it was not recorded as a sign-up. */
export function toMonthRegistrationResult(raw: RawMonthRegistrationResult): MonthRegistrationResult {
  return {
    kind: toSlotKind(raw.kind),
    uuid: raw.uuid ?? '',
    outcome: OUTCOMES.includes(raw.outcome as MonthRegistrationOutcome)
      ? (raw.outcome as MonthRegistrationOutcome)
      : 'CLOSED',
  };
}

/**
 * Map a sign-up to the raw request. Only the fields that apply to the chosen
 * type are sent; "invité par" only accompanies an invitation.
 */
export function toRawPreRegistrationRequest(
  outreachUuid: string,
  input: PreRegistrationInput,
): RawPreRegistrationRequest {
  if (input.type === 'MEMBER') {
    return { type: 'MEMBER', outreachUuid, profileUuid: input.profileUuid };
  }
  const request: RawPreRegistrationRequest = {
    type: 'GUEST',
    outreachUuid,
    firstname: input.firstname.trim(),
    lastname: input.lastname.trim(),
    reason: input.reason,
  };
  const invitedBy = input.invitedBy.trim();
  if (input.reason === 'INVITATION' && invitedBy) {
    request.invitedBy = invitedBy;
  }
  return request;
}
