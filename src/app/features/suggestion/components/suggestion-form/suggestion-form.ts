import { Component, computed, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_RULES,
  attachmentProblem,
  formatSize,
  type Suggestion,
  type SuggestionInput,
} from '../../suggestion.models';

/** A file picked in the form, with a local preview URL. */
interface PickedFile {
  file: File;
  url: string;
  isVideo: boolean;
}

export interface SuggestionFormValue {
  input: SuggestionInput;
  /** New files to upload (always empty when editing — attachments are managed on the detail page). */
  files: File[];
}

/**
 * Create/edit modal for a suggestion. On creation it also collects images and
 * videos, previewed locally and checked against {@link ATTACHMENT_RULES} before
 * anything is sent. Presentational: the parent performs the request.
 */
@Component({
  selector: 'app-suggestion-form',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './suggestion-form.html',
  styleUrl: './suggestion-form.scss',
})
export class SuggestionForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);

  /** Suggestion to edit, or `null` to create one. */
  readonly suggestion = input<Suggestion | null>(null);
  readonly busy = input(false);
  /** Error from the parent's request, shown above the buttons. */
  readonly error = input<string | null>(null);

  readonly save = output<SuggestionFormValue>();
  readonly cancel = output<void>();

  protected readonly isEdit = computed(() => this.suggestion() !== null);
  protected readonly picked = signal<PickedFile[]>([]);
  protected readonly fileError = signal<string | null>(null);

  protected readonly accept = ATTACHMENT_ACCEPT;
  protected readonly maxFiles = ATTACHMENT_RULES.maxFiles;
  protected readonly formatSize = formatSize;

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(10000)]],
  });

  ngOnInit(): void {
    const s = this.suggestion();
    if (s) {
      this.form.setValue({ title: s.title, description: s.description });
    }
  }

  ngOnDestroy(): void {
    this.picked().forEach((p) => URL.revokeObjectURL(p.url));
  }

  protected onFiles(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.fileError.set(null);
    const room = this.maxFiles - this.picked().length;
    if (files.length > room) {
      this.fileError.set(`${this.maxFiles} fichiers maximum.`);
      return;
    }
    for (const file of files) {
      const problem = attachmentProblem(file);
      if (problem) {
        this.fileError.set(problem);
        return;
      }
    }
    this.picked.update((list) => [
      ...list,
      ...files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isVideo: file.type.startsWith('video/'),
      })),
    ]);
  }

  protected removeFile(item: PickedFile): void {
    URL.revokeObjectURL(item.url);
    this.picked.update((list) => list.filter((p) => p !== item));
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit({
      input: this.form.getRawValue(),
      files: this.picked().map((p) => p.file),
    });
  }
}
