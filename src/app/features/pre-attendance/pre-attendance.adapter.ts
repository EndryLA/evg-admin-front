import type {
  PreAttendanceReason,
  PreRegistrationInput,
  SignUpOutreach,
  SignUpOutreachStatus,
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
