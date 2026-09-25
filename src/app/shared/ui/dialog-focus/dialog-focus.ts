import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';

/**
 * Put on a dialog's card: moves keyboard focus into it when it opens, so
 * keyboard users land in the dialog and its host `(keydown.escape)` handler
 * fires without a click first. Focuses the first form field when there is one,
 * the card itself otherwise.
 */
@Directive({
  selector: '[appDialogFocus]',
  host: { tabindex: '-1' },
})
export class DialogFocus {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      if (el.contains(document.activeElement)) {
        return;
      }
      const field = el.querySelector<HTMLElement>(
        'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
      );
      (field ?? el).focus({ preventScroll: true });
    });
  }
}
