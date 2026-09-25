import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ProjectService } from '../../project.service';
import {
  PROJECT_CATEGORY_LABELS,
  TYPE_COLOR_LABELS,
  type Project,
  type ProjectTicketType,
  type TicketTypeInput,
} from '../../project.models';
import { TicketTypeForm } from '../ticket-type-form/ticket-type-form';

/**
 * Types tab: the project's ticket types as a table. They start from the
 * project's category; the manager adds/edits them in a modal and deletes the
 * unused ones (the backend refuses a type still used by tickets). Changes ask
 * the parent to reload the project through {@link changed}.
 */
@Component({
  selector: 'app-ticket-type-list',
  imports: [TicketTypeForm, ConfirmDialog],
  templateUrl: './ticket-type-list.html',
  styleUrl: './ticket-type-list.scss',
})
export class TicketTypeList {
  private readonly service = inject(ProjectService);

  readonly project = input.required<Project>();
  readonly changed = output<void>();

  /** Type being edited; `'new'` for creation; `null` when the modal is closed. */
  protected readonly editing = signal<ProjectTicketType | 'new' | null>(null);
  protected readonly deleting = signal<ProjectTicketType | null>(null);
  protected readonly query = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly colorLabels = TYPE_COLOR_LABELS;
  protected readonly categoryLabels = PROJECT_CATEGORY_LABELS;

  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.project().ticketTypes.filter((t) => !q || t.name.toLowerCase().includes(q));
  });

  protected editedType(): ProjectTicketType | null {
    const e = this.editing();
    return e === 'new' ? null : e;
  }

  protected openCreate(): void {
    this.error.set(null);
    this.editing.set('new');
  }

  protected openEdit(type: ProjectTicketType): void {
    this.error.set(null);
    this.editing.set(type);
  }

  protected onSave(input: TicketTypeInput): void {
    const e = this.editing();
    const uuid = this.project().uuid;
    this.run(
      e && e !== 'new'
        ? this.service.updateTicketType(uuid, e.uuid, input)
        : this.service.addTicketType(uuid, input),
      () => this.editing.set(null),
    );
  }

  protected onDelete(): void {
    const type = this.deleting();
    if (type) {
      this.run(this.service.removeTicketType(this.project().uuid, type.uuid), () =>
        this.deleting.set(null),
      );
    }
  }

  private run(request: Observable<void>, done: () => void): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        done();
        this.changed.emit();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(messageFromError(err, 'La mise à jour des types a échoué.'));
      },
    });
  }
}
