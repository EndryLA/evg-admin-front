import { Component, computed, inject, input, OnInit, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  ITEM_TYPE_LABELS,
  OPERATION_TYPE_LABELS,
  operationHint,
  operationSign,
  operationsFor,
  recipientLabel,
  type InventoryItem,
  type InventoryOperationInput,
  type OperationType,
  type Option,
} from '../../inventory.models';

/**
 * Modal recording one stock movement against an item (design.md §3
 * "Create/Edit modal"). The operation picker only offers the types the item's
 * own type allows — flyers take Réception/Distribution/Utilisation, matériel
 * takes Sortie/Retour — mirroring the backend's own rule.
 *
 * Presentational: emits {@link save}; the parent performs the request, owns
 * {@link busy} / {@link error} and closes the modal.
 */
@Component({
  selector: 'app-inventory-operation-form',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './inventory-operation-form.html',
  styleUrl: './inventory-operation-form.scss',
})
export class InventoryOperationForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly item = input.required<InventoryItem>();
  /** Operation to preselect — the action button the user pressed. */
  readonly type = input.required<OperationType>();
  /** Members selectable as the one who performed the operation. */
  readonly profiles = input<Option[]>([]);
  /** Signed-in member, preselected in the "Effectué par" picker when known. */
  readonly defaultProfileUuid = input<string | null>(null);
  readonly busy = input(false);
  /** Backend failure to surface in the modal (type mismatch, stock too low). */
  readonly error = input<string | null>(null);

  readonly save = output<InventoryOperationInput>();
  readonly cancel = output<void>();

  protected readonly itemTypeLabel = computed(() => ITEM_TYPE_LABELS[this.item().type]);
  protected readonly choices = computed(() => operationsFor(this.item().type));
  protected readonly typeLabels = OPERATION_TYPE_LABELS;

  protected readonly form = this.fb.nonNullable.group({
    type: ['RECEPTION' as OperationType, [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    effectuatedByUuid: ['', [Validators.required]],
    distributedTo: [''],
    notes: [''],
  });

  /* Mirror the `type` / `quantity` controls as signals so the hint, the
     recipient field and the projected stock react to them. ngOnInit's
     patchValue emits, so these pick up the real starting values. */
  private readonly picked = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  protected readonly quantity = toSignal(this.form.controls.quantity.valueChanges, {
    initialValue: this.form.controls.quantity.value,
  });

  protected readonly hint = computed(() => operationHint(this.picked()));
  protected readonly recipient = computed(() => recipientLabel(this.picked()));

  /** Stock this operation would leave behind — the backend refuses below zero. */
  protected readonly projected = computed(() => {
    const delta = operationSign(this.picked()) * (Number(this.quantity()) || 0);
    return this.item().quantity + delta;
  });
  protected readonly wouldOverdraw = computed(() => this.projected() < 0);

  ngOnInit(): void {
    this.form.patchValue({
      type: this.type(),
      effectuatedByUuid: this.defaultProfileUuid() ?? '',
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.busy() || this.wouldOverdraw()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.save.emit({
      itemUuid: this.item().uuid,
      type: v.type,
      effectuatedByUuid: v.effectuatedByUuid,
      quantity: Number(v.quantity) || 0,
      // Only the operations that name a recipient carry one.
      distributedTo: this.recipient() ? v.distributedTo : '',
      notes: v.notes,
    });
  }
}
