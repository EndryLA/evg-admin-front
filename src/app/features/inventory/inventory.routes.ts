import type { Routes } from '@angular/router';

/** Inventory feature routes, mounted under the authenticated shell. */
export const INVENTORY_ROUTES: Routes = [
  {
    path: 'inventaire',
    title: 'Inventaire · Évangélisation',
    loadComponent: () =>
      import('./pages/inventory-list/inventory-list').then((m) => m.InventoryList),
  },
  {
    path: 'inventaire/:uuid',
    title: 'Article · Évangélisation',
    loadComponent: () =>
      import('./pages/inventory-detail/inventory-detail').then((m) => m.InventoryDetailPage),
  },
];
