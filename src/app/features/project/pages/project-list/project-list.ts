import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ACCESS } from '../../../../core/auth/access';
import { AuthService } from '../../../../core/auth/auth.service';
import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr } from '../../../../shared/util/date.util';
import { ProjectForm } from '../../components/project-form/project-form';
import { ProjectService } from '../../project.service';
import {
  progress,
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONES,
  type Project,
  type ProjectInput,
  type ProjectStatus,
} from '../../project.models';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Projets — the projects the member belongs to (all of them for super admins),
 * with their progress. Admins create projects here; rows open the project.
 */
@Component({
  selector: 'app-project-list',
  imports: [ProjectForm],
  host: { class: 'data-list' },
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList {
  private readonly service = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly items = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly query = signal('');
  /** Archived projects are out of the way unless asked for. */
  protected readonly showArchived = signal(false);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly canCreate = computed(() => this.auth.hasAnyRole(ACCESS.projectCreate));
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly categoryLabels = PROJECT_CATEGORY_LABELS;
  protected readonly statusTones = PROJECT_STATUS_TONES;
  protected readonly progress = progress;
  protected readonly formatDate = formatDateFr;

  protected readonly archivedCount = computed(
    () => this.items().filter((p) => p.status === 'ARCHIVED').length,
  );

  protected readonly rows = computed(() => {
    const q = normalize(this.query().trim());
    const order: ProjectStatus[] = ['ACTIVE', 'PLANNED', 'DONE', 'ARCHIVED'];
    return this.items()
      .filter((p) => this.showArchived() || p.status !== 'ARCHIVED')
      .filter((p) => !q || normalize(`${p.name} ${p.key} ${p.description}`).includes(q))
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name, 'fr'));
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des projets impossible.'));
        this.loading.set(false);
      },
    });
  }

  protected view(p: Project): void {
    void this.router.navigate(['/projets', p.uuid]);
  }

  protected openCreate(): void {
    this.saveError.set(null);
    this.formOpen.set(true);
  }

  /** Creates the project, then opens it so phases, members and tickets can be added. */
  protected onSave(input: ProjectInput): void {
    this.saving.set(true);
    this.saveError.set(null);
    this.service.create(input).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.formOpen.set(false);
        void this.router.navigate(['/projets', created.uuid]);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(messageFromError(err, 'Création du projet impossible.'));
      },
    });
  }
}
