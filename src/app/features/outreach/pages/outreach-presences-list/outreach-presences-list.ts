import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { OutreachPresences } from '../../components/outreach-presences/outreach-presences';
import { OutreachService } from '../../outreach.service';
import {
  STATUS_LABELS,
  STATUS_TONES,
  type Outreach,
  type OutreachAttendance,
} from '../../outreach.models';

/**
 * Full-list page for an outreach's presences (`/sorties/:uuid/presences`) —
 * reached from the "Voir tout" link on the manage page's presences card. Shows
 * every entry through the shared {@link OutreachPresences} card in expanded mode.
 */
@Component({
  selector: 'app-outreach-presences-list',
  imports: [RouterLink, OutreachPresences],
  host: { class: 'list-page' },
  templateUrl: './outreach-presences-list.html',
  styleUrl: './outreach-presences-list.scss',
})
export class OutreachPresencesList implements OnInit {
  private readonly service = inject(OutreachService);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly outreach = signal<Outreach | null>(null);
  protected readonly presences = signal<OutreachAttendance[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly statusLabel = computed(() => {
    const o = this.outreach();
    return o ? STATUS_LABELS[o.status] : '';
  });
  protected readonly statusTone = computed(() => {
    const o = this.outreach();
    return o ? STATUS_TONES[o.status] : 'grey';
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getOne(this.uuid()).subscribe({
      next: (data) => this.outreach.set(data),
      error: (err) =>
        this.error.set(messageFromError(err, 'Chargement de la sortie impossible.')),
    });

    this.service.attendances(this.uuid()).subscribe({
      next: (data) => {
        this.presences.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(messageFromError(err, 'Chargement des présences impossible.'));
        this.loading.set(false);
      },
    });
  }
}
