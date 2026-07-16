import type { Routes } from '@angular/router';

import { ACCESS } from '../../core/auth/access';
import { hasAnyRole } from '../../core/auth/auth.guard';

/**
 * City directory feature routes, mounted under the authenticated shell.
 * Maintaining the directory is an administrative task.
 */
export const CITY_ROUTES: Routes = [
  {
    path: 'villes',
    title: 'Annuaire des villes · Évangélisation',
    canActivate: [hasAnyRole(...ACCESS.cities)],
    loadComponent: () => import('./pages/city-list/city-list').then((m) => m.CityList),
  },
];
