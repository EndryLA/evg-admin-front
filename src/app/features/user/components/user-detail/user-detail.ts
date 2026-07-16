import { Component, computed, input, output } from '@angular/core';

import { refName, roleLabel, roleTone, statusLabel, statusTone, type User } from '../../user.models';

/**
 * Right-hand slide-over showing one account's detail. An account's e-mail,
 * role and member are fixed once created (the backend exposes no update), so
 * the actions here are the two that exist: granting or revoking access, and
 * re-sending the activation e-mail to an account that has not been enabled.
 * Purely presentational — the parent owns the data and the requests.
 */
@Component({
  selector: 'app-user-detail',
  host: { class: 'slideover', '(keydown.escape)': 'close.emit()' },
  templateUrl: './user-detail.html',
})
export class UserDetail {
  readonly user = input.required<User>();
  /** `true` while the status change is in flight. */
  readonly statusBusy = input(false);
  /** `true` while the activation link is being re-sent. */
  readonly resendBusy = input(false);
  /** Confirmation shown after the link was re-sent. */
  readonly resent = input(false);
  /** Failure from the last action, if any. */
  readonly error = input<string | null>(null);

  readonly close = output<void>();
  readonly resend = output<void>();
  /** Requests the account be enabled, or disabled when already enabled. */
  readonly toggleStatus = output<void>();

  protected readonly roleLabel = computed(() => roleLabel(this.user().role));
  protected readonly roleTone = computed(() => roleTone(this.user().role));
  protected readonly statusLabel = computed(() => statusLabel(this.user().enabled));
  protected readonly statusTone = computed(() => statusTone(this.user().enabled));
  protected readonly member = computed(() => refName(this.user().profile));
}
