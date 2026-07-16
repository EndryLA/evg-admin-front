import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { UserDetail } from '../../components/user-detail/user-detail';
import { UserForm } from '../../components/user-form/user-form';
import {
  refName,
  roleLabel,
  roleTone,
  statusLabel,
  statusTone,
  type Option,
  type User,
  type UserInput,
} from '../../user.models';
import { UserService } from '../../user.service';

type Tab = 'ALL' | 'ACTIVE' | 'INACTIVE';
type SortKey = 'member' | 'email' | 'role' | 'status';
type SortDir = 'asc' | 'desc';
type PageItem = number | 'gap';

const PAGE_SIZE = 10;

/** Strip accents & lowercase for accent-insensitive search. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Utilisateurs — the accounts table. Loads all accounts and the member picker
 * once, does search / filter / sort / pagination in memory, then orchestrates
 * the detail slide-over, the create modal and the deactivation confirm.
 *
 * An account's fields are fixed once created (no update endpoint), so the
 * slide-over offers access control and the activation e-mail rather than
 * Modifier / Supprimer.
 */
@Component({
  selector: 'app-user-list',
  imports: [UserDetail, UserForm, ConfirmDialog],
  host: { class: 'data-list' },
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserList {
  private readonly service = inject(UserService);
  private readonly auth = inject(AuthService);

  // ---- Data ----
  protected readonly users = signal<User[]>([]);
  protected readonly profiles = signal<Option[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // ---- Filters / view state ----
  protected readonly query = signal('');
  protected readonly tab = signal<Tab>('ALL');
  protected readonly sortKey = signal<SortKey>('member');
  protected readonly sortDir = signal<SortDir>('asc');
  protected readonly page = signal(1);

  // ---- Overlays ----
  protected readonly selected = signal<User | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  // ---- Activation re-send ----
  protected readonly resending = signal(false);
  protected readonly resent = signal(false);

  // ---- Access control ----
  protected readonly statusBusy = signal(false);
  /** Account awaiting deactivation confirmation. */
  protected readonly disableTarget = signal<User | null>(null);
  /** Failure from the last slide-over action (re-send or status change). */
  protected readonly actionError = signal<string | null>(null);

  protected readonly refName = refName;
  protected readonly roleLabel = roleLabel;
  protected readonly roleTone = roleTone;
  protected readonly statusLabel = statusLabel;
  protected readonly statusTone = statusTone;

  constructor() {
    this.load();
  }

  // ---- Derived collections ----
  protected readonly filtered = computed<User[]>(() => {
    const q = normalize(this.query().trim());
    const tab = this.tab();
    return this.users().filter((u) => {
      if (tab === 'ACTIVE' && !u.enabled) {
        return false;
      }
      if (tab === 'INACTIVE' && u.enabled) {
        return false;
      }
      if (!q) {
        return true;
      }
      return normalize(`${u.email} ${refName(u.profile)} ${roleLabel(u.role)}`).includes(q);
    });
  });

  protected readonly sorted = computed<User[]>(() => {
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.filtered()].sort((a, b) => this.compare(a, b, key) * dir);
  });

  protected readonly total = computed(() => this.users().length);
  protected readonly inactiveCount = computed(() => this.users().filter((u) => !u.enabled).length);
  protected readonly resultCount = computed(() => this.filtered().length);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.resultCount() / PAGE_SIZE)),
  );

  protected readonly rows = computed<User[]>(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.sorted().slice(start, start + PAGE_SIZE);
  });

  protected readonly rangeLabel = computed(() => {
    const count = this.resultCount();
    if (count === 0) {
      return '0 résultat';
    }
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.page() * PAGE_SIZE, count);
    return `${start}–${end} sur ${count}`;
  });

  protected readonly pageItems = computed<PageItem[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const items: PageItem[] = [1];
    const from = Math.max(2, current - 1);
    const to = Math.min(total - 1, current + 1);
    if (from > 2) {
      items.push('gap');
    }
    for (let i = from; i <= to; i++) {
      items.push(i);
    }
    if (to < total - 1) {
      items.push('gap');
    }
    items.push(total);
    return items;
  });

  // ---- Loading ----
  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      users: this.service.list(),
      profiles: this.service.profiles(),
    }).subscribe({
      next: ({ users, profiles }) => {
        this.users.set(users);
        this.profiles.set(profiles);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des utilisateurs impossible.'));
        this.loading.set(false);
      },
    });
  }

  // ---- Filter / sort handlers ----
  protected onSearch(value: string): void {
    this.query.set(value);
    this.page.set(1);
  }
  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.page.set(1);
  }
  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }
  protected sortIndicator(key: SortKey): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  // ---- Pagination ----
  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }
  protected prev(): void {
    this.goTo(this.page() - 1);
  }
  protected next(): void {
    this.goTo(this.page() + 1);
  }

  // ---- Detail ----
  protected view(user: User): void {
    this.selected.set(user);
    this.resent.set(false);
    this.actionError.set(null);
  }
  protected closeDetail(): void {
    this.selected.set(null);
  }

  /** Re-send the activation e-mail for the selected inactive account. */
  protected resendActivation(): void {
    const target = this.selected();
    if (!target || this.resending()) {
      return;
    }
    this.resending.set(true);
    this.resent.set(false);
    this.actionError.set(null);
    this.auth.requestActivation(target.email).subscribe({
      next: () => {
        this.resending.set(false);
        this.resent.set(true);
      },
      error: (err) => {
        this.resending.set(false);
        this.actionError.set(messageFromError(err, 'Envoi du lien impossible. Réessayez.'));
      },
    });
  }

  // ---- Access control ----
  /**
   * Enabling is harmless and applies straight away; revoking someone's access
   * goes through a confirmation first.
   */
  protected onToggleStatus(): void {
    const target = this.selected();
    if (!target || this.statusBusy()) {
      return;
    }
    if (target.enabled) {
      this.disableTarget.set(target);
    } else {
      this.applyStatus(target, true);
    }
  }

  protected cancelDisable(): void {
    this.disableTarget.set(null);
  }

  protected confirmDisable(): void {
    const target = this.disableTarget();
    if (target) {
      this.applyStatus(target, false);
    }
  }

  private applyStatus(target: User, enabled: boolean): void {
    this.statusBusy.set(true);
    this.resent.set(false);
    this.actionError.set(null);
    this.service.setStatus(target.uuid, enabled).subscribe({
      next: (updated) => {
        this.statusBusy.set(false);
        this.disableTarget.set(null);
        // The response carries the new state — patch the row in place rather
        // than refetching the whole list.
        this.users.update((list) => list.map((u) => (u.uuid === updated.uuid ? updated : u)));
        if (this.selected()?.uuid === updated.uuid) {
          this.selected.set(updated);
        }
      },
      error: (err) => {
        this.statusBusy.set(false);
        this.disableTarget.set(null);
        this.actionError.set(
          messageFromError(
            err,
            enabled ? 'Activation impossible. Réessayez.' : 'Désactivation impossible. Réessayez.',
          ),
        );
      },
    });
  }

  // ---- Create ----
  protected openCreate(): void {
    this.saveError.set(null);
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
    this.saveError.set(null);
  }
  protected onSave(input: UserInput): void {
    this.saving.set(true);
    this.saveError.set(null);
    this.service.create(input).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(messageFromError(err, 'Création de l’utilisateur impossible.'));
      },
    });
  }

  private compare(a: User, b: User, key: SortKey): number {
    switch (key) {
      case 'member':
        return refName(a.profile).localeCompare(refName(b.profile), 'fr');
      case 'email':
        return a.email.localeCompare(b.email, 'fr');
      case 'role':
        return roleLabel(a.role).localeCompare(roleLabel(b.role), 'fr');
      case 'status':
        return Number(a.enabled) - Number(b.enabled);
    }
  }
}
