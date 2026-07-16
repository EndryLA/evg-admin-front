import { Component, computed, inject, input, OnInit, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import type { ManagerOption, Outreach, OutreachInput } from '../../outreach.models';

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

/** Create/edit modal for an outreach. Presentational — emits {@link save}. */
@Component({
  selector: 'app-outreach-form',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './outreach-form.html',
})
export class OutreachForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly outreach = input<Outreach | null>(null);
  readonly managers = input<ManagerOption[]>([]);
  readonly busy = input(false);

  readonly save = output<OutreachInput>();
  readonly cancel = output<void>();

  protected readonly isEdit = computed(() => this.outreach() !== null);
  protected readonly title = computed(() => this.outreach()?.name || 'Nouvelle sortie');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    location: ['', [Validators.required]],
    date: ['', [Validators.required]],
    startTime: ['', [Validators.required]],
    endTime: ['', [Validators.required]],
    managedByUuid: [''],
  });

  ngOnInit(): void {
    const o = this.outreach();
    if (o) {
      this.form.setValue({
        name: o.name,
        location: o.location,
        date: toDateInput(o.date),
        startTime: toTimeInput(o.startTime),
        endTime: toTimeInput(o.endTime),
        managedByUuid: o.managedBy?.uuid ?? '',
      });
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.save.emit({
      name: v.name,
      location: v.location,
      date: v.date,
      startTime: v.startTime,
      endTime: v.endTime,
      managedByUuid: v.managedByUuid || null,
    });
  }
}
