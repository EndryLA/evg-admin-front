import { Component, inject, input, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { BrandLogo } from '../../../../shared/ui/brand-logo/brand-logo';
import { messageFromError } from '../../../../core/http/http-error.util';
import {
  MemberAutocomplete,
  type MemberValue,
} from '../../../../shared/ui/member-autocomplete/member-autocomplete';
import { toNameCase } from '../../../../shared/util/text.util';
import { AttendanceService } from '../../attendance.service';
import { ATTENDANCE_REASON_OPTIONS, type AttendanceReason } from '../../attendance.models';

/**
 * How the visitor takes part: department member, guest, or block leader — the
 * last one records nothing here.
 */
type Branch = 'MEMBER' | 'GUEST' | 'LEADER';

/** Initial/reset value for the member field: no pick, empty label. */
const EMPTY_MEMBER: MemberValue = { uuid: null, label: '' };

/** The member must be an actual pick from the list — free text is rejected. */
function memberPicked(control: AbstractControl): ValidationErrors | null {
  const value = control.value as MemberValue | null;
  return value && value.uuid != null ? null : { memberRequired: true };
}

/**
 * Public, unauthenticated form (`/sortie/:uuid/presence`) for recording a
 * person's presence at an outreach. First asks in which capacity the visitor is
 * there: a member picks themselves from an autocomplete (linking their profile);
 * a guest gives their name and how they came — with "invité par" shown only for
 * an invitation; a block leader has nothing to record here and only sees a note.
 */
@Component({
  selector: 'app-public-attendance-form',
  imports: [ReactiveFormsModule, BrandLogo, MemberAutocomplete, RouterLink],
  templateUrl: './public-attendance-form.html',
  styleUrl: './public-attendance-form.scss',
})
export class PublicAttendanceForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AttendanceService);

  /** Outreach id from the route, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly reasonOptions = ATTENDANCE_REASON_OPTIONS;

  /** Step-1 branch: null until the visitor answers "Vous participez en tant que… ?". */
  protected readonly branch = signal<Branch | null>(null);

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly outreachName = signal('');

  protected readonly memberForm = this.fb.nonNullable.group({
    member: [{ ...EMPTY_MEMBER } as MemberValue, [memberPicked]],
  });

  protected readonly guestForm = this.fb.nonNullable.group({
    firstname: ['', [Validators.required]],
    lastname: ['', [Validators.required]],
    reason: ['' as AttendanceReason | '', [Validators.required]],
    invitedBy: [''],
  });

  constructor() {
    // "Invité par" is required only when the guest came through an invitation.
    this.guestForm.controls.reason.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((reason) => {
        const invitedBy = this.guestForm.controls.invitedBy;
        if (reason === 'INVITATION') {
          invitedBy.addValidators(Validators.required);
        } else {
          invitedBy.removeValidators(Validators.required);
          invitedBy.setValue('', { emitEvent: false });
        }
        invitedBy.updateValueAndValidity({ emitEvent: false });
      });
  }

  ngOnInit(): void {
    // Best-effort context: show which outreach this is, if the lookup succeeds.
    this.service.outreachName(this.uuid()).subscribe((name) => this.outreachName.set(name));
  }

  /** Pick the capacity branch and clear any stale error. */
  protected choose(branch: Branch): void {
    this.error.set(null);
    this.branch.set(branch);
  }

  /** Return to the capacity question, keeping entered values. */
  protected back(): void {
    this.error.set(null);
    this.branch.set(null);
  }

  protected get showInvitedBy(): boolean {
    return this.guestForm.controls.reason.value === 'INVITATION';
  }

  /**
   * Capitalize a name field once the user leaves it — doing it per keystroke
   * would send the caret to the end mid-word.
   */
  protected capitalize(field: 'firstname' | 'lastname'): void {
    const control = this.guestForm.controls[field];
    control.setValue(toNameCase(control.value.trim()), { emitEvent: false });
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    const branch = this.branch();
    if (branch === null || branch === 'LEADER') {
      return;
    }
    const form = branch === 'MEMBER' ? this.memberForm : this.guestForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const payload =
      branch === 'MEMBER'
        ? {
            type: 'MEMBER' as const,
            profileUuid: this.memberForm.getRawValue().member.uuid,
            firstname: '',
            lastname: '',
            invitedBy: '',
            reason: null,
          }
        : (() => {
            const v = this.guestForm.getRawValue();
            return {
              type: 'GUEST' as const,
              profileUuid: null,
              firstname: v.firstname,
              lastname: v.lastname,
              invitedBy: v.reason === 'INVITATION' ? v.invitedBy : '',
              reason: v.reason as AttendanceReason,
            };
          })();

    this.service.submitPublic(this.uuid(), payload).subscribe({
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

  /** Reset both branches to accept another submission. */
  protected again(): void {
    this.memberForm.reset({ member: { ...EMPTY_MEMBER } });
    this.guestForm.reset({ firstname: '', lastname: '', reason: '', invitedBy: '' });
    this.branch.set(null);
    this.submitted.set(false);
  }
}
