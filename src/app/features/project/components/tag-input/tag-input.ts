import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

/**
 * Chip-style tag editor, usable as a form control (value: `string[]`). Enter or
 * comma adds the typed tag, Backspace on an empty field removes the last one.
 * Case-insensitive duplicates are ignored; {@link suggestions} feed a datalist.
 */
@Component({
  selector: 'app-tag-input',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TagInput), multi: true }],
  template: `
    <div class="tags" [class.tags--disabled]="disabled()" (click)="focusField()">
      @for (tag of value(); track tag) {
        <span class="tag">
          {{ tag }}
          <button type="button" class="tag__remove" (click)="remove(tag); $event.stopPropagation()"
            [disabled]="disabled()" [attr.aria-label]="'Retirer le tag ' + tag">×</button>
        </span>
      }
      @if (value().length < max) {
        <input #field class="tags__input" type="text" [attr.id]="inputId()" [attr.list]="inputId() + '-list'"
          [maxLength]="maxLength" [value]="draft()" [disabled]="disabled()"
          [placeholder]="value().length ? '' : placeholder()"
          (input)="onInput($any($event.target))" (keydown)="onKeydown($event)" (blur)="commit()" />
        <datalist [attr.id]="inputId() + '-list'">
          @for (s of available(); track s) { <option [value]="s"></option> }
        </datalist>
      } @else {
        <span class="tags__full">{{ max }} tags maximum</span>
      }
    </div>
  `,
  styleUrl: './tag-input.scss',
})
export class TagInput implements ControlValueAccessor {
  readonly inputId = input('tags');
  readonly placeholder = input('Ajouter un tag…');
  /** Tags used elsewhere, offered while typing. */
  readonly suggestions = input<string[]>([]);
  /** Focus the field once rendered (e.g. when it is the only field of a dialog). */
  readonly autofocus = input(false);

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly value = signal<string[]>([]);
  protected readonly draft = signal('');
  protected readonly disabled = signal(false);
  protected readonly max = MAX_TAGS;
  protected readonly maxLength = MAX_TAG_LENGTH;

  protected readonly available = computed(() => {
    const taken = new Set(this.value().map((t) => t.toLowerCase()));
    return this.suggestions().filter((s) => !taken.has(s.toLowerCase()));
  });

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) {
        this.focusField();
      }
    });
  }

  private onChange: (value: string[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string[] | null): void {
    this.value.set([...(value ?? [])]);
  }
  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected focusField(): void {
    this.field()?.nativeElement.focus();
  }

  protected onInput(field: HTMLInputElement): void {
    const text = field.value;
    // A comma (typed or pasted) validates what precedes it.
    if (text.includes(',')) {
      text.split(',').slice(0, -1).forEach((part) => this.add(part));
      this.setDraft(text.split(',').pop() ?? '');
    } else {
      this.draft.set(text);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commit();
    } else if (event.key === 'Backspace' && !this.draft() && this.value().length) {
      this.remove(this.value()[this.value().length - 1]);
    }
  }

  protected commit(): void {
    this.add(this.draft());
    this.setDraft('');
    this.onTouched();
  }

  /**
   * Writes the field directly as well: when keys arrive faster than change
   * detection, the bound value may already equal the new draft and Angular
   * would leave the typed text in place.
   */
  private setDraft(text: string): void {
    this.draft.set(text);
    const el = this.field()?.nativeElement;
    if (el && el.value !== text) {
      el.value = text;
    }
  }

  protected remove(tag: string): void {
    this.update(this.value().filter((t) => t !== tag));
  }

  private add(raw: string): void {
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
    const exists = this.value().some((t) => t.toLowerCase() === tag.toLowerCase());
    if (tag && !exists && this.value().length < MAX_TAGS) {
      this.update([...this.value(), tag]);
    }
  }

  private update(tags: string[]): void {
    this.value.set(tags);
    this.onChange(tags);
  }
}
