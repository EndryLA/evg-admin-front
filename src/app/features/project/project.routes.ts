import type { Routes } from '@angular/router';

/**
 * Project routes, mounted under the authenticated shell. Open to every member:
 * the backend only returns the projects (and tickets) the caller belongs to.
 */
export const PROJECT_ROUTES: Routes = [
  {
    path: 'projets',
    title: 'Projets · Évangélisation',
    loadComponent: () => import('./pages/project-list/project-list').then((m) => m.ProjectList),
  },
  {
    path: 'projets/:uuid',
    title: 'Projet · Évangélisation',
    loadComponent: () =>
      import('./pages/project-detail/project-detail').then((m) => m.ProjectDetail),
  },
];
