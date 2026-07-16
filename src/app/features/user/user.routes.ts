import type { Routes } from '@angular/router';

import { ACCESS } from '../../core/auth/access';
import { hasAnyRole } from '../../core/auth/auth.guard';

/**
 * User feature routes, mounted under the authenticated shell. Managing who can
 * sign in is reserved for super administrators.
 */
export const USER_ROUTES: Routes = [
  {
    path: 'utilisateurs',
    title: 'Utilisateurs · Évangélisation',
    canActivate: [hasAnyRole(...ACCESS.users)],
    loadComponent: () => import('./pages/user-list/user-list').then((m) => m.UserList),
  },
];
