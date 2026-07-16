import { computed, effect, Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

/** localStorage key holding the user's explicit override (absent = follow OS). */
const STORAGE_KEY = 'evg.theme';

/**
 * App-wide light/dark theme. Resolves to an explicit user override when one has
 * been set, otherwise follows the OS `prefers-color-scheme`. The resolved theme
 * is reflected onto `<html data-theme>` so the token layer in `styles.scss` can
 * switch. An inline bootstrap in `index.html` applies the same attribute before
 * first paint to avoid a flash; this service keeps it in sync afterwards.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Explicit user choice, or `null` to defer to the operating system. */
  private readonly override = signal<ThemeMode | null>(this.readOverride());

  /** Latest OS preference, kept live via a media-query listener. */
  private readonly systemDark = signal(this.prefersDark());

  /** The theme actually applied to the document. */
  readonly theme = computed<ThemeMode>(() => {
    const override = this.override();
    if (override) {
      return override;
    }
    return this.systemDark() ? 'dark' : 'light';
  });

  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    const media = this.mediaQuery();
    if (media) {
      media.addEventListener('change', (event) => this.systemDark.set(event.matches));
    }

    // Reflect the resolved theme onto the root element whenever it changes.
    effect(() => {
      const root = document.documentElement;
      root.setAttribute('data-theme', this.theme());
    });
  }

  /** Flip to the opposite of the currently displayed theme and remember it. */
  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  /** Pin an explicit theme, persisting the choice. */
  set(mode: ThemeMode): void {
    this.override.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures (e.g. private mode); the choice still applies in-session.
    }
  }

  /** Drop the override and follow the OS preference again. */
  useSystem(): void {
    this.override.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  private readOverride(): ThemeMode | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch {
      return null;
    }
  }

  private mediaQuery(): MediaQueryList | null {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  }

  private prefersDark(): boolean {
    return this.mediaQuery()?.matches ?? false;
  }
}
