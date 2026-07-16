import type { Routes } from '@angular/router';

/** Admin contact routes, mounted under the authenticated shell. */
export const CONTACT_ROUTES: Routes = [
  {
    path: 'contacts',
    title: 'Contacts · Évangélisation',
    loadComponent: () =>
      import('./pages/contact-list/contact-list').then((m) => m.ContactList),
  },
  {
    path: 'contacts/:uuid',
    title: 'Contact · Évangélisation',
    loadComponent: () =>
      import('./pages/contact-detail/contact-detail').then((m) => m.ContactDetail),
  },
];

/**
 * Public, unauthenticated contact form for a given outreach. Lives outside the
 * app shell so a member of the public can submit without signing in.
 */
export const PUBLIC_CONTACT_ROUTES: Routes = [
  {
    path: 'sortie/:uuid/contact',
    title: 'Formulaire de contact · Évangélisation',
    loadComponent: () =>
      import('./pages/public-contact-form/public-contact-form').then(
        (m) => m.PublicContactForm,
      ),
  },
];
