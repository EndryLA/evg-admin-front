import type { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import {
  ATTENDANCE_ROUTES,
  PUBLIC_ATTENDANCE_ROUTES,
} from './features/attendance/attendance.routes';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { BRANCH_ROUTES } from './features/branch/branch.routes';
import { CALENDAR_ROUTES } from './features/calendar/calendar.routes';
import { CITY_ROUTES } from './features/city/city.routes';
import { CONTACT_ROUTES, PUBLIC_CONTACT_ROUTES } from './features/contact/contact.routes';
import { INVENTORY_ROUTES } from './features/inventory/inventory.routes';
import { OUTREACH_ROUTES } from './features/outreach/outreach.routes';
import { PROFILE_ROUTES } from './features/profile/profile.routes';
import { USER_ROUTES } from './features/user/user.routes';

export const routes: Routes = [
  ...AUTH_ROUTES,
  ...PUBLIC_CONTACT_ROUTES,
  ...PUBLIC_ATTENDANCE_ROUTES,
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profils' },
      ...PROFILE_ROUTES,
      ...OUTREACH_ROUTES,
      ...CONTACT_ROUTES,
      ...ATTENDANCE_ROUTES,
      ...CALENDAR_ROUTES,
      ...BRANCH_ROUTES,
      ...CITY_ROUTES,
      ...INVENTORY_ROUTES,
      ...USER_ROUTES,
    ],
  },
  { path: '**', redirectTo: '' },
];
