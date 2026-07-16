import { Component, computed, inject, signal } from '@angular/core';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ProfileDetail } from '../../components/profile-detail/profile-detail';
import { ProfileForm } from '../../components/profile-form/profile-form';
import { ProfileService } from '../../profile.service';
import {
  fullName,
  leaderTone,
  MEMBERSHIP_LABELS,
  type MembershipType,
  type Profile,
  type ProfileFormResult,
} from '../../profile.models';
import { ageLabel } from '../../../../shared/util/date.util';

type Tab = 'ALL' | 'OUVRIER' | 'AIDE';
type SortKey = 'name' | 'type' | 'joined';
type SortDir = 'asc' | 'desc';
type PageItem = number | 'gap';

const PAGE_SIZE = 10;

/** Strip accents & lowercase for accent-insensitive search. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Profils — the members table. Loads all profiles once and does search, tab
 * filtering, the 1ᵉʳ-département toggle, sorting and pagination in memory, then
 * orchestrates the detail slide-over, create/edit modal and delete dialog.
 */
@Component({
  selector: 'app-profile-list',
  imports: [ProfileDetail, ProfileForm, ConfirmDialog],
  host: { class: 'data-list' },
  templateUrl: './profile-list.html',
  styleUrl: './profile-list.scss',
})
export class ProfileList {
  private readonly service = inject(ProfileService);

  // ---- Data ----
  protected readonly profiles = signal<Profile[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // ---- Filters / view state ----
  protected readonly query = signal('');
  protected readonly tab = signal<Tab>('ALL');
  protected readonly deptOnly = signal(false);
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortDir = signal<SortDir>('asc');
  protected readonly page = signal(1);

  // ---- Overlays ----
  /** Mobile-only: the bottom filter drawer. */
  protected readonly filterDrawerOpen = signal(false);
  /** Active drawer filters (search excluded — it stays visible). Drives the badge. */
  protected readonly activeFilterCount = computed(
    () => (this.tab() !== 'ALL' ? 1 : 0) + (this.deptOnly() ? 1 : 0),
  );
  protected readonly selected = signal<Profile | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly formProfile = signal<Profile | null>(null);
  protected readonly saving = signal(false);
  protected readonly confirmTarget = signal<Profile | null>(null);
  protected readonly deleting = signal(false);

  protected readonly fullName = fullName;
  protected readonly age = ageLabel;
  protected readonly leaderTone = leaderTone;
  protected membershipLabel(type: MembershipType | null): string {
    return type ? MEMBERSHIP_LABELS[type] : '—';
  }

  /** Team leaders, offered as "Chef d'équipe" options in the form. */
  protected readonly leaders = computed(() =>
    this.profiles().filter((p) => p.isTeamLeader),
  );

  constructor() {
    this.load();
  }

  // ---- Derived collections ----
  protected readonly filtered = computed<Profile[]>(() => {
    const q = normalize(this.query().trim());
    const tab = this.tab();
    const deptOnly = this.deptOnly();
    return this.profiles().filter((p) => {
      if (tab !== 'ALL' && p.membershipType !== tab) {
        return false;
      }
      if (deptOnly && !p.firstDepartment) {
        return false;
      }
      if (q) {
        const haystack = normalize(
          `${p.firstname} ${p.lastname} ${p.email ?? ''} ${p.phoneNumber ?? ''}`,
        );
        if (!haystack.includes(q)) {
          return false;
        }
      }
      return true;
    });
  });

  protected readonly sorted = computed<Profile[]>(() => {
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.filtered()].sort((a, b) => {
      const cmp = this.compare(a, b, key);
      return cmp * dir;
    });
  });

  protected readonly total = computed(() => this.profiles().length);
  protected readonly resultCount = computed(() => this.filtered().length);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.resultCount() / PAGE_SIZE)),
  );

  protected readonly rows = computed<Profile[]>(() => {
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
    this.service.list().subscribe({
      next: (data) => {
        this.profiles.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des profils impossible.'));
        this.loading.set(false);
      },
    });
  }

  // ---- Filter handlers (all reset to page 1) ----
  protected onSearch(value: string): void {
    this.query.set(value);
    this.page.set(1);
  }
  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.page.set(1);
  }
  protected toggleDept(): void {
    this.deptOnly.update((v) => !v);
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
  protected view(profile: Profile): void {
    this.selected.set(profile);
  }
  protected closeDetail(): void {
    this.selected.set(null);
  }

  // ---- Filter drawer (mobile) ----
  protected openFilters(): void {
    this.filterDrawerOpen.set(true);
  }
  protected closeFilters(): void {
    this.filterDrawerOpen.set(false);
  }

  // ---- Create / edit ----
  protected openCreate(): void {
    this.formProfile.set(null);
    this.formOpen.set(true);
  }
  protected openEdit(profile: Profile): void {
    this.selected.set(null);
    this.formProfile.set(profile);
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
    this.formProfile.set(null);
  }
  protected onSave(result: ProfileFormResult): void {
    const editing = this.formProfile();
    const request$ = editing
      ? this.service.update(editing.uuid, result.input)
      : this.service.create(result.input);

    this.saving.set(true);
    request$.subscribe({
      next: (saved) => {
        // The team leader is assigned through a separate endpoint; only call it
        // when a leader was picked and it actually changed. (The backend has no
        // "unassign", so clearing to "Aucun" is a no-op here.)
        const leader = result.leaderUuid;
        if (leader && leader !== (editing?.leaderUuid ?? null)) {
          this.service.assignLeader(saved.uuid, leader).subscribe({
            next: () => this.finishSave(),
            error: () => this.finishSave(),
          });
        } else {
          this.finishSave();
        }
      },
      error: () => this.saving.set(false),
    });
  }

  private finishSave(): void {
    this.saving.set(false);
    this.closeForm();
    this.load();
  }

  // ---- Delete ----
  protected askDelete(profile: Profile): void {
    this.selected.set(null);
    this.confirmTarget.set(profile);
  }
  protected cancelDelete(): void {
    this.confirmTarget.set(null);
  }
  protected confirmDelete(): void {
    const target = this.confirmTarget();
    if (!target) {
      return;
    }
    this.deleting.set(true);
    this.service.remove(target.uuid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmTarget.set(null);
        this.load();
      },
      error: () => this.deleting.set(false),
    });
  }

  private compare(a: Profile, b: Profile, key: SortKey): number {
    switch (key) {
      case 'name':
        return `${a.lastname} ${a.firstname}`.localeCompare(
          `${b.lastname} ${b.firstname}`,
          'fr',
        );
      case 'type':
        return (a.membershipType ?? '').localeCompare(b.membershipType ?? '');
      case 'joined':
        return (a.joinedAt ?? 0) - (b.joinedAt ?? 0);
    }
  }
}
