import { Component, inject, input, OnInit, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

/**
 * Confirmation modal for closing out an outreach: captures the final
 * participant count, then the parent marks the sortie as finished.
 */
@Component({
  selector: 'app-outreach-close-dialog',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './outreach-close-dialog.html',
  styles: [
    '.modal__lead { margin: 0 0 4px; font-size: 13px; line-height: 1.5; color: #71717a; }',
  ],
})
export class OutreachCloseDialog implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly participants = input<number | null>(null);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<number>();
  readonly cancel = output<void>();

  protected readonly form = this.fb.nonNullable.group({
    totalParticipants: [
      null as number | null,
      [Validators.required, Validators.min(0)],
    ],
  });

  ngOnInit(): void {
    this.form.setValue({ totalParticipants: this.participants() });
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.confirm.emit(Number(this.form.getRawValue().totalParticipants));
  }
}
