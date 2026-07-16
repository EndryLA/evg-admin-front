import type { Routes } from '@angular/router';

/** City directory feature routes, mounted under the authenticated shell. */
export const CITY_ROUTES: Routes = [
  {
    path: 'villes',
    title: 'Annuaire des villes · Évangélisation',
    loadComponent: () => import('./pages/city-list/city-list').then((m) => m.CityList),
  },
];
