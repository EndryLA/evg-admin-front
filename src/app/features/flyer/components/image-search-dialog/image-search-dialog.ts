import { Component, DestroyRef, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import { catchError, type Subscription } from 'rxjs';

import { ImageSearchService, type WebImage } from '../../image-search.service';
import { messageFromError } from '../../../../core/http/http-error.util';

/** The image the user picked, already downloaded same-origin. */
export interface PickedImage {
  blob: Blob;
  name: string;
}

/**
 * Modal for finding the flyer's centre photo on the web (SerpAPI-backed). Owns
 * the search and the download; emits the picked image as a Blob so the parent
 * only has to decode it onto the canvas.
 */
@Component({
  selector: 'app-image-search-dialog',
  host: { class: 'modal-form', '(keydown.escape)': 'close.emit()' },
  templateUrl: './image-search-dialog.html',
  styleUrl: './image-search-dialog.scss',
})
export class ImageSearchDialog {
  private readonly imageSearch = inject(ImageSearchService);

  readonly picked = output<PickedImage>();
  readonly close = output<void>();

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('queryInput');

  protected readonly query = signal('');
  protected readonly images = signal<WebImage[]>([]);
  protected readonly searching = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The query the current `images` answer — drives the "no result" message. */
  protected readonly searchedQuery = signal('');
  /** The thumbnail of the hit being downloaded — its tile shows a busy state. */
  protected readonly pending = signal<string | null>(null);
  /** The last search errored or found nothing — the device import is offered then. */
  protected readonly searchFailed = signal(false);

  private searchSub?: Subscription;
  private fetchSub?: Subscription;

  constructor() {
    afterNextRender(() => this.inputRef()?.nativeElement.focus());
    inject(DestroyRef).onDestroy(() => {
      this.searchSub?.unsubscribe();
      this.fetchSub?.unsubscribe();
    });
  }

  protected onQuery(value: string): void {
    this.query.set(value);
  }

  /** Run the search on demand (Enter or the button) — each new query is billed,
   *  so there's no search-as-you-type here. */
  protected search(event?: Event): void {
    event?.preventDefault();
    const q = this.query().trim();
    if (q.length < 2) {
      return;
    }
    this.searchSub?.unsubscribe();
    this.error.set(null);
    this.searching.set(true);
    this.searchSub = this.imageSearch.search(q).subscribe({
      next: (images) => {
        this.images.set(images);
        this.searchedQuery.set(q);
        this.searching.set(false);
        this.searchFailed.set(images.length === 0);
      },
      error: (err: unknown) => {
        this.error.set(messageFromError(err, "Recherche d'images indisponible. Réessayez."));
        this.searching.set(false);
        this.searchFailed.set(true);
      },
    });
  }

  /** Fallback when the web search failed: hand a device image to the parent. */
  protected onFile(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (file) {
      this.picked.emit({ blob: file, name: file.name });
    }
  }

  /** Download a hit — the full-size image when its site allows, otherwise the
   *  (smaller) thumbnail — and hand it to the parent. */
  protected pick(hit: WebImage): void {
    if (this.pending()) {
      return;
    }
    this.pending.set(hit.thumbnail);
    this.error.set(null);
    const thumbnail$ = this.imageSearch.fetch(hit.thumbnail);
    const blob$ = hit.original
      ? this.imageSearch.fetch(hit.original).pipe(catchError(() => thumbnail$))
      : thumbnail$;
    this.fetchSub = blob$.subscribe({
      next: (blob) => {
        this.pending.set(null);
        this.picked.emit({ blob, name: hit.title || hit.source || 'Image du web' });
      },
      error: () => {
        this.error.set('Image indisponible. Choisissez-en une autre.');
        this.pending.set(null);
      },
    });
  }
}
