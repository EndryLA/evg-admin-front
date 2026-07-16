import type { Routes } from '@angular/router';

import { ACCESS } from '../../core/auth/access';
import { hasAnyRole } from '../../core/auth/auth.guard';

/**
 * Profile feature routes, mounted under the authenticated shell. Profils is
 * open to every signed-in user; assigning team leaders is reserved for super
 * administrators.
 */
export const PROFILE_ROUTES: Routes = [
  {
    path: 'profils',
    title: 'Profils · Évangélisation',
    loadComponent: () =>
      import('./pages/profile-list/profile-list').then((m) => m.ProfileList),
  },
  {
    path: 'responsables',
    title: "Chefs d'équipe · Évangélisation",
    canActivate: [hasAnyRole(...ACCESS.teamLeaders)],
    loadComponent: () =>
      import('./pages/team-leader-manage/team-leader-manage').then(
        (m) => m.TeamLeaderManage,
      ),
  },
];
