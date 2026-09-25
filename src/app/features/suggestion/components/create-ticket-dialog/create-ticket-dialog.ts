import { Component, computed, inject, input, type OnInit, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DialogFocus } from '../../../../shared/ui/dialog-focus/dialog-focus';
import { messageFromError } from '../../../../core/http/http-error.util';
import { SuggestionService } from '../../suggestion.service';
import {
  ticketDraftFrom,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  type CreatedTicket,
  type ProjectOption,
  type Suggestion,
  type TicketPriority,
} from '../../suggestion.models';

/**
 * "Créer un ticket" from one or more accepted suggestions: pick the project,
 * adjust the prefilled title/description, optionally a type and priority. The
 * ticket is created with the suggestions already linked (one request), then
 * the dialog offers to open the project.
 */
@Component({
  selector: 'app-create-ticket-dialog',
  imports: [RouterLink, DialogFocus],
  host: { class: 'modal-form', '(keydown.escape)': 'close.emit()' },
  templateUrl: './create-ticket-dialog.html',
  styleUrl: './create-ticket-dialog.scss',
})
export class CreateTicketDialog implements OnInit {
  private readonly service = inject(SuggestionService);

  readonly suggestions = input.required<Suggestion[]>();
  /** Emitted once the ticket exists, so the parent can refresh its suggestions. */
  readonly created = output<CreatedTicket>();
  readonly close = output<void>();

  protected readonly projects = signal<ProjectOption[]>([]);
  protected readonly loadingProjects = signal(true);
  protected readonly projectUuid = signal('');
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly typeUuid = signal('');
  protected readonly priority = signal<TicketPriority>('NORMAL');
  protected readonly tried = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<CreatedTicket | null>(null);

  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;

  protected readonly project = computed(() =>
    this.projects().find((p) => p.uuid === this.projectUuid()),
  );
  protected readonly valid = computed(() => !!this.projectUuid() && !!this.title().trim());

  ngOnInit(): void {
    const draft = ticketDraftFrom(this.suggestions());
    this.title.set(draft.title);
    this.description.set(draft.description);
    this.service.projectOptions().subscribe({
      next: (projects) => {
        const open = projects.filter((p) => !p.archived);
        this.projects.set(open);
        if (open.length === 1) {
          this.projectUuid.set(open[0].uuid);
        }
        this.loadingProjects.set(false);
      },
      error: (err) => {
        this.error.set(messageFromError(err, 'Chargement des projets impossible.'));
        this.loadingProjects.set(false);
      },
    });
  }

  protected selectProject(uuid: string): void {
    this.projectUuid.set(uuid);
    // Types belong to a project.
    this.typeUuid.set('');
  }

  protected submit(): void {
    this.tried.set(true);
    if (!this.valid() || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.service
      .createTicket({
        projectUuid: this.projectUuid(),
        suggestionUuids: this.suggestions().map((s) => s.uuid),
        title: this.title(),
        description: this.description(),
        typeUuid: this.typeUuid() || null,
        priority: this.priority(),
      })
      .subscribe({
        next: (ticket) => {
          this.busy.set(false);
          this.result.set(ticket);
          this.created.emit(ticket);
        },
        error: (err) => {
          this.busy.set(false);
          this.error.set(messageFromError(err, 'Création du ticket impossible.'));
        },
      });
  }
}
