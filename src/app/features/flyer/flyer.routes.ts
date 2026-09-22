import type { Routes } from '@angular/router';

import { ACCESS } from '../../core/auth/access';
import { hasAnyRole } from '../../core/auth/auth.guard';

/** Flyer generation routes, mounted under the authenticated shell. */
export const FLYER_ROUTES: Routes = [
  {
    path: 'flyers',
    title: 'Génération de flyers · Évangélisation',
    canActivate: [hasAnyRole(...ACCESS.flyers)],
    loadComponent: () => import('./pages/flyer-hub/flyer-hub').then((m) => m.FlyerHub),
  },
  {
    path: 'flyers/invitation',
    title: 'Invitation · Génération de flyers · Évangélisation',
    canActivate: [hasAnyRole(...ACCESS.flyers)],
    loadComponent: () =>
      import('./pages/flyer-invitation/flyer-invitation').then((m) => m.FlyerInvitation),
  },
];
