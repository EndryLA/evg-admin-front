import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Base URL of the EVG Management backend, sourced from the Angular environment
 * (`environment.apiUrl`). The build swaps `environment.ts` per configuration via
 * `fileReplacements` in `angular.json`, so this is resolved without touching
 * feature services. The value is the host only — services prepend their own
 * `/api/...` paths.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});
