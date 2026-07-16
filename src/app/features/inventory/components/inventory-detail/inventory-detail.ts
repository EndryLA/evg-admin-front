import { Component, computed, input, output } from '@angular/core';

import { refName, type InventoryItem } from '../../inventory.models';

/**
 * Right-hand slide-over showing one item's full detail, with Modifier /
 * Supprimer actions. Purely presentational — the parent owns the data.
 */
@Component({
  selector: 'app-inventory-detail',
  host: { class: 'slideover', '(keydown.escape)': 'close.emit()' },
  templateUrl: './inventory-detail.html',
})
export class InventoryDetail {
  readonly item = input.required<InventoryItem>();

  readonly close = output<void>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  protected readonly responsible = computed(() => refName(this.item().managedBy));
}
