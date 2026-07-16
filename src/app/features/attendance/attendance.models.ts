/** Whether an attendee is a first-time guest or an existing department member. */
export type AttendanceType = 'GUEST' | 'MEMBER';

/** French labels for {@link AttendanceType}. */
export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  GUEST: 'Invité',
  MEMBER: 'Membre',
};

/** Badge tone (see global `.pill--*`) per attendance type. */
export const ATTENDANCE_TYPE_TONES: Record<AttendanceType, string> = {
  GUEST: 'grey',
  MEMBER: 'red',
};

/** Selectable option for the outreach / member dropdowns in the form. */
export interface AttendanceOption {
  uuid: string;
  label: string;
}

/**
 * Fields captured by the public, unauthenticated presence form. The outreach is
 * taken from the route and there is no member linkage — a public user cannot
 * look up profiles — so this is a subset of {@link AttendanceInput}.
 */
export interface PublicAttendanceInput {
  firstname: string;
  lastname: string;
  invitedBy: string;
  type: AttendanceType;
}

/**
 * The department member linked to a MEMBER attendance, as embedded in
 * `AttendanceResponse.profile`. A local subset — features never import each
 * other, so this does not reuse the `profile` feature's model.
 */
export interface AttendanceProfile {
  uuid: string;
  firstname: string;
  lastname: string;
}

/** A single attendance record, mapped from the backend `AttendanceResponse`. */
export interface Attendance {
  uuid: string;
  firstname: string;
  lastname: string;
  /** Free-text name of whoever invited the attendee. */
  invitedBy: string;
  type: AttendanceType;
  /** Linked member profile — present for MEMBER records. */
  profile: AttendanceProfile | null;
  outreachUuid: string;
}

/**
 * Editable fields when recording or updating an attendance (`AttendanceRequest`).
 * `outreachUuid` and `type` are required by the backend. For a MEMBER, set
 * `profileUuid`; for a GUEST, set `firstname`/`lastname`.
 */
export interface AttendanceInput {
  firstname: string | null;
  lastname: string | null;
  invitedBy: string | null;
  type: AttendanceType;
  profileUuid: string | null;
  outreachUuid: string;
}

/** Full name helper for an attendance row. */
export function attendanceName(
  attendance: Pick<Attendance, 'firstname' | 'lastname'>,
): string {
  return `${attendance.firstname} ${attendance.lastname}`.trim();
}
