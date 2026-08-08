import { Injectable } from '@angular/core';

/** localStorage key prefix; one entry per outreach. */
const KEY_PREFIX = 'evg.contact.edit.';

/**
 * Safety expiry for a stored token (24h). The backend's open/closed check is the
 * real gate on editing; this just stops a stale token lingering on the device.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

interface StoredToken {
  token: string;
  /** Epoch ms after which the token is dropped, regardless of outreach status. */
  expiresAt: number;
}

/**
 * Persists the anonymous submitter token per outreach in `localStorage`, so a
 * person who filled in contacts can come back and edit them — until the outreach
 * closes (backend-enforced) or 24h passes (client safety net). Guarded against
 * environments where storage is unavailable.
 *
 * Lives in `core/` because both the contact feature (which mints and consumes the
 * token) and the sortie landing page (which only checks whether one exists, to
 * offer the "modifier" entry point) read it.
 */
@Injectable({ providedIn: 'root' })
export class ContactEditTokenStore {
  /** The token for an outreach, or null if none/expired (expired ones are purged). */
  read(outreachUuid: string): string | null {
    const raw = this.safeGet(this.key(outreachUuid));
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredToken>;
      if (!parsed.token || typeof parsed.expiresAt !== 'number') {
        return null;
      }
      if (Date.now() >= parsed.expiresAt) {
        this.clear(outreachUuid);
        return null;
      }
      return parsed.token;
    } catch {
      return null;
    }
  }

  /** Store (or refresh) the token for an outreach, resetting its 24h window. */
  write(outreachUuid: string, token: string): void {
    const value: StoredToken = { token, expiresAt: Date.now() + TTL_MS };
    try {
      localStorage.setItem(this.key(outreachUuid), JSON.stringify(value));
    } catch {
      // Storage full/unavailable — editing simply won't persist across reloads.
    }
  }

  clear(outreachUuid: string): void {
    try {
      localStorage.removeItem(this.key(outreachUuid));
    } catch {
      // no-op
    }
  }

  private key(outreachUuid: string): string {
    return `${KEY_PREFIX}${outreachUuid}`;
  }

  private safeGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}
