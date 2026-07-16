import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { messageFromError } from '../../../../core/http/http-error.util';
import { BranchForm } from '../../components/branch-form/branch-form';
import { BranchMembershipService } from '../../branch-membership.service';
import { BranchService } from '../../branch.service';
import {
  refName,
  type Branch,
  type BranchInput,
  type BranchMember,
  type Option,
} from '../../branch.models';

type SortKey = 'name' | 'members';
type SortDir = 'asc' | 'desc';
type PageItem = number | 'gap';

const PAGE_SIZE = 10;

/** Strip accents & lowercase for accent-insensitive search. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Branches — the organisation table. Loads all branches, their member
 * assignments (for the count column) and the profile picker once, then does
 * search / sort / pagination in memory. Rows link to the detail page
 * (`/branches/:uuid`), where members are managed; only creation happens here.
 */
@Component({
  selector: 'app-branch-list',
  imports: [BranchForm],
  host: { class: 'data-list' },
  templateUrl: './branch-list.html',
  styleUrl: './branch-list.scss',
})
export class BranchList {
  private readonly service = inject(BranchService);
  private readonly membershipService = inject(BranchMembershipService);
  private readonly router = inject(Router);

  // ---- Data ----
  protected readonly branches = signal<Branch[]>([]);
  protected readonly memberships = signal<BranchMember[]>([]);
  protected readonly profiles = signal<Option[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // ---- Filters / view state ----
  protected readonly query = signal('');
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortDir = signal<SortDir>('asc');
  protected readonly page = signal(1);

  // ---- Create modal ----
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);

  protected readonly refName = refName;

  constructor() {
    this.load();
  }

  protected memberCount(branchUuid: string): number {
    return this.memberships().filter((m) => m.branchUuid === branchUuid).length;
  }

  // ---- Derived collections ----
  protected readonly filtered = computed<Branch[]>(() => {
    const q = normalize(this.query().trim());
    if (!q) {
      return this.branches();
    }
    return this.branches().filter((b) => {
      const haystack = normalize(`${b.name} ${b.description} ${refName(b.responsible)}`);
      return haystack.includes(q);
    });
  });

  protected readonly sorted = computed<Branch[]>(() => {
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.filtered()].sort((a, b) => this.compare(a, b, key) * dir);
  });

  protected readonly total = computed(() => this.branches().length);
  protected readonly resultCount = computed(() => this.filtered().length);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.resultCount() / PAGE_SIZE)),
  );

  protected readonly rows = computed<Branch[]>(() => {
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
      branches: this.service.list(),
      memberships: this.membershipService.list(),
      profiles: this.service.profiles(),
    }).subscribe({
      next: ({ branches, memberships, profiles }) => {
        this.branches.set(branches);
        this.memberships.set(memberships);
        this.profiles.set(profiles);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des branches impossible.'));
        this.loading.set(false);
      },
    });
  }

  // ---- Filter / sort handlers ----
  protected onSearch(value: string): void {
    this.query.set(value);
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

  // ---- Navigation ----
  protected view(branch: Branch): void {
    this.router.navigate(['/branches', branch.uuid]);
  }

  // ---- Create ----
  protected openCreate(): void {
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
  }
  protected onSave(input: BranchInput): void {
    this.saving.set(true);
    this.service.create(input).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  private compare(a: Branch, b: Branch, key: SortKey): number {
    switch (key) {
      case 'name':
        return a.name.localeCompare(b.name, 'fr');
      case 'members':
        return this.memberCount(a.uuid) - this.memberCount(b.uuid);
    }
  }
}
