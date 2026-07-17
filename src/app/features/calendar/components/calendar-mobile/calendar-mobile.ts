import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import { formatTimeFr } from '../../../../shared/util/date.util';
import type { CalendarEventType, CalendarItem } from '../../calendar.models';

/** Monday-first weekday initials — the app runs `firstDay: 1` everywhere. */
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

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
 * a month grid where days carry coloured event dots, and a scrollable list of
 * the selected day's events underneath.
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
export class CalendarMobile implements OnInit {
  /** The feed for the visible window, already filtered by the page. */
  readonly items = input.required<CalendarItem[]>();
  readonly loading = input(false);

  /** The grid window to fetch, `YYYY-MM-DD` inclusive — the six rendered weeks. */
  readonly rangeChange = output<{ from: string; to: string }>();
  /** A tapped entry — the page opens its detail. */
  readonly selectItem = output<CalendarItem>();
  /** The "+" for a day — the page opens a creation prefilled with the date. */
  readonly createOn = output<string>();

  protected readonly weekdays = WEEKDAYS;

  private readonly todayIso = toIso(new Date());

  /** First day of the displayed month. */
  private readonly cursor = signal(startOfMonth(new Date()));

  /** The highlighted day whose events fill the agenda below. */
  protected readonly selected = signal(this.todayIso);

  private readonly monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  private readonly dayFmt = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  /** e.g. `Juillet 2026`. */
  protected readonly title = computed(() => capitalize(this.monthFmt.format(this.cursor())));

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

  /** Six weeks covering the month plus its spill days, Monday-first. */
  protected readonly weeks = computed<DayCell[][]>(() => {
    const cursor = this.cursor();
    const month = cursor.getMonth();
    const byDate = this.byDate();
    const start = gridStart(cursor);

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

  ngOnInit(): void {
    // The first fetch is ours to trigger — the page has no window until now.
    this.emitRange();
  }

  protected prevMonth(): void {
    this.cursor.update((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    this.emitRange();
  }

  protected nextMonth(): void {
    this.cursor.update((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    this.emitRange();
  }

  protected goToday(): void {
    this.cursor.set(startOfMonth(new Date()));
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

  protected typeClass(type: CalendarEventType): string {
    return `ev--${type.toLowerCase()}`;
  }

  protected time(value: string | null): string {
    return formatTimeFr(value);
  }

  private emitRange(): void {
    const start = gridStart(this.cursor());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 41);
    this.rangeChange.emit({ from: toIso(start), to: toIso(end) });
  }
}

/** The first of the month `date` falls in. */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The Monday on or before the first of `cursor`'s month — top-left of the grid. */
function gridStart(cursor: Date): Date {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
}
