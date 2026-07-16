import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, tap, type Observable } from 'rxjs';

import {
  toAuthSession,
  userFromToken,
  type RawLoginResponse,
  type RawMessageResponse,
} from './auth.adapter';
import type {
  ActivationConfirmation,
  AuthenticatedUser,
  AuthSession,
  Credentials,
  ResetPassword,
  UserRole,
} from './auth.models';
import { isJwtExpired } from './jwt.util';
import { TokenStorage } from './token-storage';

/**
 * App-wide authentication state and the sole gateway to `/api/auth/*`.
 * Holds the session as a signal; identity is derived from the access token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(TokenStorage);
  private readonly router = inject(Router);

  private readonly session = signal<AuthSession | null>(this.storage.read());

  /** Current tokens, or `null` when signed out. */
  readonly currentSession = this.session.asReadonly();

  /** Identity derived from the access token, or `null` when signed out. */
  readonly currentUser = computed<AuthenticatedUser | null>(() => {
    const s = this.session();
    return s ? userFromToken(s.accessToken) : null;
  });

  /** `true` while a valid, unexpired access token is held. */
  readonly isAuthenticated = computed<boolean>(() => {
    const s = this.session();
    return !!s && !isJwtExpired(s.accessToken);
  });

  /** Every role the current token grants; empty when signed out. */
  readonly roles = computed<readonly UserRole[]>(() => this.currentUser()?.roles ?? []);

  /**
   * Whether the signed-in user holds `role`. Client-side only — a convenience
   * for routing and UI; the backend still enforces access.
   */
  hasRole(role: UserRole): boolean {
    return this.roles().includes(role);
  }

  /** Whether the signed-in user holds at least one of `roles`. */
  hasAnyRole(roles: readonly UserRole[]): boolean {
    return roles.some((role) => this.roles().includes(role));
  }

  /** Raw access token for the HTTP interceptor. */
  accessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  login(credentials: Credentials): Observable<AuthSession> {
    return this.http
      .post<RawLoginResponse>(`/api/auth/login`, credentials)
      .pipe(
        map(toAuthSession),
        tap((session) => this.persist(session)),
      );
  }

  /** Asks the backend to e-mail a password-reset link. Returns its message. */
  forgotPassword(email: string): Observable<string> {
    return this.http
      .post<RawMessageResponse>(`/api/auth/password/forgot`, { email })
      .pipe(map((r) => r.message ?? ''));
  }

  resetPassword(payload: ResetPassword): Observable<string> {
    return this.http
      .post<RawMessageResponse>(`/api/auth/password/reset`, payload)
      .pipe(map((r) => r.message ?? ''));
  }

  /** Asks the backend to e-mail an activation link. Returns its message. */
  requestActivation(email: string): Observable<string> {
    return this.http
      .post<RawMessageResponse>(`/api/auth/activation/request`, { email })
      .pipe(map((r) => r.message ?? ''));
  }

  confirmActivation(payload: ActivationConfirmation): Observable<string> {
    return this.http
      .post<RawMessageResponse>(`/api/auth/activation/confirm`, payload)
      .pipe(map((r) => r.message ?? ''));
  }

  /** Clears the session and returns to the login screen. */
  logout(): void {
    this.session.set(null);
    this.storage.clear();
    void this.router.navigate(['/connexion']);
  }

  private persist(session: AuthSession): void {
    this.session.set(session);
    this.storage.write(session);
  }
}
