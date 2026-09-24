import type { Routes } from '@angular/router';

/**
 * Public, unauthenticated sign-up page for an upcoming outreach — its own link,
 * separate from the day-of `/sortie/:uuid` menu, so it can be shared ahead of time.
 */
export const PUBLIC_PRE_ATTENDANCE_ROUTES: Routes = [
  {
    // One link per month (`YYYY-MM`), to sign up for several of its sorties at once.
    path: 'inscription/mois/:month',
    title: 'Inscription aux sorties du mois · Évangélisation',
    loadComponent: () =>
      import('./pages/public-month-registration/public-month-registration').then(
        (m) => m.PublicMonthRegistration,
      ),
  },
  {
    path: 'inscription/:uuid',
    title: "Inscription à la sortie · Évangélisation",
    loadComponent: () =>
      import('./pages/public-pre-registration/public-pre-registration').then(
        (m) => m.PublicPreRegistration,
      ),
  },
];
