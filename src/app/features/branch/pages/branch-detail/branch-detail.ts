import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { BranchForm } from '../../components/branch-form/branch-form';
import { BranchMembershipService } from '../../branch-membership.service';
import { BranchService } from '../../branch.service';
import {
  refName,
  type Branch,
  type BranchInput,
  type BranchMember,
  type BranchRole,
  type Option,
} from '../../branch.models';

/**
 * Full-page detail for one branch (`/branches/:uuid`). Loads the branch, its
 * member assignments (formerly "affectations") and the role/profile pickers,
 * and hosts the assignment add/remove, the edit modal and the delete
 * confirmation.
 */
@Component({
  selector: 'app-branch-detail',
  imports: [RouterLink, BranchForm, ConfirmDialog],
  host: { class: 'detail-page' },
  templateUrl: './branch-detail.html',
  styleUrl: './branch-detail.scss',
})
export class BranchDetail implements OnInit {
  private readonly service = inject(BranchService);
  private readonly membershipService = inject(BranchMembershipService);
  private readonly router = inject(Router);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly branch = signal<Branch | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly members = signal<BranchMember[]>([]);
  protected readonly membersLoading = signal(true);
  protected readonly membersError = signal<string | null>(null);

  protected readonly roles = signal<BranchRole[]>([]);
  protected readonly profiles = signal<Option[]>([]);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly deleting = signal(false);
  protected readonly addingMember = signal(false);
  protected readonly removingMemberUuid = signal<string | null>(null);

  // ---- Add-member local form state ----
  protected readonly newProfile = signal('');
  protected readonly newRole = signal('');

  protected readonly refName = refName;

  /** Profiles not already assigned to this branch. */
  protected readonly availableProfiles = computed<Option[]>(() => {
    const taken = new Set(
      this.members()
        .map((m) => m.profile?.uuid)
        .filter((id): id is string => !!id),
    );
    return this.profiles().filter((p) => !taken.has(p.uuid));
  });

  constructor() {
    this.service.roles().subscribe({
      next: (list) => this.roles.set(list),
      error: () => this.roles.set([]),
    });
    this.service.profiles().subscribe({
      next: (list) => this.profiles.set(list),
      error: () => this.profiles.set([]),
    });
  }

  ngOnInit(): void {
    // `uuid` (a required route input) is only bound after construction, so the
    // initial load must wait until here.
    this.load();
  }

  protected load(): void {
    const id = this.uuid();
    this.loading.set(true);
    this.loadError.set(null);
    this.service.get(id).subscribe({
      next: (data) => {
        this.branch.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement de la branche impossible.'));
        this.loading.set(false);
      },
    });
    this.loadMembers();
  }

  private loadMembers(): void {
    const id = this.uuid();
    this.membersLoading.set(true);
    this.membersError.set(null);
    this.membershipService.list().subscribe({
      next: (all) => {
        this.members.set(all.filter((m) => m.branchUuid === id));
        this.membersLoading.set(false);
      },
      error: (err) => {
        this.membersError.set(messageFromError(err, 'Chargement des membres impossible.'));
        this.membersLoading.set(false);
      },
    });
  }

  // ---- Member assignments ----
  protected addMember(): void {
    const profileUuid = this.newProfile();
    if (!profileUuid || this.addingMember()) {
      return;
    }
    this.addingMember.set(true);
    this.membershipService
      .add({ profileUuid, branchUuid: this.uuid(), branchRoleUuid: this.newRole() || null })
      .subscribe({
        next: () => {
          this.addingMember.set(false);
          this.newProfile.set('');
          this.newRole.set('');
          this.loadMembers();
        },
        error: () => this.addingMember.set(false),
      });
  }
  protected removeMember(member: BranchMember): void {
    this.removingMemberUuid.set(member.uuid);
    this.membershipService.remove(member.uuid).subscribe({
      next: () => {
        this.removingMemberUuid.set(null);
        this.loadMembers();
      },
      error: () => this.removingMemberUuid.set(null),
    });
  }

  // ---- Edit ----
  protected openEdit(): void {
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
  }
  protected onSave(input: BranchInput): void {
    const current = this.branch();
    if (!current) {
      return;
    }
    this.saving.set(true);
    this.service.update(current.uuid, input).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.branch.set(updated);
        this.formOpen.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  // ---- Delete ----
  protected askDelete(): void {
    this.confirmOpen.set(true);
  }
  protected cancelDelete(): void {
    this.confirmOpen.set(false);
  }
  protected confirmDelete(): void {
    const current = this.branch();
    if (!current) {
      return;
    }
    this.deleting.set(true);
    this.service.remove(current.uuid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmOpen.set(false);
        this.router.navigate(['/branches']);
      },
      error: () => this.deleting.set(false),
    });
  }
}
