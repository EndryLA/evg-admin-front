import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';

import { messageFromError } from '../../../../core/http/http-error.util';
import { PhoneFrPipe } from '../../../../shared/pipes/phone.pipe';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ProfileDetail } from '../../components/profile-detail/profile-detail';
import { ProfileForm } from '../../components/profile-form/profile-form';
import { ProfileService } from '../../profile.service';
import {
  EMPTY_PROFILE_FILTER,
  fullName,
  MEMBERSHIP_LABELS,
  type MembershipType,
  type Profile,
  type ProfileFilter,
  type ProfileFormResult,
} from '../../profile.models';
import { ageLabel } from '../../../../shared/util/date.util';

/** The type-tab selection: all types, or one {@link MembershipType}. */
type TypeFilter = ProfileFilter['membershipType'];
type SortKey = 'name' | 'type' | 'joined';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;
/** Debounce before the free-text search triggers a server reload. */
const SEARCH_DEBOUNCE_MS = 300;

/** Sortable columns mapped to the backing entity field Spring sorts on. */
const SORT_FIELDS: Record<SortKey, string> = {
  name: 'lastname',
  type: 'membershipType',
  joined: 'joinedAt',
};

/**
 * Effectif — the members table. Paged server-side and loaded 20 at a time via
 * infinite scroll (`GET /api/profiles?page&size&sort` + `ProfileFilter`): an
 * IntersectionObserver on a bottom sentinel pulls the next page as it comes into
 * view. Search, type, 1ᵉʳ-département, team leader and the joined-year range are
 * all applied server-side, so any change — sorting included — reloads from the
 * first page. Also orchestrates the detail slide-over, create/edit modal and
 * delete dialog.
 */
@Component({
  selector: 'app-profile-list',
  imports: [ProfileDetail, ProfileForm, ConfirmDialog, PhoneFrPipe],
  host: { class: 'data-list' },
  templateUrl: './profile-list.html',
  styleUrl: './profile-list.scss',
})
export class ProfileList implements OnDestroy {
  private readonly service = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scrollRoot = viewChild<ElementRef<HTMLElement>>('scrollRoot');
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  // ---- Data ----
  protected readonly rows = signal<Profile[]>([]);
  protected readonly loading = signal(true); // initial page
  protected readonly loadingMore = signal(false); // subsequent pages
  protected readonly loadError = signal<string | null>(null);
  protected readonly hasMore = signal(true);
  protected readonly totalElements = signal(0);
  private nextPage = 0;

  /**
   * Team leaders — the "Chef d'équipe" options in both the filter and the form.
   * Fetched separately from the paged list, which only ever holds the rows
   * matching the current filter.
   */
  protected readonly leaders = signal<Profile[]>([]);

  // ---- Filters ----
  protected readonly filter = signal<ProfileFilter>({ ...EMPTY_PROFILE_FILTER });
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortDir = signal<SortDir>('asc');

  /** True when any filter is narrowing the list (drives the reset button). */
  protected readonly hasActiveFilters = computed(() => {
    const f = this.filter();
    return (
      f.search.trim() !== '' ||
      f.membershipType !== 'ALL' ||
      f.firstDepartment !== null ||
      f.leaderUuid !== null ||
      f.minJoinedAt !== null ||
      f.maxJoinedAt !== null
    );
  });

  /** Active drawer filters (search excluded — it stays visible). Drives the badge. */
  protected readonly activeFilterCount = computed(() => {
    const f = this.filter();
    return (
      (f.membershipType !== 'ALL' ? 1 : 0) +
      (f.firstDepartment !== null ? 1 : 0) +
      (f.leaderUuid !== null ? 1 : 0) +
      (f.minJoinedAt !== null ? 1 : 0) +
      (f.maxJoinedAt !== null ? 1 : 0)
    );
  });

  /** The 1ᵉʳ-département chip is a toggle: on = `true`, off = unconstrained. */
  protected readonly deptOnly = computed(() => this.filter().firstDepartment === true);

  // ---- Overlays ----
  /** Mobile-only: the bottom filter drawer. */
  protected readonly filterDrawerOpen = signal(false);
  protected readonly selected = signal<Profile | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly formProfile = signal<Profile | null>(null);
  protected readonly saving = signal(false);
  protected readonly confirmTarget = signal<Profile | null>(null);
  protected readonly deleting = signal(false);

  protected readonly fullName = fullName;
  protected readonly age = ageLabel;
  protected membershipLabel(type: MembershipType | null): string {
    return type ? MEMBERSHIP_LABELS[type] : '—';
  }

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
    this.loadLeaders();
    afterNextRender(() => this.observe());
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  // ---- Loading ----
  /** (Re)start from the first page — used on load and whenever a filter changes. */
  protected load(): void {
    this.rows.set([]);
    this.nextPage = 0;
    this.hasMore.set(true);
    this.loadError.set(null);
    this.loading.set(true);
    this.fetchNext(true);
  }

  /** Pull the next page — triggered by the bottom sentinel. */
  protected loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore() || this.loadError()) {
      return;
    }
    this.loadingMore.set(true);
    this.fetchNext(false);
  }

  private fetchNext(initial: boolean): void {
    const sort = `${SORT_FIELDS[this.sortKey()]},${this.sortDir()}`;
    this.service.list(this.nextPage, PAGE_SIZE, this.filter(), sort).subscribe({
      next: (page) => {
        this.rows.update((list) => (initial ? page.items : [...list, ...page.items]));
        this.totalElements.set(page.totalElements);
        this.hasMore.set(!page.last && page.items.length > 0);
        this.nextPage += 1;
        this.loading.set(false);
        this.loadingMore.set(false);
        this.maybeLoadMore();
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des profils impossible.'));
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }

  /** Best-effort: the filter/form leader options degrade to empty on failure. */
  private loadLeaders(): void {
    this.service.listAll().subscribe({
      next: (all) => this.leaders.set(all.filter((p) => p.isTeamLeader)),
      error: () => this.leaders.set([]),
    });
  }

  // ---- Infinite scroll ----
  private observe(): void {
    const sentinel = this.sentinel()?.nativeElement;
    if (!sentinel) {
      return;
    }
    const root = this.scrollRoot()?.nativeElement ?? null;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.loadMore();
        }
      },
      { root, rootMargin: '300px' },
    );
    io.observe(sentinel);
    this.destroyRef.onDestroy(() => io.disconnect());
  }

  /** If the sentinel is still visible after a load, fetch the next page. */
  private maybeLoadMore(): void {
    const sentinel = this.sentinel()?.nativeElement;
    const root = this.scrollRoot()?.nativeElement;
    if (!sentinel || !root || !this.hasMore()) {
      return;
    }
    const sRect = sentinel.getBoundingClientRect();
    const rRect = root.getBoundingClientRect();
    if (sRect.top <= rRect.bottom + 300) {
      queueMicrotask(() => this.loadMore());
    }
  }

  // ---- Filter handlers (all reload from the first page) ----
  /** Patch one filter field and reload. */
  private applyFilter(patch: Partial<ProfileFilter>): void {
    this.filter.update((f) => ({ ...f, ...patch }));
    this.load();
  }

  /** Free-text search — debounced so typing doesn't fire a request per key. */
  protected onSearch(value: string): void {
    this.filter.update((f) => ({ ...f, search: value }));
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }

  protected setTab(membershipType: TypeFilter): void {
    this.applyFilter({ membershipType });
  }
  protected toggleDept(): void {
    this.applyFilter({ firstDepartment: this.deptOnly() ? null : true });
  }
  protected setLeader(value: string): void {
    this.applyFilter({ leaderUuid: value === 'ALL' ? null : value });
  }
  protected setMinJoinedAt(value: string): void {
    this.applyFilter({ minJoinedAt: toYear(value) });
  }
  protected setMaxJoinedAt(value: string): void {
    this.applyFilter({ maxJoinedAt: toYear(value) });
  }

  /** Clear every filter back to its default. */
  protected resetFilters(): void {
    clearTimeout(this.searchTimer);
    this.filter.set({ ...EMPTY_PROFILE_FILTER });
    this.load();
  }

  // ---- Sorting (server-side, so it restarts the list) ----
  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
    this.load();
  }
  protected sortIndicator(key: SortKey): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDir() === 'asc' ? '↑' : '↓';
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
    this.loadLeaders();
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
        this.loadLeaders();
      },
      error: () => this.deleting.set(false),
    });
  }
}

/** Parse a year input to a number, or `null` when empty / not a year. */
function toYear(value: string): number | null {
  const year = Number(value.trim());
  return value.trim() !== '' && Number.isInteger(year) ? year : null;
}
