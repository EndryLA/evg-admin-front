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
 * The value a member field carries. A picked member sets {@link uuid} (and keeps
 * its display `label`); typing without picking keeps the raw `label` and a null
 * uuid, so the caller can require an actual pick.
 */
export interface MemberValue {
  uuid: string | null;
  label: string;
}

/** One `/api/profiles/search` hit — name only, as the public endpoint returns. */
interface RawMember {
  uuid?: string;
  firstname?: string;
  lastname?: string;
}

interface MemberSuggestion {
  uuid: string;
  label: string;
}

const EMPTY: MemberValue = { uuid: null, label: '' };

/**
 * Autocomplete combobox over the public `/api/profiles/search` endpoint (members
 * by name, no PII) — a form control (via `ControlValueAccessor`) for the public
 * presence form, where a department member picks themselves.
 *
 * Picking a suggestion stores its profile uuid; typing free text with no pick
 * keeps the raw label and a null uuid. Mirrors {@link CityAutocomplete}.
 */
@Component({
  selector: 'app-member-autocomplete',
  templateUrl: './member-autocomplete.html',
  styleUrl: './member-autocomplete.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MemberAutocomplete),
      multi: true,
    },
  ],
})
export class MemberAutocomplete implements ControlValueAccessor {
  private readonly http = inject(HttpClient);

  /** `id` for the input, so an external `<label for>` can target it. */
  readonly inputId = input<string>('member');
  readonly placeholder = input<string>('Tapez votre nom…');
  readonly ariaInvalid = input<boolean>(false);

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('input');

  protected readonly query = signal('');
  protected readonly results = signal<MemberSuggestion[]>([]);
  protected readonly open = signal(false);
  protected readonly searching = signal(false);
  /** Index of the keyboard-highlighted option, or -1 for none. */
  protected readonly active = signal(-1);
  protected readonly disabled = signal(false);

  private value: MemberValue = { ...EMPTY };
  private onChange: (value: MemberValue) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    toObservable(this.query)
      .pipe(
        debounceTime(280),
        switchMap((q) => {
          const term = q.trim();
          if (term.length < 2) {
            this.searching.set(false);
            return of<MemberSuggestion[]>([]);
          }
          this.searching.set(true);
          const params = new HttpParams().set('q', term);
          return this.http
            .get<RawMember[]>('/api/profiles/search', { params })
            .pipe(
              catchError(() => of<RawMember[]>([])),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.searching.set(false);
        this.results.set(
          (list ?? [])
            .filter((m): m is Required<Pick<RawMember, 'uuid'>> & RawMember => !!m.uuid)
            .map((m) => ({
              uuid: m.uuid,
              label: `${m.firstname ?? ''} ${m.lastname ?? ''}`.trim(),
            })),
        );
        this.active.set(-1);
        if (this.query().trim().length >= 2) {
          this.open.set(true);
        }
      });
  }

  // ---- ControlValueAccessor ----

  writeValue(value: MemberValue | null): void {
    this.value = value ? { ...value } : { ...EMPTY };
    this.query.set(this.value.label);
  }

  registerOnChange(fn: (value: MemberValue) => void): void {
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
    // Typing invalidates any earlier pick: keep the raw label, drop the uuid.
    this.value = { uuid: null, label: text };
    this.onChange(this.value);
    if (text.trim().length < 2) {
      this.results.set([]);
      this.open.set(false);
      this.active.set(-1);
    }
  }

  protected pick(s: MemberSuggestion): void {
    this.value = { uuid: s.uuid, label: s.label };
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
