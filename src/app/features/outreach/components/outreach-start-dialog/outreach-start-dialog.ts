import { Component, input, output } from '@angular/core';

/**
 * Confirmation modal for starting an outreach: guards the transition from
 * scheduled to in-progress so it can't be triggered by an accidental tap.
 */
@Component({
  selector: 'app-outreach-start-dialog',
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './outreach-start-dialog.html',
  styles: [
    '.modal__lead { margin: 0 0 4px; font-size: 13px; line-height: 1.5; color: #71717a; }',
  ],
})
export class OutreachStartDialog {
  readonly name = input<string>('');
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
