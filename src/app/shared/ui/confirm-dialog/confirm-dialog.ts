import { Component, input, output } from '@angular/core';

/**
 * Centered destructive-action confirmation dialog (design.md §3 "Delete
 * confirm"). Mount it with `@if` in the parent; it emits {@link confirm} /
 * {@link cancel}. Message copy is projected as content.
 *
 * Defaults to delete wording and a trash icon. For other irreversible-feeling
 * actions, override {@link confirmLabel} / {@link busyLabel} and project a
 * different icon with `<svg dialogIcon>`.
 */
@Component({
  selector: 'app-confirm-dialog',
  host: { '(keydown.escape)': 'cancel.emit()' },
  template: `
    <div class="cd-overlay" (click)="cancel.emit()">
      <div
        class="cd-card"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (click)="$event.stopPropagation()">
        <div class="cd-icon" aria-hidden="true">
          <ng-content select="[dialogIcon]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </ng-content>
        </div>
        <h3 class="cd-title">{{ title() }}</h3>
        <p class="cd-message"><ng-content /></p>
        <div class="cd-actions">
          <button type="button" class="btn cd-cancel" (click)="cancel.emit()" [disabled]="busy()">
            {{ cancelLabel() }}
          </button>
          <button type="button" class="btn btn--primary cd-confirm" (click)="confirm.emit()" [disabled]="busy()" autofocus>
            {{ busy() ? busyLabel() : confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly confirmLabel = input('Supprimer');
  readonly cancelLabel = input('Annuler');
  /** Confirm-button copy while the action is in flight. */
  readonly busyLabel = input('Suppression…');
  readonly busy = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
