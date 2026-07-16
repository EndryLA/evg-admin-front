import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, type Observable } from 'rxjs';
import { toDataURL } from 'qrcode';

import { messageFromError } from '../../../../core/http/http-error.util';
import { OutreachCloseDialog } from '../../components/outreach-close-dialog/outreach-close-dialog';
import { OutreachStartDialog } from '../../components/outreach-start-dialog/outreach-start-dialog';
import { OutreachContacts } from '../../components/outreach-contacts/outreach-contacts';
import { OutreachPresences } from '../../components/outreach-presences/outreach-presences';
import { OutreachService } from '../../outreach.service';
import {
  STATUS_LABELS,
  STATUS_TONES,
  type ContactEntry,
  type Outreach,
  type OutreachAttendance,
} from '../../outreach.models';

/**
 * Manage page for one outreach (`/sorties/:uuid/gestion`) — the operational
 * controls: lifecycle status, participant count, and a QR code linking to the
 * public contact form. Status and participants persist through dedicated PATCH
 * endpoints, independent of the outreach's core fields (edited on Details).
 */
@Component({
  selector: 'app-outreach-manage',
  imports: [RouterLink, OutreachCloseDialog, OutreachStartDialog, OutreachContacts, OutreachPresences],
  host: { class: 'manage-page', '(document:keydown.escape)': 'closeQr()' },
  templateUrl: './outreach-manage.html',
  styleUrl: './outreach-manage.scss',
})
export class OutreachManage implements OnInit {
  private readonly service = inject(OutreachService);
  private readonly document = inject(DOCUMENT);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly outreach = signal<Outreach | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly contacts = signal<ContactEntry[]>([]);
  protected readonly contactsLoading = signal(true);
  protected readonly contactsError = signal<string | null>(null);

  protected readonly presences = signal<OutreachAttendance[]>([]);
  protected readonly presencesLoading = signal(true);
  protected readonly presencesError = signal<string | null>(null);

  protected readonly startOpen = signal(false);
  protected readonly closeOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly qrDataUrl = signal<string>('');
  protected readonly presenceQrDataUrl = signal<string>('');
  /** Which public link, if any, was just copied — drives the "Copié" state. */
  protected readonly copied = signal<'contact' | 'presence' | null>(null);
  // Fullscreen QR overlay — holds whichever code was opened.
  protected readonly qrOpen = signal(false);
  protected readonly qrFsSrc = signal<string>('');
  protected readonly qrFsUrl = signal<string>('');

  protected readonly statusLabel = computed(() => {
    const o = this.outreach();
    return o ? STATUS_LABELS[o.status] : '';
  });
  protected readonly statusTone = computed(() => {
    const o = this.outreach();
    return o ? STATUS_TONES[o.status] : 'grey';
  });

  protected readonly publicFormPath = computed(() => `/sortie/${this.uuid()}/contact`);
  protected readonly publicFormUrl = computed(
    () => `${this.document.location.origin}${this.publicFormPath()}`,
  );

  protected readonly publicPresencePath = computed(() => `/sortie/${this.uuid()}/presence`);
  protected readonly publicPresenceUrl = computed(
    () => `${this.document.location.origin}${this.publicPresencePath()}`,
  );

  ngOnInit(): void {
    this.load();
    // Render at high resolution so each code stays crisp when opened fullscreen.
    toDataURL(this.publicFormUrl(), { width: 640, margin: 1 }).then(
      (url) => this.qrDataUrl.set(url),
      () => this.qrDataUrl.set(''),
    );
    toDataURL(this.publicPresenceUrl(), { width: 640, margin: 1 }).then(
      (url) => this.presenceQrDataUrl.set(url),
      () => this.presenceQrDataUrl.set(''),
    );
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

    this.contactsLoading.set(true);
    this.contactsError.set(null);
    this.service.contactEntries(this.uuid()).subscribe({
      next: (data) => {
        this.contacts.set(data);
        this.contactsLoading.set(false);
      },
      error: (err) => {
        this.contactsError.set(messageFromError(err, 'Chargement des contacts impossible.'));
        this.contactsLoading.set(false);
      },
    });

    this.presencesLoading.set(true);
    this.presencesError.set(null);
    this.service.attendances(this.uuid()).subscribe({
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

  protected openStart(): void {
    this.saveError.set(null);
    this.startOpen.set(true);
  }
  protected cancelStart(): void {
    this.startOpen.set(false);
  }

  /** Move a planned outreach into the in-progress state. */
  protected start(): void {
    const current = this.outreach();
    if (!current || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    this.service.setStatus(this.uuid(), 'IN_PROGRESS').subscribe({
      next: (o) => {
        this.saving.set(false);
        this.startOpen.set(false);
        this.outreach.set(o);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(messageFromError(err, 'Démarrage impossible.'));
      },
    });
  }

  protected openClose(): void {
    this.saveError.set(null);
    this.closeOpen.set(true);
  }
  protected cancelClose(): void {
    this.closeOpen.set(false);
  }

  /** Record the final participant count and mark the sortie as finished. */
  protected confirmClose(participants: number): void {
    const current = this.outreach();
    if (!current || this.saving()) {
      return;
    }

    const calls: Observable<Outreach>[] = [
      this.service.setParticipants(this.uuid(), participants),
    ];
    if (current.status !== 'FINISHED') {
      calls.push(this.service.setStatus(this.uuid(), 'FINISHED'));
    }

    this.saving.set(true);
    this.saveError.set(null);
    forkJoin(calls).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeOpen.set(false);
        // Re-fetch for a consistent snapshot after the parallel patches.
        this.service.getOne(this.uuid()).subscribe((o) => this.outreach.set(o));
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(messageFromError(err, 'Clôture impossible.'));
      },
    });
  }

  protected openQr(src: string, url: string): void {
    if (src) {
      this.qrFsSrc.set(src);
      this.qrFsUrl.set(url);
      this.qrOpen.set(true);
    }
  }
  protected closeQr(): void {
    this.qrOpen.set(false);
  }

  protected copyLink(url: string, which: 'contact' | 'presence'): void {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (!clipboard) {
      return;
    }
    clipboard.writeText(url).then(() => {
      this.copied.set(which);
      setTimeout(() => this.copied.set(null), 2000);
    }, () => undefined);
  }
}
