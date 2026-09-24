import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toDataURL } from 'qrcode';

import { messageFromError } from '../../../../core/http/http-error.util';
import { OutreachCloseDialog } from '../../components/outreach-close-dialog/outreach-close-dialog';
import { OutreachStartDialog } from '../../components/outreach-start-dialog/outreach-start-dialog';
import { OutreachContacts } from '../../components/outreach-contacts/outreach-contacts';
import { PreRegistrationTable } from '../../../../shared/ui/pre-registration-table/pre-registration-table';
import { PresenceTable } from '../../../../shared/ui/presence-table/presence-table';
import { OutreachService } from '../../outreach.service';
import {
  STATUS_LABELS,
  STATUS_TONES,
  type ContactEntry,
  type Outreach,
  type OutreachAttendance,
  type OutreachPreAttendance,
} from '../../outreach.models';

/**
 * Manage page for one outreach (`/sorties/:uuid/gestion`) — the operational
 * controls: lifecycle status, and QR codes linking to the public contact and
 * presence forms. Status persists through a dedicated PATCH endpoint,
 * independent of the outreach's core fields (edited on Details).
 *
 * Also shows a read-only glance at the sortie's pre-registrations — confirming
 * them into presences happens on their own full-list page.
 */
@Component({
  selector: 'app-outreach-manage',
  imports: [
    RouterLink,
    OutreachCloseDialog,
    OutreachStartDialog,
    OutreachContacts,
    PreRegistrationTable,
    PresenceTable,
  ],
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

  protected readonly preAttendances = signal<OutreachPreAttendance[]>([]);
  protected readonly preLoading = signal(true);
  protected readonly preError = signal<string | null>(null);

  protected readonly startOpen = signal(false);
  protected readonly closeOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly qrDataUrl = signal<string>('');
  /** The link that was just copied, if any — drives its button's "Copié" state. */
  protected readonly copiedUrl = signal<string | null>(null);
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

  protected readonly publicFormPath = computed(() => `/sortie/${this.uuid()}`);
  protected readonly publicFormUrl = computed(
    () => `${this.document.location.origin}${this.publicFormPath()}`,
  );

  /** Separate public sign-up page, shared ahead of a planned sortie. */
  protected readonly signupPath = computed(() => `/inscription/${this.uuid()}`);
  protected readonly signupUrl = computed(
    () => `${this.document.location.origin}${this.signupPath()}`,
  );

  ngOnInit(): void {
    this.load();
    // Render at high resolution so the code stays crisp when opened fullscreen.
    toDataURL(this.publicFormUrl(), { width: 640, margin: 1 }).then(
      (url) => this.qrDataUrl.set(url),
      () => this.qrDataUrl.set(''),
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

    this.loadPresences();
    this.loadPreAttendances();
  }

  private loadPresences(): void {
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

  protected loadPreAttendances(): void {
    this.preLoading.set(true);
    this.preError.set(null);
    this.service.preAttendances(this.uuid()).subscribe({
      next: (data) => {
        this.preAttendances.set(data);
        this.preLoading.set(false);
      },
      error: (err) => {
        this.preError.set(messageFromError(err, 'Chargement des pré-inscriptions impossible.'));
        this.preLoading.set(false);
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

  /** Mark the sortie as finished, recording the head count entered in the dialog. */
  protected confirmClose(totalPresences: number): void {
    const current = this.outreach();
    if (!current || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    this.service.setStatus(this.uuid(), 'FINISHED', totalPresences).subscribe({
      next: (o) => {
        this.saving.set(false);
        this.closeOpen.set(false);
        this.outreach.set(o);
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

  protected copyLink(url: string): void {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (!clipboard) {
      return;
    }
    clipboard.writeText(url).then(() => {
      this.copiedUrl.set(url);
      setTimeout(() => {
        if (this.copiedUrl() === url) {
          this.copiedUrl.set(null);
        }
      }, 2000);
    }, () => undefined);
  }
}
