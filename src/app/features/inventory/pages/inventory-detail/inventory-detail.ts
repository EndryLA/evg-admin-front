import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { formatDateFr, formatTimeFr } from '../../../../shared/util/date.util';
import { InventoryForm } from '../../components/inventory-form/inventory-form';
import { InventoryOperationForm } from '../../components/inventory-operation-form/inventory-operation-form';
import { InventoryOperationService } from '../../inventory-operation.service';
import { InventoryService } from '../../inventory.service';
import {
  ITEM_TYPE_LABELS,
  OPERATION_TYPE_LABELS,
  operationSign,
  operationsFor,
  refName,
  signedQuantity,
  type InventoryInput,
  type InventoryItem,
  type InventoryOperation,
  type InventoryOperationInput,
  type OperationType,
  type Option,
} from '../../inventory.models';

/**
 * Full-page detail for one inventory item (`/inventaire/:uuid`). Loads the item
 * and its stock movements, and hosts the edit modal, the delete confirmation
 * and the record-operation modal.
 *
 * Which operations it offers depends on the item's type — flyers take
 * Réception/Distribution/Utilisation, matériel takes Sortie/Retour — so the
 * page never proposes one the backend would reject.
 */
@Component({
  selector: 'app-inventory-detail-page',
  imports: [RouterLink, InventoryForm, InventoryOperationForm, ConfirmDialog],
  host: { class: 'detail-page' },
  templateUrl: './inventory-detail.html',
  styleUrl: './inventory-detail.scss',
})
export class InventoryDetailPage implements OnInit {
  private readonly service = inject(InventoryService);
  private readonly operationService = inject(InventoryOperationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly item = signal<InventoryItem | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly operations = signal<InventoryOperation[]>([]);
  protected readonly operationsLoading = signal(true);
  protected readonly operationsError = signal<string | null>(null);

  protected readonly profiles = signal<Option[]>([]);

  // ---- Overlays ----
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly deleting = signal(false);
  /** Operation being recorded, or `null` when the modal is closed. */
  protected readonly operationType = signal<OperationType | null>(null);
  protected readonly recording = signal(false);
  protected readonly recordError = signal<string | null>(null);

  protected readonly refName = refName;
  protected readonly signedQuantity = signedQuantity;
  protected readonly typeLabels = OPERATION_TYPE_LABELS;

  protected readonly typeLabel = computed(() => {
    const it = this.item();
    return it ? ITEM_TYPE_LABELS[it.type] : '';
  });
  protected readonly typeTone = computed(() => (this.item()?.type === 'FLYER' ? 'blue' : 'violet'));
  protected readonly choices = computed(() => {
    const it = this.item();
    return it ? operationsFor(it.type) : [];
  });
  protected readonly responsible = computed(() => refName(this.item()?.managedBy ?? null));

  /** Signed-in member, preselected as the one performing an operation. */
  protected readonly currentProfileUuid = computed(
    () => this.auth.currentUser()?.profileUuid ?? null,
  );

  constructor() {
    this.service.profiles().subscribe({
      next: (list) => this.profiles.set(list),
      error: () => this.profiles.set([]),
    });
  }

  ngOnInit(): void {
    // `uuid` (a required route input) is only bound after construction, so the
    // initial load must wait until here.
    this.load();
  }

  protected load(): void {
    const id = this.uuid();

    this.loading.set(true);
    this.loadError.set(null);
    this.service.getOne(id).subscribe({
      next: (data) => {
        this.item.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement de l’article impossible.'));
        this.loading.set(false);
      },
    });

    this.loadOperations();
  }

  private loadOperations(): void {
    this.operationsLoading.set(true);
    this.operationsError.set(null);
    this.operationService.listForItem(this.uuid()).subscribe({
      next: (data) => {
        this.operations.set(data);
        this.operationsLoading.set(false);
      },
      error: (err) => {
        this.operationsError.set(messageFromError(err, 'Chargement de l’historique impossible.'));
        this.operationsLoading.set(false);
      },
    });
  }

  // ---- Edit ----
  protected openEdit(): void {
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
  }
  protected onSave(input: InventoryInput): void {
    const current = this.item();
    if (!current) {
      return;
    }
    this.saving.set(true);
    this.service.update(current.uuid, input).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.item.set(updated);
        this.formOpen.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  // ---- Delete ----
  protected askDelete(): void {
    this.confirmOpen.set(true);
  }
  protected cancelDelete(): void {
    this.confirmOpen.set(false);
  }
  protected confirmDelete(): void {
    const current = this.item();
    if (!current) {
      return;
    }
    this.deleting.set(true);
    this.service.remove(current.uuid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmOpen.set(false);
        void this.router.navigate(['/inventaire']);
      },
      error: () => this.deleting.set(false),
    });
  }

  // ---- Operations ----
  protected openOperation(type: OperationType): void {
    this.recordError.set(null);
    this.operationType.set(type);
  }
  protected closeOperation(): void {
    this.operationType.set(null);
    this.recordError.set(null);
  }

  /**
   * Records the movement, then reloads the item — the backend moved the stock,
   * so the local quantity is stale — and the history.
   */
  protected onRecord(input: InventoryOperationInput): void {
    this.recording.set(true);
    this.recordError.set(null);
    this.operationService.create(input).subscribe({
      next: () => {
        this.recording.set(false);
        this.closeOperation();
        this.load();
      },
      error: (err) => {
        this.recordError.set(messageFromError(err, 'Enregistrement de l’opération impossible.'));
        this.recording.set(false);
      },
    });
  }

  /** `true` when the operation adds stock — drives the entry's colour. */
  protected isInbound(type: OperationType): boolean {
    return operationSign(type) > 0;
  }

  /** `17/07/2026 · 14:30` for an operation's timestamp. */
  protected timestamp(value: string): string {
    return `${formatDateFr(value)} · ${formatTimeFr(value)}`;
  }
}
