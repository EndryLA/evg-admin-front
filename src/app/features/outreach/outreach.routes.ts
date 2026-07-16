import type { Routes } from '@angular/router';

/** Outreach feature routes, mounted under the authenticated shell. */
export const OUTREACH_ROUTES: Routes = [
  {
    path: 'sorties',
    title: 'Sorties · Évangélisation',
    loadComponent: () =>
      import('./pages/outreach-list/outreach-list').then((m) => m.OutreachList),
  },
  {
    path: 'sorties/:uuid',
    title: 'Sortie · Évangélisation',
    loadComponent: () =>
      import('./pages/outreach-detail/outreach-detail').then((m) => m.OutreachDetail),
  },
  {
    path: 'sorties/:uuid/gestion',
    title: 'Gestion de la sortie · Évangélisation',
    loadComponent: () =>
      import('./pages/outreach-manage/outreach-manage').then((m) => m.OutreachManage),
  },
  {
    path: 'sorties/:uuid/statistiques',
    title: 'Statistiques de la sortie · Évangélisation',
    loadComponent: () =>
      import('./pages/outreach-stats/outreach-stats').then((m) => m.OutreachStats),
  },
  {
    path: 'sorties/:uuid/contacts',
    title: 'Contacts de la sortie · Évangélisation',
    loadComponent: () =>
      import('./pages/outreach-contacts-list/outreach-contacts-list').then(
        (m) => m.OutreachContactsList,
      ),
  },
  {
    path: 'sorties/:uuid/presences',
    title: 'Présences de la sortie · Évangélisation',
    loadComponent: () =>
      import('./pages/outreach-presences-list/outreach-presences-list').then(
        (m) => m.OutreachPresencesList,
      ),
  },
];
