import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { OutreachPreAttendances } from '../../components/outreach-pre-attendances/outreach-pre-attendances';
import { OutreachService } from '../../outreach.service';
import {
  STATUS_LABELS,
  STATUS_TONES,
  type Outreach,
  type OutreachPreAttendance,
} from '../../outreach.models';

/**
 * Full-list page for an outreach's pre-registrations
 * (`/sorties/:uuid/pre-inscriptions`) — reached from the manage page, whose card
 * is only a read-only glance.
 *
 * This is where a sign-up is confirmed into a presence, once the sortie has
 * started. There is no deletion for now.
 */
@Component({
  selector: 'app-outreach-pre-attendances-list',
  imports: [RouterLink, OutreachPreAttendances],
  host: { class: 'list-page' },
  templateUrl: './outreach-pre-attendances-list.html',
  styleUrl: './outreach-pre-attendances-list.scss',
})
export class OutreachPreAttendancesList implements OnInit {
  private readonly service = inject(OutreachService);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly outreach = signal<Outreach | null>(null);
  protected readonly items = signal<OutreachPreAttendance[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Row whose confirm is in flight. */
  protected readonly busyUuid = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  /** Presences can only be recorded once the sortie is under way (or for a late roll call). */
  protected readonly canConfirm = computed(() => {
    const status = this.outreach()?.status;
    return status === 'IN_PROGRESS' || status === 'FINISHED';
  });

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

    this.service.preAttendances(this.uuid()).subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(messageFromError(err, 'Chargement des pré-inscriptions impossible.'));
        this.loading.set(false);
      },
    });
  }

  /** Turn a sign-up into a presence. */
  protected confirm(item: OutreachPreAttendance): void {
    if (this.busyUuid()) {
      return;
    }
    this.busyUuid.set(item.uuid);
    this.actionError.set(null);
    this.service.confirmPreAttendance(item.uuid).subscribe({
      next: (updated) => {
        this.busyUuid.set(null);
        this.items.update((list) => list.map((p) => (p.uuid === updated.uuid ? updated : p)));
      },
      error: (err) => {
        this.busyUuid.set(null);
        this.actionError.set(messageFromError(err, 'Confirmation impossible.'));
      },
    });
  }
}
