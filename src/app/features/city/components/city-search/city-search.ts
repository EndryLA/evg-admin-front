import { Component, inject, output, signal } from '@angular/core';
import { debounceTime, of, switchMap } from 'rxjs';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

import { messageFromError } from '../../../../core/http/http-error.util';
import { CityService } from '../../city.service';
import type { City, CitySuggestion } from '../../city.models';

/**
 * Référentiel lookup modal — a live autocomplete over `/api/cities/search`.
 * Suggestions that are not yet in the database can be **registered** with an
 * optional sector (`POST /api/cities`), keyed by their INSEE code. Emits
 * {@link registered} with the created city so the parent can refresh its list.
 */
@Component({
  selector: 'app-city-search',
  host: { class: 'modal-form', '(keydown.escape)': 'close.emit()' },
  templateUrl: './city-search.html',
  styleUrl: './city-search.scss',
})
export class CitySearch {
  private readonly service = inject(CityService);

  protected readonly query = signal('');
  protected readonly results = signal<CitySuggestion[]>([]);
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);

  // ---- Registration step ----
  protected readonly selected = signal<CitySuggestion | null>(null);
  protected readonly sector = signal('');
  protected readonly registering = signal(false);
  protected readonly registerError = signal<string | null>(null);

  readonly close = output<void>();
  readonly registered = output<City>();

  constructor() {
    toObservable(this.query)
      .pipe(
        debounceTime(250),
        switchMap((q) => {
          const term = q.trim();
          if (term.length < 2) {
            this.searching.set(false);
            this.searched.set(false);
            this.results.set([]);
            return of<CitySuggestion[] | null>(null);
          }
          this.searching.set(true);
          return this.service.search(term);
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (list) => {
          if (list) {
            this.results.set(list);
            this.searched.set(true);
          }
          this.searching.set(false);
        },
        error: () => this.searching.set(false),
      });
  }

  protected onInput(value: string): void {
    this.query.set(value);
    // Leaving the results invalidates any pending selection.
    this.selected.set(null);
  }

  /** Whether a suggestion can be registered (not already tracked, has INSEE). */
  protected canRegister(s: CitySuggestion): boolean {
    return !s.inDatabase && s.inseeCode != null;
  }

  protected select(s: CitySuggestion): void {
    if (!this.canRegister(s)) {
      return;
    }
    this.selected.set(s);
    this.sector.set('');
    this.registerError.set(null);
  }

  protected cancelSelect(): void {
    this.selected.set(null);
    this.registerError.set(null);
  }

  protected submitRegister(): void {
    const target = this.selected();
    if (!target || target.inseeCode == null || this.registering()) {
      return;
    }
    const raw = this.sector().trim();
    const sector = raw === '' ? null : Number(raw);
    if (sector != null && (!Number.isInteger(sector) || sector < 1)) {
      this.registerError.set('Indiquez un numéro de secteur valide, ou laissez vide.');
      return;
    }

    this.registering.set(true);
    this.registerError.set(null);
    this.service.register(target.inseeCode, sector).subscribe({
      next: (city) => {
        this.registering.set(false);
        this.registered.emit(city);
        // Mark the suggestion as registered and leave the register step.
        this.results.update((list) =>
          list.map((s) => (s.inseeCode === target.inseeCode ? { ...s, inDatabase: true } : s)),
        );
        this.selected.set(null);
      },
      error: (err) => {
        this.registering.set(false);
        this.registerError.set(messageFromError(err, 'Enregistrement de la commune impossible.'));
      },
    });
  }
}
