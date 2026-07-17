import type {
  InventoryInput,
  InventoryItem,
  InventoryOperation,
  InventoryOperationInput,
  ItemType,
  OperationType,
  ProfileRef,
} from './inventory.models';

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
  type?: string | null;
  quantity?: number | null;
  stockLocation?: string | null;
  managedBy?: RawProfile | null;
}

/** Raw `InventoryOperationResponse`. */
export interface RawInventoryOperation {
  uuid?: string;
  item?: RawInventoryItem | null;
  type?: string | null;
  effectuatedBy?: RawProfile | null;
  quantity?: number | null;
  distributedTo?: string | null;
  notes?: string | null;
  createdAt?: string | null;
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

/** Fall back to `EQUIPMENT` for anything unrecognised — it's the type with the
 *  narrower operation set, so an unknown value can't unlock flyer operations. */
function toItemType(raw: string | null | undefined): ItemType {
  return raw === 'FLYER' ? 'FLYER' : 'EQUIPMENT';
}

/** Map a raw inventory item to the clean domain model. */
export function toInventoryItem(raw: RawInventoryItem): InventoryItem {
  return {
    uuid: raw.uuid ?? '',
    name: raw.name ?? '',
    type: toItemType(raw.type),
    quantity: raw.quantity ?? 0,
    stockLocation: raw.stockLocation ?? '',
    managedBy: toProfileRef(raw.managedBy),
  };
}

/** Map a raw operation to the clean domain model. */
export function toInventoryOperation(raw: RawInventoryOperation): InventoryOperation {
  return {
    uuid: raw.uuid ?? '',
    type: (raw.type ?? 'RECEPTION') as OperationType,
    quantity: raw.quantity ?? 0,
    effectuatedBy: toProfileRef(raw.effectuatedBy),
    distributedTo: raw.distributedTo ?? '',
    notes: raw.notes ?? '',
    createdAt: raw.createdAt ?? '',
  };
}

/** Map a domain input to the raw `InventoryOperationRequest`. */
export function toRawOperationRequest(input: InventoryOperationInput): {
  itemUuid: string;
  type: OperationType;
  effectuatedByUuid: string;
  quantity: number;
  distributedTo?: string;
  notes?: string;
} {
  return {
    itemUuid: input.itemUuid,
    type: input.type,
    effectuatedByUuid: input.effectuatedByUuid,
    quantity: input.quantity,
    distributedTo: input.distributedTo.trim() || undefined,
    notes: input.notes.trim() || undefined,
  };
}

/** Map a domain input to the raw `InventoryItemRequest`. */
export function toRawInventoryRequest(input: InventoryInput): {
  name: string;
  type: ItemType;
  quantity: number;
  stockLocation?: string;
  managedByUuid?: string;
} {
  return {
    name: input.name.trim(),
    type: input.type,
    quantity: input.quantity,
    stockLocation: input.stockLocation.trim() || undefined,
    managedByUuid: input.managedByUuid || undefined,
  };
}
