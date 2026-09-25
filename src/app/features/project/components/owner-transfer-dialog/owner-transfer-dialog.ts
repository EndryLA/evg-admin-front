import { Component, computed, input, output, signal } from '@angular/core';

import { DialogFocus } from '../../../../shared/ui/dialog-focus/dialog-focus';
import { personName, PROJECT_ROLE_LABELS, type Project } from '../../project.models';

/**
 * Modal picking the member who becomes the project's owner. Presentational:
 * emits the chosen profile uuid, the parent saves.
 */
@Component({
  selector: 'app-owner-transfer-dialog',
  imports: [DialogFocus],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  template: `
    <div class="modal-overlay" (click)="cancel.emit()">
      <div class="modal" appDialogFocus role="dialog" aria-modal="true" aria-label="Transférer la propriété"
        (click)="$event.stopPropagation()">
        <header class="modal__head">
          <span class="eyebrow">Membres du projet</span>
          <h2 class="modal__title">Transférer la propriété</h2>
        </header>
        <form (submit)="$event.preventDefault(); submit()" novalidate>
          <div class="grid">
            <div class="field field--span">
              <label class="field__label" for="owner-transfer-member">Nouveau propriétaire</label>
              <select id="owner-transfer-member" class="field__control" [value]="picked()"
                (change)="picked.set($any($event.target).value)" [attr.aria-invalid]="tried() && !picked()">
                <option value="">Choisir un membre…</option>
                @for (m of candidates(); track m.person.uuid) {
                  <option [value]="m.person.uuid">{{ personName(m.person) }} — {{ roleLabels[m.role] }}</option>
                }
              </select>
              @if (tried() && !picked()) {
                <span class="field__error">Choisissez un membre.</span>
              }
            </div>
            <p class="hint field--span">
              Le nouveau propriétaire gérera tout le projet, y compris les gestionnaires.
              {{ owner() ? personName(owner()!.person) : 'L’actuel propriétaire' }} restera gestionnaire{{
                project().myRole === 'OWNER' ? ' : vous ne pourrez plus annuler ce transfert vous-même' : '' }}.
            </p>
            @if (error(); as err) {
              <p class="modal__error field--span" role="alert">{{ err }}</p>
            }
          </div>
          <footer class="modal__foot">
            <button type="button" class="btn modal__cancel" (click)="cancel.emit()" [disabled]="busy()">Annuler</button>
            <button type="submit" class="btn btn--primary" [disabled]="busy()">{{ busy() ? 'Transfert…' : 'Transférer' }}</button>
          </footer>
        </form>
      </div>
    </div>
  `,
  styles: `.hint { margin: 0; font-size: 13px; color: var(--text-muted); }`,
})
export class OwnerTransferDialog {
  readonly project = input.required<Project>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<string>();
  readonly cancel = output<void>();

  protected readonly picked = signal('');
  protected readonly tried = signal(false);
  protected readonly personName = personName;
  protected readonly roleLabels = PROJECT_ROLE_LABELS;

  protected readonly owner = computed(() => this.project().members.find((m) => m.role === 'OWNER'));
  protected readonly candidates = computed(() =>
    this.project()
      .members.filter((m) => m.role !== 'OWNER')
      .sort((a, b) => personName(a.person).localeCompare(personName(b.person), 'fr')),
  );

  protected submit(): void {
    this.tried.set(true);
    if (this.picked() && !this.busy()) {
      this.save.emit(this.picked());
    }
  }
}
