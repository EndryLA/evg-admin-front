import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { formatDateFr, formatTimeFr } from '../../../../shared/util/date.util';
import { OutreachForm } from '../../components/outreach-form/outreach-form';
import { OutreachService } from '../../outreach.service';
import {
  STATUS_LABELS,
  STATUS_TONES,
  type Outreach,
  type OutreachInput,
} from '../../outreach.models';

/**
 * Full-page detail for one outreach (`/sorties/:uuid`) — its own fields only,
 * plus the edit modal and delete confirmation that previously lived in the
 * list's slide-over. Contacts and présences are reached from the gestion page.
 */
@Component({
  selector: 'app-outreach-detail',
  imports: [RouterLink, OutreachForm, ConfirmDialog],
  host: { class: 'detail-page' },
  templateUrl: './outreach-detail.html',
  styleUrl: './outreach-detail.scss',
})
export class OutreachDetail implements OnInit {
  private readonly service = inject(OutreachService);
  private readonly router = inject(Router);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly outreach = signal<Outreach | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly deleting = signal(false);

  protected readonly fmtDate = formatDateFr;
  protected readonly fmtTime = formatTimeFr;

  protected readonly statusLabel = computed(() => {
    const o = this.outreach();
    return o ? STATUS_LABELS[o.status] : '';
  });
  protected readonly statusTone = computed(() => {
    const o = this.outreach();
    return o ? STATUS_TONES[o.status] : 'grey';
  });

  ngOnInit(): void {
    // `uuid` (a required route input) is only bound after construction, so the
    // initial load must wait until here.
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getOne(this.uuid()).subscribe({
      next: (data) => {
        this.outreach.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement de la sortie impossible.'));
        this.loading.set(false);
      },
    });
  }

  protected openEdit(): void {
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
  }
  protected onSave(input: OutreachInput): void {
    const current = this.outreach();
    if (!current) {
      return;
    }
    this.saving.set(true);
    this.service.update(current.uuid, input).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.outreach.set(updated);
        this.formOpen.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  protected askDelete(): void {
    this.confirmOpen.set(true);
  }
  protected cancelDelete(): void {
    this.confirmOpen.set(false);
  }
  protected confirmDelete(): void {
    const current = this.outreach();
    if (!current) {
      return;
    }
    this.deleting.set(true);
    this.service.remove(current.uuid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmOpen.set(false);
        this.router.navigate(['/sorties']);
      },
      error: () => this.deleting.set(false),
    });
  }
}
