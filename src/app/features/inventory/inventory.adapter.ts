import type { InventoryInput, InventoryItem, ProfileRef } from './inventory.models';

/** Raw Spring `Page<T>` envelope (only fields we consume). */
export interface RawPage<T> {
  content?: T[];
}

/** Raw `ProfileResponse` (subset embedded in inventory responses). */
export interface RawProfile {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}

/** Raw `InventoryItemResponse`. */
export interface RawInventoryItem {
  uuid?: string;
  name?: string;
  quantity?: number | null;
  stockLocation?: string | null;
  managedBy?: RawProfile | null;
}

function toProfileRef(raw: RawProfile | null | undefined): ProfileRef | null {
  if (!raw?.uuid) {
    return null;
  }
  return {
    uuid: raw.uuid,
    firstname: raw.firstname ?? '',
    lastname: raw.lastname ?? '',
  };
}

/** Map a raw inventory item to the clean domain model. */
export function toInventoryItem(raw: RawInventoryItem): InventoryItem {
  return {
    uuid: raw.uuid ?? '',
    name: raw.name ?? '',
    quantity: raw.quantity ?? 0,
    stockLocation: raw.stockLocation ?? '',
    managedBy: toProfileRef(raw.managedBy),
  };
}

/** Map a domain input to the raw `InventoryItemRequest`. */
export function toRawInventoryRequest(input: InventoryInput): {
  name: string;
  quantity: number;
  stockLocation?: string;
  managedByUuid?: string;
} {
  return {
    name: input.name.trim(),
    quantity: input.quantity,
    stockLocation: input.stockLocation.trim() || undefined,
    managedByUuid: input.managedByUuid || undefined,
  };
}
