/** Whether the person signing up is a department member or a guest. */
export type PreAttendanceType = 'GUEST' | 'MEMBER';

/** How a guest heard about the outreach (mirrors the backend `AttendanceReason`). */
export type PreAttendanceReason =
  | 'INVITATION'
  | 'INFO_GROUP'
  | 'INSTAGRAM'
  | 'BLOC'
  | 'SECTOR'
  | 'OTHER';

/** French labels for {@link PreAttendanceReason}, in the order shown to guests. */
export const PRE_ATTENDANCE_REASON_OPTIONS: readonly {
  value: PreAttendanceReason;
  label: string;
}[] = [
  { value: 'INVITATION', label: 'Invitation' },
  { value: 'INFO_GROUP', label: "Groupe d'info" },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'BLOC', label: 'Bloc' },
  { value: 'SECTOR', label: 'Secteur' },
  { value: 'OTHER', label: 'Autre' },
];

/** Lifecycle status of the outreach — sign-ups are open only while SCHEDULED. */
export type SignUpOutreachStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

/**
 * What the sign-up page shows about the outreach, mapped from
 * `OutreachResponse`. A local subset — features never import each other.
 */
export interface SignUpOutreach {
  name: string;
  /** Calendar day, `YYYY-MM-DD`, or `null` when unset. */
  date: string | null;
  /** Wall-clock times, `HH:mm:ss`, or `null` when unset. */
  startTime: string | null;
  endTime: string | null;
  location: string;
  /** Commune's official name, else the free-text label, else empty. */
  cityName: string;
  status: SignUpOutreachStatus;
}

/**
 * A public sign-up (`PublicAttendanceRequest`). A MEMBER is identified by their
 * profile; a GUEST gives a name, how they heard of it and — for an invitation —
 * who invited them.
 */
export type PreRegistrationInput =
  | { type: 'MEMBER'; profileUuid: string }
  | {
      type: 'GUEST';
      firstname: string;
      lastname: string;
      reason: PreAttendanceReason;
      invitedBy: string;
    };
