import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { messageFromError } from '../../../../core/http/http-error.util';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { formatDateFr } from '../../../../shared/util/date.util';
import { PhaseForm } from '../phase-form/phase-form';
import { ProjectService } from '../../project.service';
import {
  PHASE_STATUS_LABELS,
  PHASE_STATUS_TONES,
  progress,
  type Phase,
  type PhaseInput,
  type Project,
} from '../../project.models';

/**
 * Phases tab: the project's phases as a table, in order, with their progress.
 * Managers add/edit them in a modal, reorder (up/down) and delete them; any
 * change asks the parent to reload the project through {@link changed}.
 * Phases are optional.
 */
@Component({
  selector: 'app-phase-list',
  imports: [PhaseForm, ConfirmDialog],
  templateUrl: './phase-list.html',
  styleUrl: './phase-list.scss',
})
export class PhaseList {
  private readonly service = inject(ProjectService);

  readonly project = input.required<Project>();
  readonly changed = output<void>();

  /** Phase being edited; `'new'` for creation; `null` when the form is closed. */
  protected readonly editing = signal<Phase | 'new' | null>(null);
  protected readonly deleting = signal<Phase | null>(null);
  protected readonly query = signal('');

  /** Reordering is disabled while searching: neighbours on screen aren't the real ones. */
  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.project().phases.filter(
      (p) => !q || `${p.name} ${p.description}`.toLowerCase().includes(q),
    );
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly statusLabels = PHASE_STATUS_LABELS;
  protected readonly statusTones = PHASE_STATUS_TONES;
  protected readonly progress = progress;
  protected readonly formatDate = formatDateFr;

  protected editedPhase(): Phase | null {
    const e = this.editing();
    return e === 'new' ? null : e;
  }

  protected onSave(input: PhaseInput): void {
    const e = this.editing();
    const uuid = this.project().uuid;
    const request =
      e === 'new' || e === null
        ? this.service.addPhase(uuid, input)
        : this.service.updatePhase(uuid, e.uuid, input);
    this.run(request, () => this.editing.set(null));
  }

  protected onDelete(): void {
    const phase = this.deleting();
    if (phase) {
      this.run(this.service.removePhase(this.project().uuid, phase.uuid), () =>
        this.deleting.set(null),
      );
    }
  }

  protected indexOf(phase: Phase): number {
    return this.project().phases.findIndex((p) => p.uuid === phase.uuid);
  }

  /** Swaps the phase with its neighbour and saves the full order. */
  protected move(phase: Phase, delta: -1 | 1): void {
    const ids = this.project().phases.map((p) => p.uuid);
    const index = this.indexOf(phase);
    const target = index + delta;
    if (target < 0 || target >= ids.length) {
      return;
    }
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.run(this.service.reorderPhases(this.project().uuid, ids));
  }

  private run(request: Observable<unknown>, done?: () => void): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        done?.();
        this.changed.emit();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(messageFromError(err, 'L’opération sur la phase a échoué.'));
      },
    });
  }
}
