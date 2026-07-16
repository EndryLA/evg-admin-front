import type { Routes } from '@angular/router';

import { guestGuard } from '../../core/auth/auth.guard';

/**
 * Auth screens. All are gated by {@link guestGuard} so signed-in users are
 * bounced to the app rather than shown a login form.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'connexion',
    canActivate: [guestGuard],
    title: 'Connexion',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'mot-de-passe-oublie',
    canActivate: [guestGuard],
    title: 'Mot de passe oublié',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reinitialiser-mot-de-passe',
    canActivate: [guestGuard],
    title: 'Mot de passe oublié',
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'activation',
    canActivate: [guestGuard],
    title: 'Activation',
    loadComponent: () =>
      import('./pages/activate-account/activate-account').then((m) => m.ActivateAccount),
  },
];
