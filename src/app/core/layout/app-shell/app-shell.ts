import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ACCESS } from '../../auth/access';
import { primaryRole, ROLE_LABELS } from '../../auth/auth.models';
import { AuthService } from '../../auth/auth.service';
import { ThemeService } from '../../theme/theme.service';

/**
 * Authenticated layout: a dark sidebar (brand, grouped nav, user card) plus a
 * scrollable main region hosting the routed feature page. On desktop the sidebar
 * is a fixed column; on mobile it collapses behind a top bar and slides in as an
 * overlay, toggled by the hamburger button. Nav entries beyond Profils are
 * placeholders until their features land.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  host: {
    '(document:keydown.escape)': 'closeSidebar()',
  },
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  protected readonly user = this.auth.currentUser;

  // Nav entries the current user cannot reach are hidden rather than left to
  // bounce off their route guard. Same rules as the guards (see ACCESS).
  protected readonly canSeeUsers = computed(() => this.auth.hasAnyRole(ACCESS.users));
  protected readonly canSeeTeamLeaders = computed(() => this.auth.hasAnyRole(ACCESS.teamLeaders));
  protected readonly canSeeCities = computed(() => this.auth.hasAnyRole(ACCESS.cities));

  /** Reflects the active theme so the toggle can show the right icon/label. */
  protected readonly isDark = this.theme.isDark;

  private static readonly COLLAPSED_KEY = 'evg.sidebar.collapsed';

  /** Whether the mobile sidebar overlay is open. Ignored on desktop (always visible). */
  protected readonly sidebarOpen = signal(false);

  /** Whether the desktop sidebar is collapsed to an icon rail. Persisted; ignored on mobile. */
  protected readonly collapsed = signal(this.readCollapsed());

  constructor() {
    // Close the mobile overlay whenever navigation completes.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeSidebar());

    // Persist the desktop collapsed preference.
    effect(() => this.writeCollapsed(this.collapsed()));
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(AppShell.COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeCollapsed(value: boolean): void {
    try {
      localStorage.setItem(AppShell.COLLAPSED_KEY, String(value));
    } catch {
      // Ignore storage failures (e.g. private mode); collapse still works in-session.
    }
  }

  /** The broadest role held — the card has room for one. */
  protected readonly roleLabel = computed(() => {
    const role = primaryRole(this.user()?.roles ?? []);
    return role ? ROLE_LABELS[role] : 'Membre';
  });

  protected readonly displayName = computed(() => {
    const email = this.user()?.email;
    if (!email) {
      return 'Utilisateur';
    }
    return email.split('@')[0];
  });

  protected readonly initials = computed(() => {
    const source = this.displayName();
    const parts = source.split(/[.\-_\s]+/).filter(Boolean);
    const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
    return (letters || source.slice(0, 2)).toUpperCase();
  });

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected logout(): void {
    this.auth.logout();
  }
}
