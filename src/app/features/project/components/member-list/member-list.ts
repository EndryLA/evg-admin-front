import { Component, computed, inject, input, output, signal } from '@angular/core';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { formatDateFr } from '../../../../shared/util/date.util';
import { ProjectService } from '../../project.service';
import {
  CLOSED_TICKET_STATUSES,
  personName,
  PROJECT_ROLES,
  PROJECT_ROLE_HINTS,
  PROJECT_ROLE_LABELS,
  PROJECT_ROLE_TONES,
  type Project,
  type ProjectMember,
  type ProjectRole,
  type Ticket,
} from '../../project.models';
import { MemberAddDialog, type NewMember } from '../member-add-dialog/member-add-dialog';
import { OwnerTransferDialog } from '../owner-transfer-dialog/owner-transfer-dialog';

const ROLE_ORDER: readonly ProjectRole[] = ['OWNER', 'MANAGER', 'CONTRIBUTOR', 'VIEWER'];

/**
 * Membres tab: the project's members, their role and open tickets. Managers
 * add, re-role and remove contributors and viewers; the owner (or a super
 * admin) also handles managers and hands the project over from the toolbar's
 * « Transférer la propriété » modal — OWNER is never offered in the role list. Removed members
 * and members made viewers lose their assignments (the backend does it).
 * Emits the updated project.
 */
@Component({
  selector: 'app-member-list',
  imports: [MemberAddDialog, OwnerTransferDialog, ConfirmDialog],
  templateUrl: './member-list.html',
  styleUrl: './member-list.scss',
})
export class MemberList {
  private readonly service = inject(ProjectService);

  readonly project = input.required<Project>();
  /** The project's tickets, to count what each member has open. */
  readonly tickets = input<Ticket[]>([]);
  readonly changed = output<Project>();

  protected readonly adding = signal(false);
  protected readonly removing = signal<ProjectMember | null>(null);
  protected readonly transferring = signal(false);
  protected readonly query = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly personName = personName;
  protected readonly formatDate = formatDateFr;
  /** Roles the caller may give: managers can't make managers. */
  protected readonly roles = computed(() =>
    this.project().canLead ? PROJECT_ROLES : PROJECT_ROLES.filter((r) => r !== 'MANAGER'),
  );
  protected readonly roleLabels = PROJECT_ROLE_LABELS;
  protected readonly roleHints = PROJECT_ROLE_HINTS;
  protected readonly roleTones = PROJECT_ROLE_TONES;

  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.project()
      .members.filter((m) => !q || personName(m.person).toLowerCase().includes(q))
      .sort(
        (a, b) =>
          ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
          personName(a.person).localeCompare(personName(b.person), 'fr'),
      );
  });

  /** Open (not done/cancelled) tickets per member uuid. */
  protected readonly openTickets = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.tickets()) {
      if (t.assignee && !CLOSED_TICKET_STATUSES.includes(t.status)) {
        counts.set(t.assignee.uuid, (counts.get(t.assignee.uuid) ?? 0) + 1);
      }
    }
    return counts;
  });

  protected initials(member: ProjectMember): string {
    const p = member.person;
    return `${p.firstname.charAt(0)}${p.lastname.charAt(0)}`.toUpperCase() || '?';
  }

  protected openAdd(): void {
    this.error.set(null);
    this.adding.set(true);
  }

  protected onAdd(member: NewMember): void {
    this.run(this.service.addMember(this.project().uuid, member.profileUuid, member.role), () =>
      this.adding.set(false),
    );
  }

  /**
   * Saves a role change. On failure the select is put back by hand — the bound
   * data didn't change, so Angular wouldn't touch it.
   */
  protected onRoleChange(member: ProjectMember, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const role = select.value as ProjectRole;
    this.busy.set(true);
    this.error.set(null);
    this.service.setMemberRole(this.project().uuid, member.person.uuid, role).subscribe({
      next: (project) => {
        this.busy.set(false);
        this.changed.emit(project);
      },
      error: (err) => {
        this.busy.set(false);
        select.value = member.role;
        this.error.set(messageFromError(err, 'Changement de rôle impossible.'));
      },
    });
  }

  protected onRemove(): void {
    const member = this.removing();
    if (member) {
      this.run(this.service.removeMember(this.project().uuid, member.person.uuid), () =>
        this.removing.set(null),
      );
    }
  }

  protected onTransfer(profileUuid: string): void {
    this.run(this.service.transferOwnership(this.project().uuid, profileUuid), () =>
      this.transferring.set(false),
    );
  }

  private run(request: ReturnType<ProjectService['addMember']>, done: () => void): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (project) => {
        this.busy.set(false);
        done();
        this.changed.emit(project);
      },
      error: (err) => {
        this.busy.set(false);
        // The confirm dialog can't show errors: close it so the list's alert does.
        this.removing.set(null);
        this.error.set(messageFromError(err, 'La mise à jour des membres a échoué.'));
      },
    });
  }
}
