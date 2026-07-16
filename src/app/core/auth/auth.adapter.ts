import type { AuthenticatedUser, AuthSession, UserRole } from './auth.models';
import { decodeJwt, type JwtClaims } from './jwt.util';

/** Raw shape of `POST /api/auth/login`. */
export interface RawLoginResponse {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
}

/** Raw shape of link-returning endpoints (forgot password, activation request). */
export interface RawLinkResponse {
  url?: string;
}

/** Raw shape of message-returning endpoints (reset, activation confirm). */
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

function asRole(value: unknown): UserRole | null {
  if (typeof value === 'string') {
    const normalized = value.replace(/^ROLE_/, '') as UserRole;
    return ROLES.includes(normalized) ? normalized : null;
  }
  return null;
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
  const roleClaim =
    claims['role'] ??
    (Array.isArray(claims['authorities']) ? claims['authorities'][0] : undefined) ??
    (Array.isArray(claims['roles']) ? claims['roles'][0] : undefined);

  return {
    uuid: asString(claims['uuid']) ?? asString(claims['sub']),
    email: asString(claims['email']) ?? asString(claims['sub']),
    role: asRole(roleClaim),
    profileUuid: asString(claims['profileUuid']),
  };
}
