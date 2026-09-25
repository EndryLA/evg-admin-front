import { Component, computed, inject, input, output, signal } from '@angular/core';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { formatDateFr } from '../../../../shared/util/date.util';
import { ProjectService } from '../../project.service';
import {
  CLOSED_TICKET_STATUSES,
  personName,
  type Project,
  type ProjectMember,
  type Ticket,
} from '../../project.models';
import { MemberAddDialog } from '../member-add-dialog/member-add-dialog';

/**
 * Membres tab: the project's members as a table, with their open tickets. The
 * manager adds people in a modal and removes anyone but the creator (their
 * tickets become unassigned — the backend does it). Emits the updated project.
 */
@Component({
  selector: 'app-member-list',
  imports: [MemberAddDialog, ConfirmDialog],
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
  protected readonly query = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly personName = personName;
  protected readonly formatDate = formatDateFr;

  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.project()
      .members.filter((m) => !q || personName(m.person).toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(b.creator) - Number(a.creator) ||
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

  protected onAdd(profileUuid: string): void {
    this.run(this.service.addMember(this.project().uuid, profileUuid), () => this.adding.set(false));
  }

  protected onRemove(): void {
    const member = this.removing();
    if (member) {
      this.run(this.service.removeMember(this.project().uuid, member.person.uuid), () =>
        this.removing.set(null),
      );
    }
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
        this.error.set(messageFromError(err, 'La mise à jour des membres a échoué.'));
      },
    });
  }
}
