import { Component, computed, inject, input, OnInit, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import type { Branch, BranchInput, Option } from '../../branch.models';

/**
 * Create/edit modal for a branch (design.md §3 "Create/Edit modal").
 * Presentational: emits {@link save} with a clean {@link BranchInput}; the
 * parent performs the request and closes the modal.
 */
@Component({
  selector: 'app-branch-form',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './branch-form.html',
})
export class BranchForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  /** Branch to edit, or `null` to create a new one. */
  readonly branch = input<Branch | null>(null);
  /** Members selectable as the branch responsible. */
  readonly profiles = input<Option[]>([]);
  readonly busy = input(false);

  readonly save = output<BranchInput>();
  readonly cancel = output<void>();

  protected readonly isEdit = computed(() => this.branch() !== null);
  protected readonly title = computed(() => this.branch()?.name || 'Nouvelle branche');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    responsibleUuid: [''],
    description: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const b = this.branch();
    if (b) {
      this.form.setValue({
        name: b.name,
        responsibleUuid: b.responsible?.uuid ?? '',
        description: b.description,
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
      name: v.name,
      description: v.description,
      responsibleUuid: v.responsibleUuid || null,
    });
  }
}
