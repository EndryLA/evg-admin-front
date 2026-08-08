import type { Routes } from '@angular/router';

/**
 * Public, unauthenticated landing page for a given outreach. Lives outside the
 * app shell so anyone can pick between the presence and contact forms without
 * signing in. The presence/contact forms themselves are declared in their own
 * features.
 */
export const PUBLIC_SORTIE_ROUTES: Routes = [
  {
    path: 'sortie/:uuid',
    title: 'Sortie · Évangélisation',
    loadComponent: () =>
      import('./pages/sortie-landing/sortie-landing').then((m) => m.SortieLanding),
  },
];
