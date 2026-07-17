import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { formatTimeFr } from '../../../../shared/util/date.util';
import type { CalendarEventType, CalendarItem } from '../../calendar.models';

/** Monday-first weekday initials — the app runs `firstDay: 1` everywhere. */
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

/** Fallback settle delay for browsers without `scrollend`; kept long enough to
 *  clear momentum so the month never commits mid-glide. Cleared by `scrollend`
 *  where it fires (Chrome/Safari), so it only bites on older engines. */
const SETTLE_MS = 180;

/** A single square in the month grid. */
interface DayCell {
  /** `YYYY-MM-DD`, read in local time so the day never slips. */
  iso: string;
  day: number;
  /** False for the days that spill in from the neighbouring month. */
  inMonth: boolean;
  isToday: boolean;
  /** Up to three distinct event types on the day, for the coloured dots. */
  dots: CalendarEventType[];
}

/** One swipeable month page in the pager. */
interface MonthPage {
  key: string;
  weeks: DayCell[][];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A `Date` → `YYYY-MM-DD`, in local time. */
function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` → a local `Date` at midnight (no UTC off-by-one). */
function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** French labels come through lowercase ("juillet") — lift the first letter. */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The phone agenda — a native-feeling month calendar in the shape of Apple's:
 * a month grid that scrolls vertically month to month and snaps ("locks") to
 * one month per gesture, over a scrollable list of the selected day's events.
 *
 * The scroll is a real CSS scroll-snap pager of three pages (previous / current
 * / next) stacked vertically; once a swipe settles on a neighbour we shift the
 * month and re-centre on the middle page, so it scrolls endlessly up or down.
 *
 * Purely presentational and self-contained: the parent owns the data and the
 * detail/create overlays. This view drives the visible window instead of
 * FullCalendar — every month change emits {@link rangeChange} so the page can
 * refetch — and reports taps back through {@link selectItem} / {@link createOn}.
 */
@Component({
  selector: 'app-calendar-mobile',
  templateUrl: './calendar-mobile.html',
  styleUrl: './calendar-mobile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarMobile implements OnInit, OnDestroy {
  /** The feed for the visible window, already filtered by the page. */
  readonly items = input.required<CalendarItem[]>();
  readonly loading = input(false);

  /** The window to fetch, `YYYY-MM-DD` inclusive — the three swipeable months. */
  readonly rangeChange = output<{ from: string; to: string }>();
  /** A tapped entry — the page opens its detail. */
  readonly selectItem = output<CalendarItem>();
  /** The "+" for a day — the page opens a creation prefilled with the date. */
  readonly createOn = output<string>();

  protected readonly weekdays = WEEKDAYS;

  private readonly pager = viewChild<ElementRef<HTMLElement>>('pager');

  private readonly todayIso = toIso(new Date());

  /** First day of the centre (committed) month. */
  private readonly cursor = signal(startOfMonth(new Date()));

  /** Which page is in view relative to {@link cursor} while a swipe is in
   *  flight: -1 previous, 0 centre, +1 next. Lets the header track the grid
   *  live during the drag instead of only snapping at settle. */
  private readonly viewOffset = signal(0);

  /** The month actually on screen right now (centre month plus any drag). */
  private readonly displayedMonth = computed(() => {
    const c = this.cursor();
    return new Date(c.getFullYear(), c.getMonth() + this.viewOffset(), 1);
  });

  /** The highlighted day whose events fill the agenda below. */
  protected readonly selected = signal(this.todayIso);

  private readonly monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  private readonly dayFmt = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  /** e.g. `Juillet 2026` — follows the grid as it's dragged. */
  protected readonly title = computed(() => capitalize(this.monthFmt.format(this.displayedMonth())));

  /** e.g. `Mardi 15 juillet`. */
  protected readonly selectedLabel = computed(() =>
    capitalize(this.dayFmt.format(fromIso(this.selected()))),
  );

  /** The feed bucketed by day, so a cell reads its events in one lookup. */
  private readonly byDate = computed(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of this.items()) {
      if (!item.date) {
        continue;
      }
      const bucket = map.get(item.date);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(item.date, [item]);
      }
    }
    return map;
  });

  /** The three swipeable month grids: previous, current, next. */
  protected readonly pages = computed<MonthPage[]>(() => {
    const cursor = this.cursor();
    return [-1, 0, 1].map((offset) => {
      const base = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
      return { key: `${base.getFullYear()}-${base.getMonth()}`, weeks: this.buildWeeks(base) };
    });
  });

  /** The selected day's entries, all-day first then by start time. */
  protected readonly dayEvents = computed(() =>
    (this.byDate().get(this.selected()) ?? []).slice().sort((a, b) => {
      const at = a.startTime ?? '';
      const bt = b.startTime ?? '';
      if (at === bt) {
        return 0;
      }
      if (!at) {
        return -1;
      }
      if (!bt) {
        return 1;
      }
      return at.localeCompare(bt);
    }),
  );

  private settleTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Whenever the month commits (and once the pager first renders), lock the
    // scroller back onto the middle page — the neighbour just swiped to now
    // holds the same month, so the reset is invisible.
    effect(() => {
      this.cursor();
      const el = this.pager()?.nativeElement;
      if (!el || typeof requestAnimationFrame !== 'function') {
        return;
      }
      requestAnimationFrame(() => {
        if (el.clientHeight) {
          el.scrollTop = el.clientHeight;
        }
      });
    });
  }

  ngOnInit(): void {
    // The first fetch is ours to trigger — the page has no window until now.
    this.emitRange();
  }

  ngOnDestroy(): void {
    clearTimeout(this.settleTimer);
  }

  /** Arrows animate the pager; the settle handler then commits the month. */
  protected prevMonth(): void {
    this.page(-1);
  }
  protected nextMonth(): void {
    this.page(1);
  }

  protected goToday(): void {
    const t = new Date();
    this.cursor.set(new Date(t.getFullYear(), t.getMonth(), 1));
    this.viewOffset.set(0);
    this.selected.set(this.todayIso);
    this.emitRange();
  }

  /** Tap a day: select it, and follow a spill day into its own month. */
  protected selectDay(cell: DayCell): void {
    this.selected.set(cell.iso);
    if (!cell.inMonth) {
      this.cursor.set(startOfMonth(fromIso(cell.iso)));
      this.emitRange();
    }
  }

  /** On every scroll frame, track the month in view so the header follows the
   *  grid. The commit itself waits for `scrollend` (below); this only arms a
   *  fallback for engines that don't fire it. */
  protected onPagerScroll(): void {
    const el = this.pager()?.nativeElement;
    if (el && el.clientHeight) {
      this.viewOffset.set(Math.round(el.scrollTop / el.clientHeight) - 1);
    }
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.settle(), SETTLE_MS);
  }

  /** Momentum and snap have both finished — safe to commit the month now. */
  protected onPagerSettle(): void {
    clearTimeout(this.settleTimer);
    this.settle();
  }

  protected typeClass(type: CalendarEventType): string {
    return `ev--${type.toLowerCase()}`;
  }

  protected time(value: string | null): string {
    return formatTimeFr(value);
  }

  /** Which page the scroller landed on; commit a month if it's a neighbour. */
  private settle(): void {
    const el = this.pager()?.nativeElement;
    if (!el || !el.clientHeight) {
      return;
    }
    const index = Math.round(el.scrollTop / el.clientHeight);
    if (index === 1) {
      this.viewOffset.set(0);
      return;
    }
    this.shiftMonth(index - 1);
  }

  /** Scroll one page over; falls back to a direct shift before first layout. */
  private page(delta: number): void {
    const el = this.pager()?.nativeElement;
    if (el && el.clientHeight) {
      el.scrollTo({ top: el.clientHeight * (1 + delta), behavior: 'smooth' });
    } else {
      this.shiftMonth(delta);
    }
  }

  private shiftMonth(delta: number): void {
    this.cursor.update((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
    this.viewOffset.set(0);
    this.syncSelection();
    this.emitRange();
  }

  /** Keep the agenda relevant after a month change: today when we land on this
   *  month, otherwise carry the same day-of-month so the highlight moves with
   *  the swipe rather than jumping to the 1st. */
  private syncSelection(): void {
    const cursor = this.cursor();
    const t = new Date();
    if (cursor.getFullYear() === t.getFullYear() && cursor.getMonth() === t.getMonth()) {
      this.selected.set(this.todayIso);
      return;
    }
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const day = Math.min(fromIso(this.selected()).getDate(), daysInMonth);
    this.selected.set(toIso(new Date(cursor.getFullYear(), cursor.getMonth(), day)));
  }

  /** Build one month's six-week grid, Monday-first, with per-day event dots. */
  private buildWeeks(base: Date): DayCell[][] {
    const month = base.getMonth();
    const byDate = this.byDate();
    const start = gridStart(base);

    const weeks: DayCell[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
        const iso = toIso(date);
        const dots: CalendarEventType[] = [];
        for (const item of byDate.get(iso) ?? []) {
          if (!dots.includes(item.type) && dots.length < 3) {
            dots.push(item.type);
          }
        }
        row.push({
          iso,
          day: date.getDate(),
          inMonth: date.getMonth() === month,
          isToday: iso === this.todayIso,
          dots,
        });
      }
      weeks.push(row);
    }
    return weeks;
  }

  /** Cover all three pages so neighbouring months carry their dots pre-swipe. */
  private emitRange(): void {
    const cursor = this.cursor();
    const start = gridStart(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    const nextStart = gridStart(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    const end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() + 41);
    this.rangeChange.emit({ from: toIso(start), to: toIso(end) });
  }
}

/** The first of the month `date` falls in. */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The Monday on or before the first of `base`'s month — top-left of the grid. */
function gridStart(base: Date): Date {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
}
