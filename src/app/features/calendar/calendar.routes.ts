import type { Routes } from '@angular/router';

/** Calendar feature routes, mounted under the authenticated shell. */
export const CALENDAR_ROUTES: Routes = [
  {
    path: 'planning',
    title: 'Planning · Évangélisation',
    loadComponent: () =>
      import('./pages/calendar-page/calendar-page').then((m) => m.CalendarPage),
  },
  // The page lived at `/agenda` until it was renamed. Kept so links and
  // bookmarks handed around before the rename still land on it.
  { path: 'agenda', pathMatch: 'full', redirectTo: 'planning' },
];
