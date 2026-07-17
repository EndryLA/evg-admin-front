import type { Routes } from '@angular/router';

/** Calendar feature routes, mounted under the authenticated shell. */
export const CALENDAR_ROUTES: Routes = [
  {
    path: 'agenda',
    title: 'Agenda · Évangélisation',
    loadComponent: () =>
      import('./pages/calendar-page/calendar-page').then((m) => m.CalendarPage),
  },
];
