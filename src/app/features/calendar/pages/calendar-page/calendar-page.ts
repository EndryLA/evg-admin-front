import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import type {
  CalendarOptions,
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventInput,
} from '@fullcalendar/core';
import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { CalendarEventDetail } from '../../components/calendar-event-detail/calendar-event-detail';
import { CalendarEventForm } from '../../components/calendar-event-form/calendar-event-form';
import {
  CalendarFilters,
  emptyFilterState,
  type CalendarFilterState,
} from '../../components/calendar-filters/calendar-filters';
import { CalendarMobile } from '../../components/calendar-mobile/calendar-mobile';
import { CalendarWeekends } from '../../components/calendar-weekends/calendar-weekends';
import { CalendarService } from '../../calendar.service';
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarFilter,
  CalendarItem,
  EventStatus,
  ManagerOption,
} from '../../calendar.models';

/** The FullCalendar layouts offered by the view switcher. */
type GridViewKey = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listMonth';

/** Every layout, including `weekends` — the year of week-ends, which is this
 *  page's own list rather than a FullCalendar view (see the template). */
type ViewKey = GridViewKey | 'weekends';

const VIEW_OPTIONS: readonly { value: ViewKey; label: string }[] = [
  { value: 'dayGridMonth', label: 'Mois' },
  { value: 'timeGridWeek', label: 'Semaine' },
  { value: 'timeGridDay', label: 'Jour' },
  { value: 'listMonth', label: 'Liste' },
  { value: 'weekends', label: 'Week-ends' },
];

/** The app's phone breakpoint (styles.scss, design.md §6). */
const NARROW_QUERY = '(max-width: 720px)';

/** 24-hour `HH:mm`, for both event chips and the time-grid axis. */
const TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: false } as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A `Date` → `YYYY-MM-DD`, read in local time so the day never slips. */
function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A `Date` → `HH:MM`, for prefilling the form from a dragged slot. */
function toIsoTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `YYYY-MM-DD` + `HH:mm[:ss]` → a local ISO datetime FullCalendar can place. */
function toDateTime(date: string, time: string | null): string {
  if (!time) {
    return date;
  }
  const normalized = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  return `${date}T${normalized}`;
}

/**
 * Agenda — the FullCalendar grid over `GET /api/calendar`, the merged feed of
 * calendar events *and* outreaches. The visible view range drives the query's
 * required `from`/`to` window, so every navigation refetches; the type / status
 * / responsable / search filters narrow it server-side. The "Week-ends" view is
 * the widest of those windows — a full year in one request (see `views` below).
 *
 * Creating and editing only ever touches standalone calendar events
 * (`/api/calendar/events`). Mirrored outreaches are read-only here — clicking
 * one opens its detail with a link across to `/sorties/:uuid`.
 */
@Component({
  selector: 'app-calendar-page',
  imports: [
    FullCalendarModule,
    CalendarFilters,
    CalendarMobile,
    CalendarWeekends,
    CalendarEventDetail,
    CalendarEventForm,
    ConfirmDialog,
  ],
  // Deliberately *not* `.data-list`: that shell styles bare `table`/`tr`/`td`,
  // and FullCalendar builds its grid out of exactly those — its month view is
  // one big `<tr>`, so the shared row hover would light up the whole calendar
  // and the 14px cell padding would break the layout. This page follows the
  // `.list-page` pages instead and carries its own chrome (see the scss).
  host: { class: 'agenda' },
  templateUrl: './calendar-page.html',
  styleUrls: ['./calendar-page.scss', './calendar-grid.scss'],
  // FullCalendar renders its own DOM, which never receives this component's
  // scoping attribute — the only ways in are `::ng-deep` (deprecated) or
  // dropping encapsulation. Every selector in both stylesheets is therefore
  // scoped under the host's `.agenda` class by hand, which keeps the rules off
  // the rest of the app just as encapsulation would.
  encapsulation: ViewEncapsulation.None,
})
export class CalendarPage {
  private readonly service = inject(CalendarService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly calendar = viewChild<FullCalendarComponent>('calendar');
  private readonly card = viewChild<ElementRef<HTMLElement>>('card');

  // ---- Data ----
  protected readonly items = signal<CalendarItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly managers = signal<ManagerOption[]>([]);

  /** The visible window, `YYYY-MM-DD`. Set by FullCalendar via `datesSet`. */
  private range: { from: string; to: string } | null = null;

  // ---- Toolbar ----
  /** FullCalendar's own range label, e.g. `juillet 2026` — or the year, on the
   *  week-end list, which navigates a year at a time. */
  protected readonly viewTitle = signal('');
  protected readonly view = signal<ViewKey>('dayGridMonth');
  protected readonly viewOptions = VIEW_OPTIONS;

  /** The FullCalendar layout to return to when leaving the week-end list —
   *  which unmounts the grid, so this is what remounts it as it was. */
  private readonly gridView = signal<GridViewKey>('dayGridMonth');
  /** …and the period it was showing, so it comes back where it was left. */
  private gridDate = toIsoDate(new Date());

  /** The year the week-end list covers. */
  protected readonly year = signal(new Date().getFullYear());

  // ---- Filters ----
  /** What the filter bar currently narrows the feed by. The bar owns its own
   *  controls and reports the selection whole; this is where it lands. */
  private readonly filters = signal<CalendarFilterState>(emptyFilterState());

  /** True on phone-width viewports. The grid can't be sized by CSS alone —
   *  header formats, event density and the aspect ratio are library options —
   *  so the breakpoint is mirrored here as a signal `calendarOptions` reads. */
  protected readonly narrow = signal(false);

  /** The week view is the one layout that can't shrink to a phone: seven time
   *  columns need more width than the viewport has, so on narrow it scrolls
   *  sideways inside the card (see `.cal-card--scroll-x`). */
  protected readonly scrollX = computed(() => this.narrow() && this.view() === 'timeGridWeek');

  /** True on the week-end list — the one view FullCalendar doesn't render. */
  protected readonly isYearView = computed(() => this.view() === 'weekends');

  // ---- Overlays ----
  protected readonly selected = signal<CalendarItem | null>(null);
  protected readonly formOpen = signal(false);
  /** The event being edited, or `null` when the form is creating. */
  protected readonly editing = signal<CalendarEvent | null>(null);
  /** Day/slot a creation was started from on the grid. */
  protected readonly draftDate = signal('');
  protected readonly draftStart = signal('');
  protected readonly draftEnd = signal('');
  protected readonly saving = signal(false);
  protected readonly confirmingDelete = signal<CalendarItem | null>(null);
  protected readonly deleting = signal(false);
  protected readonly actionError = signal<string | null>(null);

  /** The feed mapped to FullCalendar's shape. Type and status ride along as
   *  class names so the chips can be themed from CSS (see the scss). */
  private readonly events = computed<EventInput[]>(() =>
    this.items()
      .filter((item) => item.date !== null)
      .map((item) => ({
        id: item.uuid,
        title: item.name,
        start: toDateTime(item.date!, item.startTime),
        end: item.endTime ? toDateTime(item.date!, item.endTime) : undefined,
        allDay: !item.startTime,
        classNames: [
          `evg-ev--${item.type.toLowerCase()}`,
          ...(item.status === 'CANCELLED' ? ['evg-ev--cancelled'] : []),
        ],
        extendedProps: { item },
      })),
  );

  protected readonly calendarOptions = computed<CalendarOptions>(() => ({
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    // Leaving the week-end list remounts the grid from scratch, so it opens on
    // the layout and period it was left on rather than on this month.
    initialView: this.gridView(),
    initialDate: this.gridDate,
    locale: frLocale,
    // The page renders its own toolbar so it can match the admin filter bar.
    headerToolbar: false,
    // Desktop: FullCalendar derives the height from the width, and the page
    // scrolls. `height: '100%'` here would make the grid measure its parent,
    // which collapses it to nothing the moment that chain isn't definite — and
    // it takes the cells' breathing room with it.
    //
    // Phone: the grid fills what's left under the chrome instead, the way
    // Apple's Calendar does — the page stops scrolling and the grid owns the
    // viewport. This doesn't size the grid on its own; it puts FullCalendar in
    // liquid-height mode, and the phone layout flexes `.fc` to the height it
    // actually gets (see the phone block in the scss — the inline `height: 100%`
    // this writes is deliberately overridden there).
    height: this.narrow() ? '100%' : undefined,
    aspectRatio: this.narrow() ? undefined : 1.75,
    // With a filled height the month rows stretch to share it, so the cells are
    // as tall as the screen allows rather than as tall as their content. Left
    // off on desktop, where it would restretch the aspect-ratio layout.
    expandRows: this.narrow(),
    // "L M M J V S D" — the full "lundi" won't fit a phone month column. The
    // time grid keeps the day number, which is what makes its columns readable.
    views: {
      dayGridMonth: { dayHeaderFormat: this.narrow() ? { weekday: 'narrow' } : { weekday: 'short' } },
      timeGridWeek: { dayHeaderFormat: { weekday: 'short', day: 'numeric' } },
    },
    nowIndicator: true,
    // `true` fits as many chips as the cell's real height allows and rolls the
    // rest into "+N en plus" — which is what makes the filled phone height pay
    // off, since taller cells now mean more events visible rather than more
    // empty space.
    dayMaxEvents: true,
    weekNumbers: false,
    firstDay: 1,
    slotMinTime: '06:00:00',
    slotMaxTime: '23:00:00',
    scrollTime: '08:00:00',
    slotDuration: '00:30:00',
    allDaySlot: false,
    selectable: true,
    selectMirror: true,
    eventDisplay: 'block',
    displayEventEnd: false,
    // The French locale renders bare hours as "14 h" / "09 h"; the app writes
    // times as `HH:mm` everywhere else (design.md §4).
    eventTimeFormat: TIME_FORMAT,
    slotLabelFormat: TIME_FORMAT,
    noEventsText: 'Aucun événement sur cette période',
    events: this.events(),
    datesSet: (arg: DatesSetArg) => this.onDatesSet(arg),
    eventClick: (arg: EventClickArg) => this.onEventClick(arg),
    select: (arg: DateSelectArg) => this.onSelect(arg),
  }));

  constructor() {
    this.service.managers().subscribe({
      next: (list) => this.managers.set(list),
      error: () => this.managers.set([]),
    });
    this.watchBreakpoint();
    // The first load is driven by FullCalendar's initial `datesSet`, which
    // tells us the window to ask for.
    this.watchResize();
  }

  /** Track the phone breakpoint so the grid options can follow it. */
  private watchBreakpoint(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia(NARROW_QUERY);
    this.narrow.set(media.matches);
    const onChange = (e: MediaQueryListEvent) => this.narrow.set(e.matches);
    media.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => media.removeEventListener('change', onChange));
  }

  /**
   * Re-lay out the grid whenever its container changes size. FullCalendar only
   * watches the *window*, so collapsing the sidebar — which resizes the card
   * without resizing the window — would otherwise leave the columns at their
   * old widths until the next window resize.
   *
   * Reads the card through its signal so it re-attaches to whatever element is
   * current: crossing to the week-end list and back destroys the grid's card
   * and builds a new one, which an observer bound once would stop watching.
   */
  private watchResize(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    let frame = 0;
    effect((onCleanup) => {
      const card = this.card()?.nativeElement;
      if (!card) {
        return;
      }
      const observer = new ResizeObserver(() => {
        // The sidebar animates, so this fires every frame of the transition —
        // coalesce to one reflow per frame.
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => this.calendarApi()?.updateSize());
      });
      observer.observe(card);
      onCleanup(() => {
        cancelAnimationFrame(frame);
        observer.disconnect();
      });
    });
  }

  // ---- Loading ----
  private currentFilter(): CalendarFilter {
    const filters = this.filters();
    return {
      from: this.range?.from ?? '',
      to: this.range?.to ?? '',
      types: filters.types,
      status: filters.status,
      managedByUuid: filters.managedByUuid,
      search: filters.query,
    };
  }

  /** The filter bar reported a change — refetch the visible window with it. */
  protected onFiltersChange(next: CalendarFilterState): void {
    this.filters.set(next);
    this.load();
  }

  /** Refetch the visible window. No-op until FullCalendar has reported one. */
  protected load(): void {
    if (!this.range) {
      return;
    }
    this.loadError.set(null);
    this.loading.set(true);
    this.service.items(this.currentFilter()).subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.items.set([]);
        this.loadError.set(messageFromError(err, "Chargement de l'agenda impossible."));
        this.loading.set(false);
      },
    });
  }

  // ---- Grid callbacks ----
  /**
   * FullCalendar reports the window it just rendered — on init, on navigation
   * and on a view switch. `arg.end` is exclusive, so the inclusive `to` the
   * backend wants is the day before. Re-renders that land on the same window
   * (an event list refresh, say) must not refetch, or the load would loop.
   */
  private onDatesSet(arg: DatesSetArg): void {
    const end = new Date(arg.end);
    end.setDate(end.getDate() - 1);
    const next = { from: toIsoDate(arg.start), to: toIsoDate(end) };

    this.viewTitle.set(arg.view.title);
    this.view.set(arg.view.type as ViewKey);
    this.gridView.set(arg.view.type as GridViewKey);
    // `currentStart` is the period itself, not the padded grid — reopening on
    // the grid's first visible day would land a month view on the month before.
    this.gridDate = toIsoDate(arg.view.currentStart);

    if (this.range?.from === next.from && this.range?.to === next.to) {
      return;
    }
    this.range = next;
    this.load();
  }

  private onEventClick(arg: EventClickArg): void {
    this.actionError.set(null);
    this.selected.set(arg.event.extendedProps['item'] as CalendarItem);
  }

  // ---- Mobile grid callbacks ----
  /** The phone view drives its own window (FullCalendar isn't mounted there). */
  protected onMobileRange(next: { from: string; to: string }): void {
    if (this.range?.from === next.from && this.range?.to === next.to) {
      return;
    }
    this.range = next;
    this.load();
  }

  /** Tapping an entry in the phone agenda opens its detail. */
  protected onSelectItem(item: CalendarItem): void {
    this.actionError.set(null);
    this.selected.set(item);
  }

  /** The phone "+" starts a creation prefilled with the tapped day. */
  protected openCreateOn(date: string): void {
    this.editing.set(null);
    this.draftDate.set(date);
    this.draftStart.set('');
    this.draftEnd.set('');
    this.actionError.set(null);
    this.formOpen.set(true);
  }

  /** Dragging a range (or clicking a day) starts a creation prefilled with it. */
  private onSelect(arg: DateSelectArg): void {
    this.calendarApi()?.unselect();
    this.editing.set(null);
    this.draftDate.set(toIsoDate(arg.start));
    this.draftStart.set(arg.allDay ? '' : toIsoTime(arg.start));
    this.draftEnd.set(arg.allDay ? '' : toIsoTime(arg.end));
    this.actionError.set(null);
    this.formOpen.set(true);
  }

  private calendarApi() {
    return this.calendar()?.getApi();
  }

  // ---- Toolbar ----
  /** The arrows step a period on the grid and a year on the week-end list. */
  protected prev(): void {
    if (this.isYearView()) {
      this.year.update((y) => y - 1);
      this.loadYear();
      return;
    }
    this.calendarApi()?.prev();
  }
  protected next(): void {
    if (this.isYearView()) {
      this.year.update((y) => y + 1);
      this.loadYear();
      return;
    }
    this.calendarApi()?.next();
  }
  protected today(): void {
    if (this.isYearView()) {
      const current = new Date().getFullYear();
      if (this.year() !== current) {
        this.year.set(current);
        this.loadYear();
      }
      return;
    }
    this.calendarApi()?.today();
  }

  /**
   * Switch layout. The four FullCalendar views are a `changeView` away, but the
   * week-end list is this page's own component — so crossing between the two
   * mounts or unmounts the grid, and the window has to be driven from here
   * instead of arriving through `datesSet`.
   */
  protected setView(view: ViewKey): void {
    if (view === this.view()) {
      return;
    }
    if (view === 'weekends') {
      this.view.set('weekends');
      this.loadYear();
      return;
    }
    this.gridView.set(view);
    if (this.isYearView()) {
      // Remounts the grid on `gridView` / `gridDate`; its `datesSet` then
      // reports the window and refetches.
      this.view.set(view);
      return;
    }
    this.calendarApi()?.changeView(view);
  }

  /** Point the window at the whole displayed year and refetch — one request
   *  covers the list, since it shows every week-end of the year at once. */
  private loadYear(): void {
    const year = this.year();
    this.viewTitle.set(String(year));
    this.range = { from: `${year}-01-01`, to: `${year}-12-31` };
    this.load();
  }

  // ---- Detail / form ----
  protected closeDetail(): void {
    this.selected.set(null);
  }

  protected openOutreach(uuid: string): void {
    this.router.navigate(['/sorties', uuid]);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.draftDate.set(toIsoDate(new Date()));
    this.draftStart.set('');
    this.draftEnd.set('');
    this.actionError.set(null);
    this.formOpen.set(true);
  }

  /**
   * Edit the selected entry. The grid feed carries only the merged
   * `CalendarItem`, so the event is re-read from `/events/:uuid` to be sure the
   * form starts from the event's own record.
   */
  protected openEdit(): void {
    const item = this.selected();
    if (!item || item.outreachUuid) {
      return;
    }
    this.saving.set(true);
    this.service.getEvent(item.uuid).subscribe({
      next: (event) => {
        this.saving.set(false);
        this.editing.set(event);
        this.formOpen.set(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.actionError.set(messageFromError(err, "Ouverture de l'événement impossible."));
      },
    });
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected onSave(input: CalendarEventInput): void {
    const editing = this.editing();
    const request = editing
      ? this.service.updateEvent(editing.uuid, input)
      : this.service.createEvent(input);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.closeDetail();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.actionError.set(messageFromError(err, "Enregistrement de l'événement impossible."));
      },
    });
  }

  protected onStatusChange(status: EventStatus): void {
    const item = this.selected();
    if (!item) {
      return;
    }
    this.saving.set(true);
    this.service.setEventStatus(item.uuid, status).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDetail();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.actionError.set(messageFromError(err, 'Changement de statut impossible.'));
      },
    });
  }

  // ---- Delete ----
  protected askDelete(): void {
    const item = this.selected();
    if (item && !item.outreachUuid) {
      this.confirmingDelete.set(item);
    }
  }
  protected cancelDelete(): void {
    this.confirmingDelete.set(null);
  }
  protected confirmDelete(): void {
    const item = this.confirmingDelete();
    if (!item) {
      return;
    }
    this.deleting.set(true);
    this.service.removeEvent(item.uuid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmingDelete.set(null);
        this.closeDetail();
        this.load();
      },
      error: (err) => {
        this.deleting.set(false);
        this.confirmingDelete.set(null);
        this.actionError.set(messageFromError(err, "Suppression de l'événement impossible."));
      },
    });
  }
}
