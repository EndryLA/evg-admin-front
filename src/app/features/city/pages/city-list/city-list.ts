import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { messageFromError } from '../../../../core/http/http-error.util';
import { CitySearch } from '../../components/city-search/city-search';
import { CitySectorForm } from '../../components/city-sector-form/city-sector-form';
import { CityService } from '../../city.service';
import type { City } from '../../city.models';

/** Assignment filter: all cities, only assigned, or only unassigned. */
type Assignment = 'ALL' | 'ASSIGNED' | 'UNASSIGNED';
type SortKey = 'name' | 'postal' | 'department' | 'sector';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

/** Strip accents & lowercase for accent-insensitive search. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Annuaire des villes — browse every commune, filtered by assignment state
 * (toutes / affectées / non affectées) and by sector. Rows load 20 at a time
 * via infinite scroll (`GET /api/cities?page&size`); an IntersectionObserver on
 * a bottom sentinel pulls the next page as it comes into view. Search / filter /
 * sort run in memory over the rows loaded so far — when a filter's matches are
 * sparse the sentinel stays visible and keeps pulling until they appear or the
 * list is exhausted. Row click opens the sector-assignment modal.
 */
@Component({
  selector: 'app-city-list',
  imports: [CitySearch, CitySectorForm],
  host: { class: 'data-list' },
  templateUrl: './city-list.html',
  styleUrl: './city-list.scss',
})
export class CityList {
  private readonly service = inject(CityService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scrollRoot = viewChild<ElementRef<HTMLElement>>('scrollRoot');
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  // ---- Data ----
  protected readonly cities = signal<City[]>([]);
  protected readonly loading = signal(true); // initial page
  protected readonly loadingMore = signal(false); // subsequent pages
  protected readonly loadError = signal<string | null>(null);
  protected readonly hasMore = signal(true);
  protected readonly totalElements = signal(0);
  private nextPage = 0;

  // ---- Filters / view state ----
  protected readonly query = signal('');
  protected readonly assignment = signal<Assignment>('ALL');
  /** Selected sector filter, or `null` for "all sectors". */
  protected readonly sector = signal<number | null>(null);
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortDir = signal<SortDir>('asc');

  // ---- Overlays ----
  /** Mobile-only: the bottom filter drawer. */
  protected readonly filterDrawerOpen = signal(false);
  /** Active drawer filters (search excluded — it stays visible). Drives the badge. */
  protected readonly activeFilterCount = computed(
    () => (this.assignment() !== 'ALL' ? 1 : 0) + (this.sector() !== null ? 1 : 0),
  );
  protected openFilters(): void {
    this.filterDrawerOpen.set(true);
  }
  protected closeFilters(): void {
    this.filterDrawerOpen.set(false);
  }

  protected readonly assignTarget = signal<City | null>(null);
  protected readonly assigning = signal(false);
  protected readonly searchOpen = signal(false);

  constructor() {
    this.load();
    afterNextRender(() => this.observe());
  }

  protected departmentLabel(city: City): string {
    const code = city.departmentCode ? `(${city.departmentCode})` : '';
    return [city.departmentName, code].filter(Boolean).join(' ') || '—';
  }

  /** Badge tones assigned per sector, cycled. Grey/red are reserved elsewhere. */
  private static readonly SECTOR_TONES = ['blue', 'green', 'violet', 'amber'] as const;

  /** Deterministic badge tone for a sector — unassigned falls back to grey. */
  protected sectorTone(sector: number | null): string {
    if (sector == null) {
      return 'grey';
    }
    const tones = CityList.SECTOR_TONES;
    return tones[((sector % tones.length) + tones.length) % tones.length];
  }

  // ---- Filter option data (derived from loaded rows) ----
  /** Distinct sector numbers present in the loaded data, ascending. */
  protected readonly sectorOptions = computed<number[]>(() => {
    const set = new Set<number>();
    for (const c of this.cities()) {
      if (c.sector != null) {
        set.add(c.sector);
      }
    }
    return [...set].sort((a, b) => a - b);
  });

  // ---- Derived collections ----
  protected readonly filtered = computed<City[]>(() => {
    const q = normalize(this.query().trim());
    const assignment = this.assignment();
    const sector = this.sector();
    return this.cities().filter((c) => {
      if (assignment === 'ASSIGNED' && c.sector == null) {
        return false;
      }
      if (assignment === 'UNASSIGNED' && c.sector != null) {
        return false;
      }
      if (sector != null && c.sector !== sector) {
        return false;
      }
      if (q) {
        const haystack = normalize(
          `${c.officialName} ${c.postalCode} ${c.departmentName} ${c.departmentCode}`,
        );
        if (!haystack.includes(q)) {
          return false;
        }
      }
      return true;
    });
  });

  protected readonly rows = computed<City[]>(() => {
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.filtered()].sort((a, b) => this.compare(a, b, key) * dir);
  });

  protected readonly resultCount = computed(() => this.filtered().length);

  // ---- Loading ----
  /** (Re)start from the first page. */
  protected load(): void {
    this.cities.set([]);
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
    this.service.list(this.nextPage, PAGE_SIZE).subscribe({
      next: (page) => {
        this.cities.update((list) => (initial ? page.items : [...list, ...page.items]));
        this.totalElements.set(page.totalElements);
        this.hasMore.set(!page.last && page.items.length > 0);
        this.nextPage += 1;
        this.loading.set(false);
        this.loadingMore.set(false);
        // A short page may not fill the viewport — keep pulling until the
        // sentinel scrolls out of view or the list is exhausted.
        this.maybeLoadMore();
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des villes impossible.'));
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
      // Defer to avoid re-entrant loads within the same tick.
      queueMicrotask(() => this.loadMore());
    }
  }

  // ---- Filter / sort handlers ----
  protected onSearch(value: string): void {
    this.query.set(value);
    this.maybeLoadMore();
  }
  protected setAssignment(value: Assignment): void {
    this.assignment.set(value);
    this.maybeLoadMore();
  }
  protected onSectorChange(value: string): void {
    this.sector.set(value === '' ? null : Number(value));
    this.maybeLoadMore();
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

  // ---- Référentiel lookup ----
  protected openSearch(): void {
    this.searchOpen.set(true);
  }
  protected closeSearch(): void {
    this.searchOpen.set(false);
  }
  /** A commune was registered from the référentiel — reload from the top. */
  protected onRegistered(): void {
    this.load();
  }

  // ---- Sector assignment ----
  protected openAssign(city: City): void {
    this.assignTarget.set(city);
  }
  protected cancelAssign(): void {
    this.assignTarget.set(null);
  }
  protected onAssign(sector: number): void {
    const target = this.assignTarget();
    if (!target) {
      return;
    }
    this.assigning.set(true);
    this.service.assignSector(target.uuid, sector).subscribe({
      next: (updated) => {
        this.assigning.set(false);
        this.assignTarget.set(null);
        // Reflect the new sector in place without a full reload.
        this.cities.update((list) =>
          list.map((c) => (c.uuid === target.uuid ? { ...c, sector: updated.sector } : c)),
        );
      },
      error: () => this.assigning.set(false),
    });
  }

  private compare(a: City, b: City, key: SortKey): number {
    switch (key) {
      case 'name':
        return a.officialName.localeCompare(b.officialName, 'fr');
      case 'postal':
        return a.postalCode.localeCompare(b.postalCode, 'fr');
      case 'department':
        return this.departmentLabel(a).localeCompare(this.departmentLabel(b), 'fr');
      case 'sector':
        // Unassigned (null) sort after any numbered sector.
        return (a.sector ?? Number.POSITIVE_INFINITY) - (b.sector ?? Number.POSITIVE_INFINITY);
    }
  }
}
