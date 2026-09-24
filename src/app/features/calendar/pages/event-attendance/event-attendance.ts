import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ACCESS } from '../../../../core/auth/access';
import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import {
  presenceName,
  type PreRegistration,
  type Presence,
  type PresenceInput,
} from '../../../../shared/attendance/attendance.models';
import { AttendanceForm } from '../../../../shared/ui/attendance-form/attendance-form';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { PreRegistrationTable } from '../../../../shared/ui/pre-registration-table/pre-registration-table';
import { PresenceTable } from '../../../../shared/ui/presence-table/presence-table';
import { formatDateFr, formatTimeFr } from '../../../../shared/util/date.util';
import { CalendarService } from '../../calendar.service';
import {
  CALENDAR_STATUS_LABELS,
  CALENDAR_STATUS_TONES,
  EVENT_TYPE_LABELS,
  type CalendarEvent,
} from '../../calendar.models';

/**
 * Pre-registrations and presences of one calendar event
 * (`/planning/evenements/:uuid/presences`) — the event counterpart of a
 * sortie's two list pages, on a single page since an event has no gestion hub.
 *
 * Sign-ups come in through the public monthly page; they are confirmed into
 * presences from the day of the event on. Admins can also add someone who
 * turned up without signing up, and remove a wrong presence. Presences at
 * events never count in the outreach stats.
 */
@Component({
  selector: 'app-event-attendance',
  imports: [RouterLink, PreRegistrationTable, PresenceTable, AttendanceForm, ConfirmDialog],
  host: { class: 'list-page' },
  templateUrl: './event-attendance.html',
  styleUrl: './event-attendance.scss',
})
export class EventAttendance implements OnInit {
  private readonly service = inject(CalendarService);
  private readonly auth = inject(AuthService);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly event = signal<CalendarEvent | null>(null);
  protected readonly eventError = signal<string | null>(null);

  protected readonly preRegistrations = signal<PreRegistration[]>([]);
  protected readonly preLoading = signal(true);
  protected readonly preError = signal<string | null>(null);
  /** Sign-up whose confirm is in flight. */
  protected readonly busyUuid = signal<string | null>(null);
  protected readonly confirmError = signal<string | null>(null);

  protected readonly presences = signal<Presence[]>([]);
  protected readonly presencesLoading = signal(true);
  protected readonly presencesError = signal<string | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  /** Presence awaiting delete confirmation. */
  protected readonly toRemove = signal<Presence | null>(null);
  protected readonly removing = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly canManage = this.auth.hasAnyRole(ACCESS.attendances);
  protected readonly name = presenceName;

  /** Today as `YYYY-MM-DD`, read once so the page stays stable while open. */
  private readonly today = toIsoDate(new Date());

  /** Presences are recorded from the day of the event on, unless it was cancelled. */
  protected readonly canConfirm = computed(() => {
    const e = this.event();
    return !!e?.date && e.date <= this.today && e.status !== 'CANCELLED';
  });

  protected readonly typeLabel = computed(() => {
    const e = this.event();
    return e ? EVENT_TYPE_LABELS[e.type] : 'Événement';
  });
  protected readonly statusLabel = computed(() => {
    const e = this.event();
    return e ? CALENDAR_STATUS_LABELS[e.status] : '';
  });
  protected readonly statusTone = computed(() => {
    const e = this.event();
    return e ? CALENDAR_STATUS_TONES[e.status] : 'grey';
  });
  /** `12/10/2026 · 12:30` */
  protected readonly scheduleLabel = computed(() => {
    const e = this.event();
    if (!e) {
      return '';
    }
    const start = formatTimeFr(e.startTime);
    return start === '—' ? formatDateFr(e.date) : `${formatDateFr(e.date)} · ${start}`;
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.eventError.set(null);
    this.service.getEvent(this.uuid()).subscribe({
      next: (data) => this.event.set(data),
      error: (err) =>
        this.eventError.set(messageFromError(err, "Chargement de l'événement impossible.")),
    });
    this.loadPreRegistrations();
    this.loadPresences();
  }

  protected loadPreRegistrations(): void {
    this.preLoading.set(true);
    this.preError.set(null);
    this.service.preRegistrations(this.uuid()).subscribe({
      next: (data) => {
        this.preRegistrations.set(data);
        this.preLoading.set(false);
      },
      error: (err) => {
        this.preError.set(messageFromError(err, 'Chargement des pré-inscriptions impossible.'));
        this.preLoading.set(false);
      },
    });
  }

  protected loadPresences(): void {
    this.presencesLoading.set(true);
    this.presencesError.set(null);
    this.service.presences(this.uuid()).subscribe({
      next: (data) => {
        this.presences.set(data);
        this.presencesLoading.set(false);
      },
      error: (err) => {
        this.presencesError.set(messageFromError(err, 'Chargement des présences impossible.'));
        this.presencesLoading.set(false);
      },
    });
  }

  // ---- Confirm a sign-up ----
  protected confirm(item: PreRegistration): void {
    if (this.busyUuid()) {
      return;
    }
    this.busyUuid.set(item.uuid);
    this.confirmError.set(null);
    this.service.confirmPreRegistration(item.uuid).subscribe({
      next: (updated) => {
        this.busyUuid.set(null);
        this.preRegistrations.update((list) =>
          list.map((p) => (p.uuid === updated.uuid ? updated : p)),
        );
        // The new presence was created server-side.
        this.loadPresences();
      },
      error: (err) => {
        this.busyUuid.set(null);
        this.confirmError.set(messageFromError(err, 'Confirmation impossible.'));
      },
    });
  }

  // ---- Add a presence ----
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
  protected onSave(input: PresenceInput): void {
    this.saving.set(true);
    this.saveError.set(null);
    this.service.addPresence(this.uuid(), input).subscribe({
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

  // ---- Remove a presence ----
  protected askRemove(presence: Presence): void {
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
    this.service.removePresence(current.uuid).subscribe({
      next: () => {
        this.presences.update((list) => list.filter((p) => p.uuid !== current.uuid));
        this.removing.set(false);
        this.toRemove.set(null);
        // A sign-up confirmed into that presence reads as unconfirmed again.
        this.loadPreRegistrations();
      },
      error: (err) => {
        this.removing.set(false);
        this.toRemove.set(null);
        this.actionError.set(messageFromError(err, 'Suppression impossible.'));
      },
    });
  }
}

/** A `Date` as `YYYY-MM-DD`, in local time. */
function toIsoDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}
