import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ProfileService } from '../../profile.service';
import { fullName, leaderTone, type Profile } from '../../profile.models';

/** Strip accents & lowercase for accent-insensitive search. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Responsables d'équipe — manage which members are team leaders. Lists the
 * current leaders (each with their badge colour and team size) with a demote
 * action, and a searchable roster to promote any other member. Promotion toggles
 * `isTeamLeader` via `PATCH /api/profiles/:uuid/team-leader`.
 */
@Component({
  selector: 'app-team-leader-manage',
  imports: [RouterLink],
  host: { class: 'leaders-page' },
  templateUrl: './team-leader-manage.html',
  styleUrl: './team-leader-manage.scss',
})
export class TeamLeaderManage {
  private readonly service = inject(ProfileService);

  protected readonly profiles = signal<Profile[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  /** The profile currently being promoted/demoted (disables its button). */
  protected readonly busyUuid = signal<string | null>(null);

  protected readonly query = signal('');

  protected readonly fullName = fullName;
  protected readonly leaderTone = leaderTone;

  constructor() {
    this.load();
  }

  /** Team leaders, sorted by first name. */
  protected readonly leaders = computed(() =>
    this.profiles()
      .filter((p) => p.isTeamLeader)
      .sort((a, b) => a.firstname.localeCompare(b.firstname, 'fr')),
  );

  /** Non-leader members matching the search, for the promotion roster. */
  protected readonly candidates = computed(() => {
    const q = normalize(this.query().trim());
    return this.profiles()
      .filter((p) => !p.isTeamLeader)
      .filter((p) => !q || normalize(fullName(p)).includes(q))
      .sort((a, b) => `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`, 'fr'));
  });

  /** Number of members reporting to each leader, keyed by leader uuid. */
  private readonly memberCountByLeader = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this.profiles()) {
      if (p.leaderUuid) {
        counts.set(p.leaderUuid, (counts.get(p.leaderUuid) ?? 0) + 1);
      }
    }
    return counts;
  });
  protected memberCount(uuid: string): number {
    return this.memberCountByLeader().get(uuid) ?? 0;
  }

  protected onSearch(value: string): void {
    this.query.set(value);
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.listAll().subscribe({
      next: (data) => {
        this.profiles.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des profils impossible.'));
        this.loading.set(false);
      },
    });
  }

  protected promote(profile: Profile): void {
    this.setLeader(profile, true);
  }
  protected demote(profile: Profile): void {
    this.setLeader(profile, false);
  }

  private setLeader(profile: Profile, teamLeader: boolean): void {
    if (this.busyUuid()) {
      return;
    }
    this.busyUuid.set(profile.uuid);
    this.service.setTeamLeader(profile.uuid, teamLeader).subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.load();
      },
      error: (err) => {
        this.busyUuid.set(null);
        this.loadError.set(messageFromError(err, 'Modification impossible.'));
      },
    });
  }
}
