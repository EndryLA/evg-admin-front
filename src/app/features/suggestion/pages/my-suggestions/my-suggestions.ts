import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr } from '../../../../shared/util/date.util';
import {
  SuggestionForm,
  type SuggestionFormValue,
} from '../../components/suggestion-form/suggestion-form';
import { SuggestionService } from '../../suggestion.service';
import {
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_STATUS_TONES,
  type Suggestion,
} from '../../suggestion.models';

/**
 * Mes suggestions — the one suggestion page every member has: send a new idea
 * (modal) and follow the ones already sent, with their status and the reply.
 * Rows open the suggestion, where the author can still edit it while pending.
 */
@Component({
  selector: 'app-my-suggestions',
  imports: [SuggestionForm],
  host: { class: 'data-list' },
  templateUrl: './my-suggestions.html',
  styleUrl: './my-suggestions.scss',
})
export class MySuggestions {
  private readonly service = inject(SuggestionService);
  private readonly router = inject(Router);

  protected readonly items = signal<Suggestion[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  /** Title of the suggestion just sent, shown in a confirmation banner. */
  protected readonly justSent = signal<string | null>(null);

  protected readonly statusLabels = SUGGESTION_STATUS_LABELS;
  protected readonly statusTones = SUGGESTION_STATUS_TONES;
  protected readonly formatDate = formatDateFr;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.mine().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement de vos suggestions impossible.'));
        this.loading.set(false);
      },
    });
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
        this.justSent.set(created.title);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(messageFromError(err, 'Envoi de la suggestion impossible.'));
      },
    });
  }
}
