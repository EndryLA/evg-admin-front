import { Component, input } from '@angular/core';

import { BrandLogo } from '../../../../shared/ui/brand-logo/brand-logo';

/**
 * Presentational shell shared by every auth screen: centered card on a plain
 * white page, brand logo, then a title/subtitle and the projected form.
 */
@Component({
  selector: 'app-auth-card',
  imports: [BrandLogo],
  template: `
    <main class="auth-shell">
      <section class="auth-card" role="region" [attr.aria-label]="title()">
        <div class="auth-brand">
          <app-brand-logo [priority]="true" />
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
