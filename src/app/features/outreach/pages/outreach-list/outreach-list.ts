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
import { Router } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr, formatTimeFr } from '../../../../shared/util/date.util';
import { OutreachForm } from '../../components/outreach-form/outreach-form';
import { OutreachService } from '../../outreach.service';
import {
  SECTORS,
  STATUS_LABELS,
  STATUS_TONES,
  type ManagerOption,
  type Outreach,
  type OutreachFilter,
  type OutreachInput,
  type OutreachStatus,
  type SectorFilter,
} from '../../outreach.models';

type Tab = 'ALL' | OutreachStatus;
type SortKey = 'name' | 'start' | 'status';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;
/** Debounce before the free-text search triggers a server reload. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Sorties — the outreach events table. Paged server-side and loaded 20 at a time
 * via infinite scroll (`GET /api/outreaches?page&size&sort` + filter): an
 * IntersectionObserver on a bottom sentinel pulls the next page as it scrolls
 * into view. Filtering and sorting are applied server-side, so any change
 * reloads from the first page. Rows link to the detail page (`/sorties/:uuid`);
 * only creation happens here, via the modal.
 */
@Component({
  selector: 'app-outreach-list',
  imports: [OutreachForm],
  host: { class: 'data-list' },
  templateUrl: './outreach-list.html',
  styleUrl: './outreach-list.scss',
})
export class OutreachList implements OnDestroy {
  private readonly service = inject(OutreachService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scrollRoot = viewChild<ElementRef<HTMLElement>>('scrollRoot');
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  // ---- Data ----
  protected readonly rows = signal<Outreach[]>([]);
  protected readonly loading = signal(true); // initial page
  protected readonly loadingMore = signal(false); // subsequent pages
  protected readonly loadError = signal<string | null>(null);
  protected readonly hasMore = signal(true);
  protected readonly totalElements = signal(0);
  private nextPage = 0;

  protected readonly managers = signal<ManagerOption[]>([]);

  // ---- Filters / sort ----
  protected readonly query = signal('');
  protected readonly tab = signal<Tab>('ALL');
  protected readonly sector = signal<SectorFilter>('ALL');
  protected readonly sectors = SECTORS;
  /** Selected responsible person's uuid, or `'ALL'`. */
  protected readonly managedBy = signal<string>('ALL');
  /** Outreach date bounds, `YYYY-MM-DD`, or '' for none. */
  protected readonly minDate = signal('');
  protected readonly maxDate = signal('');
  protected readonly sortKey = signal<SortKey>('start');
  protected readonly sortDir = signal<SortDir>('desc');

  // ---- Overlays ----
  /** Mobile-only: the bottom filter drawer. */
  protected readonly filterDrawerOpen = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  /** The row whose actions menu is open, if any (rendered once, fixed-positioned). */
  protected readonly menuOutreach = signal<Outreach | null>(null);
  protected readonly menuPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  protected readonly fmtDate = formatDateFr;
  protected readonly fmtTime = formatTimeFr;

  /** True when any filter is narrowing the list (drives the reset button). */
  protected readonly hasActiveFilters = computed(
    () =>
      this.query().trim() !== '' ||
      this.tab() !== 'ALL' ||
      this.sector() !== 'ALL' ||
      this.managedBy() !== 'ALL' ||
      this.minDate() !== '' ||
      this.maxDate() !== '',
  );

  /** Number of drawer filters currently narrowing the list (search excluded — it
   *  stays visible on mobile). Drives the badge on the "Filtres" button. */
  protected readonly activeFilterCount = computed(
    () =>
      (this.tab() !== 'ALL' ? 1 : 0) +
      (this.sector() !== 'ALL' ? 1 : 0) +
      (this.managedBy() !== 'ALL' ? 1 : 0) +
      (this.minDate() !== '' ? 1 : 0) +
      (this.maxDate() !== '' ? 1 : 0),
  );

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
    this.service.managers().subscribe({
      next: (list) => this.managers.set(list),
      error: () => this.managers.set([]),
    });
    afterNextRender(() => this.observe());
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  protected statusLabel(status: OutreachStatus): string {
    return STATUS_LABELS[status];
  }
  protected statusTone(status: OutreachStatus): string {
    return STATUS_TONES[status];
  }

  // ---- Loading ----
  /** Assemble the current filter to send to the backend. */
  private currentFilter(): OutreachFilter {
    return {
      search: this.query(),
      status: this.tab(),
      sector: this.sector(),
      managedByUuid: this.managedBy(),
      minDate: this.minDate(),
      maxDate: this.maxDate(),
    };
  }
  /** Backend `sort` param, e.g. `startTime,desc`. */
  private currentSort(): string {
    const field = this.sortKey() === 'start' ? 'startTime' : this.sortKey();
    return `${field},${this.sortDir()}`;
  }

  /** (Re)start from the first page — used on load and on any filter/sort change. */
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
    this.service.list(this.nextPage, PAGE_SIZE, this.currentFilter(), this.currentSort()).subscribe({
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
        this.loadError.set(messageFromError(err, 'Chargement des sorties impossible.'));
        this.loading.set(false);
        this.loadingMore.set(false);
      },
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

  // ---- Filter / sort handlers (each reloads from the first page) ----
  /** Free-text search — debounced so typing doesn't fire a request per key. */
  protected onSearch(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }
  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.load();
  }
  protected setSector(value: string): void {
    this.sector.set(value === 'ALL' || value === 'UNASSIGNED' ? value : Number(value));
    this.load();
  }
  protected setManagedBy(value: string): void {
    this.managedBy.set(value);
    this.load();
  }
  protected setMinDate(value: string): void {
    this.minDate.set(value);
    this.load();
  }
  protected setMaxDate(value: string): void {
    this.maxDate.set(value);
    this.load();
  }
  protected resetFilters(): void {
    clearTimeout(this.searchTimer);
    this.query.set('');
    this.tab.set('ALL');
    this.sector.set('ALL');
    this.managedBy.set('ALL');
    this.minDate.set('');
    this.maxDate.set('');
    this.load();
  }

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

  // ---- Row actions ----
  /** Primary row action: open the management page. */
  protected openManage(outreach: Outreach): void {
    this.router.navigate(['/sorties', outreach.uuid, 'gestion']);
  }

  protected toggleMenu(outreach: Outreach, event: Event): void {
    event.stopPropagation();
    if (this.menuOutreach()?.uuid === outreach.uuid) {
      this.closeMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuPos.set({ top: rect.bottom + 6, left: rect.right });
    this.menuOutreach.set(outreach);
  }
  protected closeMenu(): void {
    this.menuOutreach.set(null);
  }

  /** Kebab-menu action: open the read-only details page. */
  protected openDetails(outreach: Outreach): void {
    this.closeMenu();
    this.router.navigate(['/sorties', outreach.uuid]);
  }

  protected openFilters(): void {
    this.filterDrawerOpen.set(true);
  }
  protected closeFilters(): void {
    this.filterDrawerOpen.set(false);
  }

  protected openCreate(): void {
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
  }
  protected onSave(input: OutreachInput): void {
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
}
