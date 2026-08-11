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

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { CalendarCreateChoice } from '../../components/calendar-create-choice/calendar-create-choice';
import { CalendarEventDetail } from '../../components/calendar-event-detail/calendar-event-detail';
import { CalendarEventForm } from '../../components/calendar-event-form/calendar-event-form';
import {
  CalendarFilters,
  emptyFilterState,
  type CalendarFilterState,
} from '../../components/calendar-filters/calendar-filters';
import { CalendarMobile } from '../../components/calendar-mobile/calendar-mobile';
import { CalendarOutreachForm } from '../../components/calendar-outreach-form/calendar-outreach-form';
import {
  CalendarPeriodPicker,
  type Period,
} from '../../components/calendar-period-picker/calendar-period-picker';
import { CalendarWeeks } from '../../components/calendar-weeks/calendar-weeks';
import { CalendarService } from '../../calendar.service';
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarFilter,
  CalendarItem,
  CreateKind,
  EventStatus,
  ManagerOption,
  OutreachDraft,
} from '../../calendar.models';

/**
 * The two layouts the agenda offers.
 *
 * `weeks` is the default and the one the department actually plans in — a year
 * of week blocks, this page's own list rather than a FullCalendar view (see the
 * template). `dayGridMonth` is the familiar month grid, kept for the overview a
 * list can't give.
 */
type ViewKey = 'weeks' | 'dayGridMonth';

const VIEW_OPTIONS: readonly { value: ViewKey; label: string }[] = [
  { value: 'weeks', label: 'Calendrier' },
  { value: 'dayGridMonth', label: 'Grille' },
];

/** The app's phone breakpoint (styles.scss, design.md §6). */
const NARROW_QUERY = '(max-width: 720px)';

/** 24-hour `HH:mm`, for the event chips. */
const TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: false } as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A `Date` → `YYYY-MM-DD`, read in local time so the day never slips. */
function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** All-day first, then by start time — the order a day reads in. */
function byStartTime(a: CalendarItem, b: CalendarItem): number {
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
 * Agenda — the merged feed of calendar events *and* outreaches over
 * `GET /api/calendar`. The visible range drives the query's required `from`/`to`
 * window, so every navigation refetches; the type / status / responsable /
 * search filters narrow it server-side. The week list is the widest of those
 * windows — a full year in one request.
 *
 * Creating goes through a fork: a click on a day asks whether it's an event or
 * an évangélisation, then posts to `/api/calendar/events` or `/api/outreaches`
 * accordingly, and stays here either way. Editing only ever touches standalone
 * calendar events — mirrored outreaches are read-only on the agenda, and
 * clicking one leaves for its management page.
 */
@Component({
  selector: 'app-calendar-page',
  imports: [
    FullCalendarModule,
    CalendarFilters,
    CalendarMobile,
    CalendarWeeks,
    CalendarPeriodPicker,
    CalendarCreateChoice,
    CalendarEventDetail,
    CalendarEventForm,
    CalendarOutreachForm,
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

  /** The visible window, `YYYY-MM-DD`. */
  private range: { from: string; to: string } | null = null;

  // ---- Toolbar ----
  /** FullCalendar's own range label, e.g. `juillet 2026` — or the year, on the
   *  week list, which navigates a year at a time. */
  protected readonly viewTitle = signal('');
  /** The week list leads: planning happens week-end by week-end, and the month
   *  grid is the overview you drop into. */
  protected readonly view = signal<ViewKey>('weeks');
  protected readonly viewOptions = VIEW_OPTIONS;

  /** The period the month grid was showing, so it comes back where it was left
   *  after a trip through the week list (which unmounts it). A signal because
   *  `calendarOptions` reads it: the grid is remounted from that computed, and
   *  a plain field would leave it serving the previous period's `initialDate`. */
  private readonly gridDate = signal(toIsoDate(new Date()));

  /** The year the week list covers. */
  protected readonly year = signal(new Date().getFullYear());
  /** The month the period picker opens on — the grid's month, or the week
   *  list's last jump. */
  protected readonly month = signal(new Date().getMonth());

  // ---- Filters ----
  /** What the filter bar currently narrows the feed by. The bar owns its own
   *  controls and reports the selection whole; this is where it lands. */
  private readonly filters = signal<CalendarFilterState>(emptyFilterState());

  /** True on phone-width viewports. The grid can't be sized by CSS alone —
   *  header formats, event density and the aspect ratio are library options —
   *  so the breakpoint is mirrored here as a signal `calendarOptions` reads. */
  protected readonly narrow = signal(false);

  /** True on the week list — the view FullCalendar doesn't render. */
  protected readonly isWeekView = computed(() => this.view() === 'weeks');

  // ---- Overlays ----
  protected readonly selected = signal<CalendarItem | null>(null);
  /** The day a creation was started from, while the kind is being chosen. */
  protected readonly choosingOn = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  /** True while the évangélisation form is up rather than the event one. */
  protected readonly outreachFormOpen = signal(false);
  /** The event being edited, or `null` when the form is creating. */
  protected readonly editing = signal<CalendarEvent | null>(null);
  /** Day a creation was started from on the calendar. */
  protected readonly draftDate = signal('');
  protected readonly saving = signal(false);
  protected readonly confirmingDelete = signal<CalendarItem | null>(null);
  protected readonly deleting = signal(false);
  protected readonly actionError = signal<string | null>(null);

  /** Today, as the grid reads it — past days are drawn quiet (see the scss). */
  private readonly todayIso = toIsoDate(new Date());

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
          ...(item.date! < this.todayIso ? ['evg-ev--past'] : []),
        ],
        extendedProps: { item },
      })),
  );

  protected readonly calendarOptions = computed<CalendarOptions>(() => ({
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    // Leaving the week list remounts the grid from scratch, so it opens on the
    // period it was left on rather than on this month.
    initialDate: this.gridDate(),
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
    // "L M M J V S D" — the full "lundi" won't fit a phone month column.
    views: {
      dayGridMonth: { dayHeaderFormat: this.narrow() ? { weekday: 'narrow' } : { weekday: 'short' } },
    },
    nowIndicator: true,
    // `true` fits as many chips as the cell's real height allows and rolls the
    // rest into "+N en plus" — which is what makes the filled phone height pay
    // off, since taller cells now mean more events visible rather than more
    // empty space.
    dayMaxEvents: true,
    weekNumbers: false,
    firstDay: 1,
    selectable: true,
    selectMirror: true,
    eventDisplay: 'block',
    displayEventEnd: false,
    // The French locale renders bare hours as "14 h" / "09 h"; the app writes
    // times as `HH:mm` everywhere else (design.md §4).
    eventTimeFormat: TIME_FORMAT,
    noEventsText: 'Aucun événement sur cette période',
    // Days already gone are dimmed rather than blocked — a sortie is often
    // recorded after the fact, so they stay selectable (see the scss).
    dayCellClassNames: (arg) => (toIsoDate(arg.date) < this.todayIso ? ['evg-day--past'] : []),
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
    this.watchResize();
    // The week list opens first, and it drives its own window — FullCalendar
    // isn't mounted to report one through `datesSet`.
    this.loadYear();
    // …and it opens on the current month rather than at the top of January,
    // which is a year's scroll away from anything anyone is planning.
    this.scrollToMonth(this.year(), this.month());
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
   * current: crossing to the week list and back destroys the grid's card and
   * builds a new one, which an observer bound once would stop watching.
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

  /** Refetch the visible window. No-op until a view has reported one. */
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
    // `currentStart` is the period itself, not the padded grid — reopening on
    // the grid's first visible day would land a month view on the month before.
    this.gridDate.set(toIsoDate(arg.view.currentStart));
    this.year.set(arg.view.currentStart.getFullYear());
    this.month.set(arg.view.currentStart.getMonth());

    if (this.range?.from === next.from && this.range?.to === next.to) {
      return;
    }
    this.range = next;
    this.load();
  }

  /**
   * Open an entry. Mirrored outreaches leave the agenda entirely: everything
   * there is to do with a sortie — présences, contacts, clôture — lives on its
   * management page, and none of it is editable from the calendar endpoints.
   */
  private onEventClick(arg: EventClickArg): void {
    this.onSelectItem(arg.event.extendedProps['item'] as CalendarItem);
  }

  /**
   * A day on the grid is one target, as it is in the week list: clicking it
   * opens what's on it, and offers to fill it when it's empty. Dragging a range
   * is always a creation — the intent there is the span, not what it covers.
   */
  private onSelect(arg: DateSelectArg): void {
    this.calendarApi()?.unselect();
    const date = toIsoDate(arg.start);
    // `end` is exclusive, so a single day ends the morning after it.
    const end = new Date(arg.end);
    end.setDate(end.getDate() - 1);

    if (toIsoDate(end) === date) {
      const first = this.items()
        .filter((item) => item.date === date)
        .sort(byStartTime)[0];
      if (first) {
        this.onSelectItem(first);
        return;
      }
    }
    this.openCreateOn(date);
  }

  // ---- Mobile callbacks ----
  /** The phone view drives its own window (FullCalendar isn't mounted there). */
  protected onMobileRange(next: { from: string; to: string }): void {
    if (this.range?.from === next.from && this.range?.to === next.to) {
      return;
    }
    this.range = next;
    this.load();
  }

  /** Tapping an entry opens its detail — or the sortie it mirrors. */
  protected onSelectItem(item: CalendarItem): void {
    this.actionError.set(null);
    if (item.outreachUuid) {
      this.openOutreach(item.outreachUuid);
      return;
    }
    this.selected.set(item);
  }

  private calendarApi() {
    return this.calendar()?.getApi();
  }

  // ---- Toolbar ----
  /** The arrows step a month on the grid and a year on the week list. */
  protected prev(): void {
    if (this.isWeekView()) {
      this.year.update((y) => y - 1);
      this.loadYear();
      return;
    }
    this.calendarApi()?.prev();
  }
  protected next(): void {
    if (this.isWeekView()) {
      this.year.update((y) => y + 1);
      this.loadYear();
      return;
    }
    this.calendarApi()?.next();
  }
  protected today(): void {
    const now = new Date();
    if (this.isWeekView()) {
      this.goTo({ month: now.getMonth(), year: now.getFullYear() });
      return;
    }
    this.calendarApi()?.today();
  }

  /**
   * Jump straight to a month, from the period picker. On the grid that's a
   * navigation; on the week list it's a scroll to the month's section, plus a
   * refetch when the year changes under it.
   */
  protected goTo(period: Period): void {
    this.month.set(period.month);
    if (!this.isWeekView()) {
      this.calendarApi()?.gotoDate(new Date(period.year, period.month, 1));
      return;
    }
    if (this.year() !== period.year) {
      this.year.set(period.year);
      this.loadYear();
    }
    this.scrollToMonth(period.year, period.month);
  }

  /**
   * Bring a month's section to the top of the week list.
   *
   * The section may not exist yet — the list is rendered from a fetch, so on
   * first load this runs before there is anything to scroll to. Retries for a
   * few frames rather than assuming the DOM has caught up, then gives up.
   */
  private scrollToMonth(year: number, month: number, attempts = 20): void {
    if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') {
      return;
    }
    requestAnimationFrame(() => {
      const section = document.getElementById(`wk-${year}-${month}`);
      if (section) {
        section.scrollIntoView({ block: 'start' });
        return;
      }
      if (attempts > 0) {
        this.scrollToMonth(year, month, attempts - 1);
      }
    });
  }

  /**
   * Switch layout. The month grid is a FullCalendar view and the week list is
   * this page's own component, so crossing between the two mounts or unmounts
   * the grid — and the window has to be driven from here rather than arriving
   * through `datesSet`.
   */
  protected setView(view: ViewKey): void {
    if (view === this.view()) {
      return;
    }
    this.view.set(view);
    if (view === 'weeks') {
      this.loadYear();
      return;
    }
    // Remounts the grid on the period it was left on; its `datesSet` then
    // reports the window and refetches.
    this.gridDate.set(toIsoDate(new Date(this.year(), this.month(), 1)));
  }

  /** Point the window at the whole displayed year and refetch — one request
   *  covers the list, since it shows every week of the year at once. */
  private loadYear(): void {
    const year = this.year();
    this.viewTitle.set(String(year));
    this.range = { from: `${year}-01-01`, to: `${year}-12-31` };
    this.load();
  }

  // ---- Detail ----
  protected closeDetail(): void {
    this.selected.set(null);
  }

  /** Everything about a sortie is managed on its own page. */
  protected openOutreach(uuid: string): void {
    this.router.navigate(['/sorties', uuid, 'gestion']);
  }

  // ---- Creating ----
  /** A click on a day (or the toolbar button): ask what to put on it. */
  protected openCreateOn(date: string): void {
    this.actionError.set(null);
    this.choosingOn.set(date);
  }

  protected openCreate(): void {
    this.openCreateOn(toIsoDate(new Date()));
  }

  protected cancelCreate(): void {
    this.choosingOn.set(null);
  }

  /** The kind was chosen — open the matching form on the chosen day. */
  protected onChooseKind(kind: CreateKind): void {
    this.draftDate.set(this.choosingOn() ?? '');
    this.choosingOn.set(null);
    this.editing.set(null);
    if (kind === 'OUTREACH') {
      this.outreachFormOpen.set(true);
      return;
    }
    this.formOpen.set(true);
  }

  /**
   * Edit the selected entry. The feed carries only the merged `CalendarItem`,
   * so the event is re-read from `/events/:uuid` to be sure the form starts
   * from the event's own record.
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
    this.outreachFormOpen.set(false);
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

  /** Plan a sortie. It comes back through the merged feed on the refetch, so
   *  the calendar stays put rather than following it to its management page. */
  protected onSaveOutreach(input: OutreachDraft): void {
    this.saving.set(true);
    this.service.createOutreach(input).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.actionError.set(messageFromError(err, "Enregistrement de l'évangélisation impossible."));
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
