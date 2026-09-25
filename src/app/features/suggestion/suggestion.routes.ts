import type { Routes } from '@angular/router';

import { ACCESS } from '../../core/auth/access';
import { hasAnyRole } from '../../core/auth/auth.guard';

/**
 * Suggestion routes, mounted under the authenticated shell. Every member has
 * "Mes suggestions" (send + follow their own); the full list is for
 * {@link ACCESS.suggestions}. A suggestion's page is open to all here — the
 * backend only serves it to its author or an admin.
 */
export const SUGGESTION_ROUTES: Routes = [
  {
    path: 'mes-suggestions',
    title: 'Mes suggestions · Évangélisation',
    loadComponent: () =>
      import('./pages/my-suggestions/my-suggestions').then((m) => m.MySuggestions),
  },
  {
    path: 'suggestions',
    title: 'Suggestions · Évangélisation',
    canActivate: [hasAnyRole(...ACCESS.suggestions)],
    loadComponent: () =>
      import('./pages/suggestion-list/suggestion-list').then((m) => m.SuggestionList),
  },
  {
    path: 'suggestions/:uuid',
    title: 'Suggestion · Évangélisation',
    loadComponent: () =>
      import('./pages/suggestion-detail/suggestion-detail').then((m) => m.SuggestionDetail),
  },
];
