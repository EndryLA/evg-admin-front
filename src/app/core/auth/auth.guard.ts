import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import type { UserRole } from './auth.models';
import { AuthService } from './auth.service';

/** Blocks protected routes for signed-out users, sending them to login. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/connexion'], {
    queryParams: { redirectTo: state.url },
  });
};

/** Keeps already-authenticated users out of the auth screens. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};

/**
 * Restricts a route to holders of at least one of `roles`.
 *
 * Signed-out visitors go to login (keeping their destination), and signed-in
 * users without the role are sent home rather than shown an error — the entry
 * is one they should not have reached. This is UX, not security: the token is
 * read client-side, so the backend still enforces every rule.
 *
 * @example
 * { path: 'villes', canActivate: [hasAnyRole('ADMIN', 'SUPER_ADMIN')], ... }
 */
export function hasAnyRole(...roles: UserRole[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/connexion'], {
        queryParams: { redirectTo: state.url },
      });
    }
    return auth.hasAnyRole(roles) || router.createUrlTree(['/']);
  };
}

/**
 * Restricts a route to holders of `role`.
 *
 * @example
 * { path: 'utilisateurs', canActivate: [hasRole('SUPER_ADMIN')], ... }
 */
export function hasRole(role: UserRole): CanActivateFn {
  return hasAnyRole(role);
}
