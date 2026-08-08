import type {
  Attendance,
  AttendanceInput,
  AttendanceReason,
  AttendanceType,
} from './attendance.models';

/** Nested profile as returned inside `AttendanceResponse.profile`. */
export interface RawAttendanceProfile {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}

/** Raw `AttendanceResponse` from the backend. */
export interface RawAttendance {
  uuid?: string;
  firstname?: string;
  lastname?: string;
  invitedBy?: string;
  type?: string | null;
  reason?: string | null;
  profile?: RawAttendanceProfile | null;
  outreachUuid?: string;
}

/** Raw `AttendanceRequest` sent to the backend. */
export interface RawAttendanceRequest {
  firstname?: string;
  lastname?: string;
  invitedBy?: string;
  type: AttendanceType;
  reason?: AttendanceReason;
  profileUuid?: string;
  outreachUuid: string;
}

const ATTENDANCE_TYPES: readonly AttendanceType[] = ['GUEST', 'MEMBER'];

function toType(value: string | null | undefined): AttendanceType {
  return ATTENDANCE_TYPES.includes(value as AttendanceType)
    ? (value as AttendanceType)
    : 'GUEST';
}

const ATTENDANCE_REASONS: readonly AttendanceReason[] = [
  'INVITATION',
  'INFO_GROUP',
  'INSTAGRAM',
  'BLOC',
  'SECTOR',
  'OTHER',
];

function toReason(value: string | null | undefined): AttendanceReason | null {
  return ATTENDANCE_REASONS.includes(value as AttendanceReason)
    ? (value as AttendanceReason)
    : null;
}

/** Map a raw attendance to the clean domain model. */
export function toAttendance(raw: RawAttendance): Attendance {
  const profile = raw.profile;
  return {
    uuid: raw.uuid ?? '',
    firstname: raw.firstname ?? '',
    lastname: raw.lastname ?? '',
    invitedBy: raw.invitedBy ?? '',
    type: toType(raw.type),
    reason: toReason(raw.reason),
    profile:
      profile && profile.uuid
        ? {
            uuid: profile.uuid,
            firstname: profile.firstname ?? '',
            lastname: profile.lastname ?? '',
          }
        : null,
    outreachUuid: raw.outreachUuid ?? '',
  };
}

/**
 * Map a domain input to the raw `AttendanceRequest`. Optional fields are omitted
 * when empty so the backend receives only what applies to the attendance type.
 */
export function toRawAttendanceRequest(input: AttendanceInput): RawAttendanceRequest {
  const request: RawAttendanceRequest = {
    type: input.type,
    outreachUuid: input.outreachUuid,
  };

  const firstname = input.firstname?.trim();
  if (firstname) request.firstname = firstname;

  const lastname = input.lastname?.trim();
  if (lastname) request.lastname = lastname;

  const invitedBy = input.invitedBy?.trim();
  if (invitedBy) request.invitedBy = invitedBy;

  if (input.reason) request.reason = input.reason;

  if (input.profileUuid) request.profileUuid = input.profileUuid;

  return request;
}
