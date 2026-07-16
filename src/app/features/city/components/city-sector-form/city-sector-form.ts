import { Component, computed, inject, OnInit, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import type { City } from '../../city.models';

/**
 * Modal to assign a sector number to a commune (design.md §3 "Create/Edit
 * modal", reduced to a single field). Presentational: emits {@link save} with
 * the chosen sector; the parent performs the PATCH and closes the modal.
 */
@Component({
  selector: 'app-city-sector-form',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './city-sector-form.html',
  styles: `.modal__sub { margin: 5px 0 0; font-size: 13px; color: var(--text-muted); }`,
})
export class CitySectorForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly city = input.required<City>();
  readonly busy = input(false);

  readonly save = output<number>();
  readonly cancel = output<void>();

  protected readonly subtitle = computed(() => {
    const c = this.city();
    return [c.postalCode, c.departmentName].filter(Boolean).join(' · ');
  });

  protected readonly form = this.fb.nonNullable.group({
    sector: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    const current = this.city().sector;
    if (current != null) {
      this.form.controls.sector.setValue(current);
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit(Number(this.form.getRawValue().sector));
  }
}
