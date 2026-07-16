import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extract a human-friendly message from an HTTP error, preferring the backend's
 * own `message` field and falling back to a caller-supplied default.
 */
export function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
    }
    const body = error.error as { message?: unknown; detail?: unknown } | string | null;
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (body && typeof body === 'object') {
      const msg = body.message ?? body.detail;
      if (typeof msg === 'string' && msg.trim()) {
        return msg;
      }
    }
  }
  return fallback;
}
