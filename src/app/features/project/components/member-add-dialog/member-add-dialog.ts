import { Component, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  MemberAutocomplete,
  type MemberValue,
} from '../../../../shared/ui/member-autocomplete/member-autocomplete';

/** Modal picking a person to add to a project. Presentational: the parent saves. */
@Component({
  selector: 'app-member-add-dialog',
  imports: [ReactiveFormsModule, MemberAutocomplete],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  template: `
    <div class="modal-overlay" (click)="cancel.emit()">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Ajouter un membre"
        (click)="$event.stopPropagation()">
        <header class="modal__head">
          <span class="eyebrow">Membres du projet</span>
          <h2 class="modal__title">Ajouter un membre</h2>
        </header>
        <form (submit)="$event.preventDefault(); submit()" novalidate>
          <div class="grid">
            <div class="field field--span">
              <label class="field__label" for="project-member-add">Personne</label>
              <app-member-autocomplete inputId="project-member-add" [formControl]="picker"
                placeholder="Rechercher par nom…" [ariaInvalid]="tried() && !picker.value.uuid" />
              @if (tried() && !picker.value.uuid) {
                <span class="field__error">Choisissez une personne dans la liste.</span>
              }
            </div>
            <p class="modal__note field--span">
              Un membre voit le projet et peut créer, modifier et se voir assigner des tickets.
            </p>
            @if (error(); as err) {
              <p class="modal__error field--span" role="alert">{{ err }}</p>
            }
          </div>
          <footer class="modal__foot">
            <button type="button" class="btn modal__cancel" (click)="cancel.emit()" [disabled]="busy()">Annuler</button>
            <button type="submit" class="btn btn--primary" [disabled]="busy()">{{ busy() ? 'Ajout…' : 'Ajouter' }}</button>
          </footer>
        </form>
      </div>
    </div>
  `,
})
export class MemberAddDialog {
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  /** Emits the picked profile uuid. */
  readonly save = output<string>();
  readonly cancel = output<void>();

  protected readonly picker = new FormControl<MemberValue>({ uuid: null, label: '' }, { nonNullable: true });
  protected readonly tried = signal(false);

  protected submit(): void {
    this.tried.set(true);
    const uuid = this.picker.value.uuid;
    if (uuid && !this.busy()) {
      this.save.emit(uuid);
    }
  }
}
