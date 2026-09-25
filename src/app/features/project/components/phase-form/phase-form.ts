import { Component, computed, inject, input, type OnInit, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  PHASE_STATUSES,
  PHASE_STATUS_LABELS,
  type Phase,
  type PhaseInput,
  type PhaseStatus,
} from '../../project.models';

/** Create/edit modal for a project phase. Presentational: the parent saves. */
@Component({
  selector: 'app-phase-form',
  imports: [ReactiveFormsModule],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  template: `
    <div class="modal-overlay" (click)="cancel.emit()">
      <div class="modal" role="dialog" aria-modal="true"
        [attr.aria-label]="isEdit() ? 'Modifier la phase' : 'Nouvelle phase'"
        (click)="$event.stopPropagation()">
        <header class="modal__head">
          <span class="eyebrow">Phase</span>
          <h2 class="modal__title">{{ isEdit() ? phase()!.name : 'Nouvelle phase' }}</h2>
        </header>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="grid">
            <label class="field">
              <span class="field__label">Nom</span>
              <input class="field__control" formControlName="name" autocomplete="off"
                placeholder="Ex. Cadrage, Développement…"
                [attr.aria-invalid]="form.controls.name.touched && form.controls.name.invalid" />
              @if (form.controls.name.touched && form.controls.name.invalid) {
                <span class="field__error">Le nom de la phase est requis.</span>
              }
            </label>
            <label class="field">
              <span class="field__label">Statut</span>
              <select class="field__control" formControlName="status">
                @for (s of statuses; track s) { <option [value]="s">{{ statusLabels[s] }}</option> }
              </select>
            </label>
            <label class="field">
              <span class="field__label">Début</span>
              <input class="field__control" type="date" formControlName="startDate" />
            </label>
            <label class="field">
              <span class="field__label">Fin</span>
              <input class="field__control" type="date" formControlName="endDate" />
            </label>
            <label class="field field--span">
              <span class="field__label">Description</span>
              <textarea class="field__control" formControlName="description" rows="3"></textarea>
            </label>
            @if (error(); as err) {
              <p class="field__error field--span" role="alert">{{ err }}</p>
            }
          </div>
          <footer class="modal__foot">
            <button type="button" class="btn modal__cancel" (click)="cancel.emit()" [disabled]="busy()">Annuler</button>
            <button type="submit" class="btn btn--primary" [disabled]="busy()">
              {{ busy() ? 'Enregistrement…' : (isEdit() ? 'Enregistrer' : 'Créer') }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  `,
  styles: `textarea.field__control { resize: vertical; line-height: 1.5; }`,
})
export class PhaseForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly phase = input<Phase | null>(null);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<PhaseInput>();
  readonly cancel = output<void>();

  protected readonly isEdit = computed(() => this.phase() !== null);
  protected readonly statuses = PHASE_STATUSES;
  protected readonly statusLabels = PHASE_STATUS_LABELS;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    status: ['PLANNED' as PhaseStatus],
    startDate: [''],
    endDate: [''],
  });

  ngOnInit(): void {
    const p = this.phase();
    if (p) {
      this.form.setValue({
        name: p.name,
        description: p.description,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
      });
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.save.emit({ ...v, startDate: v.startDate || null, endDate: v.endDate || null });
  }
}
