import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ACCESS } from '../../../../core/auth/access';
import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr } from '../../../../shared/util/date.util';
import { CreateTicketDialog } from '../../components/create-ticket-dialog/create-ticket-dialog';
import {
  SuggestionForm,
  type SuggestionFormValue,
} from '../../components/suggestion-form/suggestion-form';
import { SuggestionService } from '../../suggestion.service';
import {
  LINKABLE_STATUSES,
  personName,
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_STATUS_TONES,
  SUGGESTION_STATUSES,
  type Suggestion,
  type SuggestionStatus,
} from '../../suggestion.models';

/** Strip accents & lowercase for accent-insensitive search. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Suggestions — every suggestion, for admins. Opens on the "En attente" tab so
 * what needs a decision comes first; rows open the detail page where the
 * review happens. New suggestions are submitted from here too, and the super
 * admin can tick accepted suggestions to turn them into a ticket.
 */
@Component({
  selector: 'app-suggestion-list',
  imports: [SuggestionForm, CreateTicketDialog],
  host: { class: 'data-list' },
  templateUrl: './suggestion-list.html',
  styleUrl: './suggestion-list.scss',
})
export class SuggestionList {
  private readonly service = inject(SuggestionService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly items = signal<Suggestion[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly tab = signal<SuggestionStatus | 'ALL'>('PENDING');
  protected readonly query = signal('');

  /** Only whoever may link suggestions to tickets gets the selection column. */
  protected readonly canCreateTickets = computed(() => this.auth.hasAnyRole(ACCESS.suggestionReview));
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly selection = computed(() =>
    this.items().filter((s) => this.selected().has(s.uuid)),
  );
  /** Suggestions the open "Créer un ticket" dialog works on (a snapshot of the selection). */
  protected readonly ticketSources = signal<Suggestion[] | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly statuses = SUGGESTION_STATUSES;
  protected readonly statusLabels = SUGGESTION_STATUS_LABELS;
  protected readonly statusTones = SUGGESTION_STATUS_TONES;
  protected readonly personName = personName;
  protected readonly formatDate = formatDateFr;

  protected readonly counts = computed(() => {
    const counts: Record<string, number> = { ALL: this.items().length };
    for (const s of this.items()) {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
    }
    return counts;
  });

  protected readonly rows = computed(() => {
    const tab = this.tab();
    const q = normalize(this.query().trim());
    return this.items().filter(
      (s) =>
        (tab === 'ALL' || s.status === tab) &&
        (!q || normalize(`${s.title} ${s.description} ${personName(s.author)}`).includes(q)),
    );
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des suggestions impossible.'));
        this.loading.set(false);
      },
    });
  }

  protected isLinkable(s: Suggestion): boolean {
    return LINKABLE_STATUSES.includes(s.status);
  }

  protected toggle(s: Suggestion): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(s.uuid)) {
        next.delete(s.uuid);
      } else {
        next.add(s.uuid);
      }
      return next;
    });
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  protected openTicketDialog(): void {
    this.ticketSources.set(this.selection());
  }

  /** The dialog stays open on its success step; the list refreshes behind it. */
  protected onTicketCreated(): void {
    this.clearSelection();
    this.load();
  }

  protected view(s: Suggestion): void {
    void this.router.navigate(['/suggestions', s.uuid]);
  }

  protected openCreate(): void {
    this.saveError.set(null);
    this.formOpen.set(true);
  }

  protected onSave(value: SuggestionFormValue): void {
    this.saving.set(true);
    this.saveError.set(null);
    this.service.create(value.input, value.files).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.items.update((list) => [created, ...list]);
        this.tab.set('PENDING');
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(messageFromError(err, 'Envoi de la suggestion impossible.'));
      },
    });
  }
}
