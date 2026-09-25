import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr } from '../../../../shared/util/date.util';
import {
  formatSize,
  personName,
  TICKET_ATTACHMENT_ACCEPT,
  TICKET_ATTACHMENT_RULES,
  ticketAttachmentProblem,
  type Ticket,
  type TicketAttachment,
} from '../../project.models';
import { TicketService } from '../../ticket.service';

/**
 * A ticket's files. On an existing ticket, files are uploaded right away and
 * the updated ticket is emitted ({@link changed}); on a new one ({@link ticket}
 * null) picked files are kept and reported through {@link pendingChange}, and
 * the parent uploads them once the ticket exists. Images get thumbnails; a
 * click opens images/videos/PDFs in a tab and downloads Office files.
 */
@Component({
  selector: 'app-ticket-attachments',
  templateUrl: './ticket-attachments.html',
  styleUrl: './ticket-attachments.scss',
})
export class TicketAttachments {
  private readonly service = inject(TicketService);

  /** The ticket, or `null` while it is being created. */
  readonly ticket = input<Ticket | null>(null);
  /** Managers and contributors add and remove files; viewers only open them. */
  readonly canEdit = input(false);

  readonly changed = output<Ticket>();
  readonly pendingChange = output<File[]>();

  protected readonly pending = signal<File[]>([]);
  protected readonly thumbs = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly accept = TICKET_ATTACHMENT_ACCEPT;
  protected readonly maxFiles = TICKET_ATTACHMENT_RULES.maxFiles;
  protected readonly formatSize = formatSize;
  protected readonly formatDate = formatDateFr;
  protected readonly personName = personName;

  constructor() {
    // Image thumbnails, reloaded when the attachment list changes.
    effect((onCleanup) => {
      const ticket = this.ticket();
      const images = (ticket?.attachments ?? []).filter((a) => a.kind === 'IMAGE');
      const urls = new Map<string, string>();
      const subs = images.map((a) =>
        this.service.attachmentBlob(ticket!.uuid, a.uuid).subscribe({
          next: (blob) => {
            urls.set(a.uuid, URL.createObjectURL(blob));
            this.thumbs.set(new Map(urls));
          },
        }),
      );
      onCleanup(() => {
        subs.forEach((s) => s.unsubscribe());
        urls.forEach((url) => URL.revokeObjectURL(url));
      });
    });
    inject(DestroyRef).onDestroy(() => this.thumbs().forEach((url) => URL.revokeObjectURL(url)));
  }

  protected count(): number {
    return (this.ticket()?.attachments.length ?? 0) + this.pending().length;
  }

  protected onPick(inputEl: HTMLInputElement): void {
    const files = Array.from(inputEl.files ?? []);
    inputEl.value = '';
    this.error.set(null);
    if (this.count() + files.length > this.maxFiles) {
      this.error.set(`${this.maxFiles} fichiers maximum par ticket.`);
      return;
    }
    const problem = files.map(ticketAttachmentProblem).find((p) => p !== null);
    if (problem) {
      this.error.set(problem);
      return;
    }
    const ticket = this.ticket();
    if (!ticket) {
      this.pending.update((list) => [...list, ...files]);
      this.pendingChange.emit(this.pending());
      return;
    }
    this.busy.set(true);
    this.service.addAttachments(ticket.uuid, files).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.changed.emit(updated);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(messageFromError(err, 'Envoi des fichiers impossible.'));
      },
    });
  }

  protected removePending(file: File): void {
    this.pending.update((list) => list.filter((f) => f !== file));
    this.pendingChange.emit(this.pending());
  }

  protected remove(attachment: TicketAttachment): void {
    const ticket = this.ticket();
    if (!ticket) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.service.removeAttachment(ticket.uuid, attachment.uuid).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.changed.emit(updated);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(messageFromError(err, 'Suppression du fichier impossible.'));
      },
    });
  }

  /** Images, videos and PDFs open in a new tab; Office files are downloaded under their name. */
  protected open(attachment: TicketAttachment): void {
    const ticket = this.ticket();
    if (!ticket) {
      return;
    }
    const inline = attachment.kind !== 'DOCUMENT' || attachment.contentType === 'application/pdf';
    // Opened synchronously so the browser doesn't treat it as a pop-up.
    const tab = inline ? window.open('', '_blank') : null;
    this.service.attachmentBlob(ticket.uuid, attachment.uuid).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (tab) {
          tab.location.href = url;
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.download = attachment.fileName;
          link.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) => {
        tab?.close();
        this.error.set(messageFromError(err, 'Ouverture du fichier impossible.'));
      },
    });
  }

  protected extension(name: string): string {
    return name.includes('.') ? name.split('.').pop()!.toUpperCase().slice(0, 4) : 'FICH';
  }
}
