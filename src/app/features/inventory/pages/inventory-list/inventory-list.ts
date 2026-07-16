import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { InventoryDetail } from '../../components/inventory-detail/inventory-detail';
import { InventoryForm } from '../../components/inventory-form/inventory-form';
import { InventoryService } from '../../inventory.service';
import {
  refName,
  type InventoryInput,
  type InventoryItem,
  type Option,
} from '../../inventory.models';

type SortKey = 'name' | 'quantity' | 'location';
type SortDir = 'asc' | 'desc';
type PageItem = number | 'gap';

const PAGE_SIZE = 10;

/** Strip accents & lowercase for accent-insensitive search. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Inventaire — the stock table. Loads all items and the responsible picker
 * once, does search / sort / pagination in memory, then orchestrates the
 * detail slide-over, create/edit modal and delete dialog.
 */
@Component({
  selector: 'app-inventory-list',
  imports: [InventoryDetail, InventoryForm, ConfirmDialog],
  host: { class: 'data-list' },
  templateUrl: './inventory-list.html',
  styleUrl: './inventory-list.scss',
})
export class InventoryList {
  private readonly service = inject(InventoryService);

  // ---- Data ----
  protected readonly items = signal<InventoryItem[]>([]);
  protected readonly profiles = signal<Option[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // ---- Filters / view state ----
  protected readonly query = signal('');
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortDir = signal<SortDir>('asc');
  protected readonly page = signal(1);

  // ---- Overlays ----
  protected readonly selected = signal<InventoryItem | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly formItem = signal<InventoryItem | null>(null);
  protected readonly saving = signal(false);
  protected readonly confirmTarget = signal<InventoryItem | null>(null);
  protected readonly deleting = signal(false);

  protected readonly refName = refName;

  constructor() {
    this.load();
  }

  // ---- Derived collections ----
  protected readonly filtered = computed<InventoryItem[]>(() => {
    const q = normalize(this.query().trim());
    if (!q) {
      return this.items();
    }
    return this.items().filter((it) => {
      const haystack = normalize(`${it.name} ${it.stockLocation} ${refName(it.managedBy)}`);
      return haystack.includes(q);
    });
  });

  protected readonly sorted = computed<InventoryItem[]>(() => {
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.filtered()].sort((a, b) => this.compare(a, b, key) * dir);
  });

  protected readonly total = computed(() => this.items().length);
  protected readonly resultCount = computed(() => this.filtered().length);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.resultCount() / PAGE_SIZE)),
  );

  protected readonly rows = computed<InventoryItem[]>(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.sorted().slice(start, start + PAGE_SIZE);
  });

  protected readonly rangeLabel = computed(() => {
    const count = this.resultCount();
    if (count === 0) {
      return '0 résultat';
    }
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.page() * PAGE_SIZE, count);
    return `${start}–${end} sur ${count}`;
  });

  protected readonly pageItems = computed<PageItem[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const items: PageItem[] = [1];
    const from = Math.max(2, current - 1);
    const to = Math.min(total - 1, current + 1);
    if (from > 2) {
      items.push('gap');
    }
    for (let i = from; i <= to; i++) {
      items.push(i);
    }
    if (to < total - 1) {
      items.push('gap');
    }
    items.push(total);
    return items;
  });

  // ---- Loading ----
  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      items: this.service.list(),
      profiles: this.service.profiles(),
    }).subscribe({
      next: ({ items, profiles }) => {
        this.items.set(items);
        this.profiles.set(profiles);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement de l’inventaire impossible.'));
        this.loading.set(false);
      },
    });
  }

  // ---- Filter / sort handlers ----
  protected onSearch(value: string): void {
    this.query.set(value);
    this.page.set(1);
  }
  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }
  protected sortIndicator(key: SortKey): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  // ---- Pagination ----
  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }
  protected prev(): void {
    this.goTo(this.page() - 1);
  }
  protected next(): void {
    this.goTo(this.page() + 1);
  }

  // ---- Detail ----
  protected view(item: InventoryItem): void {
    this.selected.set(item);
  }
  protected closeDetail(): void {
    this.selected.set(null);
  }

  // ---- Create / edit ----
  protected openCreate(): void {
    this.formItem.set(null);
    this.formOpen.set(true);
  }
  protected openEdit(item: InventoryItem): void {
    this.selected.set(null);
    this.formItem.set(item);
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
    this.formItem.set(null);
  }
  protected onSave(input: InventoryInput): void {
    const editing = this.formItem();
    const request$ = editing
      ? this.service.update(editing.uuid, input)
      : this.service.create(input);

    this.saving.set(true);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  // ---- Delete ----
  protected askDelete(item: InventoryItem): void {
    this.selected.set(null);
    this.confirmTarget.set(item);
  }
  protected cancelDelete(): void {
    this.confirmTarget.set(null);
  }
  protected confirmDelete(): void {
    const target = this.confirmTarget();
    if (!target) {
      return;
    }
    this.deleting.set(true);
    this.service.remove(target.uuid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmTarget.set(null);
        this.load();
      },
      error: () => this.deleting.set(false),
    });
  }

  private compare(a: InventoryItem, b: InventoryItem, key: SortKey): number {
    switch (key) {
      case 'name':
        return a.name.localeCompare(b.name, 'fr');
      case 'quantity':
        return a.quantity - b.quantity;
      case 'location':
        return a.stockLocation.localeCompare(b.stockLocation, 'fr');
    }
  }
}
