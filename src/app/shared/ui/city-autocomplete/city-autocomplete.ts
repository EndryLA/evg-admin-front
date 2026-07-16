import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Component,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  NG_VALUE_ACCESSOR,
  type ControlValueAccessor,
} from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of, switchMap } from 'rxjs';

/**
 * The value a city field carries. Exactly one side is meaningful at a time:
 * a picked suggestion sets {@link inseeCode} (and keeps its `label` for display),
 * while free text leaves `inseeCode` null and keeps only the raw `label`.
 */
export interface CityValue {
  inseeCode: number | null;
  label: string;
}

/** One `/api/cities/search` hit, kept minimal so this control needs no feature. */
interface CitySuggestion {
  label: string;
  inseeCode: number | null;
}

const EMPTY: CityValue = { inseeCode: null, label: '' };

/**
 * Autocomplete combobox over the public `/api/cities/search` référentiel — a
 * form control (via `ControlValueAccessor`) usable on both the authenticated and
 * the public/anonymous contact forms.
 *
 * Picking a suggestion stores its INSEE code; typing free text with no pick keeps
 * the raw label and a null code. The backend resolves the rest on submit — this
 * control never decides region eligibility or creates cities.
 */
@Component({
  selector: 'app-city-autocomplete',
  templateUrl: './city-autocomplete.html',
  styleUrl: './city-autocomplete.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CityAutocomplete),
      multi: true,
    },
  ],
})
export class CityAutocomplete implements ControlValueAccessor {
  private readonly http = inject(HttpClient);

  /** `id` for the input, so an external `<label for>` can target it. */
  readonly inputId = input<string>('city');
  readonly placeholder = input<string>('Ex. Lille, 59000…');
  readonly ariaInvalid = input<boolean>(false);

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('input');

  protected readonly query = signal('');
  protected readonly results = signal<CitySuggestion[]>([]);
  protected readonly open = signal(false);
  protected readonly searching = signal(false);
  /** Index of the keyboard-highlighted option, or -1 for none. */
  protected readonly active = signal(-1);
  protected readonly disabled = signal(false);

  private value: CityValue = { ...EMPTY };
  private onChange: (value: CityValue) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    toObservable(this.query)
      .pipe(
        debounceTime(280),
        switchMap((q) => {
          const term = q.trim();
          // Empty/blank never hits the API — the backend returns [] anyway.
          if (term.length < 2) {
            this.searching.set(false);
            return of<CitySuggestion[]>([]);
          }
          this.searching.set(true);
          const params = new HttpParams().set('q', term);
          return this.http
            .get<CitySuggestion[]>('/api/cities/search', { params })
            .pipe(catchError(() => of<CitySuggestion[]>([])));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.searching.set(false);
        this.results.set(list ?? []);
        this.active.set(-1);
        // Keep the panel open only while the field is focused with a live query.
        if (this.query().trim().length >= 2) {
          this.open.set(true);
        }
      });
  }

  // ---- ControlValueAccessor ----

  writeValue(value: CityValue | null): void {
    this.value = value ? { ...value } : { ...EMPTY };
    this.query.set(this.value.label);
  }

  registerOnChange(fn: (value: CityValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // ---- Interaction ----

  protected onInput(text: string): void {
    this.query.set(text);
    // Typing invalidates any earlier pick: keep the raw label, drop the code.
    this.value = { inseeCode: null, label: text };
    this.onChange(this.value);
    if (text.trim().length < 2) {
      this.results.set([]);
      this.open.set(false);
      this.active.set(-1);
    }
  }

  protected pick(s: CitySuggestion): void {
    this.value = { inseeCode: s.inseeCode, label: s.label };
    this.query.set(s.label);
    this.onChange(this.value);
    this.results.set([]);
    this.open.set(false);
    this.active.set(-1);
    this.inputEl()?.nativeElement.focus();
  }

  protected onFocus(): void {
    if (this.results().length > 0 && this.query().trim().length >= 2) {
      this.open.set(true);
    }
  }

  protected onBlur(): void {
    // Delay so an option's mousedown-triggered pick runs before the panel hides.
    setTimeout(() => this.open.set(false), 120);
    this.onTouched();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const list = this.results();
    switch (event.key) {
      case 'ArrowDown':
        if (list.length === 0) {
          return;
        }
        event.preventDefault();
        this.open.set(true);
        this.active.set((this.active() + 1) % list.length);
        break;
      case 'ArrowUp':
        if (list.length === 0) {
          return;
        }
        event.preventDefault();
        this.active.set((this.active() - 1 + list.length) % list.length);
        break;
      case 'Enter': {
        const choice = list[this.active()];
        if (this.open() && choice) {
          event.preventDefault();
          this.pick(choice);
        }
        break;
      }
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.open.set(false);
          this.active.set(-1);
        }
        break;
    }
  }

  protected optionId(index: number): string {
    return `${this.inputId()}-opt-${index}`;
  }
}
