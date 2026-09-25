import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/** Phones: below the app's 721px layout breakpoint. */
export const COMPACT_MEDIA = '(max-width: 720px)';

/**
 * Whether `query` currently matches, kept up to date while the calling
 * component lives. Call it in an injection context (a field initializer or
 * the constructor). For layouts that change markup, not just styles — e.g. a
 * table on desktop, a list on phones.
 */
export function mediaMatches(query: string = COMPACT_MEDIA): Signal<boolean> {
  const media = window.matchMedia(query);
  const matches = signal(media.matches);
  const onChange = (event: MediaQueryListEvent) => matches.set(event.matches);
  media.addEventListener('change', onChange);
  inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
  return matches.asReadonly();
}
