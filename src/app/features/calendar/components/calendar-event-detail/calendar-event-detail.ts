import { Component, computed, input, output } from '@angular/core';

import { formatDateFr, formatTimeFr } from '../../../../shared/util/date.util';
import {
  CALENDAR_STATUS_LABELS,
  CALENDAR_STATUS_TONES,
  EVENT_STATUS_OPTIONS,
  EVENT_TYPE_LABELS,
} from '../../calendar.models';
import type { CalendarItem, EventStatus } from '../../calendar.models';

/**
 * Right-hand slide-over showing one agenda entry's detail. Purely
 * presentational — the parent owns the data.
 *
 * Mirrored outreaches ({@link CalendarItem.outreachUuid} set) are read-only
 * here: they offer a link across to the sorties feature instead of the
 * edit/delete/status actions, which the calendar endpoints don't accept for
 * them.
 */
@Component({
  selector: 'app-calendar-event-detail',
  host: { class: 'slideover', '(keydown.escape)': 'close.emit()' },
  templateUrl: './calendar-event-detail.html',
  styleUrl: './calendar-event-detail.scss',
})
export class CalendarEventDetail {
  readonly item = input.required<CalendarItem>();
  readonly busy = input(false);

  readonly close = output<void>();
  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly statusChange = output<EventStatus>();
  /** Mirrored outreaches only: navigate to `/sorties/:uuid`. */
  readonly openOutreach = output<string>();

  protected readonly statusOptions = EVENT_STATUS_OPTIONS;

  protected readonly isOutreach = computed(() => this.item().outreachUuid !== null);
  protected readonly typeLabel = computed(() => EVENT_TYPE_LABELS[this.item().type]);
  protected readonly statusLabel = computed(
    () => CALENDAR_STATUS_LABELS[this.item().status],
  );
  protected readonly statusTone = computed(() => CALENDAR_STATUS_TONES[this.item().status]);

  protected readonly dateLabel = computed(() => formatDateFr(this.item().date));

  /** `14:00 – 17:30`, or a single bound when only one is set. */
  protected readonly timeLabel = computed(() => {
    const { startTime, endTime } = this.item();
    if (!startTime && !endTime) {
      return '—';
    }
    return `${formatTimeFr(startTime)} – ${formatTimeFr(endTime)}`;
  });

  /** Lieu, falling back to the commune on mirrored outreaches. */
  protected readonly locationLabel = computed(
    () => this.item().location || this.item().cityLabel || '—',
  );

  /** The statuses worth offering — the current one is already applied. */
  protected readonly availableStatuses = computed(() =>
    this.statusOptions.filter((s) => s.value !== this.item().status),
  );
}
