import type { Routes } from '@angular/router';

/** Profile feature routes, mounted under the authenticated shell. */
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
    loadComponent: () =>
      import('./pages/team-leader-manage/team-leader-manage').then(
        (m) => m.TeamLeaderManage,
      ),
  },
];
