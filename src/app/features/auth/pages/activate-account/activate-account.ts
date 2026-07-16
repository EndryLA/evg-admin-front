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

/**
 * Handles both halves of activation: with a `token` query param the user sets
 * their password (confirm); without one they request an activation link.
 */
@Component({
  selector: 'app-activate-account',
  imports: [ReactiveFormsModule, RouterLink, AuthCard],
  templateUrl: './activate-account.html',
})
export class ActivateAccount {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected readonly hasToken = computed(() => this.token.length > 0);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal(false);

  protected readonly requestForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly confirmForm = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected requestLink(): void {
    if (this.requestForm.invalid || this.submitting()) {
      this.requestForm.markAllAsTouched();
      return;
    }
    this.begin();
    this.auth.requestActivation(this.requestForm.getRawValue().email).subscribe({
      next: () => this.done.set(true),
      error: (err) =>
        this.fail(err, "Envoi impossible pour le moment. Réessayez."),
    });
  }

  protected confirm(): void {
    if (this.confirmForm.invalid || this.submitting()) {
      this.confirmForm.markAllAsTouched();
      return;
    }
    this.begin();
    this.auth
      .confirmActivation({ token: this.token, password: this.confirmForm.getRawValue().password })
      .subscribe({
        next: () => this.done.set(true),
        error: (err) =>
          this.fail(err, 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.'),
      });
  }

  private begin(): void {
    this.submitting.set(true);
    this.error.set(null);
  }

  private fail(err: unknown, fallback: string): void {
    this.error.set(messageFromError(err, fallback));
    this.submitting.set(false);
  }
}
