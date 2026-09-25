import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';

import { SuggestionService } from '../../suggestion.service';
import { formatSize, type SuggestionAttachment } from '../../suggestion.models';

/** Loaded state of one attachment: an object URL once its bytes are in. */
interface Tile {
  attachment: SuggestionAttachment;
  url: string | null;
  failed: boolean;
}

/**
 * Grid of a suggestion's images and videos. The bytes come through the API
 * (so the bearer token is sent) and are shown from object URLs, revoked when
 * the list changes or the gallery goes away. Images open in a lightbox.
 */
@Component({
  selector: 'app-attachment-gallery',
  templateUrl: './attachment-gallery.html',
  styleUrl: './attachment-gallery.scss',
  host: { '(document:keydown.escape)': 'lightbox.set(null)' },
})
export class AttachmentGallery {
  private readonly service = inject(SuggestionService);

  readonly suggestionUuid = input.required<string>();
  readonly attachments = input.required<SuggestionAttachment[]>();
  /** Shows a remove button on each tile (author, while the suggestion is pending). */
  readonly removable = input(false);

  readonly remove = output<SuggestionAttachment>();

  protected readonly tiles = signal<Tile[]>([]);
  protected readonly lightbox = signal<Tile | null>(null);
  protected readonly formatSize = formatSize;

  constructor() {
    effect((onCleanup) => {
      const uuid = this.suggestionUuid();
      const tiles: Tile[] = this.attachments().map((attachment) => ({
        attachment,
        url: null,
        failed: false,
      }));
      this.tiles.set(tiles);

      const subs = tiles.map((tile) =>
        this.service.attachmentBlob(uuid, tile.attachment.uuid).subscribe({
          next: (blob) => this.patch(tile.attachment.uuid, { url: URL.createObjectURL(blob) }),
          error: () => this.patch(tile.attachment.uuid, { failed: true }),
        }),
      );
      onCleanup(() => {
        subs.forEach((s) => s.unsubscribe());
        this.revokeAll();
      });
    });
    inject(DestroyRef).onDestroy(() => this.revokeAll());
  }

  private patch(uuid: string, change: Partial<Tile>): void {
    this.tiles.update((list) =>
      list.map((t) => (t.attachment.uuid === uuid ? { ...t, ...change } : t)),
    );
  }

  private revokeAll(): void {
    this.tiles().forEach((t) => t.url && URL.revokeObjectURL(t.url));
  }
}
