import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ThemeService } from '../../../core/theme/theme.service';

/**
 * Brand logo that follows the active theme: the dark-ink mark on light
 * backgrounds, the white mark on dark ones. Surfaces that stay dark in both
 * themes (the sidebar) should keep using `assets/logo-white.svg` directly.
 */
@Component({
  selector: 'app-brand-logo',
  imports: [NgOptimizedImage],
  template: `
    <img
      [ngSrc]="src()"
      [width]="width()"
      [height]="height()"
      [priority]="priority()"
      alt="Département Évangélisation" />
  `,
  styles: `
    :host { display: block; }
    img { height: 100%; width: auto; max-width: 100%; display: block; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogo {
  private readonly theme = inject(ThemeService);

  /** Intrinsic size hints for NgOptimizedImage; CSS still drives the rendered size. */
  readonly width = input(220);
  readonly height = input(65);

  /** Set on above-the-fold logos so the mark is preloaded. */
  readonly priority = input(false);

  protected readonly src = computed(() =>
    this.theme.isDark() ? 'assets/logo-white.svg' : 'assets/logo.svg',
  );
}
