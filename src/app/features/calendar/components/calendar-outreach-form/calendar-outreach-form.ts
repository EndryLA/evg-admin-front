import { Component, inject, input, OnInit, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  CityAutocomplete,
  type CityValue,
} from '../../../../shared/ui/city-autocomplete/city-autocomplete';
import {
  MemberAutocomplete,
  type MemberValue,
} from '../../../../shared/ui/member-autocomplete/member-autocomplete';
import type { OutreachDraft } from '../../calendar.models';

/** Initial value for the city field: no pick, empty label. */
const EMPTY_CITY: CityValue = { inseeCode: null, label: '' };

/** Initial value for the supervisor field: no pick, empty label. */
const EMPTY_MEMBER: MemberValue = { uuid: null, label: '' };

/** Usual outreach schedule, pre-filled on every creation. */
const DEFAULT_START_TIME = '11:00';
const DEFAULT_END_TIME = '13:30';

/**
 * Modal for planning an évangélisation straight from the agenda.
 *
 * Creation only — everything after that (présences, contacts, clôture) belongs
 * to the sortie itself, at `/sorties/:uuid/gestion`. This asks for the little
 * it takes to put one on the calendar and nothing more.
 *
 * The sorties feature has its own, fuller form; features never import from one
 * another, so this is the calendar's own. Both lean on the same shared city and
 * member autocompletes, which is where the substance of either would be.
 *
 * Presentational — emits {@link save}.
 */
@Component({
  selector: 'app-calendar-outreach-form',
  imports: [ReactiveFormsModule, CityAutocomplete, MemberAutocomplete],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './calendar-outreach-form.html',
})
export class CalendarOutreachForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  /** Day the creation was started from, `YYYY-MM-DD`. */
  readonly defaultDate = input('');
  readonly busy = input(false);

  readonly save = output<OutreachDraft>();
  readonly cancel = output<void>();

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    location: ['', [Validators.required]],
    date: ['', [Validators.required]],
    startTime: [DEFAULT_START_TIME, [Validators.required]],
    endTime: [DEFAULT_END_TIME, [Validators.required]],
    // Optional: a picked commune or free text; the backend accepts either or none.
    city: [{ ...EMPTY_CITY } as CityValue],
    // Optional: only an actual pick carries a uuid; free text is ignored on submit.
    manager: [{ ...EMPTY_MEMBER } as MemberValue],
  });

  ngOnInit(): void {
    this.form.patchValue({ date: this.defaultDate() });
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
      // A picked commune carries an INSEE code; free text keeps its label.
      cityInseeCode: v.city.inseeCode,
      cityLabel: v.city.inseeCode == null ? v.city.label : null,
      // Only a picked member is a supervisor; unmatched free text clears it.
      managedByUuid: v.manager.uuid,
    });
  }
}
