import type { Routes } from '@angular/router';

/**
 * Project routes, mounted under the authenticated shell. Open to every member:
 * the backend only returns the projects (and tickets) the caller belongs to.
 * A ticket has its own pages (read, then edit) rather than a modal — easier on
 * a phone. `nouveau` is declared before `:ticketUuid` so it isn't taken for one.
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
  {
    path: 'projets/:uuid/tickets/nouveau',
    title: 'Nouveau ticket · Évangélisation',
    loadComponent: () => import('./pages/ticket-edit/ticket-edit').then((m) => m.TicketEdit),
  },
  {
    path: 'projets/:uuid/tickets/:ticketUuid',
    title: 'Ticket · Évangélisation',
    loadComponent: () => import('./pages/ticket-detail/ticket-detail').then((m) => m.TicketDetail),
  },
  {
    path: 'projets/:uuid/tickets/:ticketUuid/modifier',
    title: 'Modifier le ticket · Évangélisation',
    loadComponent: () => import('./pages/ticket-edit/ticket-edit').then((m) => m.TicketEdit),
  },
];
