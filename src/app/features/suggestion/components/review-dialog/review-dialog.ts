import { Component, computed, input, output, signal } from '@angular/core';

import { DialogFocus } from '../../../../shared/ui/dialog-focus/dialog-focus';
import type { ReviewDecision } from '../../suggestion.models';

/**
 * Accept / reject a suggestion with the required message to its author.
 * Mount with `@if`; emits {@link confirm} with the message.
 */
@Component({
  selector: 'app-review-dialog',
  imports: [DialogFocus],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  template: `
    <div class="modal-overlay" (click)="cancel.emit()">
      <div class="modal" appDialogFocus role="dialog" aria-modal="true" [attr.aria-label]="title()"
        (click)="$event.stopPropagation()">
        <header class="modal__head">
          <span class="eyebrow">Réponse à l’auteur</span>
          <h2 class="modal__title">{{ title() }}</h2>
        </header>
        <div class="grid">
          <label class="field field--span">
            <span class="field__label">Message</span>
            <textarea class="field__control" rows="5" [value]="message()"
              (input)="message.set($any($event.target).value)"
              [placeholder]="placeholder()"
              [attr.aria-invalid]="tried() && !valid()"></textarea>
            @if (tried() && !valid()) {
              <span class="field__error">Un message est requis : l’auteur le verra.</span>
            }
          </label>
          @if (error(); as err) {
            <p class="field__error field--span" role="alert">{{ err }}</p>
          }
        </div>
        <footer class="modal__foot">
          <button type="button" class="btn modal__cancel" (click)="cancel.emit()" [disabled]="busy()">Annuler</button>
          <button type="button" class="btn btn--primary" (click)="submit()" [disabled]="busy()">
            {{ busy() ? 'Envoi…' : (decision() === 'ACCEPT' ? 'Accepter' : 'Refuser') }}
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: `textarea.field__control { resize: vertical; min-height: 110px; line-height: 1.5; }`,
})
export class ReviewDialog {
  readonly decision = input.required<ReviewDecision>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<string>();
  readonly cancel = output<void>();

  protected readonly message = signal('');
  protected readonly tried = signal(false);
  protected readonly valid = computed(() => this.message().trim().length > 0);

  protected readonly title = computed(() =>
    this.decision() === 'ACCEPT' ? 'Accepter la suggestion' : 'Refuser la suggestion',
  );
  protected readonly placeholder = computed(() =>
    this.decision() === 'ACCEPT'
      ? 'Ex. Merci, bonne idée ! Nous allons la planifier.'
      : 'Ex. Merci pour la proposition, mais…',
  );

  protected submit(): void {
    this.tried.set(true);
    if (this.valid() && !this.busy()) {
      this.confirm.emit(this.message());
    }
  }
}
