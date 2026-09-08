import { Component, computed, input, output, signal } from '@angular/core';

/**
 * Confirmation modal for closing out an outreach. Closing is also when the
 * supervisor records the head count (`totalPresences`) — the number of people
 * actually there, which is deliberately asked for rather than derived: the QR
 * form only ever catches a fraction of them. The field starts empty so the
 * count comes from a real count on the ground; {@link tracked} is shown as a
 * reference only.
 */
@Component({
  selector: 'app-outreach-close-dialog',
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './outreach-close-dialog.html',
  styles: [
    '.modal__lead { margin: 0 0 4px; font-size: 13px; line-height: 1.5; color: #71717a; }',
    '.field__hint { margin: 6px 0 0; font-size: 12.5px; color: #71717a; }',
  ],
})
export class OutreachCloseDialog {
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  /** Presences already recorded through the public form — shown as a hint. */
  readonly tracked = input(0);

  readonly confirm = output<number>();
  readonly cancel = output<void>();

  /** Raw field text — kept as a string so an empty field stays empty rather
   *  than collapsing to 0. */
  protected readonly total = signal('');
  /** Set once the field has been left or submission attempted, so the error
   *  doesn't shout at a field the user hasn't reached yet. */
  protected readonly touched = signal(false);

  /** The entered count as a non-negative integer, or `null` when unusable. */
  protected readonly parsed = computed(() => {
    const raw = this.total().trim();
    if (raw === '') {
      return null;
    }
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : null;
  });

  protected readonly invalid = computed(() => this.parsed() === null);

  protected setTotal(value: string): void {
    this.total.set(value);
  }

  protected markTouched(): void {
    this.touched.set(true);
  }

  protected submit(): void {
    this.touched.set(true);
    const value = this.parsed();
    if (value === null || this.busy()) {
      return;
    }
    this.confirm.emit(value);
  }
}
