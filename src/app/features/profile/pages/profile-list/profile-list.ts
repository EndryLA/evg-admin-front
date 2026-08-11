import { Component, computed, inject, OnDestroy, signal } from '@angular/core';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ProfileDetail } from '../../components/profile-detail/profile-detail';
import { ProfileForm } from '../../components/profile-form/profile-form';
import { ProfileService } from '../../profile.service';
import {
  EMPTY_PROFILE_FILTER,
  fullName,
  leaderTone,
  MEMBERSHIP_LABELS,
  type MembershipType,
  type Profile,
  type ProfileFilter,
  type ProfileFormResult,
} from '../../profile.models';

/** The type-tab selection: all types, or one {@link MembershipType}. */
type TypeFilter = ProfileFilter['membershipType'];

/** One team: its leader plus the members reporting to them. */
interface TeamGroup {
  /** Group key — a leader uuid, or {@link NO_TEAM} for unassigned members. */
  leaderUuid: string;
  /** Card title, e.g. "Équipe Ephraim" or "Sans équipe". */
  title: string;
  /** Badge tone, keyed by leader uuid so it matches the rest of the app. */
  tone: string;
  members: Profile[];
}

/** Group key for members with no team leader — always sorted last. */
const NO_TEAM = '__no_team__';

/** Debounce before the free-text search triggers a server reload. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Effectif — the members roster, grouped by team. The whole filtered set is
 * fetched at once (`GET /api/profiles` with `ProfileFilter`, one large page):
 * teams and their head-counts can't be built from a partial page, and the
 * department is small enough for this to stay cheap. Members with no leader
 * assigned still appear, under a trailing "Sans équipe" card.
 *
 * Each team is a collapsible card; a member row opens the detail slide-over.
 * Search, type, 1ᵉʳ-département, team leader and the joined-year range are all
 * applied server-side, so any change reloads the list.
 */
@Component({
  selector: 'app-profile-list',
  imports: [ProfileDetail, ProfileForm, ConfirmDialog],
  host: { class: 'data-list' },
  templateUrl: './profile-list.html',
  styleUrl: './profile-list.scss',
})
export class ProfileList implements OnDestroy {
  private readonly service = inject(ProfileService);

  // ---- Data ----
  private readonly rows = signal<Profile[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  /**
   * Team leaders — the "Chef d'équipe" options in both the filter and the form.
   * Fetched unfiltered, unlike {@link rows}, which only holds the current match.
   */
  protected readonly leaders = signal<Profile[]>([]);

  // ---- Filters ----
  protected readonly filter = signal<ProfileFilter>({ ...EMPTY_PROFILE_FILTER });

  /** True when any filter is narrowing the list (drives the reset button). */
  protected readonly hasActiveFilters = computed(() => {
    const f = this.filter();
    return (
      f.search.trim() !== '' ||
      f.membershipType !== 'ALL' ||
      f.firstDepartment !== null ||
      f.leaderUuid !== null ||
      f.minJoinedAt !== null ||
      f.maxJoinedAt !== null
    );
  });

  /** Active drawer filters (search excluded — it stays visible). Drives the badge. */
  protected readonly activeFilterCount = computed(() => {
    const f = this.filter();
    return (
      (f.membershipType !== 'ALL' ? 1 : 0) +
      (f.firstDepartment !== null ? 1 : 0) +
      (f.leaderUuid !== null ? 1 : 0) +
      (f.minJoinedAt !== null ? 1 : 0) +
      (f.maxJoinedAt !== null ? 1 : 0)
    );
  });

  /** The 1ᵉʳ-département chip is a toggle: on = `true`, off = unconstrained. */
  protected readonly deptOnly = computed(() => this.filter().firstDepartment === true);

  // ---- Grouping ----
  /** Leader uuids whose card is expanded. Everything starts collapsed. */
  private readonly openTeams = signal<ReadonlySet<string>>(new Set());

  /**
   * The loaded members bucketed by team, biggest first. Every team leader gets a
   * card even when the current filter matches none of their members, so the list
   * of teams stays stable instead of appearing and vanishing as you filter.
   * Members with no leader collect in a trailing "Sans équipe" card, so the
   * roster always accounts for everyone.
   */
  protected readonly teams = computed<TeamGroup[]>(() => {
    const byLeader = new Map<string, TeamGroup>();

    for (const leader of this.leaders()) {
      byLeader.set(leader.uuid, {
        leaderUuid: leader.uuid,
        title: `Équipe ${leader.firstname}`,
        tone: leaderTone(leader.uuid),
        members: [],
      });
    }

    for (const profile of this.rows()) {
      // A leader reports to nobody, so they carry no `leaderUuid` — key them to
      // their own team instead of letting them fall into "Sans équipe".
      const key = profile.isTeamLeader ? profile.uuid : profile.leaderUuid ?? NO_TEAM;
      let group = byLeader.get(key);
      if (!group) {
        // A leader referenced by a member but missing from `leaders()` (not
        // flagged `isTeamLeader`) still gets a card — nobody goes unlisted.
        group = {
          leaderUuid: key,
          title: profile.isTeamLeader
            ? `Équipe ${profile.firstname}`
            : profile.leaderFirstname
              ? `Équipe ${profile.leaderFirstname}`
              : 'Sans équipe',
          tone: leaderTone(key === NO_TEAM ? null : key),
          members: [],
        };
        byLeader.set(key, group);
      }
      group.members.push(profile);
    }

    // The chef heads their own roster; everyone else keeps the server's order.
    for (const group of byLeader.values()) {
      group.members.sort(
        (a, b) => Number(b.uuid === group.leaderUuid) - Number(a.uuid === group.leaderUuid),
      );
    }

    return [...byLeader.values()].sort((a, b) => {
      // "Sans équipe" is a leftover bucket, not a team — it stays at the bottom.
      if ((a.leaderUuid === NO_TEAM) !== (b.leaderUuid === NO_TEAM)) {
        return a.leaderUuid === NO_TEAM ? 1 : -1;
      }
      return b.members.length - a.members.length || a.title.localeCompare(b.title, 'fr');
    });
  });

  /** Real teams, excluding the "Sans équipe" bucket — drives the subtitle. */
  protected readonly teamCount = computed(
    () => this.teams().filter((t) => t.leaderUuid !== NO_TEAM).length,
  );

  /** Every member currently loaded. */
  protected readonly shownCount = computed(() => this.rows().length);

  /**
   * Open state is held solely by {@link openTeams} — a click must always win, so
   * nothing here may force a card open. Filters seed the set on load instead
   * (see {@link syncOpenTeams}).
   */
  protected isOpen(leaderUuid: string): boolean {
    return this.openTeams().has(leaderUuid);
  }

  protected toggleTeam(leaderUuid: string): void {
    this.openTeams.update((open) => {
      const next = new Set(open);
      if (next.has(leaderUuid)) {
        next.delete(leaderUuid);
      } else {
        next.add(leaderUuid);
      }
      return next;
    });
  }

  // ---- Overlays ----
  /** Mobile-only: the bottom filter drawer. */
  protected readonly filterDrawerOpen = signal(false);
  protected readonly selected = signal<Profile | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly formProfile = signal<Profile | null>(null);
  protected readonly saving = signal(false);
  protected readonly confirmTarget = signal<Profile | null>(null);
  protected readonly deleting = signal(false);

  protected readonly fullName = fullName;
  protected membershipLabel(type: MembershipType | null): string {
    return type ? MEMBERSHIP_LABELS[type] : '—';
  }

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
    this.loadLeaders();
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  // ---- Loading ----
  /** (Re)fetch the whole filtered set — on load and whenever a filter changes. */
  protected load(): void {
    this.loadError.set(null);
    this.loading.set(true);
    this.service.listAll(this.filter()).subscribe({
      next: (all) => {
        this.rows.set(all);
        this.loading.set(false);
        this.syncOpenTeams(all);
      },
      error: (err) => {
        this.rows.set([]);
        this.loadError.set(messageFromError(err, 'Chargement des profils impossible.'));
        this.loading.set(false);
      },
    });
  }

  /**
   * Seed which cards start open after a load: a filtered list would otherwise
   * hide its own results behind collapsed cards, so it opens the teams that
   * matched. An unfiltered list starts fully collapsed. Toggling afterwards is
   * always the user's call — this only runs on load.
   */
  private syncOpenTeams(loaded: Profile[]): void {
    if (!this.hasActiveFilters()) {
      this.openTeams.set(new Set());
      return;
    }
    // Same key rule as `teams()`, so a matched leader opens their own card.
    this.openTeams.set(
      new Set(loaded.map((p) => (p.isTeamLeader ? p.uuid : p.leaderUuid ?? NO_TEAM))),
    );
  }

  /** Best-effort: the filter/form leader options degrade to empty on failure. */
  private loadLeaders(): void {
    this.service.listAll().subscribe({
      next: (all) => this.leaders.set(all.filter((p) => p.isTeamLeader)),
      error: () => this.leaders.set([]),
    });
  }

  // ---- Filter handlers (all reload the list) ----
  /** Patch one filter field and reload. */
  private applyFilter(patch: Partial<ProfileFilter>): void {
    this.filter.update((f) => ({ ...f, ...patch }));
    this.load();
  }

  /** Free-text search — debounced so typing doesn't fire a request per key. */
  protected onSearch(value: string): void {
    this.filter.update((f) => ({ ...f, search: value }));
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }

  protected setTab(membershipType: TypeFilter): void {
    this.applyFilter({ membershipType });
  }
  protected toggleDept(): void {
    this.applyFilter({ firstDepartment: this.deptOnly() ? null : true });
  }
  protected setLeader(value: string): void {
    this.applyFilter({ leaderUuid: value === 'ALL' ? null : value });
  }
  protected setMinJoinedAt(value: string): void {
    this.applyFilter({ minJoinedAt: toYear(value) });
  }
  protected setMaxJoinedAt(value: string): void {
    this.applyFilter({ maxJoinedAt: toYear(value) });
  }

  /** Clear every filter back to its default. */
  protected resetFilters(): void {
    clearTimeout(this.searchTimer);
    this.filter.set({ ...EMPTY_PROFILE_FILTER });
    this.load();
  }

  // ---- Detail ----
  protected view(profile: Profile): void {
    this.selected.set(profile);
  }
  protected closeDetail(): void {
    this.selected.set(null);
  }

  // ---- Filter drawer (mobile) ----
  protected openFilters(): void {
    this.filterDrawerOpen.set(true);
  }
  protected closeFilters(): void {
    this.filterDrawerOpen.set(false);
  }

  // ---- Create / edit ----
  protected openCreate(): void {
    this.formProfile.set(null);
    this.formOpen.set(true);
  }
  protected openEdit(profile: Profile): void {
    this.selected.set(null);
    this.formProfile.set(profile);
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
    this.formProfile.set(null);
  }
  protected onSave(result: ProfileFormResult): void {
    const editing = this.formProfile();
    const request$ = editing
      ? this.service.update(editing.uuid, result.input)
      : this.service.create(result.input);

    this.saving.set(true);
    request$.subscribe({
      next: (saved) => {
        // The team leader is assigned through a separate endpoint; only call it
        // when a leader was picked and it actually changed. (The backend has no
        // "unassign", so clearing to "Aucun" is a no-op here.)
        const leader = result.leaderUuid;
        if (leader && leader !== (editing?.leaderUuid ?? null)) {
          this.service.assignLeader(saved.uuid, leader).subscribe({
            next: () => this.finishSave(),
            error: () => this.finishSave(),
          });
        } else {
          this.finishSave();
        }
      },
      error: () => this.saving.set(false),
    });
  }

  private finishSave(): void {
    this.saving.set(false);
    this.closeForm();
    this.load();
    this.loadLeaders();
  }

  // ---- Delete ----
  protected askDelete(profile: Profile): void {
    this.selected.set(null);
    this.confirmTarget.set(profile);
  }
  protected cancelDelete(): void {
    this.confirmTarget.set(null);
  }
  protected confirmDelete(): void {
    const target = this.confirmTarget();
    if (!target) {
      return;
    }
    this.deleting.set(true);
    this.service.remove(target.uuid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmTarget.set(null);
        this.load();
        this.loadLeaders();
      },
      error: () => this.deleting.set(false),
    });
  }
}

/** Parse a year input to a number, or `null` when empty / not a year. */
function toYear(value: string): number | null {
  const year = Number(value.trim());
  return value.trim() !== '' && Number.isInteger(year) ? year : null;
}
