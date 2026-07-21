import { Component, computed, input, output } from '@angular/core';

import { formatDateFr, formatTimeFr } from '../../../../shared/util/date.util';
import {
  ITEM_TYPE_LABELS,
  OPERATION_TYPE_LABELS,
  operationSign,
  recipientLabel,
  refName,
  signedQuantity,
  type InventoryItem,
  type InventoryOperation,
} from '../../inventory.models';

/**
 * Read-only modal showing one recorded stock movement in full — the place the
 * history list defers its detail to (notes and, for a distribution, the
 * recipient). Presentational: emits {@link close}; the parent owns visibility.
 *
 * Which rows it shows follows the operation, mirroring the list: equipment
 * moves one unit so it hides the quantity, and only operations that name a
 * recipient show one.
 */
@Component({
  selector: 'app-inventory-operation-detail',
  imports: [],
  host: { class: 'modal-form', '(keydown.escape)': 'close.emit()' },
  templateUrl: './inventory-operation-detail.html',
  styleUrl: './inventory-operation-detail.scss',
})
export class InventoryOperationDetail {
  readonly operation = input.required<InventoryOperation>();
  readonly item = input.required<InventoryItem>();
  readonly close = output<void>();

  protected readonly typeLabels = OPERATION_TYPE_LABELS;
  protected readonly refName = refName;

  protected readonly itemTypeLabel = computed(() => ITEM_TYPE_LABELS[this.item().type]);
  protected readonly isEquipment = computed(() => this.item().type === 'EQUIPMENT');
  protected readonly isInbound = computed(() => operationSign(this.operation().type) > 0);
  protected readonly signedQty = computed(() =>
    signedQuantity(this.operation().type, this.operation().quantity),
  );
  /** Label for the recipient row, present only when the operation names one. */
  protected readonly recipientLabel = computed(() => recipientLabel(this.operation().type));
  protected readonly timestamp = computed(
    () =>
      `${formatDateFr(this.operation().createdAt)} · ${formatTimeFr(this.operation().createdAt)}`,
  );
}
