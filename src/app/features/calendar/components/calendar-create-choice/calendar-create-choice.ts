import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { formatLongDateFr } from '../../../../shared/util/date.util';
import type { CreateKind } from '../../calendar.models';

/**
 * The fork every creation on the agenda goes through: it asks what the thing is
 * before asking for its details, since the two land in different places — an
 * event stays in the calendar, an évangélisation becomes a sortie with its own
 * management pages.
 *
 * The day is shown but not editable — the form this opens carries a date field
 * of its own, and asking twice for the same thing only adds a step.
 *
 * Purely presentational: the parent opens the matching form on the day it holds.
 */
@Component({
  selector: 'app-calendar-create-choice',
  host: { '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './calendar-create-choice.html',
  styleUrl: './calendar-create-choice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarCreateChoice {
  /** The day the creation was started from, `YYYY-MM-DD`. */
  readonly date = input.required<string>();

  readonly choose = output<CreateKind>();
  readonly cancel = output<void>();

  protected readonly dateLabel = computed(() => formatLongDateFr(this.date()));
}
