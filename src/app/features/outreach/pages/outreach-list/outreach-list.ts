import { Component, computed, ElementRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import {
  formatDateFr,
  formatDateTimeShortFr,
  formatTimeFr,
  monthYearLabel,
} from '../../../../shared/util/date.util';
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

/** Page size used while paging through a whole year server-side. */
const YEAR_PAGE_SIZE = 200;

/** `YYYY-MM` for today, local time — avoids `toISOString()`'s UTC shift. */
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** One calendar month's worth of outreach rows, in display order. */
interface MonthGroup {
  key: string;
  label: string;
  rows: Outreach[];
}

/**
 * Sorties — the outreach events, browsed one calendar year at a time (see
 * {@link year}) and rendered as one table per month that actually has
 * outreaches (empty months are skipped). All pages for the selected year are
 * fetched up front (`GET /api/outreaches?minDate&maxDate&page&size`, looping
 * until the last page) and grouped client-side by `date`'s `YYYY-MM` prefix.
 * Rows link to the detail page (`/sorties/:uuid`); only creation happens here,
 * via the modal.
 */
@Component({
  selector: 'app-outreach-list',
  imports: [OutreachForm],
  host: { class: 'data-list' },
  templateUrl: './outreach-list.html',
  styleUrl: './outreach-list.scss',
})
export class OutreachList {
  private readonly service = inject(OutreachService);
  private readonly router = inject(Router);
  private readonly hostRef: ElementRef<HTMLElement> = inject(ElementRef);

  // ---- Data ----
  protected readonly rows = signal<Outreach[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly totalElements = signal(0);

  // ---- Year ----
  private readonly currentYear = new Date().getFullYear();
  protected readonly year = signal(this.currentYear);
  protected readonly isCurrentYear = computed(() => this.year() === this.currentYear);
  /** `YYYY-MM` of today (local time) — drives the auto-scroll to the current
   *  month on load. */
  protected readonly currentMonthKey = currentMonthKey();

  protected readonly managers = signal<ManagerOption[]>([]);

  // ---- Filters ----
  protected readonly query = signal('');
  protected readonly tab = signal<Tab>('ALL');
  protected readonly sector = signal<SectorFilter>('ALL');
  protected readonly sectors = SECTORS;
  /** Selected responsible person's uuid, or `'ALL'`. */
  protected readonly managedBy = signal<string>('ALL');

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
  /** Compact `17/07/26 - 14:30` used in the mobile card, where date + start
   *  time share one line. */
  protected readonly fmtDateTimeShort = formatDateTimeShortFr;

  /** True when any filter is narrowing the list (drives the reset button). */
  protected readonly hasActiveFilters = computed(
    () =>
      this.query().trim() !== '' ||
      this.tab() !== 'ALL' ||
      this.sector() !== 'ALL' ||
      this.managedBy() !== 'ALL',
  );

  /** Number of drawer filters currently narrowing the list (search excluded — it
   *  stays visible on mobile). Drives the badge on the "Filtres" button. */
  protected readonly activeFilterCount = computed(
    () =>
      (this.tab() !== 'ALL' ? 1 : 0) +
      (this.sector() !== 'ALL' ? 1 : 0) +
      (this.managedBy() !== 'ALL' ? 1 : 0),
  );

  /** Month groups for the selected year in calendar order, January first (rows
   *  within each group are already server-sorted the same way, so scrolling down
   *  moves forward through the year), skipping empty months. */
  protected readonly groups = computed<MonthGroup[]>(() => {
    const byKey = new Map<string, MonthGroup>();
    for (const row of this.rows()) {
      const key = row.date ? row.date.slice(0, 7) : ''; // YYYY-MM, or '' when undated
      let group = byKey.get(key);
      if (!group) {
        group = { key, label: row.date ? monthYearLabel(row.date) : 'SANS DATE', rows: [] };
        byKey.set(key, group);
      }
      group.rows.push(row);
    }
    return [...byKey.values()];
  });

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
    this.service.managers().subscribe({
      next: (list) => this.managers.set(list),
      error: () => this.managers.set([]),
    });
  }

  protected statusLabel(status: OutreachStatus): string {
    return STATUS_LABELS[status];
  }
  protected statusTone(status: OutreachStatus): string {
    return STATUS_TONES[status];
  }

  // ---- Loading ----
  /** Assemble the current filter — the selected year bounds plus the usual
   *  narrowing filters — to send to the backend. */
  private currentFilter(): OutreachFilter {
    const y = this.year();
    return {
      search: this.query(),
      status: this.tab(),
      sector: this.sector(),
      managedByUuid: this.managedBy(),
      minDate: `${y}-01-01`,
      maxDate: `${y}-12-31`,
    };
  }

  /** (Re)load the whole selected year — used on load and on any filter/year
   *  change. Pages through the backend until the last page, since the table
   *  needs every row of the year at once to group it by month. */
  protected load(): void {
    this.rows.set([]);
    this.loadError.set(null);
    this.loading.set(true);
    this.fetchAll(0, []);
  }

  private fetchAll(page: number, acc: Outreach[]): void {
    this.service.list(page, YEAR_PAGE_SIZE, this.currentFilter(), 'date,asc').subscribe({
      next: (result) => {
        const combined = [...acc, ...result.items];
        if (!result.last && result.items.length > 0) {
          this.fetchAll(page + 1, combined);
          return;
        }
        this.rows.set(combined);
        this.totalElements.set(combined.length);
        this.loading.set(false);
        if (this.isCurrentYear()) {
          // Wait for the month tables to actually render before scrolling.
          setTimeout(() => this.scrollToCurrentMonth(), 0);
        }
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des sorties impossible.'));
        this.loading.set(false);
      },
    });
  }

  /** Land the viewport on the current month's table, when it's present in the
   *  currently loaded (current) year. */
  private scrollToCurrentMonth(): void {
    const target = this.hostRef.nativeElement.querySelector<HTMLElement>(
      '[data-month-anchor]',
    );
    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  // ---- Year navigation ----
  protected prevYear(): void {
    this.year.update((y) => y - 1);
    this.load();
  }
  protected nextYear(): void {
    this.year.update((y) => y + 1);
    this.load();
  }
  protected goToCurrentYear(): void {
    if (this.isCurrentYear()) {
      return;
    }
    this.year.set(this.currentYear);
    this.load();
  }

  // ---- Filter handlers (each reloads the year from scratch) ----
  /** Free-text search — debounced so typing doesn't fire a request per key. */
  protected onSearch(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
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
  protected resetFilters(): void {
    clearTimeout(this.searchTimer);
    this.query.set('');
    this.tab.set('ALL');
    this.sector.set('ALL');
    this.managedBy.set('ALL');
    this.load();
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
