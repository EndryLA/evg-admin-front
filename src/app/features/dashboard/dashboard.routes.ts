import type { Routes } from '@angular/router';

/** Dashboard feature routes, mounted under the authenticated shell. */
export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'tableau-de-bord',
    title: 'Tableau de bord · Évangélisation',
    loadComponent: () =>
      import('./pages/dashboard-home/dashboard-home').then((m) => m.DashboardHome),
  },
];
