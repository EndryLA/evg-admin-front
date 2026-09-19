import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ACCESS } from '../../../../core/auth/access';
import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { OutreachAttendanceForm } from '../../components/outreach-attendance-form/outreach-attendance-form';
import { OutreachPresences } from '../../components/outreach-presences/outreach-presences';
import { OutreachService } from '../../outreach.service';
import {
  STATUS_LABELS,
  STATUS_TONES,
  presenceName,
  type Outreach,
  type OutreachAttendance,
  type OutreachAttendanceInput,
} from '../../outreach.models';

/**
 * Full-list page for an outreach's presences (`/sorties/:uuid/presences`) —
 * reached from the manage page. Shows every entry through the shared
 * {@link OutreachPresences} table in expanded mode.
 *
 * Admins can add a missing person and remove a wrong one; there is no editing —
 * a bad record is removed and re-added. Everyone else sees the list read-only.
 */
@Component({
  selector: 'app-outreach-presences-list',
  imports: [RouterLink, OutreachPresences, OutreachAttendanceForm, ConfirmDialog],
  host: { class: 'list-page' },
  templateUrl: './outreach-presences-list.html',
  styleUrl: './outreach-presences-list.scss',
})
export class OutreachPresencesList implements OnInit {
  private readonly service = inject(OutreachService);
  private readonly auth = inject(AuthService);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly outreach = signal<Outreach | null>(null);
  protected readonly presences = signal<OutreachAttendance[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  /** Presence awaiting delete confirmation. */
  protected readonly toRemove = signal<OutreachAttendance | null>(null);
  protected readonly removing = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly canManage = this.auth.hasAnyRole(ACCESS.attendances);
  protected readonly name = presenceName;

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

  // ---- Add ----
  protected openAdd(): void {
    this.saveError.set(null);
    this.actionError.set(null);
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    if (!this.saving()) {
      this.formOpen.set(false);
    }
  }
  protected onSave(input: OutreachAttendanceInput): void {
    this.saving.set(true);
    this.saveError.set(null);
    this.service.createAttendance(this.uuid(), input).subscribe({
      next: (saved) => {
        this.presences.update((list) => [...list, saved]);
        this.saving.set(false);
        this.formOpen.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(messageFromError(err, 'Ajout impossible.'));
      },
    });
  }

  // ---- Remove ----
  protected askRemove(presence: OutreachAttendance): void {
    this.actionError.set(null);
    this.toRemove.set(presence);
  }
  protected cancelRemove(): void {
    if (!this.removing()) {
      this.toRemove.set(null);
    }
  }
  protected confirmRemove(): void {
    const current = this.toRemove();
    if (!current || this.removing()) {
      return;
    }
    this.removing.set(true);
    this.service.removeAttendance(current.uuid).subscribe({
      next: () => {
        this.presences.update((list) => list.filter((p) => p.uuid !== current.uuid));
        this.removing.set(false);
        this.toRemove.set(null);
      },
      error: (err) => {
        this.removing.set(false);
        this.toRemove.set(null);
        this.actionError.set(messageFromError(err, 'Suppression impossible.'));
      },
    });
  }
}
