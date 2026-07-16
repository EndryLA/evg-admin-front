import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';

import { API_BASE_URL } from '../config/api.config';
import { TokenStorage } from './token-storage';

/**
 * Attaches the API base URL and bearer token to outgoing requests, per the
 * core-infrastructure rule (services never hardcode either). Reads the token
 * from {@link TokenStorage} rather than `AuthService` to avoid an HttpClient
 * dependency cycle. Absolute URLs are passed through untouched.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(API_BASE_URL);
  const storage = inject(TokenStorage);

  const isRelative = !/^https?:\/\//i.test(req.url);
  const url = isRelative ? `${baseUrl}${req.url}` : req.url;
  const token = storage.read()?.accessToken;

  const authorized =
    isRelative && token
      ? req.clone({ url, setHeaders: { Authorization: `Bearer ${token}` } })
      : req.clone({ url });

  return next(authorized);
};
