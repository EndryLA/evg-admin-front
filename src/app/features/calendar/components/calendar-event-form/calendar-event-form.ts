import { Component, computed, inject, input, OnInit, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { EVENT_TYPE_OPTIONS } from '../../calendar.models';
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarEventType,
  ManagerOption,
} from '../../calendar.models';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` (as the backend sends it) or an ISO datetime → `YYYY-MM-DD`
 *  for a native date input. */
function toDateInput(value: string | null): string {
  if (!value) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Bare `HH:mm[:ss]` or an ISO datetime → `HH:MM` for a native time input. */
function toTimeInput(value: string | null): string {
  if (!value) {
    return '';
  }
  const timeOnly = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (timeOnly) {
    return `${timeOnly[1]}:${timeOnly[2]}`;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Create/edit modal for a calendar event. Presentational — emits {@link save}.
 *
 * `OUTREACH` is absent from the type selector on purpose: outreaches reach the
 * agenda by being mirrored from the sorties feature, so creating one here would
 * produce a second, unlinked entry.
 */
@Component({
  selector: 'app-calendar-event-form',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './calendar-event-form.html',
})
export class CalendarEventForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly event = input<CalendarEvent | null>(null);
  readonly managers = input<ManagerOption[]>([]);
  /** Day the creation was started from (grid click), `YYYY-MM-DD`. */
  readonly defaultDate = input('');
  /** Slot the creation was started from (time-grid drag), `HH:MM`. */
  readonly defaultStartTime = input('');
  readonly defaultEndTime = input('');
  readonly busy = input(false);

  readonly save = output<CalendarEventInput>();
  readonly cancel = output<void>();

  protected readonly typeOptions = EVENT_TYPE_OPTIONS.filter((t) => t.value !== 'OUTREACH');

  protected readonly isEdit = computed(() => this.event() !== null);
  protected readonly title = computed(() => this.event()?.name || 'Nouvel événement');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    type: ['REUNION' as CalendarEventType, [Validators.required]],
    date: ['', [Validators.required]],
    startTime: ['', [Validators.required]],
    endTime: ['', [Validators.required]],
    location: [''],
    description: [''],
    managedByUuid: [''],
  });

  ngOnInit(): void {
    const e = this.event();
    if (e) {
      this.form.setValue({
        name: e.name,
        type: e.type,
        date: toDateInput(e.date),
        startTime: toTimeInput(e.startTime),
        endTime: toTimeInput(e.endTime),
        location: e.location,
        description: e.description,
        managedByUuid: e.managedBy?.uuid ?? '',
      });
      return;
    }
    this.form.patchValue({
      date: this.defaultDate(),
      startTime: this.defaultStartTime(),
      endTime: this.defaultEndTime(),
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.save.emit({
      name: v.name,
      type: v.type,
      date: v.date,
      startTime: v.startTime,
      endTime: v.endTime,
      location: v.location,
      description: v.description,
      managedByUuid: v.managedByUuid || null,
    });
  }
}
