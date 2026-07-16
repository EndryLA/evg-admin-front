import { Component, computed, inject, signal } from '@angular/core';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { AuthCard } from '../../components/auth-card/auth-card';

const passwordsMatch: ValidatorFn = (group: AbstractControl) => {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
};

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, AuthCard],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected readonly hasToken = computed(() => this.token.length > 0);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);

    this.auth
      .resetPassword({ token: this.token, newPassword: this.form.getRawValue().password })
      .subscribe({
        next: () => this.done.set(true),
        error: (err) => {
          this.error.set(
            messageFromError(err, 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.'),
          );
          this.submitting.set(false);
        },
      });
  }
}
