import { describe, expect, it } from 'vitest';

import { userFromToken } from './auth.adapter';

/** Build an unsigned JWT whose payload is `claims` (signature is never read). */
function tokenWith(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

describe('userFromToken', () => {
  it('reads ROLE_-prefixed roles from the roles array', () => {
    const user = userFromToken(tokenWith({ roles: ['ROLE_SUPER_ADMIN'] }));

    expect(user?.roles).toEqual(['SUPER_ADMIN']);
  });

  it('keeps every role, not just the first', () => {
    const user = userFromToken(tokenWith({ roles: ['ROLE_ADMIN', 'ROLE_TEAM_LEADER'] }));

    expect(user?.roles).toEqual(['ADMIN', 'TEAM_LEADER']);
  });

  it('reads roles from the authorities claim too', () => {
    const user = userFromToken(tokenWith({ authorities: ['ROLE_ADMIN'] }));

    expect(user?.roles).toEqual(['ADMIN']);
  });

  it('de-duplicates roles repeated across claims', () => {
    const user = userFromToken(tokenWith({ roles: ['ROLE_ADMIN'], authorities: ['ROLE_ADMIN'] }));

    expect(user?.roles).toEqual(['ADMIN']);
  });

  it('drops unrecognised roles', () => {
    const user = userFromToken(tokenWith({ roles: ['ROLE_SUPER_ADMIN', 'ROLE_WIZARD'] }));

    expect(user?.roles).toEqual(['SUPER_ADMIN']);
  });

  it('yields no roles when the claim is missing', () => {
    const user = userFromToken(tokenWith({ email: 'jean@exemple.com' }));

    expect(user?.roles).toEqual([]);
  });

  it('reads the other identity claims', () => {
    const user = userFromToken(
      tokenWith({ sub: 'jean@exemple.com', profileUuid: 'p-1', roles: ['ROLE_ADMIN'] }),
    );

    expect(user?.email).toBe('jean@exemple.com');
    expect(user?.profileUuid).toBe('p-1');
  });

  it('returns null for a malformed token', () => {
    expect(userFromToken('not-a-jwt')).toBeNull();
  });
});
