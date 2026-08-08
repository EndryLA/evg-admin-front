/** Whether an attendee is a first-time guest or an existing department member. */
export type AttendanceType = 'GUEST' | 'MEMBER';

/** French labels for {@link AttendanceType}. */
export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  GUEST: 'Invité',
  MEMBER: 'Membre',
};

/** How a guest came to the outreach (mirrors the backend `AttendanceReason`). */
export type AttendanceReason =
  | 'INVITATION'
  | 'INFO_GROUP'
  | 'INSTAGRAM'
  | 'BLOC'
  | 'SECTOR'
  | 'OTHER';

/** French labels for {@link AttendanceReason}, in the order shown to guests. */
export const ATTENDANCE_REASON_OPTIONS: readonly {
  value: AttendanceReason;
  label: string;
}[] = [
  { value: 'INVITATION', label: 'Invitation' },
  { value: 'INFO_GROUP', label: "Groupe d'info" },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'BLOC', label: 'Bloc' },
  { value: 'SECTOR', label: 'Secteur' },
  { value: 'OTHER', label: 'Autre' },
];

/** French labels for {@link AttendanceReason}, keyed for display of a stored value. */
export const ATTENDANCE_REASON_LABELS: Record<AttendanceReason, string> =
  Object.fromEntries(
    ATTENDANCE_REASON_OPTIONS.map((o) => [o.value, o.label]),
  ) as Record<AttendanceReason, string>;

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
  /** Guest only — how they came to the outreach. Null for a member. */
  reason: AttendanceReason | null;
  /** Member only — the linked department profile. Null for a guest. */
  profileUuid: string | null;
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
  /** How a guest came to the outreach — present for GUEST records. */
  reason: AttendanceReason | null;
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
  reason: AttendanceReason | null;
  profileUuid: string | null;
  outreachUuid: string;
}

/**
 * Full name helper for an attendance row. A member is only linked by profile —
 * the record's own name fields stay empty for them — so the linked profile's
 * name takes precedence when there is one.
 */
export function attendanceName(
  attendance: Pick<Attendance, 'firstname' | 'lastname' | 'profile'>,
): string {
  const profile = attendance.profile;
  const firstname = profile?.firstname || attendance.firstname;
  const lastname = profile?.lastname || attendance.lastname;
  return `${firstname} ${lastname}`.trim();
}
