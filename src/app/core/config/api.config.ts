import { InjectionToken } from '@angular/core';

/**
 * Base URL of the EVG Management backend. Provided in `app.config.ts` so it can
 * be swapped per environment without touching feature services.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:4000',
});
