import type { UserRole } from '../../core/auth/auth.models';
import type { ProfileRef, User, UserInput } from './user.models';

/** Raw Spring `Page<T>` envelope (only fields we consume). */
export interface RawPage<T> {
  content?: T[];
}

/** Raw `ProfileResponse` (subset embedded in user responses). */
export interface RawProfile {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}

/** Raw `UserResponse`. */
export interface RawUser {
  uuid?: string;
  email?: string;
  role?: string | null;
  enabled?: boolean | null;
  profile?: RawProfile | null;
}

const ROLES: readonly string[] = [
  'SUPER_ADMIN',
  'DEPARTMENT_RESPONSIBLE',
  'ADMIN',
  'TEAM_LEADER',
];

/** Narrow a raw role string to {@link UserRole}, or `null` when unrecognised. */
function toRole(raw: string | null | undefined): UserRole | null {
  return raw && ROLES.includes(raw) ? (raw as UserRole) : null;
}

function toProfileRef(raw: RawProfile | null | undefined): ProfileRef | null {
  if (!raw?.uuid) {
    return null;
  }
  return {
    uuid: raw.uuid,
    firstname: raw.firstname ?? '',
    lastname: raw.lastname ?? '',
  };
}

/** Map a raw user to the clean domain model. */
export function toUser(raw: RawUser): User {
  return {
    uuid: raw.uuid ?? '',
    email: raw.email ?? '',
    role: toRole(raw.role),
    enabled: raw.enabled ?? false,
    profile: toProfileRef(raw.profile),
  };
}

/** Map an enabled flag to the raw `UserStatusRequest`. */
export function toRawUserStatusRequest(enabled: boolean): { enabled: boolean } {
  return { enabled };
}

/** Map a domain input to the raw `CreateUserRequest`. */
export function toRawCreateUserRequest(input: UserInput): {
  email: string;
  role: UserRole;
  profileUuid: string;
} {
  return {
    email: input.email.trim(),
    role: input.role,
    profileUuid: input.profileUuid,
  };
}
