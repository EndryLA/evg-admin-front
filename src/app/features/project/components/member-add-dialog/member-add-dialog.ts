import { Component, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { DialogFocus } from '../../../../shared/ui/dialog-focus/dialog-focus';
import {
  MemberAutocomplete,
  type MemberValue,
} from '../../../../shared/ui/member-autocomplete/member-autocomplete';
import {
  PROJECT_ROLES,
  PROJECT_ROLE_HINTS,
  PROJECT_ROLE_LABELS,
  type ProjectRole,
} from '../../project.models';

/** What the dialog hands back: who to add, and with which role. */
export interface NewMember {
  profileUuid: string;
  role: ProjectRole;
}

/** Modal picking a person to add to a project, and their role. Presentational: the parent saves. */
@Component({
  selector: 'app-member-add-dialog',
  imports: [ReactiveFormsModule, MemberAutocomplete, DialogFocus],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  template: `
    <div class="modal-overlay" (click)="cancel.emit()">
      <div class="modal" appDialogFocus role="dialog" aria-modal="true" aria-label="Ajouter un membre"
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
            <div class="field field--span">
              <span class="field__label" id="member-role-label">Rôle</span>
              <div class="roles" role="radiogroup" aria-labelledby="member-role-label">
                @for (r of roles; track r) {
                  <label class="role" [class.role--active]="role() === r">
                    <input type="radio" name="member-role" [value]="r" [checked]="role() === r" (change)="role.set(r)" />
                    <span class="role__name">{{ roleLabels[r] }}</span>
                    <span class="role__hint">{{ roleHints[r] }}</span>
                  </label>
                }
              </div>
            </div>
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
  styles: `
    .roles { display: flex; flex-direction: column; gap: 8px; }
    .role {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 12px;
      border: 1px solid var(--border-input);
      border-radius: 9px;
      cursor: pointer;
    }
    .role:hover { background: var(--bg-sunken); }
    .role--active { border-color: var(--accent); background: var(--accent-soft-bg); }
    .role:focus-within { box-shadow: 0 0 0 3px var(--accent-ring); }
    .role input { position: absolute; opacity: 0; pointer-events: none; }
    .role__name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
    .role__hint { font-size: 12.5px; color: var(--text-muted); }
  `,
})
export class MemberAddDialog {
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<NewMember>();
  readonly cancel = output<void>();

  protected readonly picker = new FormControl<MemberValue>({ uuid: null, label: '' }, { nonNullable: true });
  protected readonly role = signal<ProjectRole>('CONTRIBUTOR');
  protected readonly tried = signal(false);

  protected readonly roles = PROJECT_ROLES;
  protected readonly roleLabels = PROJECT_ROLE_LABELS;
  protected readonly roleHints = PROJECT_ROLE_HINTS;

  protected submit(): void {
    this.tried.set(true);
    const uuid = this.picker.value.uuid;
    if (uuid && !this.busy()) {
      this.save.emit({ profileUuid: uuid, role: this.role() });
    }
  }
}
