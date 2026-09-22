import type { Routes } from '@angular/router';

import { ACCESS } from '../../core/auth/access';
import { hasAnyRole } from '../../core/auth/auth.guard';

/** Outreach feature routes, mounted under the authenticated shell. */
export const OUTREACH_ROUTES: Routes = [
  {
    path: 'statistiques/terrain',
    title: 'Statistiques · Terrain · Évangélisation',
    loadComponent: () =>
      import('./pages/terrain-stats/terrain-stats').then((m) => m.TerrainStats),
  },
  {
    path: 'sorties',
    title: 'Sorties évangélisation',
    loadComponent: () =>
      import('./pages/outreach-list/outreach-list').then((m) => m.OutreachList),
  },
  {
    // Literal path — must stay before `sorties/:uuid`, or it'd be read as a uuid.
    path: 'sorties/bilan',
    title: 'Choisir une sortie · Bilan · Évangélisation',
    // Picker reached from the flyer hub, so it follows the flyer rule.
    canActivate: [hasAnyRole(...ACCESS.flyers)],
    loadComponent: () =>
      import('./pages/outreach-bilan-select/outreach-bilan-select').then(
        (m) => m.OutreachBilanSelect,
      ),
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
    path: 'sorties/:uuid/bilan',
    title: 'Bilan de la sortie · Évangélisation',
    loadComponent: () =>
      import('./pages/outreach-bilan/outreach-bilan').then((m) => m.OutreachBilan),
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
    path: 'sorties/:uuid/pre-inscriptions',
    title: 'Pré-inscriptions de la sortie · Évangélisation',
    loadComponent: () =>
      import('./pages/outreach-pre-attendances-list/outreach-pre-attendances-list').then(
        (m) => m.OutreachPreAttendancesList,
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
