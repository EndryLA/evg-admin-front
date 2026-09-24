import type {
  AttendanceReason,
  AttendanceType,
  PreRegistration,
  Presence,
  PresenceInput,
} from './attendance.models';

/** Raw `AttendanceResponse` from the backend (only the fields we display). */
export interface RawPresence {
  uuid?: string;
  firstname?: string;
  lastname?: string;
  invitedBy?: string;
  type?: string | null;
  reason?: string | null;
  /** Linked department profile — present for MEMBER presences, and where their
   *  name lives (the top-level name fields are only filled for guests). */
  profile?: { firstname?: string; lastname?: string } | null;
  /** Set on an outreach presence; `null` on an event one. */
  outreachUuid?: string | null;
  /** Set on an event presence; `null` on an outreach one. */
  eventUuid?: string | null;
}

/** Raw `PreAttendanceResponse` — an attendance plus its confirmation state. */
export interface RawPreRegistration extends RawPresence {
  confirmed?: boolean;
  attendanceUuid?: string | null;
  createdAt?: string | null;
}

/** What a presence hangs off — exactly one of the two. */
export type AttendanceTarget = { outreachUuid: string } | { eventUuid: string };

/** Raw `AttendanceRequest` sent when creating a presence. */
export interface RawAttendanceRequest {
  type: AttendanceType;
  outreachUuid?: string;
  eventUuid?: string;
  profileUuid?: string;
  firstname?: string;
  lastname?: string;
  reason?: AttendanceReason;
  invitedBy?: string;
}

const ATTENDANCE_TYPES: readonly AttendanceType[] = ['GUEST', 'MEMBER'];

function toAttendanceType(value: string | null | undefined): AttendanceType {
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

function toAttendanceReason(value: string | null | undefined): AttendanceReason | null {
  return ATTENDANCE_REASONS.includes(value as AttendanceReason)
    ? (value as AttendanceReason)
    : null;
}

/**
 * Map a raw attendance to a presence. A member is only linked by profile — the
 * top-level name fields stay empty for them — so the profile's name takes
 * precedence when there is one.
 */
export function toPresence(raw: RawPresence): Presence {
  const profile = raw.profile;
  return {
    uuid: raw.uuid ?? '',
    firstname: profile?.firstname || raw.firstname || '',
    lastname: profile?.lastname || raw.lastname || '',
    invitedBy: raw.invitedBy ?? '',
    type: toAttendanceType(raw.type),
    reason: toAttendanceReason(raw.reason),
  };
}

/** Map a raw pre-attendance to a sign-up. */
export function toPreRegistration(raw: RawPreRegistration): PreRegistration {
  return {
    ...toPresence(raw),
    confirmed: raw.confirmed ?? false,
    createdAt: raw.createdAt ?? null,
  };
}

/**
 * Map a new presence to the raw `AttendanceRequest`. Optional fields are
 * omitted when empty so the backend only receives what applies to the type.
 */
export function toRawAttendanceRequest(
  target: AttendanceTarget,
  input: PresenceInput,
): RawAttendanceRequest {
  const request: RawAttendanceRequest = { type: input.type, ...target };

  if (input.type === 'MEMBER') {
    if (input.profileUuid) {
      request.profileUuid = input.profileUuid;
    }
    return request;
  }

  const firstname = input.firstname?.trim();
  if (firstname) request.firstname = firstname;

  const lastname = input.lastname?.trim();
  if (lastname) request.lastname = lastname;

  const invitedBy = input.invitedBy?.trim();
  if (invitedBy) request.invitedBy = invitedBy;

  if (input.reason) request.reason = input.reason;

  return request;
}
