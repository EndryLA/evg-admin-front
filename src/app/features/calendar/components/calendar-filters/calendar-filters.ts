import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import {
  CALENDAR_STATUS_LABELS,
  EVENT_TYPE_OPTIONS,
  type CalendarEventType,
  type CalendarStatus,
  type ManagerOption,
} from '../../calendar.models';

/** Everything the filter bar narrows the feed by. The date window isn't here —
 *  it comes from whichever view is on screen, which this bar knows nothing of. */
export interface CalendarFilterState {
  query: string;
  /** Types to keep; empty means every type. */
  types: CalendarEventType[];
  status: CalendarStatus | 'ALL';
  /** Responsible profile's uuid, or `'ALL'`. */
  managedByUuid: string;
}

/** A bar with nothing selected — the state the page starts from. */
export function emptyFilterState(): CalendarFilterState {
  return { query: '', types: [], status: 'ALL', managedByUuid: 'ALL' };
}

/** Debounce before the free-text search reports a change. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The agenda's filter bar: search, type chips, status and responsable, plus the
 * "nouvel événement" action that shares its row. Inline on desktop; on a phone
 * the controls collapse into a bottom drawer behind a "Filtres" button.
 *
 * It owns the selection (and the search debounce) and reports it whole through
 * {@link change} — the page holds the result and refetches, so the bar never
 * needs to know what a window or a request is.
 */
@Component({
  selector: 'app-calendar-filters',
  templateUrl: './calendar-filters.html',
  styleUrl: './calendar-filters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarFilters implements OnDestroy {
  /** Members selectable as an entry's responsible person. */
  readonly managers = input.required<ManagerOption[]>();
  /** Entries currently on screen — the drawer's "voir les résultats" count. */
  readonly resultCount = input(0);

  readonly change = output<CalendarFilterState>();
  readonly create = output<void>();

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly query = signal('');
  protected readonly types = signal<CalendarEventType[]>([]);
  protected readonly status = signal<CalendarStatus | 'ALL'>('ALL');
  protected readonly managedBy = signal<string>('ALL');

  protected readonly typeOptions = EVENT_TYPE_OPTIONS;
  protected readonly statusOptions = Object.entries(CALENDAR_STATUS_LABELS).map(
    ([value, label]) => ({ value: value as CalendarStatus, label }),
  );

  /** Mobile-only: the bottom filter drawer. */
  protected readonly drawerOpen = signal(false);

  protected readonly hasActiveFilters = computed(
    () =>
      this.query().trim() !== '' ||
      this.types().length > 0 ||
      this.status() !== 'ALL' ||
      this.managedBy() !== 'ALL',
  );

  /** Drawer filters currently narrowing the feed (search excluded — it stays
   *  visible on mobile). Drives the badge on the "Filtres" button. */
  protected readonly activeFilterCount = computed(
    () =>
      this.types().length +
      (this.status() !== 'ALL' ? 1 : 0) +
      (this.managedBy() !== 'ALL' ? 1 : 0),
  );

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.emit(), SEARCH_DEBOUNCE_MS);
  }
  protected toggleType(type: CalendarEventType): void {
    this.types.update((list) =>
      list.includes(type) ? list.filter((t) => t !== type) : [...list, type],
    );
    this.emit();
  }
  protected isTypeActive(type: CalendarEventType): boolean {
    return this.types().includes(type);
  }
  protected setStatus(value: string): void {
    this.status.set(value as CalendarStatus | 'ALL');
    this.emit();
  }
  protected setManagedBy(value: string): void {
    this.managedBy.set(value);
    this.emit();
  }
  protected reset(): void {
    clearTimeout(this.searchTimer);
    this.query.set('');
    this.types.set([]);
    this.status.set('ALL');
    this.managedBy.set('ALL');
    const input = this.searchInput()?.nativeElement;
    if (input) {
      input.value = '';
    }
    this.emit();
  }
  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }
  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  private emit(): void {
    this.change.emit({
      query: this.query(),
      types: this.types(),
      status: this.status(),
      managedByUuid: this.managedBy(),
    });
  }
}
