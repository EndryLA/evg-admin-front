import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/** Short French month labels, in calendar order. */
const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
] as const;

/** A picked period. */
export interface Period {
  /** 0 = January … 11 = December. */
  month: number;
  year: number;
}

/**
 * The agenda's period jump: the range title doubles as the trigger, and the
 * panel it opens puts a whole year of months one click away — stepping month by
 * month through the arrows is fine for the next one and useless for next March.
 *
 * The year is stepped inside the panel without committing, so nothing moves
 * until a month is actually chosen; picking one applies and closes. Purely
 * presentational — the parent decides what jumping there means in its view.
 */
@Component({
  selector: 'app-calendar-period-picker',
  host: { '(keydown.escape)': 'close()' },
  templateUrl: './calendar-period-picker.html',
  styleUrl: './calendar-period-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPeriodPicker {
  /** The period on screen — what the panel opens on and marks as current. */
  readonly month = input.required<number>();
  readonly year = input.required<number>();
  /** The range label the trigger shows, e.g. `2026` or `juillet 2026`. */
  readonly label = input.required<string>();

  readonly select = output<Period>();

  protected readonly months = MONTHS;
  protected readonly open = signal(false);

  /** The year the panel is browsing. Only committed when a month is picked. */
  private readonly browsing = signal<number | null>(null);
  protected readonly panelYear = computed(() => this.browsing() ?? this.year());

  protected toggle(): void {
    // Always reopen on the displayed period, not on wherever it was left.
    this.browsing.set(null);
    this.open.update((v) => !v);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected shiftYear(delta: number): void {
    this.browsing.set(this.panelYear() + delta);
  }

  protected pick(month: number): void {
    this.select.emit({ month, year: this.panelYear() });
    this.close();
  }

  /** True for the month currently on screen, so the panel says where we are. */
  protected isCurrent(month: number): boolean {
    return month === this.month() && this.panelYear() === this.year();
  }
}
