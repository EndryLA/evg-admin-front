import { NgOptimizedImage } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SortieService } from '../../sortie.service';

/**
 * Public, unauthenticated landing page (`/sortie/:uuid`) shown when someone
 * opens a sortie's shared link or QR code. Lets them pick between marking their
 * presence and recording the contacts they met, then routes to the matching
 * public form under the same outreach.
 */
@Component({
  selector: 'app-sortie-landing',
  imports: [RouterLink, NgOptimizedImage],
  templateUrl: './sortie-landing.html',
  styleUrl: './sortie-landing.scss',
})
export class SortieLanding implements OnInit {
  private readonly service = inject(SortieService);

  /** Outreach id from the route, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly outreachName = signal('');

  ngOnInit(): void {
    // Best-effort context: show which sortie this is, if the lookup succeeds.
    this.service.outreachName(this.uuid()).subscribe((name) => this.outreachName.set(name));
  }
}
