/** Whether a member is an ouvrier (worker) or an aide (helper). */
export type MembershipType = 'OUVRIER' | 'AIDE';

/** French labels for {@link MembershipType}. */
export const MEMBERSHIP_LABELS: Record<MembershipType, string> = {
  OUVRIER: 'Ouvrier',
  AIDE: 'Aide',
};

/** A department member, mapped from the backend `ProfileResponse`. */
export interface Profile {
  uuid: string;
  firstname: string;
  lastname: string;
  phoneNumber: string | null;
  email: string | null;
  /** ISO `YYYY-MM-DD`. */
  birthDate: string | null;
  membershipType: MembershipType | null;
  firstDepartment: boolean;
  /** Year the member joined the department (e.g. 2021), or `null`. */
  joinedAt: number | null;
  /** Whether this member is themselves a team leader. */
  isTeamLeader: boolean;
  /** The uuid of this member's team leader, or `null` if unassigned. */
  leaderUuid: string | null;
  /** First name of this member's team leader, or `null` — for display. */
  leaderFirstname: string | null;
}

/** Editable fields when creating or updating a profile (`ProfileRequest`). */
export interface ProfileInput {
  firstname: string;
  lastname: string;
  phoneNumber: string | null;
  email: string | null;
  birthDate: string | null;
  membershipType: MembershipType | null;
  firstDepartment: boolean;
  /** Year the member joined the department, or `null`. */
  joinedAt: number | null;
}

/**
 * Result emitted by the profile form: the editable {@link ProfileInput} plus the
 * chosen team leader (assigned via a separate endpoint, so kept out of the
 * `ProfileRequest`). `leaderUuid` is `null` when no leader is picked.
 */
export interface ProfileFormResult {
  input: ProfileInput;
  leaderUuid: string | null;
}

/** Full name helper used across list/detail. */
export function fullName(profile: Pick<Profile, 'firstname' | 'lastname'>): string {
  return `${profile.firstname} ${profile.lastname}`.trim();
}

/** Vivid pill tones cycled for team-leader badges (grey stays reserved for "none"). */
const LEADER_TONES = ['blue', 'green', 'violet', 'amber', 'red'] as const;

/**
 * Deterministic badge tone for a team leader, keyed by uuid so a given leader
 * keeps the same colour everywhere (list badge and management page).
 */
export function leaderTone(uuid: string | null): string {
  if (!uuid) {
    return 'grey';
  }
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash * 31 + uuid.charCodeAt(i)) >>> 0;
  }
  return LEADER_TONES[hash % LEADER_TONES.length];
}
