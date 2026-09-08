import { Component, computed, ElementRef, inject, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { messageFromError } from '../../../../core/http/http-error.util';
import { PhoneFrPipe } from '../../../../shared/pipes/phone.pipe';
import { isSameCity } from '../../../../shared/util/city.util';
import { formatDateFr, formatDateTimeShortFr, monthYearLabel } from '../../../../shared/util/date.util';
import { displayPhoneFr, displayYesNo } from '../../../../shared/util/text.util';
import { exportSheetsToXlsx, type XlsxColumn } from '../../../../shared/util/xlsx.util';
import { ContactService } from '../../contact.service';
import {
  CIVIL_STATE_LABELS,
  CONTACT_TYPE_EXPORT_LABELS,
  CONTACT_TYPE_LABELS,
  CONTACT_TYPE_TONES,
  EMPTY_CONTACT_FILTER,
  OUTREACH_STATUS_LABELS,
  OUTREACH_STATUS_TONES,
  SECTORS,
  type Contact,
  type ContactFilter,
  type ContactGroup,
  type ContactType,
  type GroupOutreach,
  type OutreachStatus,
  type SectorFilter,
} from '../../contact.models';

/** The type-tab selection: all types, or one {@link ContactType}. */
type TypeFilter = ContactFilter['type'];

/** Font colour in the export for a contact who lives outside their outreach's commune. */
const OUT_OF_CITY_COLOR = 'FFFF0000'; // pure red
/** Debounce before the free-text search triggers a server reload. */
const SEARCH_DEBOUNCE_MS = 300;

/** `YYYY-MM` for today, local time — avoids `toISOString()`'s UTC shift. */
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** One calendar month's worth of outreach groups, in display order. */
interface MonthSection {
  key: string;
  label: string;
  groups: ContactGroup[];
  /** Entries across the section's groups — the month's header count. */
  total: number;
}

/** A contact paired with the outreach it was collected at, for the export. */
interface ExportRow {
  contact: Contact;
  outreach: GroupOutreach;
}

/**
 * Contacts — the people met during outreaches, browsed one calendar year at a
 * time and grouped by the sortie they were collected at
 * (`GET /api/contact-entries/grouped`). The endpoint returns every matching
 * entry in one shot, so the selected year is what bounds the query; all filters
 * are applied server-side, and any change reloads the year. Groups are laid out
 * as one card per sortie under a month heading, mirroring the sorties list.
 *
 * Sorties start collapsed and only render their rows once opened — a year can
 * hold a few thousand entries, which as one flat list is both an unusable
 * scroll and far too much DOM. Selection and the Excel export work off the
 * loaded data, not the rendered rows, so a collapsed sortie can still be
 * ticked and exported whole.
 */
@Component({
  selector: 'app-contact-list',
  imports: [PhoneFrPipe, RouterLink],
  host: { class: 'data-list' },
  templateUrl: './contact-list.html',
  styleUrl: './contact-list.scss',
})
export class ContactList implements OnDestroy {
  private readonly service = inject(ContactService);
  private readonly router = inject(Router);
  private readonly hostRef: ElementRef<HTMLElement> = inject(ElementRef);

  // ---- Data ----
  protected readonly groups = signal<ContactGroup[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  /** Every entry of the loaded year, flattened — backs the counts and selection. */
  private readonly allEntries = computed(() => this.groups().flatMap((g) => g.entries));
  protected readonly totalElements = computed(() =>
    this.groups().reduce((sum, g) => sum + g.total, 0),
  );

  // ---- Year ----
  private readonly currentYear = new Date().getFullYear();
  protected readonly year = signal(this.currentYear);
  protected readonly isCurrentYear = computed(() => this.year() === this.currentYear);
  /** `YYYY-MM` of today (local time) — drives the auto-scroll to the current month. */
  protected readonly currentMonthKey = currentMonthKey();

  // ---- Filters ----
  /** The full server-side filter applied to the list (year bounds added on send). */
  protected readonly filter = signal<ContactFilter>({ ...EMPTY_CONTACT_FILTER });
  protected readonly sectors = SECTORS;

  protected readonly fmtDateTimeShort = formatDateTimeShortFr;

  /** True when any filter is narrowing the list (drives the reset button). */
  protected readonly hasActiveFilters = computed(() => {
    const f = this.filter();
    return f.search.trim() !== '' || f.type !== 'ALL' || f.sector !== 'ALL';
  });

  /**
   * Month sections for the loaded year, in calendar order — January first, so
   * scrolling down moves forward through the year. The grouped endpoint returns
   * the sorties newest-first, so they are re-sorted here; undated sorties sort
   * last, into a trailing "SANS DATE" section.
   */
  protected readonly sections = computed<MonthSection[]>(() => {
    const ordered = [...this.groups()].sort((a, b) =>
      (a.outreach.date ?? '9999').localeCompare(b.outreach.date ?? '9999'),
    );
    const byKey = new Map<string, MonthSection>();
    for (const group of ordered) {
      const date = group.outreach.date;
      const key = date ? date.slice(0, 7) : ''; // YYYY-MM, or '' when undated
      let section = byKey.get(key);
      if (!section) {
        section = {
          key,
          label: date ? monthYearLabel(date) : 'SANS DATE',
          groups: [],
          total: 0,
        };
        byKey.set(key, section);
      }
      section.groups.push(group);
      section.total += group.total;
    }
    return [...byKey.values()];
  });

  // ---- Filter drawer (mobile) ----
  protected readonly filterDrawerOpen = signal(false);
  /** Active drawer filters (search excluded — it stays visible). Drives the badge. */
  protected readonly activeFilterCount = computed(() => {
    const f = this.filter();
    return (f.type !== 'ALL' ? 1 : 0) + (f.sector !== 'ALL' ? 1 : 0);
  });
  protected openFilters(): void {
    this.filterDrawerOpen.set(true);
  }
  protected closeFilters(): void {
    this.filterDrawerOpen.set(false);
  }

  // ---- Selection ----
  /** UUIDs of the currently selected rows, across every group. */
  private readonly selectedUuids = signal<ReadonlySet<string>>(new Set());
  /** True while the export file is being generated (ExcelJS loads lazily). */
  protected readonly exporting = signal(false);

  protected readonly selectedCount = computed(() => this.selectedUuids().size);
  protected readonly allSelected = computed(() => {
    const entries = this.allEntries();
    const sel = this.selectedUuids();
    return entries.length > 0 && entries.every((c) => sel.has(c.uuid));
  });
  protected readonly someSelected = computed(
    () => this.selectedCount() > 0 && !this.allSelected(),
  );

  // ---- Expansion ----
  /** Outreach uuids whose contacts are rendered. Everything else stays
   *  collapsed to its one-line summary. */
  private readonly expandedUuids = signal<ReadonlySet<string>>(new Set());

  protected isExpanded(group: ContactGroup): boolean {
    return this.expandedUuids().has(group.outreach.uuid);
  }

  /** Open or close one sortie. Empty groups have nothing to show, so they
   *  don't open. */
  protected toggleExpanded(group: ContactGroup): void {
    if (group.entries.length === 0) {
      return;
    }
    this.expandedUuids.update((prev) => {
      const next = new Set(prev);
      if (!next.delete(group.outreach.uuid)) {
        next.add(group.outreach.uuid);
      }
      return next;
    });
  }

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  protected typeLabel(type: ContactType): string {
    return CONTACT_TYPE_LABELS[type];
  }
  protected typeTone(type: ContactType): string {
    return CONTACT_TYPE_TONES[type];
  }
  protected statusLabel(status: OutreachStatus): string {
    return OUTREACH_STATUS_LABELS[status];
  }
  protected statusTone(status: OutreachStatus): string {
    return OUTREACH_STATUS_TONES[status];
  }
  protected civilStateLabel(contact: Contact): string {
    return CIVIL_STATE_LABELS[contact.civilState];
  }
  protected contactName(contact: Contact): string {
    return `${contact.firstname} ${contact.lastname}`.trim() || '—';
  }

  // ---- Loading ----
  /** The filter to send: the user's own filters, bounded to the selected year. */
  private currentFilter(): ContactFilter {
    const y = this.year();
    return { ...this.filter(), minDate: `${y}-01-01`, maxDate: `${y}-12-31` };
  }

  /** (Re)load the whole selected year — on first render, and on any filter or
   *  year change. */
  protected load(): void {
    this.groups.set([]);
    this.selectedUuids.set(new Set());
    this.expandedUuids.set(new Set());
    this.loadError.set(null);
    this.loading.set(true);
    this.service.grouped(this.currentFilter()).subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
        if (this.isCurrentYear()) {
          // Wait for the month sections to actually render before scrolling.
          setTimeout(() => this.scrollToCurrentMonth(), 0);
        }
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des contacts impossible.'));
        this.loading.set(false);
      },
    });
  }

  /** Land the viewport on the current month, when it's present in the loaded year. */
  private scrollToCurrentMonth(): void {
    const target = this.hostRef.nativeElement.querySelector<HTMLElement>(
      '[data-month-anchor]',
    );
    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  // ---- Year navigation ----
  protected prevYear(): void {
    this.year.update((y) => y - 1);
    this.load();
  }
  protected nextYear(): void {
    this.year.update((y) => y + 1);
    this.load();
  }
  protected goToCurrentYear(): void {
    if (this.isCurrentYear()) {
      return;
    }
    this.year.set(this.currentYear);
    this.load();
  }

  // ---- Filter handlers ----
  /** Patch one filter field and reload the year. */
  private applyFilter(patch: Partial<ContactFilter>): void {
    this.filter.update((f) => ({ ...f, ...patch }));
    this.load();
  }

  /** Free-text search — debounced so typing doesn't fire a request per key. */
  protected setSearch(value: string): void {
    this.filter.update((f) => ({ ...f, search: value }));
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }

  protected setType(type: TypeFilter): void {
    this.applyFilter({ type });
  }
  protected setSector(value: string): void {
    const sector: SectorFilter =
      value === 'ALL' || value === 'UNASSIGNED' ? value : Number(value);
    this.applyFilter({ sector });
  }

  /** Clear every filter back to its default. */
  protected resetFilters(): void {
    clearTimeout(this.searchTimer);
    this.filter.set({ ...EMPTY_CONTACT_FILTER });
    this.load();
  }

  // ---- Selection ----
  protected isSelected(uuid: string): boolean {
    return this.selectedUuids().has(uuid);
  }
  protected toggleRow(uuid: string): void {
    this.selectedUuids.update((prev) => {
      const next = new Set(prev);
      if (!next.delete(uuid)) {
        next.add(uuid);
      }
      return next;
    });
  }
  /** Select or clear every entry of the loaded year. */
  protected toggleAll(): void {
    this.selectedUuids.update((prev) => {
      const entries = this.allEntries();
      const allOn = entries.length > 0 && entries.every((c) => prev.has(c.uuid));
      return allOn ? new Set() : new Set(entries.map((c) => c.uuid));
    });
  }

  /** True when every entry of the given group is selected. */
  protected groupSelected(group: ContactGroup): boolean {
    const sel = this.selectedUuids();
    return group.entries.length > 0 && group.entries.every((c) => sel.has(c.uuid));
  }
  protected groupPartiallySelected(group: ContactGroup): boolean {
    const sel = this.selectedUuids();
    return group.entries.some((c) => sel.has(c.uuid)) && !this.groupSelected(group);
  }
  /** Select or clear one sortie's entries in a single click. */
  protected toggleGroup(group: ContactGroup): void {
    const allOn = this.groupSelected(group);
    this.selectedUuids.update((prev) => {
      const next = new Set(prev);
      for (const entry of group.entries) {
        if (allOn) {
          next.delete(entry.uuid);
        } else {
          next.add(entry.uuid);
        }
      }
      return next;
    });
  }

  /**
   * Export the selected rows to a styled `.xlsx` file — contacts and conversions
   * land on their own tab, each row tagged with its colour-coded type label. The
   * outreach columns come straight from the group the row was rendered in, so no
   * extra lookup is needed.
   */
  protected async exportSelected(): Promise<void> {
    const chosen = this.selectedUuids();
    const selected: ExportRow[] = this.groups().flatMap((g) =>
      g.entries
        .filter((c) => chosen.has(c.uuid))
        .map((contact) => ({ contact, outreach: g.outreach })),
    );
    if (selected.length === 0 || this.exporting()) {
      return;
    }
    this.exporting.set(true);
    try {
      const columns: XlsxColumn<ExportRow>[] = [
        { header: 'Type', value: (r) => CONTACT_TYPE_EXPORT_LABELS[r.contact.type] },
        {
          header: 'Date',
          value: (r) => (r.outreach.date ? formatDateFr(r.outreach.date) : ''),
        },
        { header: 'Sortie', value: (r) => r.outreach.name || '' },
        { header: 'Secteur', value: (r) => r.contact.city?.sector ?? '' },
        // Left blank when unknown, so the sheet shows "/" rather than a label.
        {
          header: 'État civil',
          value: (r) =>
            r.contact.civilState === 'MISSING_INFORMATION'
              ? ''
              : this.civilStateLabel(r.contact),
        },
        { header: 'Nom', value: (r) => r.contact.lastname || '' },
        { header: 'Prénom', value: (r) => r.contact.firstname || '' },
        { header: 'Ville', value: (r) => r.contact.cityName || '' },
        { header: 'Ville évangélisée', value: (r) => r.outreach.cityName },
        {
          header: 'Téléphone',
          value: (r) => (r.contact.phoneNumber ? displayPhoneFr(r.contact.phoneNumber) : ''),
        },
        { header: 'Évangélisé par', value: (r) => r.contact.evangelizedBy || '' },
        { header: 'Souhaite venir au GF', value: (r) => displayYesNo(r.contact.wantsToAttendGF) },
        {
          header: "Souhaite venir à l'église",
          value: (r) => displayYesNo(r.contact.wantsToAttendChurch),
        },
        { header: 'Observations', value: (r) => r.contact.observations || '', width: 70 },
      ];

      // Flag people who don't live in the commune their outreach took place in.
      const rowTextColor = (r: ExportRow): string | undefined => {
        const same = isSameCity(
          { inseeCode: r.contact.city?.inseeCode ?? null, name: r.contact.cityName },
          { inseeCode: r.outreach.cityInseeCode, name: r.outreach.cityName },
        );
        return same ? undefined : OUT_OF_CITY_COLOR;
      };

      await exportSheetsToXlsx(
        [
          {
            name: 'Contacts',
            rows: selected.filter((r) => r.contact.type === 'CONTACT'),
            columns,
            numbered: true,
            rowTextColor,
          },
          {
            name: 'Conversions',
            rows: selected.filter((r) => r.contact.type === 'CONVERSION'),
            columns,
            numbered: true,
            rowTextColor,
          },
        ],
        'Contacts',
      );
    } finally {
      this.exporting.set(false);
    }
  }

  protected view(contact: Contact): void {
    this.router.navigate(['/contacts', contact.uuid]);
  }

}
