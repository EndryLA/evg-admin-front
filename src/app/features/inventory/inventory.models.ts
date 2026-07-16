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

/** A stock item, mapped from the backend `InventoryItemResponse`. */
export interface InventoryItem {
  uuid: string;
  name: string;
  quantity: number;
  stockLocation: string;
  /** Member responsible for the item, if any. */
  managedBy: ProfileRef | null;
}

/** Editable fields when creating or updating an item (`InventoryItemRequest`). */
export interface InventoryInput {
  name: string;
  quantity: number;
  stockLocation: string;
  managedByUuid: string | null;
}

/** Selectable member option for the form picker. */
export interface Option {
  uuid: string;
  label: string;
}
