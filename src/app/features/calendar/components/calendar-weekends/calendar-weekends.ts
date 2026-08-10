import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { formatTimeFr } from '../../../../shared/util/date.util';
import type { CalendarItem } from '../../calendar.models';

/** How the twelve month sections are arranged. */
export type WeekendsLayout =
  /** One column, month headings sticky — the phone. */
  | 'stack'
  /** Newspaper columns across the page width — the desktop. */
  | 'columns';

/** One Saturday or Sunday, with everything on it. */
interface WeekendDay {
  /** `YYYY-MM-DD`, read in local time so the day never slips. */
  iso: string;
  /** `sam.` / `dim.` */
  weekday: string;
  day: number;
  isToday: boolean;
  events: CalendarItem[];
}

/**
 * One week-end: its Saturday and its Sunday, kept together as a single block.
 * A month can open on a Sunday or close on a Saturday, so a block is sometimes
 * the one day of it that falls inside the month.
 */
interface WeekendPair {
  key: string;
  days: WeekendDay[];
  /** True when neither day carries an event — the block reads as available. */
  free: boolean;
  /** True when today falls in it, so the block can be marked. */
  current: boolean;
}

/** One month's worth of week-ends, as a section of the year. */
interface WeekendMonth {
  key: string;
  label: string;
  weekends: WeekendPair[];
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
 * A year of week-ends — the department plans almost exclusively on Saturdays
 * and Sundays, so this lays the year out as nothing else: twelve month
 * sections, each a run of week-end blocks pairing the Saturday with its Sunday.
 *
 * Every week-end is listed, event or not. A free week-end is exactly what
 * someone opens this view to find, so the empty blocks have to be as visible as
 * the busy ones.
 *
 * Purely presentational: the parent owns the feed (and the year it covers) and
 * the detail/create overlays. Shared by the phone agenda and the desktop grid
 * page, which differ only in {@link layout}.
 */
@Component({
  selector: 'app-calendar-weekends',
  templateUrl: './calendar-weekends.html',
  styleUrl: './calendar-weekends.scss',
  host: { '[class]': '"wk--" + layout()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarWeekends {
  /** The feed for the year, already filtered by the page. */
  readonly items = input.required<CalendarItem[]>();
  /** The year to lay out. Entries outside it are ignored. */
  readonly year = input.required<number>();
  readonly layout = input<WeekendsLayout>('stack');

  /** A tapped entry — the parent opens its detail. */
  readonly selectItem = output<CalendarItem>();
  /** A tapped date — the parent opens a creation prefilled with the day. */
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

  protected readonly months = computed<WeekendMonth[]>(() => {
    const year = this.year();
    const byDate = this.byDate();
    const months: WeekendMonth[] = [];

    for (let month = 0; month < 12; month++) {
      const weekends: WeekendPair[] = [];
      let count = 0;
      const lastDay = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month, day);
        const weekday = date.getDay();
        if (weekday !== 0 && weekday !== 6) {
          continue;
        }
        const iso = toIso(date);
        const events = byStartTime(byDate.get(iso));
        count += events.length;
        const entry: WeekendDay = {
          iso,
          weekday: weekday === 6 ? 'sam.' : 'dim.',
          day,
          isToday: iso === this.todayIso,
          events,
        };

        // A Sunday joins the Saturday just before it; anything else opens a new
        // block — which covers both a month starting on a Sunday and a month
        // ending on a Saturday.
        const open = weekends[weekends.length - 1];
        if (weekday === 0 && open?.days.length === 1 && open.days[0].day === day - 1) {
          open.days.push(entry);
        } else {
          weekends.push({ key: iso, days: [entry], free: true, current: false });
        }
      }

      for (const weekend of weekends) {
        weekend.free = weekend.days.every((d) => d.events.length === 0);
        weekend.current = weekend.days.some((d) => d.isToday);
      }

      months.push({
        key: `${year}-${month}`,
        label: capitalize(this.monthFmt.format(new Date(year, month, 1))),
        weekends,
        count,
      });
    }
    return months;
  });

  protected typeClass(item: CalendarItem): string {
    return `ev--${item.type.toLowerCase()}`;
  }

  protected time(value: string | null): string {
    return formatTimeFr(value);
  }
}
