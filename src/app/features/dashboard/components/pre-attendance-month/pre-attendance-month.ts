import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatTimeFr, monthYearLabel } from '../../../../shared/util/date.util';
import { DashboardService } from '../../dashboard.service';
import { STATUS_LABELS, STATUS_TONES, type MonthPreAttendance } from '../../dashboard.models';

const MONTHS_SHORT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** `YYYY-MM` of a local date. */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** `YYYY-MM` shifted by `delta` months. */
function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  return monthKey(new Date(year, month - 1 + delta, 1));
}

/**
 * Dashboard card: each sortie of a month — and each event open to sign-ups —
 * with how many people pre-registered and how many of them were confirmed
 * present. Opens on the current month, with arrows to browse; each row leads to
 * its pre-registration list.
 * The button below copies the picked month's public sign-up link.
 */
@Component({
  selector: 'app-pre-attendance-month',
  imports: [RouterLink],
  templateUrl: './pre-attendance-month.html',
  styleUrl: './pre-attendance-month.scss',
})
export class PreAttendanceMonth implements OnInit, OnDestroy {
  private readonly service = inject(DashboardService);
  private readonly document = inject(DOCUMENT);

  private readonly currentMonth = monthKey(new Date());

  protected readonly month = signal(this.currentMonth);
  protected readonly rows = signal<MonthPreAttendance[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly monthLabel = computed(() => monthYearLabel(`${this.month()}-01`));
  protected readonly isCurrentMonth = computed(() => this.month() === this.currentMonth);
  protected readonly isPastMonth = computed(() => this.month() < this.currentMonth);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusTones = STATUS_TONES;

  /** Set for a moment after the link was copied. */
  protected readonly copied = signal(false);
  private copiedTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.copiedTimer);
  }

  /** Copy the picked month's public sign-up link (`/inscription/mois/:month`). */
  protected copyLink(): void {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (!clipboard) {
      return;
    }
    const url = `${this.document.location.origin}/inscription/mois/${this.month()}`;
    clipboard.writeText(url).then(() => {
      this.copied.set(true);
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copied.set(false), 2000);
    }, () => undefined);
  }

  protected load(): void {
    const month = this.month();
    this.loading.set(true);
    this.error.set(null);
    this.service.preAttendanceMonth(month).subscribe({
      next: (rows) => {
        // Ignore a late answer for a month the user already moved away from.
        if (this.month() !== month) {
          return;
        }
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        if (this.month() !== month) {
          return;
        }
        this.error.set(messageFromError(err, 'Chargement des pré-inscriptions impossible.'));
        this.loading.set(false);
      },
    });
  }

  protected shift(delta: number): void {
    this.month.update((m) => shiftMonth(m, delta));
    this.load();
  }

  protected goToCurrent(): void {
    this.month.set(this.currentMonth);
    this.load();
  }

  /** A sortie's pre-registration list, or an event's sign-ups and presences page. */
  protected link(row: MonthPreAttendance): unknown[] {
    return row.kind === 'EVENT'
      ? ['/planning/evenements', row.uuid, 'presences']
      : ['/sorties', row.uuid, 'pre-inscriptions'];
  }

  /** Day of month for the calendar tile, or `—`. */
  protected day(row: MonthPreAttendance): string {
    const match = /^\d{4}-\d{2}-(\d{2})/.exec(row.date ?? '');
    return match ? String(Number(match[1])) : '—';
  }

  protected monthShort(row: MonthPreAttendance): string {
    const match = /^\d{4}-(\d{2})/.exec(row.date ?? '');
    return match ? (MONTHS_SHORT[Number(match[1]) - 1] ?? '') : '';
  }

  /** `11:00`, or empty when unknown. */
  protected time(row: MonthPreAttendance): string {
    const start = formatTimeFr(row.startTime);
    return start === '—' ? '' : start;
  }
}
