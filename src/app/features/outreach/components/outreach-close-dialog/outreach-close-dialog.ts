import { Component, input, output } from '@angular/core';

/**
 * Confirmation modal for closing out an outreach: the parent marks the sortie
 * as finished.
 */
@Component({
  selector: 'app-outreach-close-dialog',
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './outreach-close-dialog.html',
  styles: [
    '.modal__lead { margin: 0 0 4px; font-size: 13px; line-height: 1.5; color: #71717a; }',
  ],
})
export class OutreachCloseDialog {
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
