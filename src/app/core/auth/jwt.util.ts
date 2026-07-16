/**
 * Minimal, dependency-free JWT helpers. The token is only *read* client-side
 * for display/routing convenience — the backend remains the source of truth.
 */

export type JwtClaims = Record<string, unknown>;

/** Decode the payload of a JWT. Returns `null` for malformed tokens. */
export function decodeJwt(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** `true` once the token's `exp` claim is in the past. Absent `exp` ⇒ not expired. */
export function isJwtExpired(token: string, nowMs: number = Date.now()): boolean {
  const claims = decodeJwt(token);
  const exp = claims?.['exp'];
  if (typeof exp !== 'number') {
    return false;
  }
  return exp * 1000 <= nowMs;
}
