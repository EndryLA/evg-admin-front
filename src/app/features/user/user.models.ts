import { ROLE_LABELS, type UserRole } from '../../core/auth/auth.models';

export { ROLE_LABELS };
export type { UserRole };

/** Roles assignable when creating an account, in descending order of scope. */
export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
  'DEPARTMENT_RESPONSIBLE',
  'ADMIN',
  'TEAM_LEADER',
];

/** Badge tone per role — reuses the existing tones (design.md §1). */
const ROLE_TONES: Record<UserRole, string> = {
  SUPER_ADMIN: 'red',
  DEPARTMENT_RESPONSIBLE: 'violet',
  ADMIN: 'blue',
  TEAM_LEADER: 'grey',
};

/** Pill tone for a role, defaulting to grey when unknown. */
export function roleTone(role: UserRole | null): string {
  return role ? ROLE_TONES[role] : 'grey';
}

/** French label for a role, or an em dash when unset. */
export function roleLabel(role: UserRole | null): string {
  return role ? ROLE_LABELS[role] : '—';
}

/** French label for an account's access status. */
export function statusLabel(enabled: boolean): string {
  return enabled ? 'Actif' : 'Inactif';
}

/** Pill tone for an account's access status. */
export function statusTone(enabled: boolean): string {
  return enabled ? 'green' : 'grey';
}

/** Minimal reference to the member an account is attached to. */
export interface ProfileRef {
  uuid: string;
  firstname: string;
  lastname: string;
}

/** Full name helper for a {@link ProfileRef}. */
export function refName(profile: ProfileRef | null): string {
  if (!profile) {
    return '—';
  }
  return `${profile.firstname} ${profile.lastname}`.trim() || '—';
}

/**
 * An application account, mapped from the backend `UserResponse`.
 *
 * A new account starts disabled and its owner enables it by following the
 * activation e-mail; an admin can also grant or revoke access directly. The
 * backend tracks this with the single {@link User.enabled} flag, so a
 * never-activated account and a revoked one are indistinguishable here — the
 * UI says "Inactif" rather than guessing which it is.
 */
export interface User {
  uuid: string;
  email: string;
  role: UserRole | null;
  /** Whether the account may sign in. */
  enabled: boolean;
  /** Member this account belongs to, if the link resolved. */
  profile: ProfileRef | null;
}

/** Editable fields when creating an account (`CreateUserRequest`). */
export interface UserInput {
  email: string;
  role: UserRole;
  profileUuid: string;
}

/** Selectable member option for the form picker. */
export interface Option {
  uuid: string;
  label: string;
}
