import { Component, computed, inject, input, OnInit, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import type { InventoryInput, InventoryItem, Option } from '../../inventory.models';

/**
 * Create/edit modal for an inventory item (design.md §3 "Create/Edit modal").
 * Presentational: emits {@link save} with a clean {@link InventoryInput}; the
 * parent performs the request and closes the modal.
 */
@Component({
  selector: 'app-inventory-form',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './inventory-form.html',
})
export class InventoryForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  /** Item to edit, or `null` to create a new one. */
  readonly item = input<InventoryItem | null>(null);
  /** Members selectable as the item's responsible. */
  readonly profiles = input<Option[]>([]);
  readonly busy = input(false);

  readonly save = output<InventoryInput>();
  readonly cancel = output<void>();

  protected readonly isEdit = computed(() => this.item() !== null);
  protected readonly title = computed(() => this.item()?.name || 'Nouvel article');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    quantity: [0, [Validators.required, Validators.min(0)]],
    stockLocation: [''],
    managedByUuid: [''],
  });

  ngOnInit(): void {
    const item = this.item();
    if (item) {
      this.form.setValue({
        name: item.name,
        quantity: item.quantity,
        stockLocation: item.stockLocation,
        managedByUuid: item.managedBy?.uuid ?? '',
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
      quantity: Number(v.quantity) || 0,
      stockLocation: v.stockLocation,
      managedByUuid: v.managedByUuid || null,
    });
  }
}
