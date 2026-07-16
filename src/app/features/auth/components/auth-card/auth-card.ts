import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';

/**
 * Presentational shell shared by every auth screen: centered card on a plain
 * white page, brand logo, then a title/subtitle and the projected form.
 */
@Component({
  selector: 'app-auth-card',
  imports: [NgOptimizedImage],
  template: `
    <main class="auth-shell">
      <section class="auth-card" role="region" [attr.aria-label]="title()">
        <div class="auth-brand">
          <img
            ngSrc="assets/logo.svg"
            width="220"
            height="65"
            priority
            alt="Département Évangélisation" />
        </div>

        <header class="auth-head">
          <h1>{{ title() }}</h1>
          @if (subtitle()) {
            <p class="auth-sub">{{ subtitle() }}</p>
          }
        </header>

        <ng-content />
      </section>
    </main>
  `,
  styleUrl: './auth-card.scss',
})
export class AuthCard {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
