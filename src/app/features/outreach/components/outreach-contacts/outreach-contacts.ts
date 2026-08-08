import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PhoneFrPipe } from '../../../../shared/pipes/phone.pipe';
import { isSameCity, type CityRef } from '../../../../shared/util/city.util';
import { formatDateFr } from '../../../../shared/util/date.util';
import { displayPhoneFr, displayYesNo } from '../../../../shared/util/text.util';

import { exportSheetsToXlsx, type XlsxColumn } from '../../../../shared/util/xlsx.util';
import {
  CIVIL_STATE_LABELS,
  CONTACT_TYPE_EXPORT_LABELS,
  CONTACT_TYPE_LABELS,
  CONTACT_TYPE_TONES,
  type ContactEntry,
  type ContactType,
  type Outreach,
} from '../../outreach.models';

/** How many contacts show before the "Voir tout" toggle reveals the rest. */
const PREVIEW_COUNT = 5;

/** Font colour in the export for a contact who lives outside the outreach's commune. */
const OUT_OF_CITY_COLOR = 'FFFF0000'; // pure red

/**
 * Contacts card for an outreach — a compact list capped at {@link PREVIEW_COUNT}
 * rows with a "Voir tout / Voir moins" toggle. Purely presentational: the parent
 * loads the data and handles retry.
 *
 * Two optional modes tweak the footer:
 * - `seeAllLink` turns "Voir tout" into a navigation to a dedicated full-list
 *   page instead of an in-place toggle.
 * - `expanded` shows every row with no footer, for that full-list page itself.
 */
@Component({
  selector: 'app-outreach-contacts',
  imports: [RouterLink, PhoneFrPipe],
  templateUrl: './outreach-contacts.html',
  styleUrl: './outreach-contacts.scss',
})
export class OutreachContacts {
  readonly contacts = input<ContactEntry[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** When set, "Voir tout" navigates to this route instead of toggling. */
  readonly seeAllLink = input<string | unknown[] | null>(null);
  /** Show all rows with no footer — for the standalone full-list page. */
  readonly expanded = input(false);
  /** Enable row checkboxes and the "Exporter" toolbar (full-list page only). */
  readonly selectable = input(false);
  /** Base name for the exported file, e.g. the outreach name. */
  readonly exportName = input('contacts');
  /**
   * The outreach these contacts belong to — supplies the export's date and
   * "Ville évangélisée" columns, which live on the outreach, not the contact.
   */
  readonly outreach = input<Outreach | null>(null);

  readonly retry = output<void>();

  protected readonly showAll = signal(false);
  /** UUIDs of the currently selected contacts. */
  private readonly selectedUuids = signal<ReadonlySet<string>>(new Set());
  /** True while the export file is being generated (SheetJS loads lazily). */
  protected readonly exporting = signal(false);

  protected readonly visible = computed<ContactEntry[]>(() => {
    const all = this.contacts();
    return this.showAll() || this.expanded() ? all : all.slice(0, PREVIEW_COUNT);
  });
  protected readonly hasMore = computed(
    () => !this.expanded() && this.contacts().length > PREVIEW_COUNT,
  );

  /** Selected rows among those currently visible (filters may hide others). */
  protected readonly selectedCount = computed(() => {
    const sel = this.selectedUuids();
    return this.visible().filter((c) => sel.has(c.uuid)).length;
  });
  /** True only when every visible row is selected (drives the header checkbox). */
  protected readonly allSelected = computed(() => {
    const rows = this.visible();
    const sel = this.selectedUuids();
    return rows.length > 0 && rows.every((c) => sel.has(c.uuid));
  });
  /** Some but not all selected — the header checkbox's indeterminate state. */
  protected readonly someSelected = computed(
    () => this.selectedCount() > 0 && !this.allSelected(),
  );

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

  protected toggleAll(): void {
    this.selectedUuids.update((prev) => {
      const rows = this.visible();
      const allOn = rows.length > 0 && rows.every((c) => prev.has(c.uuid));
      return allOn ? new Set() : new Set(rows.map((c) => c.uuid));
    });
  }

  /**
   * Export the selected rows to a styled `.xlsx` file — contacts and conversions
   * land on their own tab, each row tagged with its colour-coded type label.
   */
  protected async exportSelected(): Promise<void> {
    const chosen = this.selectedUuids();
    const rows = this.visible().filter((c) => chosen.has(c.uuid));
    if (rows.length === 0 || this.exporting()) {
      return;
    }
    // Same for every row here: they all belong to this one outreach.
    const outreach = this.outreach();
    const date = outreach?.date ? formatDateFr(outreach.date) : '';
    const outreachCity = outreach?.city?.officialName ?? outreach?.cityName ?? '';

    const columns: XlsxColumn<ContactEntry>[] = [
      { header: 'Type', value: (c) => CONTACT_TYPE_EXPORT_LABELS[c.type] },
      { header: 'Date', value: () => date },
      { header: 'Secteur', value: (c) => c.city?.sector ?? '' },
      { header: 'État civil', value: (c) => this.civilStateLabel(c) },
      { header: 'Nom', value: (c) => c.lastname || '' },
      { header: 'Prénom', value: (c) => c.firstname || '' },
      { header: 'Ville', value: (c) => c.cityName || '' },
      { header: 'Ville évangélisée', value: () => outreachCity },
      { header: 'Téléphone', value: (c) => (c.phoneNumber ? displayPhoneFr(c.phoneNumber) : '') },
      { header: 'Évangélisé par', value: (c) => c.evangelizedBy || '' },
      { header: 'Souhaite venir au GF', value: (c) => displayYesNo(c.wantsToAttendGF) },
      { header: "Souhaite venir à l'église", value: (c) => displayYesNo(c.wantsToAttendChurch) },
      { header: 'Observations', value: (c) => c.observations || '', width: 70 },
    ];

    // Flag people who don't live in the commune the outreach took place in.
    const outreachRef: CityRef = {
      inseeCode: outreach?.city?.inseeCode ?? null,
      name: outreachCity,
    };
    const rowTextColor = (c: ContactEntry): string | undefined =>
      isSameCity({ inseeCode: c.city?.inseeCode ?? null, name: c.cityName }, outreachRef)
        ? undefined
        : OUT_OF_CITY_COLOR;

    this.exporting.set(true);
    try {
      await exportSheetsToXlsx(
        [
          {
            name: 'Contacts',
            rows: rows.filter((c) => c.type === 'CONTACT'),
            columns,
            numbered: true,
            rowTextColor,
          },
          {
            name: 'Conversions',
            rows: rows.filter((c) => c.type === 'CONVERSION'),
            columns,
            numbered: true,
            rowTextColor,
          },
        ],
        this.exportName(),
      );
    } finally {
      this.exporting.set(false);
    }
  }

  protected typeLabel(type: ContactType): string {
    return CONTACT_TYPE_LABELS[type];
  }
  protected typeTone(type: ContactType): string {
    return CONTACT_TYPE_TONES[type];
  }
  protected civilStateLabel(c: ContactEntry): string {
    return CIVIL_STATE_LABELS[c.civilState];
  }
  protected name(c: ContactEntry): string {
    return `${c.firstname} ${c.lastname}`.trim() || '—';
  }

  protected toggle(): void {
    this.showAll.update((v) => !v);
  }
}
