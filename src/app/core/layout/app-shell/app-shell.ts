import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { catchError, filter, map, of, switchMap, type Observable } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { ACCESS } from '../../auth/access';
import { primaryRole, ROLE_LABELS } from '../../auth/auth.models';
import { AuthService } from '../../auth/auth.service';
import { ThemeService } from '../../theme/theme.service';
import { BrandLogo } from '../../../shared/ui/brand-logo/brand-logo';

/** `ProfileResponse`, narrowed to the name. */
interface RawProfileName {
  firstname?: string | null;
  lastname?: string | null;
}

interface ProfileName {
  firstname: string;
  lastname: string;
}

function toProfileName(raw: RawProfileName): ProfileName | null {
  const firstname = raw.firstname?.trim() ?? '';
  return firstname ? { firstname, lastname: raw.lastname?.trim() ?? '' } : null;
}

/**
 * Authenticated layout: a dark sidebar (brand, grouped nav, user card) plus a
 * scrollable main region hosting the routed feature page. On desktop the sidebar
 * is a fixed column; on mobile it collapses behind a top bar and slides in as an
 * overlay, toggled by the hamburger button. Nav entries beyond Effectif are
 * placeholders until their features land.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandLogo],
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
  private readonly http = inject(HttpClient);

  protected readonly user = this.auth.currentUser;

  // Nav entries the current user cannot reach are hidden rather than left to
  // bounce off their route guard. Same rules as the guards (see ACCESS).
  protected readonly canSeeUsers = computed(() => this.auth.hasAnyRole(ACCESS.users));
  protected readonly canSeeTeamLeaders = computed(() => this.auth.hasAnyRole(ACCESS.teamLeaders));
  protected readonly canSeeCities = computed(() => this.auth.hasAnyRole(ACCESS.cities));
  protected readonly canSeeFlyers = computed(() => this.auth.hasAnyRole(ACCESS.flyers));

  /** Reflects the active theme so the toggle can show the right icon/label. */
  protected readonly isDark = this.theme.isDark;

  private static readonly COLLAPSED_KEY = 'evg.sidebar.collapsed';

  /** Whether the mobile sidebar overlay is open. Ignored on desktop (always visible). */
  protected readonly sidebarOpen = signal(false);

  /** Whether the desktop sidebar is collapsed to an icon rail. Persisted; ignored on mobile. */
  protected readonly collapsed = signal(this.readCollapsed());

  /** Current route URL, kept live for the "Statistiques" group's active/open state. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Whether the "Statistiques" group's children are shown. */
  protected readonly statsOpen = signal(this.url().startsWith('/statistiques'));
  /** Whether a Statistiques child route is active — highlights the group header. */
  protected readonly statsActive = computed(() => this.url().startsWith('/statistiques'));

  constructor() {
    // Keep the group open while any of its children is the active route.
    effect(() => {
      if (this.statsActive()) {
        this.statsOpen.set(true);
      }
    });

    // Close the mobile overlay whenever navigation completes.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeSidebar());

    // Persist the desktop collapsed preference.
    effect(() => this.writeCollapsed(this.collapsed()));

    // Look the user's name up whenever the signed-in account changes.
    effect((onCleanup) => {
      const user = this.user();
      this.profileName.set(null);
      if (!user) {
        return;
      }
      const sub = this.lookUpName(user.profileUuid, user.email).subscribe((name) =>
        this.profileName.set(name),
      );
      onCleanup(() => sub.unsubscribe());
    });
  }

  /**
   * The token carries no name, so the linked profile is fetched: by its uuid
   * when the claim is present, else by searching the roster for the e-mail.
   * Best-effort — `null` when neither resolves.
   */
  private lookUpName(profileUuid: string | null, email: string | null): Observable<ProfileName | null> {
    const byUuid = profileUuid
      ? this.http.get<RawProfileName>(`/api/profiles/${profileUuid}`).pipe(
          map(toProfileName),
          catchError(() => of(null)),
        )
      : of(null);

    return byUuid.pipe(
      switchMap((name) => {
        if (name || !email?.includes('@')) {
          return of(name);
        }
        const params = new HttpParams().set('page', 0).set('size', 1).set('search', email);
        return this.http
          .get<{ content?: RawProfileName[] }>('/api/profiles', { params })
          .pipe(
            map((page) => (page.content?.[0] ? toProfileName(page.content[0]) : null)),
            catchError(() => of(null)),
          );
      }),
    );
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

  protected toggleStats(): void {
    this.statsOpen.update((open) => !open);
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

  /** The signed-in member's profile name, once looked up (see the constructor). */
  private readonly profileName = signal<ProfileName | null>(null);

  /** `Marie Dupont` from the profile; the e-mail's local part until it's known. */
  protected readonly displayName = computed(() => {
    const name = this.profileName();
    if (name?.firstname) {
      return `${name.firstname} ${name.lastname}`.trim();
    }
    const email = this.user()?.email;
    if (!email) {
      return 'Utilisateur';
    }
    return email.split('@')[0];
  });

  protected readonly initials = computed(() => {
    const name = this.profileName();
    if (name?.firstname) {
      return (name.firstname.charAt(0) + name.lastname.charAt(0)).toUpperCase();
    }
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
