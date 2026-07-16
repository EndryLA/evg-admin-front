import type { Routes } from '@angular/router';

/** Branch feature routes, mounted under the authenticated shell. */
export const BRANCH_ROUTES: Routes = [
  {
    path: 'branches',
    title: 'Branches · Évangélisation',
    loadComponent: () =>
      import('./pages/branch-list/branch-list').then((m) => m.BranchList),
  },
  {
    path: 'branches/:uuid',
    title: 'Branche · Évangélisation',
    loadComponent: () =>
      import('./pages/branch-detail/branch-detail').then((m) => m.BranchDetail),
  },
];
