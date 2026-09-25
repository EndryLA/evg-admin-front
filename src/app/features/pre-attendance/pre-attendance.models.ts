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

/**
 * French labels for {@link PreAttendanceReason}, in the order shown to guests.
 * Bloc and Secteur are no longer offered (still valid on older rows).
 */
export const PRE_ATTENDANCE_REASON_OPTIONS: readonly {
  value: PreAttendanceReason;
  label: string;
}[] = [
  { value: 'INVITATION', label: 'Invitation' },
  { value: 'INFO_GROUP', label: "Groupe d'info" },
  { value: 'INSTAGRAM', label: 'Instagram' },
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

/** What a monthly slot points at: a sortie, or a calendar event open to sign-ups. */
export type SlotKind = 'OUTREACH' | 'EVENT';

/** Labels for the calendar event types that can open sign-ups. */
export const EVENT_TYPE_LABELS: Record<string, string> = {
  REUNION: 'Réunion',
  AGAPE: 'Agapé',
  OTHER: 'Événement',
};

/** A sortie or an event offered on the monthly sign-up page (`PublicSignupSlot`). */
export interface MonthSlot {
  kind: SlotKind;
  uuid: string;
  name: string;
  /** Calendar day, `YYYY-MM-DD`, or `null` when unset. */
  date: string | null;
  /** Wall-clock times, `HH:mm:ss`, or `null` when unset. */
  startTime: string | null;
  endTime: string | null;
  location: string;
  cityName: string;
  /** `Agapé`, `Réunion`… for an event; empty for a sortie. */
  typeLabel: string;
}

/** What became of one ticked slot once the monthly sign-up was sent. */
export type MonthRegistrationOutcome = 'REGISTERED' | 'ALREADY_REGISTERED' | 'CLOSED';

export interface MonthRegistrationResult {
  kind: SlotKind;
  uuid: string;
  outcome: MonthRegistrationOutcome;
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
