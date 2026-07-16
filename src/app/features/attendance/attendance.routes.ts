import type { Routes } from '@angular/router';

/** Attendance feature routes, mounted under the authenticated shell. */
export const ATTENDANCE_ROUTES: Routes = [
  {
    path: 'presences',
    title: 'Présences · Évangélisation',
    loadComponent: () =>
      import('./pages/attendance-list/attendance-list').then((m) => m.AttendanceList),
  },
];

/**
 * Public, unauthenticated presence form for a given outreach. Lives outside the
 * app shell so anyone can mark their presence without signing in.
 */
export const PUBLIC_ATTENDANCE_ROUTES: Routes = [
  {
    path: 'sortie/:uuid/presence',
    title: 'Marquer sa présence · Évangélisation',
    loadComponent: () =>
      import('./pages/public-attendance-form/public-attendance-form').then(
        (m) => m.PublicAttendanceForm,
      ),
  },
];
