/** Minimal reference to a member, embedded in inventory responses. */
export interface ProfileRef {
  uuid: string;
  firstname: string;
  lastname: string;
}

/** Full name helper for a {@link ProfileRef}. */
export function refName(profile: ProfileRef | null): string {
  if (!profile) {
    return '—';
  }
  return `${profile.firstname} ${profile.lastname}`.trim() || '—';
}

/** What a stock item is, as emitted by the backend `InventoryItem.ItemType`. */
export type ItemType = 'FLYER' | 'EQUIPMENT';

/** French labels for {@link ItemType}. */
export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  FLYER: 'Flyer',
  EQUIPMENT: 'Matériel',
};

/** Selectable item types, in form order. */
export const ITEM_TYPES: readonly ItemType[] = ['FLYER', 'EQUIPMENT'];

/** A stock item, mapped from the backend `InventoryItemResponse`. */
export interface InventoryItem {
  uuid: string;
  name: string;
  /** Decides which operations may be recorded against the item. */
  type: ItemType;
  quantity: number;
  stockLocation: string;
  /** Member responsible for the item, if any. */
  managedBy: ProfileRef | null;
}

/** Editable fields when creating or updating an item (`InventoryItemRequest`). */
export interface InventoryInput {
  name: string;
  type: ItemType;
  quantity: number;
  stockLocation: string;
  managedByUuid: string | null;
}

/**
 * A stock movement, as emitted by the backend `InventoryOperation.OperationType`.
 * Each type belongs to exactly one {@link ItemType} — see {@link OPERATION_TYPES}.
 */
export type OperationType = 'RECEPTION' | 'DISTRIBUTION' | 'USE' | 'RETRIEVAL' | 'RETURN';

/** French labels for {@link OperationType}. */
export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  RECEPTION: 'Réception',
  DISTRIBUTION: 'Distribution',
  USE: 'Utilisation',
  RETRIEVAL: 'Retrait',
  RETURN: 'Retour',
};

/**
 * Mirrors the backend enum: which item type an operation applies to, how it
 * moves stock, and whether it names a recipient. The backend rejects a
 * mismatched pair (`OperationTypeMismatchException`), so the UI only ever
 * offers the operations {@link operationsFor} allows.
 */
interface OperationMeta {
  itemType: ItemType;
  /** Effect on stock: 1 adds, -1 removes. */
  sign: 1 | -1;
  /** Label for the `distributedTo` field, or `null` when it doesn't apply. */
  recipientLabel: string | null;
  /** One-line explanation shown under the operation picker. */
  hint: string;
}

const OPERATION_TYPES: Record<OperationType, OperationMeta> = {
  RECEPTION: {
    itemType: 'FLYER',
    sign: 1,
    recipientLabel: null,
    hint: 'Nouveaux flyers reçus, ajoutés au stock.',
  },
  DISTRIBUTION: {
    itemType: 'FLYER',
    sign: -1,
    recipientLabel: 'Distribué à',
    hint: 'Flyers remis à une personne ou une équipe.',
  },
  USE: {
    itemType: 'FLYER',
    sign: -1,
    recipientLabel: null,
    hint: 'Flyers utilisés par le département lui-même.',
  },
  RETRIEVAL: {
    itemType: 'EQUIPMENT',
    sign: -1,
    recipientLabel: null,
    hint: 'Matériel retiré du stock.',
  },
  RETURN: {
    itemType: 'EQUIPMENT',
    sign: 1,
    recipientLabel: null,
    hint: 'Matériel rendu et remis en stock.',
  },
};

/** The operations recordable against an item of `type`, in display order. */
export function operationsFor(type: ItemType): OperationType[] {
  return (Object.keys(OPERATION_TYPES) as OperationType[]).filter(
    (op) => OPERATION_TYPES[op].itemType === type,
  );
}

/** Effect of `type` on stock: 1 adds, -1 removes. */
export function operationSign(type: OperationType): 1 | -1 {
  return OPERATION_TYPES[type].sign;
}

/** Label for the recipient field, or `null` when `type` names no recipient. */
export function recipientLabel(type: OperationType): string | null {
  return OPERATION_TYPES[type].recipientLabel;
}

/** One-line explanation of what `type` means. */
export function operationHint(type: OperationType): string {
  return OPERATION_TYPES[type].hint;
}

/** Signed quantity for display, e.g. `+500` / `−200`. */
export function signedQuantity(type: OperationType, quantity: number): string {
  return `${operationSign(type) > 0 ? '+' : '−'}${quantity}`;
}

/** A recorded stock movement, mapped from `InventoryOperationResponse`. */
export interface InventoryOperation {
  uuid: string;
  type: OperationType;
  quantity: number;
  /** Who recorded the movement. */
  effectuatedBy: ProfileRef | null;
  /** Recipient, when the operation names one. */
  distributedTo: string;
  notes: string;
  createdAt: string;
}

/** Payload recording a movement (`InventoryOperationRequest`). */
export interface InventoryOperationInput {
  itemUuid: string;
  type: OperationType;
  effectuatedByUuid: string;
  quantity: number;
  distributedTo: string;
  notes: string;
}

/** Selectable member option for the form picker. */
export interface Option {
  uuid: string;
  label: string;
}
