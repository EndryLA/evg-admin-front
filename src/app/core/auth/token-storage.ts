import { Injectable } from '@angular/core';
import type { AuthSession } from './auth.models';

const STORAGE_KEY = 'evg.auth.session';

/**
 * Persists the {@link AuthSession} in `localStorage` so the admin stays signed
 * in across full browser restarts. Guarded against environments where storage
 * is unavailable (e.g. SSR, private-mode quirks).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  read(): AuthSession | null {
    const raw = this.safeGet();
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AuthSession>;
      if (!parsed.accessToken) {
        return null;
      }
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken ?? '',
        tokenType: parsed.tokenType ?? 'Bearer',
      };
    } catch {
      return null;
    }
  }

  write(session: AuthSession): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage full/unavailable — session stays in memory for this tab only.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
  }

  private safeGet(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
