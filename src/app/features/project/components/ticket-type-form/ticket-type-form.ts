import { Component, computed, input, type OnInit, output, signal } from '@angular/core';

import { DialogFocus } from '../../../../shared/ui/dialog-focus/dialog-focus';
import {
  TYPE_COLORS,
  TYPE_COLOR_LABELS,
  type ProjectTicketType,
  type TicketTypeInput,
  type TypeColor,
} from '../../project.models';

/** Create/edit modal for a ticket type: a name and a pill colour, with a live preview. */
@Component({
  selector: 'app-ticket-type-form',
  imports: [DialogFocus],
  host: { class: 'modal-form', '(keydown.escape)': 'cancel.emit()' },
  template: `
    <div class="modal-overlay" (click)="cancel.emit()">
      <div class="modal" appDialogFocus role="dialog" aria-modal="true"
        [attr.aria-label]="isEdit() ? 'Modifier le type' : 'Nouveau type'" (click)="$event.stopPropagation()">
        <header class="modal__head">
          <span class="eyebrow">Type de ticket</span>
          <h2 class="modal__title">{{ isEdit() ? type()!.name : 'Nouveau type' }}</h2>
        </header>
        <form (submit)="$event.preventDefault(); submit()" novalidate>
          <div class="grid">
            <label class="field field--span">
              <span class="field__label">Nom</span>
              <input class="field__control" type="text" maxlength="60" autocomplete="off" [value]="name()"
                (input)="name.set($any($event.target).value)" placeholder="Ex. Relecture, Visuel…"
                [attr.aria-invalid]="tried() && !name().trim()" />
              @if (tried() && !name().trim()) {
                <span class="field__error">Le nom est requis.</span>
              }
            </label>
            <div class="field field--span">
              <span class="field__label" id="type-color-label">Couleur</span>
              <div class="swatches" role="radiogroup" aria-labelledby="type-color-label">
                @for (c of colors; track c) {
                  <button type="button" role="radio" class="swatch swatch--{{ c }}" [class.swatch--active]="color() === c"
                    [attr.aria-checked]="color() === c" [attr.aria-label]="colorLabels[c]" [title]="colorLabels[c]"
                    (click)="color.set(c)"></button>
                }
              </div>
            </div>
            <div class="field field--span">
              <span class="field__label">Aperçu</span>
              <span><span class="pill pill--{{ color() }}">{{ name().trim() || 'Nom du type' }}</span></span>
            </div>
            @if (error(); as err) {
              <p class="modal__error field--span" role="alert">{{ err }}</p>
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
  styles: `
    .swatches { display: flex; gap: 10px; flex-wrap: wrap; }
    .swatch { width: 30px; height: 30px; padding: 0; border: none; border-radius: 50%; cursor: pointer; }
    .swatch--grey { background: var(--pill-grey-text); }
    .swatch--red { background: var(--pill-red-text); }
    .swatch--amber { background: var(--pill-amber-text); }
    .swatch--green { background: var(--pill-green-text); }
    .swatch--blue { background: var(--pill-blue-text); }
    .swatch--violet { background: var(--pill-violet-text); }
    .swatch--active { box-shadow: 0 0 0 3px var(--bg-elevated), 0 0 0 5px var(--text-primary); }
    .swatch:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  `,
})
export class TicketTypeForm implements OnInit {
  readonly type = input<ProjectTicketType | null>(null);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<TicketTypeInput>();
  readonly cancel = output<void>();

  protected readonly isEdit = computed(() => this.type() !== null);
  protected readonly name = signal('');
  protected readonly color = signal<TypeColor>('blue');
  protected readonly tried = signal(false);
  protected readonly colors = TYPE_COLORS;
  protected readonly colorLabels = TYPE_COLOR_LABELS;

  ngOnInit(): void {
    const t = this.type();
    if (t) {
      this.name.set(t.name);
      this.color.set(t.color);
    }
  }

  protected submit(): void {
    this.tried.set(true);
    if (this.name().trim() && !this.busy()) {
      this.save.emit({ name: this.name(), color: this.color() });
    }
  }
}
