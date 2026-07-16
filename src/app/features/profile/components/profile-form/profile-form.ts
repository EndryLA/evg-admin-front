import { Component, computed, inject, input, OnInit, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  fullName,
  type Profile,
  type ProfileFormResult,
} from '../../profile.models';

/** ISO datetime → `YYYY-MM-DD` for a native date input. */
function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

/**
 * Create/edit modal for a profile (design.md §3 "Create/Edit modal").
 * Presentational: emits {@link save} with a clean {@link ProfileInput}; the
 * parent performs the request and closes the modal.
 */
@Component({
  selector: 'app-profile-form',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './profile-form.html',
})
export class ProfileForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  /** Profile to edit, or `null` to create a new one. */
  readonly profile = input<Profile | null>(null);
  /** Team leaders selectable as this member's "Responsable". */
  readonly leaders = input<Profile[]>([]);
  readonly busy = input(false);

  readonly save = output<ProfileFormResult>();
  readonly cancel = output<void>();

  /** Leaders offered in the dropdown, excluding the profile being edited. */
  protected readonly leaderOptions = computed(() => {
    const editingUuid = this.profile()?.uuid;
    return this.leaders().filter((l) => l.uuid !== editingUuid);
  });

  protected readonly isEdit = computed(() => this.profile() !== null);
  protected readonly title = computed(() => {
    const p = this.profile();
    return p ? fullName(p) : 'Nouveau profil';
  });

  protected readonly form = this.fb.nonNullable.group({
    firstname: ['', [Validators.required]],
    lastname: ['', [Validators.required]],
    phoneNumber: [''],
    email: ['', [Validators.email]],
    birthDate: [''],
    joinedAt: [''],
    membershipType: ['OUVRIER' as 'OUVRIER' | 'AIDE'],
    firstDepartment: [false],
    leaderUuid: [''],
  });

  ngOnInit(): void {
    const p = this.profile();
    if (p) {
      this.form.setValue({
        firstname: p.firstname,
        lastname: p.lastname,
        phoneNumber: p.phoneNumber ?? '',
        email: p.email ?? '',
        birthDate: toDateInput(p.birthDate),
        joinedAt: p.joinedAt != null ? String(p.joinedAt) : '',
        membershipType: p.membershipType ?? 'OUVRIER',
        firstDepartment: p.firstDepartment,
        leaderUuid: p.leaderUuid ?? '',
      });
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.save.emit({
      input: {
        firstname: v.firstname,
        lastname: v.lastname,
        phoneNumber: v.phoneNumber || null,
        email: v.email || null,
        birthDate: v.birthDate || null,
        joinedAt: v.joinedAt ? Number(v.joinedAt) : null,
        membershipType: v.membershipType,
        firstDepartment: v.firstDepartment,
      },
      leaderUuid: v.leaderUuid || null,
    });
  }
}
