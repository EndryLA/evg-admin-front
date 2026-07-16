import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { OutreachContacts } from '../../components/outreach-contacts/outreach-contacts';
import { OutreachService } from '../../outreach.service';
import {
  CIVIL_STATE_OPTIONS,
  SECTORS,
  STATUS_LABELS,
  STATUS_TONES,
  type CivilState,
  type ContactEntry,
  type ContactType,
  type Outreach,
  type SectorFilter,
} from '../../outreach.models';

/** Type filter for the contacts list: all, or one {@link ContactType}. */
type TypeFilter = 'ALL' | ContactType;
/** Civil-state filter: all, or one {@link CivilState}. */
type CivilStateFilter = 'ALL' | CivilState;

/**
 * Full-list page for an outreach's contacts (`/sorties/:uuid/contacts`) —
 * reached from the "Voir tout" link on the manage page's contacts card. Shows
 * every entry through the shared {@link OutreachContacts} card in expanded mode.
 */
@Component({
  selector: 'app-outreach-contacts-list',
  imports: [RouterLink, OutreachContacts],
  host: { class: 'list-page' },
  templateUrl: './outreach-contacts-list.html',
  styleUrl: './outreach-contacts-list.scss',
})
export class OutreachContactsList implements OnInit {
  private readonly service = inject(OutreachService);

  /** Route param, bound via `withComponentInputBinding`. */
  readonly uuid = input.required<string>();

  protected readonly outreach = signal<Outreach | null>(null);
  protected readonly contacts = signal<ContactEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Front-end filters over the loaded contacts. */
  protected readonly query = signal('');
  protected readonly typeFilter = signal<TypeFilter>('ALL');
  protected readonly civilState = signal<CivilStateFilter>('ALL');
  protected readonly sector = signal<SectorFilter>('ALL');
  protected readonly evangelizedBy = signal('');
  protected readonly sectors = SECTORS;
  protected readonly civilStateOptions = CIVIL_STATE_OPTIONS;

  /** True when any filter is narrowing the list (drives the reset button). */
  protected readonly hasActiveFilters = computed(
    () =>
      this.query().trim() !== '' ||
      this.typeFilter() !== 'ALL' ||
      this.civilState() !== 'ALL' ||
      this.sector() !== 'ALL' ||
      this.evangelizedBy().trim() !== '',
  );

  // ---- Filter drawer (mobile) ----
  protected readonly filterDrawerOpen = signal(false);
  /** Active drawer filters (search excluded — it stays visible). Drives the badge. */
  protected readonly activeFilterCount = computed(
    () =>
      (this.typeFilter() !== 'ALL' ? 1 : 0) +
      (this.civilState() !== 'ALL' ? 1 : 0) +
      (this.sector() !== 'ALL' ? 1 : 0) +
      (this.evangelizedBy().trim() !== '' ? 1 : 0),
  );
  protected openFilters(): void {
    this.filterDrawerOpen.set(true);
  }
  protected closeFilters(): void {
    this.filterDrawerOpen.set(false);
  }

  /** Contacts after applying every filter. */
  protected readonly filtered = computed<ContactEntry[]>(() => {
    const type = this.typeFilter();
    const civilState = this.civilState();
    const sector = this.sector();
    const q = this.query().trim().toLowerCase();
    const by = this.evangelizedBy().trim().toLowerCase();
    return this.contacts().filter((c) => {
      if (type !== 'ALL' && c.type !== type) {
        return false;
      }
      if (civilState !== 'ALL' && c.civilState !== civilState) {
        return false;
      }
      if (sector === 'UNASSIGNED') {
        if (c.city?.sector != null) {
          return false;
        }
      } else if (sector !== 'ALL' && c.city?.sector !== sector) {
        return false;
      }
      if (by && !c.evangelizedBy.toLowerCase().includes(by)) {
        return false;
      }
      if (!q) {
        return true;
      }
      const haystack = [
        c.firstname,
        c.lastname,
        c.cityName,
        c.evangelizedBy,
        c.phoneNumber,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  protected readonly statusLabel = computed(() => {
    const o = this.outreach();
    return o ? STATUS_LABELS[o.status] : '';
  });
  protected readonly statusTone = computed(() => {
    const o = this.outreach();
    return o ? STATUS_TONES[o.status] : 'grey';
  });
  /** File name for the Excel export, e.g. "Contacts - Marché central". */
  protected readonly exportName = computed(() => {
    const o = this.outreach();
    return o ? `Contacts - ${o.name}` : 'Contacts';
  });

  ngOnInit(): void {
    this.load();
  }

  protected onSearch(value: string): void {
    this.query.set(value);
  }
  protected setType(type: TypeFilter): void {
    this.typeFilter.set(type);
  }
  protected setCivilState(value: string): void {
    this.civilState.set(value === 'ALL' ? 'ALL' : (value as CivilState));
  }
  protected setSector(value: string): void {
    this.sector.set(
      value === 'ALL' || value === 'UNASSIGNED' ? value : Number(value),
    );
  }
  protected setEvangelizedBy(value: string): void {
    this.evangelizedBy.set(value);
  }

  /** Clear every filter back to its default. */
  protected resetFilters(): void {
    this.query.set('');
    this.typeFilter.set('ALL');
    this.civilState.set('ALL');
    this.sector.set('ALL');
    this.evangelizedBy.set('');
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getOne(this.uuid()).subscribe({
      next: (data) => this.outreach.set(data),
      error: (err) =>
        this.error.set(messageFromError(err, 'Chargement de la sortie impossible.')),
    });

    this.service.contactEntries(this.uuid()).subscribe({
      next: (data) => {
        this.contacts.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(messageFromError(err, 'Chargement des contacts impossible.'));
        this.loading.set(false);
      },
    });
  }
}
