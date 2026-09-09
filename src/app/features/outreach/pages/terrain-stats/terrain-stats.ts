import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { messageFromError } from '../../../../core/http/http-error.util';
import { formatDateFr } from '../../../../shared/util/date.util';
import { TerrainStatsService } from '../../terrain-stats.service';
import {
  EMPTY_STATS_QUERY,
  MONTH_NAMES_FR,
  type CityContacts,
  type ContactSummary,
  type MonthlyContacts,
  type StatsPeriod,
  type StatsQuery,
  type TerrainReport,
} from '../../terrain-stats.models';

/** Quick range presets offered above the bilan. */
type Preset = StatsPeriod | 'all' | 'custom';

/** One sortie's row in a monthly table — contact figures plus joined effectif. */
interface SortieRow {
  uuid: string;
  name: string;
  dateLabel: string;
  /** Day of the month, the Excel bilan's row label. */
  day: string;
  location: string;
  cityLabel: string;
  /** Département code of the linked commune, shown under the city. */
  cityCode: string;
  conversions: number;
  contacts: number;
  entries: number;
  conversionRate: number;
  /** Everyone mobilised; `null` when no presence was recorded. */
  attendances: number | null;
  /** Département members among them. */
  members: number | null;
  /** Everyone else on the sortie — `attendances - members`. */
  leaders: number | null;
}

/** Column totals for one month's table. */
interface RowTotals {
  conversions: number;
  contacts: number;
  entries: number;
  attendances: number;
  members: number;
  leaders: number;
  cities: number;
}

/** One line of the monthly récapitulatif: the API's totals plus the joined effectif. */
interface MonthlyRow {
  key: string;
  label: string;
  outreaches: number;
  conversions: number;
  contacts: number;
  attendances: number;
  members: number;
  leaders: number;
}

/** A month's block: heading, its sorties, and the totals row under them. */
interface MonthBlock {
  /** `YYYY-MM`, the group key. */
  key: string;
  /** `Janvier 2026`. */
  label: string;
  rows: SortieRow[];
  totals: RowTotals;
}

/** `YYYY-MM` → `Janvier 2026`; falls back to the raw key on an unexpected shape. */
function monthLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) {
    return key;
  }
  return `${MONTH_NAMES_FR[Number(match[2])] ?? match[2]} ${match[1]}`;
}

/**
 * Statistiques · Terrain (`/statistiques/terrain`) — the department's field
 * bilan, the app's answer to the "Stats terrain" tab of the Excel workbook: a
 * headline recap over the chosen range, a month-by-month récapitulatif, then one
 * table per month listing every sortie with its conversions, contacts and
 * effectif.
 *
 * Contact figures come from `/api/stats/outreach`; the effectif columns are
 * joined in from `/api/stats/outreaches`, which is the only endpoint carrying
 * presence counts.
 */
@Component({
  selector: 'app-terrain-stats',
  host: { class: 'data-list' },
  imports: [RouterLink],
  templateUrl: './terrain-stats.html',
  styleUrl: './terrain-stats.scss',
})
export class TerrainStats implements OnInit {
  private readonly service = inject(TerrainStatsService);

  protected readonly query = signal<StatsQuery>({
    ...EMPTY_STATS_QUERY,
    period: 'CURRENT_YEAR',
  });
  protected readonly preset = signal<Preset>('CURRENT_YEAR');

  protected readonly stats = signal<TerrainReport | null>(null);
  protected readonly cities = signal<CityContacts[]>([]);
  /** Presence counts keyed by outreach uuid, joined onto the sortie rows. */
  private readonly presences = signal<Record<string, { attendances: number; members: number }>>(
    {},
  );

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly summary = computed<ContactSummary | null>(
    () => this.stats()?.summary ?? null,
  );

  /** True once we know the range holds no sortie. */
  protected readonly empty = computed(() => (this.summary()?.outreaches ?? 0) === 0);

  /** Everyone mobilised over the range — the Excel's "Personnes mobilisées (Total)". */
  protected readonly totalAttendances = computed(() =>
    Object.values(this.presences()).reduce((sum, p) => sum + p.attendances, 0),
  );

  /** Département members among them — the Excel's "Personnes mobilisées (DPT)". */
  protected readonly totalMembers = computed(() =>
    Object.values(this.presences()).reduce((sum, p) => sum + p.members, 0),
  );

  /** Everyone else on the sorties — `effectif - dépt`. */
  protected readonly totalLeaders = computed(() => this.totalAttendances() - this.totalMembers());

  /** The API's monthly totals, oldest first (as in the bilan). */
  private readonly monthlyStats = computed<MonthlyContacts[]>(() =>
    [...(this.stats()?.monthly ?? [])].sort((a, b) => a.month.localeCompare(b.month)),
  );

  /**
   * The récapitulatif rows — the API's monthly contact totals with the effectif
   * columns joined in from the month blocks, which carry the presence figures.
   */
  protected readonly monthlyRows = computed<MonthlyRow[]>(() => {
    const byKey = new Map(this.months().map((m) => [m.key, m.totals]));
    return this.monthlyStats().map((m) => {
      const totals = byKey.get(m.month);
      return {
        key: m.month,
        label: monthLabel(m.month),
        outreaches: m.outreaches,
        conversions: m.conversions,
        contacts: m.contacts,
        attendances: totals?.attendances ?? 0,
        members: totals?.members ?? 0,
        leaders: totals?.leaders ?? 0,
      };
    });
  });

  /** One block per month that actually holds a sortie, oldest first. */
  protected readonly months = computed<MonthBlock[]>(() => {
    const presences = this.presences();
    const groups = new Map<string, SortieRow[]>();

    for (const o of this.stats()?.perOutreach ?? []) {
      const key = o.date.slice(0, 7);
      const presence = presences[o.outreachUuid];
      const row: SortieRow = {
        uuid: o.outreachUuid,
        name: o.name,
        dateLabel: formatDateFr(o.date),
        day: o.date.slice(8, 10),
        location: o.location,
        cityLabel: o.cityLabel || o.city?.officialName || '',
        cityCode: o.city?.departmentCode ?? '',
        conversions: o.conversions,
        contacts: o.contacts,
        entries: o.entries,
        conversionRate: o.conversionRate,
        attendances: presence?.attendances ?? null,
        members: presence?.members ?? null,
        leaders: presence ? presence.attendances - presence.members : null,
      };
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(row);
      } else {
        groups.set(key, [row]);
      }
    }

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => {
        rows.sort((a, b) => a.day.localeCompare(b.day));
        return { key, label: monthLabel(key), rows, totals: this.totals(rows) };
      });
  });

  /**
   * Distinct cities the sorties were held in over the range — the recap tile.
   * Counted on the outreaches themselves, not on where the contacts live: a
   * sortie in one commune routinely meets people from several others.
   *
   * A linked commune groups on its uuid; a sortie carrying only a free-text
   * label groups on that label, lowercased and trimmed, so two spellings of the
   * same place don't count twice. Sorties with no city at all are not counted.
   */
  protected readonly cityCount = computed(() => {
    const keys = new Set<string>();
    for (const o of this.stats()?.perOutreach ?? []) {
      if (o.city) {
        keys.add(o.city.uuid);
      } else {
        const label = o.cityLabel?.trim().toLowerCase();
        if (label) {
          keys.add(label);
        }
      }
    }
    return keys.size;
  });

  /**
   * Whether any sortie in the range carries a city — a column of blanks reads as
   * a bug, so it is dropped until there is something to show in it.
   */
  protected readonly showCity = computed(() =>
    this.months().some((m) => m.rows.some((r) => !!r.cityLabel)),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const query = this.query();

    forkJoin({
      stats: this.service.terrain(query),
      presences: this.service.presences(query),
      cities: this.service.cities(query),
    }).subscribe({
      next: ({ stats, presences, cities }) => {
        this.stats.set(stats);
        this.cities.set(cities);
        this.presences.set(
          Object.fromEntries(
            presences.map((p) => [
              p.outreachUuid,
              { attendances: p.attendances, members: p.members },
            ]),
          ),
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(messageFromError(err, 'Chargement des statistiques impossible.'));
        this.loading.set(false);
      },
    });
  }

  /** Switch to a preset range; drops any custom bounds. */
  protected applyPreset(preset: StatsPeriod | 'all'): void {
    this.preset.set(preset);
    this.query.set({
      ...EMPTY_STATS_QUERY,
      period: preset === 'all' ? null : preset,
    });
    this.load();
  }

  /** Update one custom bound; switches to a custom range and drops the preset. */
  protected setBound(which: 'from' | 'to', value: string): void {
    this.preset.set('custom');
    this.query.update((q) => ({ ...q, period: null, [which]: value || null }));
    this.load();
  }

  /** Sum a month's columns; distinct cities are counted, not added. */
  private totals(rows: readonly SortieRow[]): RowTotals {
    const cities = new Set(rows.map((r) => r.cityLabel).filter(Boolean));
    return {
      conversions: rows.reduce((sum, r) => sum + r.conversions, 0),
      contacts: rows.reduce((sum, r) => sum + r.contacts, 0),
      entries: rows.reduce((sum, r) => sum + r.entries, 0),
      attendances: rows.reduce((sum, r) => sum + (r.attendances ?? 0), 0),
      members: rows.reduce((sum, r) => sum + (r.members ?? 0), 0),
      leaders: rows.reduce((sum, r) => sum + (r.leaders ?? 0), 0),
      cities: cities.size,
    };
  }

  /** One decimal, French comma, trimmed when whole. */
  protected decimal(value: number): string {
    return value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  }
}
