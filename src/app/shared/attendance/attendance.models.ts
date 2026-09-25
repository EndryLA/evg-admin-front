/**
 * Presences and pre-registrations, as shared by every slice that records them —
 * outreaches and calendar events alike. Both read the same backend
 * `Attendance` / `PreAttendance` rows; only what they hang off differs.
 */

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

/** How a guest came (mirrors the backend `AttendanceReason`). */
export type AttendanceReason =
  | 'INVITATION'
  | 'INFO_GROUP'
  | 'INSTAGRAM'
  | 'BLOC'
  | 'SECTOR'
  | 'OTHER';

/** French labels for {@link AttendanceReason}. */
export const ATTENDANCE_REASON_LABELS: Record<AttendanceReason, string> = {
  INVITATION: 'Invitation',
  INFO_GROUP: "Groupe d'info",
  INSTAGRAM: 'Instagram',
  BLOC: 'Bloc',
  SECTOR: 'Secteur',
  OTHER: 'Autre',
};

/**
 * Reasons offered in the form, in order. Bloc and Secteur are no longer
 * offered but stay displayable on older rows.
 */
export const ATTENDANCE_REASON_OPTIONS: readonly {
  value: AttendanceReason;
  label: string;
}[] = [
  { value: 'INVITATION', label: ATTENDANCE_REASON_LABELS.INVITATION },
  { value: 'INFO_GROUP', label: ATTENDANCE_REASON_LABELS.INFO_GROUP },
  { value: 'INSTAGRAM', label: ATTENDANCE_REASON_LABELS.INSTAGRAM },
  { value: 'OTHER', label: ATTENDANCE_REASON_LABELS.OTHER },
];

/** A recorded presence, mapped from the backend `AttendanceResponse`. */
export interface Presence {
  uuid: string;
  firstname: string;
  lastname: string;
  invitedBy: string;
  type: AttendanceType;
  /** How a guest came — present for GUEST presences, null for members. */
  reason: AttendanceReason | null;
}

/**
 * Fields sent when adding a presence (`AttendanceRequest` minus the outreach or
 * event, which the page already knows). A MEMBER carries `profileUuid`; a GUEST
 * carries a name, optionally how they came, and who invited them.
 */
export interface PresenceInput {
  type: AttendanceType;
  profileUuid: string | null;
  firstname: string | null;
  lastname: string | null;
  reason: AttendanceReason | null;
  invitedBy: string | null;
}

/**
 * Someone who announced ahead of time that they would come — mapped from
 * `PreAttendanceResponse`. Staff confirm it on the day, which turns it into an
 * actual {@link Presence}.
 */
export interface PreRegistration extends Presence {
  /** Whether it has already been turned into a presence. */
  confirmed: boolean;
  /** ISO datetime of the sign-up, or `null` when unknown. */
  createdAt: string | null;
}

/** Full name of a presence row, or an em dash when it has none. */
export function presenceName(p: Pick<Presence, 'firstname' | 'lastname'>): string {
  return `${p.firstname} ${p.lastname}`.trim() || '—';
}
