import { Component, computed, inject, input, type OnInit, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DialogFocus } from '../../../../shared/ui/dialog-focus/dialog-focus';
import {
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
  PROJECT_CATEGORY_STARTERS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectCategory,
  type ProjectInput,
  type ProjectStatus,
} from '../../project.models';

/**
 * Create/edit modal for a project. The key prefixes its tickets (EVG → EVG-12);
 * it is suggested from the name until typed by hand. The category (creation
 * only) decides the ticket types the project starts with. Presentational: the
 * parent performs the request.
 */
@Component({
  selector: 'app-project-form',
  imports: [ReactiveFormsModule, DialogFocus],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  templateUrl: './project-form.html',
  styleUrl: './project-form.scss',
})
export class ProjectForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly project = input<Project | null>(null);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<ProjectInput>();
  readonly cancel = output<void>();

  protected readonly isEdit = computed(() => this.project() !== null);
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly categories = PROJECT_CATEGORIES;
  protected readonly categoryLabels = PROJECT_CATEGORY_LABELS;
  protected readonly categoryStarters = PROJECT_CATEGORY_STARTERS;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    key: ['', [Validators.required, Validators.pattern(/^[A-Za-z][A-Za-z0-9]{1,9}$/)]],
    description: [''],
    status: ['PLANNED' as ProjectStatus],
    category: ['OTHER' as ProjectCategory],
    startDate: [''],
    targetDate: [''],
  });

  ngOnInit(): void {
    const p = this.project();
    if (p) {
      this.form.setValue({
        name: p.name,
        key: p.key,
        description: p.description,
        status: p.status,
        category: p.category,
        startDate: p.startDate,
        targetDate: p.targetDate,
      });
    }
  }

  /** Suggests a key from the name's initials while the key hasn't been edited. */
  protected onNameInput(): void {
    const key = this.form.controls.key;
    if (this.isEdit() || key.dirty) {
      return;
    }
    const words = this.form.controls.name.value
      .normalize('NFD')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const suggestion =
      words.length > 1
        ? words.map((w) => w[0]).join('')
        : (words[0] ?? '').slice(0, 4);
    key.setValue(suggestion.toUpperCase().slice(0, 10));
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.save.emit({ ...v, startDate: v.startDate || null, targetDate: v.targetDate || null });
  }
}
