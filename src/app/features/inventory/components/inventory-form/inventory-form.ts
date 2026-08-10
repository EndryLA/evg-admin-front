import { Component, computed, inject, input, OnInit, output } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import {
  MemberAutocomplete,
  type MemberValue,
} from '../../../../shared/ui/member-autocomplete/member-autocomplete';
import {
  ITEM_TYPE_LABELS,
  ITEM_TYPES,
  type InventoryInput,
  type InventoryItem,
  type ItemType,
} from '../../inventory.models';

const EMPTY_MEMBER: MemberValue = { uuid: null, label: '' };

/**
 * The responsible is optional, but a typed name that was never picked from the
 * suggestions has no uuid and cannot be saved — flag it rather than dropping it.
 */
function memberPickedOrEmpty(control: AbstractControl): ValidationErrors | null {
  const value = control.value as MemberValue | null;
  if (!value || (!value.uuid && !value.label.trim())) {
    return null;
  }
  return value.uuid ? null : { memberNotPicked: true };
}

/**
 * Create/edit modal for an inventory item (design.md §3 "Create/Edit modal").
 * Presentational: emits {@link save} with a clean {@link InventoryInput}; the
 * parent performs the request and closes the modal.
 */
@Component({
  selector: 'app-inventory-form',
  imports: [ReactiveFormsModule, MemberAutocomplete],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './inventory-form.html',
})
export class InventoryForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  /** Item to edit, or `null` to create a new one. */
  readonly item = input<InventoryItem | null>(null);
  readonly busy = input(false);

  readonly save = output<InventoryInput>();
  readonly cancel = output<void>();

  protected readonly isEdit = computed(() => this.item() !== null);
  protected readonly title = computed(() => this.item()?.name || 'Nouvel article');

  protected readonly itemTypes = ITEM_TYPES;
  protected readonly itemTypeLabels = ITEM_TYPE_LABELS;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    type: ['FLYER' as ItemType, [Validators.required]],
    quantity: [0, [Validators.required, Validators.min(0)]],
    stockLocation: [''],
    managedBy: [{ ...EMPTY_MEMBER } as MemberValue, [memberPickedOrEmpty]],
  });

  ngOnInit(): void {
    const item = this.item();
    if (item) {
      const managedBy = item.managedBy;
      this.form.setValue({
        name: item.name,
        type: item.type,
        quantity: item.quantity,
        stockLocation: item.stockLocation,
        managedBy: managedBy
          ? {
              uuid: managedBy.uuid,
              label: `${managedBy.firstname} ${managedBy.lastname}`.trim(),
            }
          : { ...EMPTY_MEMBER },
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
      type: v.type,
      quantity: Number(v.quantity) || 0,
      stockLocation: v.stockLocation,
      managedByUuid: v.managedBy.uuid,
    });
  }
}
