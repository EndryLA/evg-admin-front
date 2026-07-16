import type { AuthenticatedUser, AuthSession, UserRole } from './auth.models';
import { decodeJwt, type JwtClaims } from './jwt.util';

/** Raw shape of `POST /api/auth/login`. */
export interface RawLoginResponse {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
}

/**
 * Raw shape of `SimpleMessageResponse` — returned by every non-login auth
 * endpoint (forgot password, reset, activation request & confirm). These used
 * to hand back the e-mail link itself; the backend now sends the mail and
 * returns only a status message.
 */
export interface RawMessageResponse {
  message?: string;
}

const ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
  'DEPARTMENT_RESPONSIBLE',
  'ADMIN',
  'TEAM_LEADER',
];

/** Map the raw login response to a clean {@link AuthSession}. */
export function toAuthSession(raw: RawLoginResponse): AuthSession {
  return {
    accessToken: raw.accessToken ?? '',
    refreshToken: raw.refreshToken ?? '',
    tokenType: raw.tokenType ?? 'Bearer',
  };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Strip Spring's `ROLE_` prefix and keep only roles this app knows. */
function asRole(value: unknown): UserRole | null {
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/^ROLE_/, '') as UserRole;
    return ROLES.includes(normalized) ? normalized : null;
  }
  return null;
}

/**
 * Normalise a role claim into a de-duplicated list. The claim is an array of
 * `ROLE_`-prefixed strings, but a bare string (single or space/comma
 * separated) is tolerated too.
 */
function asRoles(value: unknown): UserRole[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,]+/)
      : [];
  const roles = raw.map(asRole).filter((role): role is UserRole => role !== null);
  return [...new Set(roles)];
}

/**
 * Derive the {@link AuthenticatedUser} from an access token. Claim names are
 * probed defensively since the backend's exact JWT shape may vary.
 */
export function userFromToken(accessToken: string): AuthenticatedUser | null {
  const claims: JwtClaims | null = decodeJwt(accessToken);
  if (!claims) {
    return null;
  }
  // Every plausible claim name contributes, so a token that names them
  // differently still yields the full set rather than a silently empty one.
  const roles = [
    ...asRoles(claims['roles']),
    ...asRoles(claims['authorities']),
    ...asRoles(claims['role']),
  ];

  return {
    uuid: asString(claims['uuid']) ?? asString(claims['sub']),
    email: asString(claims['email']) ?? asString(claims['sub']),
    roles: [...new Set(roles)],
    profileUuid: asString(claims['profileUuid']),
  };
}
