import { Component, inject, input, OnInit, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';

import {
  MemberAutocomplete,
  type MemberValue,
} from '../../../../shared/ui/member-autocomplete/member-autocomplete';
import { toNameCase } from '../../../../shared/util/text.util';
import {
  ATTENDANCE_REASON_OPTIONS,
  type AttendanceType,
  type OutreachAttendanceInput,
} from '../../outreach.models';

const EMPTY_MEMBER: MemberValue = { uuid: null, label: '' };

/** The member must be an actual pick from the list — free text is rejected. */
function memberPicked(control: AbstractControl): ValidationErrors | null {
  const value = control.value as MemberValue | null;
  return value && value.uuid != null ? null : { memberRequired: true };
}

/** Add or drop the `required` validator on a control, then re-validate it. */
function setRequired(control: AbstractControl, required: boolean): void {
  if (required) {
    control.addValidators(Validators.required);
  } else {
    control.removeValidators(Validators.required);
  }
  control.updateValueAndValidity({ emitEvent: false });
}

/**
 * Modal for adding one presence to a sortie (design.md §3 "Create/Edit modal").
 * The sortie is implied by the page, so it has no picker. A member is searched
 * by name through the shared autocomplete and linked to their profile; a guest
 * gives a name, optionally how they came, and who invited them — required only
 * for an invitation.
 *
 * Presentational: emits {@link save}; the parent performs the request. There is
 * no edit mode — a wrong presence is removed from its row and added again.
 */
@Component({
  selector: 'app-outreach-attendance-form',
  imports: [ReactiveFormsModule, MemberAutocomplete],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './outreach-attendance-form.html',
})
export class OutreachAttendanceForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly busy = input(false);
  /** Backend refusal for the last save (e.g. member already recorded). */
  readonly error = input<string | null>(null);

  readonly save = output<OutreachAttendanceInput>();
  readonly cancel = output<void>();

  protected readonly reasonOptions = ATTENDANCE_REASON_OPTIONS;

  protected readonly form = this.fb.nonNullable.group({
    type: ['MEMBER' as AttendanceType],
    member: [{ ...EMPTY_MEMBER } as MemberValue],
    firstname: [''],
    lastname: [''],
    reason: [''],
    invitedBy: [''],
  });

  constructor() {
    const c = this.form.controls;
    c.type.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncValidators());
    c.reason.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncValidators());
  }

  ngOnInit(): void {
    this.syncValidators();
  }

  protected get isMember(): boolean {
    return this.form.controls.type.value === 'MEMBER';
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  /** Capitalize a name once the field is left — per keystroke would jump the caret. */
  protected capitalize(field: 'firstname' | 'lastname'): void {
    const control = this.form.controls[field];
    control.setValue(toNameCase(control.value.trim()));
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const member = v.type === 'MEMBER';
    this.save.emit({
      type: v.type,
      profileUuid: member ? v.member.uuid : null,
      firstname: member ? null : v.firstname,
      lastname: member ? null : v.lastname,
      reason: member || !v.reason ? null : (v.reason as OutreachAttendanceInput['reason']),
      invitedBy: member ? null : v.invitedBy,
    });
  }

  /** Required fields follow the type (and, for a guest, the reason). */
  private syncValidators(): void {
    const c = this.form.controls;
    const member = c.type.value === 'MEMBER';
    // The member field carries an object, so it needs its own "was picked" rule
    // rather than `required`, which an empty label object would already satisfy.
    if (member) {
      c.member.addValidators(memberPicked);
    } else {
      c.member.removeValidators(memberPicked);
    }
    c.member.updateValueAndValidity({ emitEvent: false });
    setRequired(c.firstname, !member);
    setRequired(c.lastname, !member);
    setRequired(c.invitedBy, !member && c.reason.value === 'INVITATION');
  }
}
