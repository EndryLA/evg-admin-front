import { Component, computed, inject, input, type OnInit, output, signal } from '@angular/core';

import { messageFromError } from '../../../../core/http/http-error.util';
import type { LinkableSuggestion, Ticket } from '../../project.models';
import { TicketService } from '../../ticket.service';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Checklist of suggestions a ticket takes into account. Offers every accepted
 * suggestion plus the ones already linked (which may be implemented by now),
 * and saves the whole selection at once.
 */
@Component({
  selector: 'app-suggestion-picker',
  templateUrl: './suggestion-picker.html',
  styleUrl: './suggestion-picker.scss',
})
export class SuggestionPicker implements OnInit {
  private readonly service = inject(TicketService);

  readonly ticket = input.required<Ticket>();

  readonly saved = output<Ticket>();
  readonly cancel = output<void>();

  protected readonly options = signal<LinkableSuggestion[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly visible = computed(() => {
    const q = normalize(this.query().trim());
    return this.options().filter(
      (o) => !q || normalize(`${o.title} ${o.description} ${o.authorName}`).includes(q),
    );
  });

  ngOnInit(): void {
    const linked = this.ticket().suggestions ?? [];
    this.selected.set(new Set(linked.map((s) => s.uuid)));
    this.service.linkableSuggestions().subscribe({
      next: (accepted) => {
        // Already-linked ones first, then the accepted pool (without duplicates).
        const current: LinkableSuggestion[] = linked.map((s) => ({
          uuid: s.uuid,
          title: s.title,
          description: '',
          authorName: '',
        }));
        const ids = new Set(current.map((c) => c.uuid));
        this.options.set([...current, ...accepted.filter((a) => !ids.has(a.uuid))]);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(messageFromError(err, 'Chargement des suggestions impossible.'));
        this.loading.set(false);
      },
    });
  }

  protected toggle(uuid: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  }

  protected save(): void {
    this.busy.set(true);
    this.error.set(null);
    this.service.setSuggestions(this.ticket().uuid, [...this.selected()]).subscribe({
      next: (ticket) => {
        this.busy.set(false);
        this.saved.emit(ticket);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(messageFromError(err, 'Mise à jour des liens impossible.'));
      },
    });
  }
}
