import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr, formatLongDateFr, formatTimeFr } from '../../../../shared/util/date.util';
import { DashboardService } from '../../dashboard.service';
import {
  STATUS_LABELS,
  STATUS_TONES,
  type DashboardCounts,
  type DashboardOutreach,
} from '../../dashboard.models';

const EMPTY_COUNTS: DashboardCounts = {
  members: 0,
  ouvriers: 0,
  aides: 0,
};

/**
 * Landing page of the admin space (`/tableau-de-bord`) — a read-only overview
 * built around the next sortie: when it is and how to jump straight into its
 * gestion page, plus the roster's headline count.
 */
@Component({
  selector: 'app-dashboard-home',
  imports: [RouterLink],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
})
export class DashboardHome implements OnInit {
  private readonly service = inject(DashboardService);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  /** The sortie the page is built around: the soonest one still ahead. */
  protected readonly nextOutreach = signal<DashboardOutreach | null>(null);
  protected readonly counts = signal<DashboardCounts>(EMPTY_COUNTS);

  /** Today as `YYYY-MM-DD`, read once so the page stays stable while open. */
  private readonly today = toIsoDate(new Date());

  protected readonly todayLabel = formatLongDateFr(this.today);

  /** The signed-in member's first name, once their profile has loaded. */
  private readonly firstname = signal('');

  /** `Bonjour Marie`, or a name-less `Bonjour` while it loads / when unlinked. */
  protected readonly greeting = computed(() => {
    const first = this.firstname().trim();
    return first ? `Bonjour ${first}` : 'Bonjour';
  });

  /** `08/08/2026 - 14:00` — the day and the start time, or the day alone. */
  protected readonly nextScheduleLabel = computed(() => {
    const o = this.nextOutreach();
    if (!o) {
      return '';
    }
    const day = formatDateFr(o.date);
    const start = formatTimeFr(o.startTime);
    return start === '—' ? day : `${day} - ${start}`;
  });

  protected readonly nextStatusLabel = computed(() => {
    const o = this.nextOutreach();
    return o ? STATUS_LABELS[o.status] : '';
  });

  protected readonly nextStatusTone = computed(() => {
    const o = this.nextOutreach();
    return o ? STATUS_TONES[o.status] : 'grey';
  });

  /** `Aujourd'hui` / `Demain` / `Dans 5 jours` — how far off the next sortie is. */
  protected readonly countdownLabel = computed(() => {
    const o = this.nextOutreach();
    if (!o) {
      return '';
    }
    if (o.status === 'IN_PROGRESS') {
      return 'En cours';
    }
    const days = daysBetween(this.today, o.date);
    if (days === null) {
      return 'Date à définir';
    }
    if (days <= 0) {
      return "Aujourd'hui";
    }
    return days === 1 ? 'Demain' : `Dans ${days} jours`;
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    const account = this.auth.currentUser();

    this.service
      .load(this.today, {
        profileUuid: account?.profileUuid ?? null,
        email: account?.email ?? null,
      })
      .subscribe({
        next: (data) => {
          this.firstname.set(data.firstname);
          this.nextOutreach.set(data.next);
          this.counts.set(data.counts);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loadError.set(
            messageFromError(error, 'Impossible de charger le tableau de bord.'),
          );
          this.loading.set(false);
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

/** Whole days from `from` to `to` (both `YYYY-MM-DD`), or `null` when unknown. */
function daysBetween(from: string, to: string | null): number | null {
  if (!to) {
    return null;
  }
  const start = Date.parse(`${from}T00:00:00`);
  const end = Date.parse(`${to}T00:00:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }
  return Math.round((end - start) / 86_400_000);
}
