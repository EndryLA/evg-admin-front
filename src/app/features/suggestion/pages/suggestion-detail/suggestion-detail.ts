import { Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ACCESS } from '../../../../core/auth/access';
import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { formatDateFr } from '../../../../shared/util/date.util';
import { AttachmentGallery } from '../../components/attachment-gallery/attachment-gallery';
import { CreateTicketDialog } from '../../components/create-ticket-dialog/create-ticket-dialog';
import { ReviewDialog } from '../../components/review-dialog/review-dialog';
import {
  SuggestionForm,
  type SuggestionFormValue,
} from '../../components/suggestion-form/suggestion-form';
import { SuggestionService } from '../../suggestion.service';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_RULES,
  attachmentProblem,
  LINKABLE_STATUSES,
  personName,
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_STATUS_TONES,
  type ReviewDecision,
  type Suggestion,
  type SuggestionAttachment,
} from '../../suggestion.models';

/**
 * One suggestion. The author can edit, add/remove media or delete it while it
 * is pending; a super admin accepts or rejects it with a message, and can
 * change that decision until a ticket takes the suggestion into account.
 */
@Component({
  selector: 'app-suggestion-detail',
  imports: [RouterLink, AttachmentGallery, ReviewDialog, SuggestionForm, ConfirmDialog, CreateTicketDialog],
  templateUrl: './suggestion-detail.html',
  styleUrl: './suggestion-detail.scss',
})
export class SuggestionDetail implements OnInit {
  private readonly service = inject(SuggestionService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** Route param (component input binding). */
  readonly uuid = input.required<string>();

  protected readonly suggestion = signal<Suggestion | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly reviewing = signal<ReviewDecision | null>(null);
  protected readonly editing = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly statusLabels = SUGGESTION_STATUS_LABELS;
  protected readonly statusTones = SUGGESTION_STATUS_TONES;
  protected readonly personName = personName;
  protected readonly formatDate = formatDateFr;
  protected readonly accept = ATTACHMENT_ACCEPT;

  /** Admins come from the full list; everyone else from their own. */
  private readonly canViewAll = computed(() => this.auth.hasAnyRole(ACCESS.suggestions));
  protected readonly backLink = computed(() =>
    this.canViewAll() ? '/suggestions' : '/mes-suggestions',
  );
  protected readonly backLabel = computed(() =>
    this.canViewAll() ? 'Suggestions' : 'Mes suggestions',
  );

  protected readonly isAuthor = computed(() => {
    const author = this.suggestion()?.author;
    return !!author && author.uuid === this.auth.currentUser()?.profileUuid;
  });
  /** Author actions are only open while nobody has answered yet. */
  protected readonly authorCanEdit = computed(
    () => this.isAuthor() && this.suggestion()?.status === 'PENDING',
  );
  /** The backend freezes the decision once a ticket takes the suggestion into account. */
  protected readonly canReview = computed(() => {
    const s = this.suggestion();
    return (
      this.auth.hasAnyRole(ACCESS.suggestionReview) &&
      !!s &&
      s.ticketCount === 0 &&
      s.status !== 'IMPLEMENTED'
    );
  });
  /** Accepted suggestions can be turned into a ticket by whoever links them. */
  protected readonly canCreateTicket = computed(() => {
    const s = this.suggestion();
    return !!s && this.auth.hasAnyRole(ACCESS.suggestionReview) && LINKABLE_STATUSES.includes(s.status);
  });
  protected readonly creatingTicket = signal(false);

  protected readonly canAddFiles = computed(
    () =>
      this.authorCanEdit() &&
      (this.suggestion()?.attachments.length ?? 0) < ATTACHMENT_RULES.maxFiles,
  );

  ngOnInit(): void {
    // `uuid` (a required route input) is only bound after construction.
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getOne(this.uuid()).subscribe({
      next: (s) => {
        this.suggestion.set(s);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Suggestion introuvable ou inaccessible.'));
        this.loading.set(false);
      },
    });
  }

  /** Re-reads the suggestion without the loading state (keeps open dialogs mounted). */
  protected refresh(): void {
    this.service.getOne(this.uuid()).subscribe({ next: (s) => this.suggestion.set(s) });
  }

  // ---- Review (super admin) ----
  protected openReview(decision: ReviewDecision): void {
    this.actionError.set(null);
    this.reviewing.set(decision);
  }

  protected onReview(message: string): void {
    const decision = this.reviewing();
    if (!decision) {
      return;
    }
    this.run(this.service.review(this.uuid(), decision, message), () => this.reviewing.set(null));
  }

  // ---- Author actions ----
  protected openEdit(): void {
    this.actionError.set(null);
    this.editing.set(true);
  }

  protected onEdit(value: SuggestionFormValue): void {
    this.run(this.service.update(this.uuid(), value.input), () => this.editing.set(false));
  }

  protected onAddFiles(inputEl: HTMLInputElement): void {
    const files = Array.from(inputEl.files ?? []);
    inputEl.value = '';
    const current = this.suggestion()?.attachments.length ?? 0;
    this.actionError.set(null);
    if (current + files.length > ATTACHMENT_RULES.maxFiles) {
      this.actionError.set(`${ATTACHMENT_RULES.maxFiles} fichiers maximum par suggestion.`);
      return;
    }
    const problem = files.map(attachmentProblem).find((p) => p !== null);
    if (problem) {
      this.actionError.set(problem);
      return;
    }
    if (files.length) {
      this.run(this.service.addAttachments(this.uuid(), files));
    }
  }

  protected onRemoveAttachment(attachment: SuggestionAttachment): void {
    this.actionError.set(null);
    this.run(this.service.removeAttachment(this.uuid(), attachment.uuid));
  }

  protected onDelete(): void {
    this.busy.set(true);
    this.service.remove(this.uuid()).subscribe({
      next: () => void this.router.navigate([this.backLink()]),
      error: (err) => {
        this.busy.set(false);
        this.confirmDelete.set(false);
        this.actionError.set(messageFromError(err, 'Suppression impossible.'));
      },
    });
  }

  /** Runs a request that returns the updated suggestion, then closes whatever asked for it. */
  private run(request: ReturnType<SuggestionService['getOne']>, done?: () => void): void {
    this.busy.set(true);
    request.subscribe({
      next: (s) => {
        this.suggestion.set(s);
        this.busy.set(false);
        done?.();
      },
      error: (err) => {
        this.busy.set(false);
        this.actionError.set(messageFromError(err, 'L’opération a échoué.'));
      },
    });
  }
}
