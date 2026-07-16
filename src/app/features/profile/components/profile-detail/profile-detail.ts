import { Component, computed, input, output } from '@angular/core';

import { PhoneFrPipe } from '../../../../shared/pipes/phone.pipe';
import { ageLabel, formatDateFr } from '../../../../shared/util/date.util';
import { fullName, MEMBERSHIP_LABELS, type Profile } from '../../profile.models';

/**
 * Right-hand slide-over showing one profile's full detail, with Modifier /
 * Supprimer actions. Purely presentational — the parent owns the data.
 */
@Component({
  selector: 'app-profile-detail',
  imports: [PhoneFrPipe],
  host: { class: 'slideover', '(keydown.escape)': 'close.emit()' },
  templateUrl: './profile-detail.html',
})
export class ProfileDetail {
  readonly profile = input.required<Profile>();

  readonly close = output<void>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  protected readonly name = computed(() => fullName(this.profile()));
  protected readonly typeLabel = computed(() => {
    const type = this.profile().membershipType;
    return type ? MEMBERSHIP_LABELS[type] : '—';
  });
  protected readonly joinedYear = computed(() => this.profile().joinedAt ?? '—');
  protected readonly age = computed(() => ageLabel(this.profile().birthDate));

  protected readonly fmtDate = formatDateFr;
}
