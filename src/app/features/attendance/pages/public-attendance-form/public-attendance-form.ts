import { NgOptimizedImage } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { messageFromError } from '../../../../core/http/http-error.util';
import { AttendanceService } from '../../attendance.service';
import type { AttendanceType } from '../../attendance.models';

/**
 * Public, unauthenticated form (`/sortie/:uuid/presence`) for recording a
 * person's presence at an outreach — filled in on the spot. Submits to the
 * attendance endpoint with the outreach from the route and shows a confirmation.
 */
@Component({
  selector: 'app-public-attendance-form',
  imports: [ReactiveFormsModule, NgOptimizedImage],
  templateUrl: './public-attendance-form.html',
  styleUrl: './public-attendance-form.scss',
})
export class PublicAttendanceForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AttendanceService);

  /** Outreach id from the route, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly outreachName = signal('');

  protected readonly form = this.fb.nonNullable.group({
    firstname: ['', [Validators.required]],
    lastname: ['', [Validators.required]],
    invitedBy: [''],
    type: ['GUEST' as AttendanceType, [Validators.required]],
  });

  ngOnInit(): void {
    // Best-effort context: show which outreach this is, if the lookup succeeds.
    this.service.outreachName(this.uuid()).subscribe((name) => this.outreachName.set(name));
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.service
      .submitPublic(this.uuid(), {
        firstname: v.firstname,
        lastname: v.lastname,
        invitedBy: v.invitedBy,
        type: v.type,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(messageFromError(err, 'Envoi impossible. Veuillez réessayer.'));
        },
      });
  }

  /** Reset the form to accept another submission. */
  protected again(): void {
    this.form.reset({ type: 'GUEST' });
    this.submitted.set(false);
  }
}
