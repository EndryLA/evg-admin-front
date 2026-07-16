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
import { exportRowsToXlsx, type XlsxColumn } from '../../../../shared/util/xlsx.util';
import { ContactService } from '../../contact.service';
import {
  CIVIL_STATE_LABELS,
  CIVIL_STATE_OPTIONS,
  CONTACT_TYPE_LABELS,
  CONTACT_TYPE_TONES,
  EMPTY_CONTACT_FILTER,
  SECTORS,
  type CivilState,
  type Contact,
  type ContactFilter,
  type ContactType,
  type SectorFilter,
} from '../../contact.models';

/** The type-tab selection: all types, or one {@link ContactType}. */
type TypeFilter = ContactFilter['type'];

const PAGE_SIZE = 20;
/** Debounce before the free-text search triggers a server reload. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Contacts — the people met during outreaches. Paged server-side and loaded 20
 * at a time via infinite scroll (`GET /api/contact-entries?page&size` + filter):
 * an IntersectionObserver on a bottom sentinel pulls the next page as it comes
 * into view. All filters are applied server-side, so any change reloads from the
 * first page. Rows can be selected and exported to Excel; each row links to its
 * detail page.
 */
@Component({
  selector: 'app-contact-list',
  host: { class: 'data-list' },
  templateUrl: './contact-list.html',
  styleUrl: './contact-list.scss',
})
export class ContactList implements OnDestroy {
  private readonly service = inject(ContactService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scrollRoot = viewChild<ElementRef<HTMLElement>>('scrollRoot');
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  // ---- Data ----
  protected readonly rows = signal<Contact[]>([]);
  protected readonly loading = signal(true); // initial page
  protected readonly loadingMore = signal(false); // subsequent pages
  protected readonly loadError = signal<string | null>(null);
  protected readonly hasMore = signal(true);
  protected readonly totalElements = signal(0);
  private nextPage = 0;

  // ---- Filters ----
  /** The full server-side filter applied to the list. */
  protected readonly filter = signal<ContactFilter>({ ...EMPTY_CONTACT_FILTER });
  protected readonly sectors = SECTORS;
  protected readonly civilStateOptions = CIVIL_STATE_OPTIONS;

  /** True when any filter is narrowing the list (drives the reset button). */
  protected readonly hasActiveFilters = computed(() => {
    const f = this.filter();
    return (
      f.search.trim() !== '' ||
      f.type !== 'ALL' ||
      f.civilState !== 'ALL' ||
      f.sector !== 'ALL' ||
      f.evangelizedBy.trim() !== '' ||
      f.minDate !== '' ||
      f.maxDate !== ''
    );
  });

  // ---- Filter drawer (mobile) ----
  protected readonly filterDrawerOpen = signal(false);
  /** Active drawer filters (search excluded — it stays visible). Drives the badge. */
  protected readonly activeFilterCount = computed(() => {
    const f = this.filter();
    return (
      (f.type !== 'ALL' ? 1 : 0) +
      (f.civilState !== 'ALL' ? 1 : 0) +
      (f.sector !== 'ALL' ? 1 : 0) +
      (f.evangelizedBy.trim() !== '' ? 1 : 0) +
      (f.minDate !== '' ? 1 : 0) +
      (f.maxDate !== '' ? 1 : 0)
    );
  });
  protected openFilters(): void {
    this.filterDrawerOpen.set(true);
  }
  protected closeFilters(): void {
    this.filterDrawerOpen.set(false);
  }

  // ---- Selection ----
  /** UUIDs of the currently selected rows. */
  private readonly selectedUuids = signal<ReadonlySet<string>>(new Set());
  /** True while the export file is being generated (ExcelJS loads lazily). */
  protected readonly exporting = signal(false);

  protected readonly selectedCount = computed(() => this.selectedUuids().size);
  protected readonly allSelected = computed(() => {
    const rows = this.rows();
    const sel = this.selectedUuids();
    return rows.length > 0 && rows.every((c) => sel.has(c.uuid));
  });
  protected readonly someSelected = computed(
    () => this.selectedCount() > 0 && !this.allSelected(),
  );

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
    afterNextRender(() => this.observe());
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  protected typeLabel(type: ContactType): string {
    return CONTACT_TYPE_LABELS[type];
  }
  protected typeTone(type: ContactType): string {
    return CONTACT_TYPE_TONES[type];
  }
  protected civilStateLabel(contact: Contact): string {
    return CIVIL_STATE_LABELS[contact.civilState];
  }
  protected contactName(contact: Contact): string {
    return `${contact.firstname} ${contact.lastname}`.trim() || '—';
  }

  // ---- Loading ----
  /** (Re)start from the first page — used on load and whenever a filter changes. */
  protected load(): void {
    this.rows.set([]);
    this.selectedUuids.set(new Set());
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
    this.service.list(this.nextPage, PAGE_SIZE, this.filter()).subscribe({
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
        this.loadError.set(messageFromError(err, 'Chargement des contacts impossible.'));
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

  // ---- Filter handlers ----
  /** Patch one filter field and reload from the first page. */
  private applyFilter(patch: Partial<ContactFilter>): void {
    this.filter.update((f) => ({ ...f, ...patch }));
    this.load();
  }

  /** Free-text search — debounced so typing doesn't fire a request per key. */
  protected setSearch(value: string): void {
    this.filter.update((f) => ({ ...f, search: value }));
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }

  protected setType(type: TypeFilter): void {
    this.applyFilter({ type });
  }
  protected setCivilState(value: string): void {
    this.applyFilter({ civilState: value === 'ALL' ? 'ALL' : (value as CivilState) });
  }
  protected setSector(value: string): void {
    const sector: SectorFilter =
      value === 'ALL' || value === 'UNASSIGNED' ? value : Number(value);
    this.applyFilter({ sector });
  }
  protected setEvangelizedBy(value: string): void {
    this.applyFilter({ evangelizedBy: value });
  }
  protected setMinDate(value: string): void {
    this.applyFilter({ minDate: value });
  }
  protected setMaxDate(value: string): void {
    this.applyFilter({ maxDate: value });
  }

  /** Clear every filter back to its default. */
  protected resetFilters(): void {
    clearTimeout(this.searchTimer);
    this.filter.set({ ...EMPTY_CONTACT_FILTER });
    this.load();
  }

  // ---- Selection ----
  protected isSelected(uuid: string): boolean {
    return this.selectedUuids().has(uuid);
  }
  protected toggleRow(uuid: string): void {
    this.selectedUuids.update((prev) => {
      const next = new Set(prev);
      if (!next.delete(uuid)) {
        next.add(uuid);
      }
      return next;
    });
  }
  protected toggleAll(): void {
    this.selectedUuids.update((prev) => {
      const rows = this.rows();
      const allOn = rows.length > 0 && rows.every((c) => prev.has(c.uuid));
      return allOn ? new Set() : new Set(rows.map((c) => c.uuid));
    });
  }

  /** Export the selected rows to a styled `.xlsx` file. */
  protected async exportSelected(): Promise<void> {
    const chosen = this.selectedUuids();
    const selected = this.rows().filter((c) => chosen.has(c.uuid));
    if (selected.length === 0 || this.exporting()) {
      return;
    }
    const columns: XlsxColumn<Contact>[] = [
      { header: 'Nom', value: (c) => c.lastname || '' },
      { header: 'Prénom', value: (c) => c.firstname || '' },
      { header: 'Type', value: (c) => this.typeLabel(c.type) },
      { header: 'État civil', value: (c) => this.civilStateLabel(c) },
      { header: 'Ville', value: (c) => c.cityName || '' },
      { header: 'Secteur', value: (c) => c.city?.sector ?? '' },
      { header: 'Évangélisé par', value: (c) => c.evangelizedBy || '' },
      { header: 'Téléphone', value: (c) => c.phoneNumber || '' },
      { header: 'Observations', value: (c) => c.observations || '', width: 70 },
    ];
    this.exporting.set(true);
    try {
      await exportRowsToXlsx(selected, columns, 'Contacts', {
        sheetName: 'Contacts',
        numbered: true,
      });
    } finally {
      this.exporting.set(false);
    }
  }

  protected view(contact: Contact): void {
    this.router.navigate(['/contacts', contact.uuid]);
  }
}
