import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { formatTimeFr } from '../../../../shared/util/date.util';
import type { CalendarItem } from '../../calendar.models';

/** How the twelve month sections are arranged. */
export type WeeksLayout =
  /** One column, month headings sticky — the phone. */
  | 'stack'
  /** Newspaper columns across the page width — the desktop. */
  | 'columns';

/** Monday-first French weekday labels, indexed by {@link weekdayIndex}. */
const WEEKDAY_LABELS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'] as const;

/** One day shown inside a week block. */
interface WeekDay {
  /** `YYYY-MM-DD`, read in local time so the day never slips. */
  iso: string;
  /** `lun.` … `dim.` */
  weekday: string;
  day: number;
  isToday: boolean;
  /** Strictly before today — the block renders it quiet (see the scss). */
  isPast: boolean;
  /** Saturday or Sunday, which are shown whether or not they carry anything. */
  isWeekend: boolean;
  events: CalendarItem[];
}

/**
 * One week — Monday to Sunday — as a single block.
 *
 * Only the days worth showing are in {@link days}: the Saturday and the Sunday
 * always, plus any weekday that carries an event. They stay in calendar order,
 * so a Tuesday event sits above the week-end it belongs to.
 */
interface WeekBlock {
  /** `YYYY-MM-DD` of the week's Monday. */
  key: string;
  days: WeekDay[];
  /** True when nothing at all falls in the week — it reads as available. */
  free: boolean;
  /** True when today falls in it, so the block can be marked. */
  current: boolean;
  /** True once the whole week is behind us. */
  isPast: boolean;
}

/** One month's worth of week blocks, as a section of the year. */
interface WeekMonth {
  key: string;
  label: string;
  weeks: WeekBlock[];
  /** Events across the month — shown next to its title. */
  count: number;
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

/** 0 = Monday … 6 = Sunday. `Date.getDay()` is Sunday-first; the app is not. */
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** The Monday on or before `date` — the block a day belongs to. */
function mondayOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - weekdayIndex(date));
}

/** French labels come through lowercase ("juillet") — lift the first letter. */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** A day's entries, all-day first then by start time. Copies before sorting —
 *  the argument is a bucket of the shared feed, not this caller's to reorder. */
function byStartTime(items: CalendarItem[] | undefined): CalendarItem[] {
  return (items ?? []).slice().sort((a, b) => {
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
  });
}

/**
 * A year of weeks — the department plans almost exclusively on Saturdays and
 * Sundays, so this lays the year out as nothing else: twelve month sections,
 * each a run of week blocks.
 *
 * A block shows its **week-end by default**, and any weekday that turns out to
 * carry something joins it in the same block, in calendar order — so a Tuesday
 * meeting is read together with the week-end it precedes rather than filed away
 * in a separate view. Weekdays with nothing on them are simply absent; the way
 * to put one on the calendar is to create an event on it.
 *
 * Every week-end is listed, event or not. A free week-end is exactly what
 * someone opens this view to find, so the empty blocks have to be as visible as
 * the busy ones.
 *
 * Purely presentational: the parent owns the feed (and the year it covers) and
 * the detail/create overlays. Shared by the phone agenda and the desktop page,
 * which differ only in {@link layout}.
 */
@Component({
  selector: 'app-calendar-weeks',
  templateUrl: './calendar-weeks.html',
  styleUrl: './calendar-weeks.scss',
  host: { '[class]': '"wk--" + layout()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarWeeks {
  /** The feed for the year, already filtered by the page. */
  readonly items = input.required<CalendarItem[]>();
  /** The year to lay out. Entries outside it are ignored. */
  readonly year = input.required<number>();
  readonly layout = input<WeeksLayout>('stack');

  /** A tapped entry — the parent opens its detail (or the sortie it mirrors). */
  readonly selectItem = output<CalendarItem>();
  /** A tapped *empty* date — the parent asks what to create on that day. */
  readonly createOn = output<string>();

  private readonly monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long' });

  private readonly todayIso = toIso(new Date());

  /** The feed bucketed by day, so a block reads its events in one lookup. */
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

  protected readonly months = computed<WeekMonth[]>(() => {
    const year = this.year();
    const byDate = this.byDate();

    // Walk the year day by day and keep only what a block shows: the week-end,
    // plus any weekday carrying an event. Blocks are collected by their Monday,
    // so a week straddling two months stays one block.
    const blocks = new Map<string, WeekBlock>();
    const last = new Date(year, 11, 31);
    for (
      let date = new Date(year, 0, 1);
      date <= last;
      date = new Date(year, date.getMonth(), date.getDate() + 1)
    ) {
      const index = weekdayIndex(date);
      const isWeekend = index >= 5;
      const iso = toIso(date);
      const events = byStartTime(byDate.get(iso));
      if (!isWeekend && events.length === 0) {
        continue;
      }

      const key = toIso(mondayOf(date));
      let block = blocks.get(key);
      if (!block) {
        block = { key, days: [], free: true, current: false, isPast: false };
        blocks.set(key, block);
      }
      block.days.push({
        iso,
        weekday: WEEKDAY_LABELS[index],
        day: date.getDate(),
        isToday: iso === this.todayIso,
        isPast: iso < this.todayIso,
        isWeekend,
        events,
      });
    }

    // A block belongs to the month of its last day inside the year — so the
    // week of 30 nov → 6 déc files under December, whole, rather than being
    // split across two sections.
    const months: WeekMonth[] = [];
    for (let month = 0; month < 12; month++) {
      months.push({
        key: `${year}-${month}`,
        label: capitalize(this.monthFmt.format(new Date(year, month, 1))),
        weeks: [],
        count: 0,
      });
    }

    const todayKey = toIso(mondayOf(new Date()));
    for (const block of blocks.values()) {
      block.free = block.days.every((d) => d.events.length === 0);
      // Read from the week itself, not from its days: today is often a weekday
      // with nothing on it, and so absent from the block it belongs to.
      block.current = block.key === todayKey;
      block.isPast = block.days.every((d) => d.isPast);

      const home = months[fromIso(block.days[block.days.length - 1].iso).getMonth()];
      home.weeks.push(block);
      for (const day of block.days) {
        home.count += day.events.length;
      }
    }

    return months;
  });

  /**
   * A day is one target: it opens what's on it, and offers to fill it when it's
   * empty. With several entries the first of the day answers for it — the rest
   * stay one click away on their own chips.
   */
  protected openDay(day: WeekDay): void {
    const first = day.events[0];
    if (first) {
      this.selectItem.emit(first);
      return;
    }
    this.createOn.emit(day.iso);
  }

  protected typeClass(item: CalendarItem): string {
    return `ev--${item.type.toLowerCase()}`;
  }

  protected time(value: string | null): string {
    return formatTimeFr(value);
  }
}
