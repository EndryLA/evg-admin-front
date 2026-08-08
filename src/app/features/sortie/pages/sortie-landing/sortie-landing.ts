import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ContactEditTokenStore } from '../../../../core/contact-edit/contact-edit-token.store';
import { BrandLogo } from '../../../../shared/ui/brand-logo/brand-logo';
import { SortieService } from '../../sortie.service';

/**
 * Public, unauthenticated landing page (`/sortie/:uuid`) shown when someone
 * opens a sortie's shared link or QR code. Lets them pick between marking their
 * presence and recording the contacts they met, then routes to the matching
 * public form under the same outreach.
 *
 * Once they have submitted at least one contact for this outreach, a third
 * choice appears for going back and editing what they saved.
 */
@Component({
  selector: 'app-sortie-landing',
  imports: [RouterLink, BrandLogo],
  templateUrl: './sortie-landing.html',
  styleUrl: './sortie-landing.scss',
})
export class SortieLanding implements OnInit {
  private readonly service = inject(SortieService);
  private readonly tokens = inject(ContactEditTokenStore);

  /** Outreach id from the route, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly outreachName = signal('');
  /** Whether a stored edit token exists — drives the "modifier" choice. */
  protected readonly hasSaved = signal(false);

  ngOnInit(): void {
    // Best-effort context: show which sortie this is, if the lookup succeeds.
    this.service.outreachName(this.uuid()).subscribe((name) => this.outreachName.set(name));
    this.hasSaved.set(this.tokens.read(this.uuid()) != null);
  }
}
