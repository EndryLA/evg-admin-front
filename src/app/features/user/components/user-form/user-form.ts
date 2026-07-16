import { Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ASSIGNABLE_ROLES, roleLabel, type Option, type UserInput, type UserRole } from '../../user.models';

/**
 * Create modal for an account (design.md §3 "Create/Edit modal"). Create-only:
 * the backend exposes no update endpoint, so there is no edit mode.
 * Presentational — emits {@link save} with a clean {@link UserInput}; the
 * parent performs the request and closes the modal.
 */
@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './user-form.html',
})
export class UserForm {
  private readonly fb = inject(FormBuilder);

  /** Members the account can be attached to. */
  readonly profiles = input<Option[]>([]);
  readonly busy = input(false);
  /** Server-side failure to show inside the modal, if any. */
  readonly error = input<string | null>(null);

  readonly save = output<UserInput>();
  readonly cancel = output<void>();

  protected readonly roles = ASSIGNABLE_ROLES;
  protected readonly roleLabel = roleLabel;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['', [Validators.required]],
    profileUuid: ['', [Validators.required]],
  });

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.save.emit({
      email: v.email,
      role: v.role as UserRole,
      profileUuid: v.profileUuid,
    });
  }
}
