import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, OnDestroy, signal } from '@angular/core';

/**
 * Small button copying a month's public sign-up link
 * (`/inscription/mois/:month`) to the clipboard.
 */
@Component({
  selector: 'app-month-signup-link',
  templateUrl: './month-signup-link.html',
  styleUrl: './month-signup-link.scss',
})
export class MonthSignupLink implements OnDestroy {
  private readonly document = inject(DOCUMENT);

  /** `YYYY-MM`. */
  readonly month = input.required<string>();
  readonly label = input('Lien d’inscription');

  private readonly url = computed(
    () => `${this.document.location.origin}/inscription/mois/${this.month()}`,
  );

  protected readonly copied = signal(false);
  private resetTimer?: ReturnType<typeof setTimeout>;

  protected copy(event: Event): void {
    event.stopPropagation();
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (!clipboard) {
      return;
    }
    clipboard.writeText(this.url()).then(() => {
      this.copied.set(true);
      clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => this.copied.set(false), 2000);
    }, () => undefined);
  }

  ngOnDestroy(): void {
    clearTimeout(this.resetTimer);
  }
}
