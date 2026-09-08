import { Component, computed, input, output } from '@angular/core';

/**
 * One line of a breakdown — a city or a sector, flattened by the parent so the
 * dialog renders both with the same table.
 */
export interface BreakdownRow {
  /** Stable key for tracking (city uuid, sector number). */
  key: string;
  label: string;
  /** Second line under the label — département code, or nothing. */
  sub: string;
  /** The row's own qualifier: its sector, or its number of cities. */
  extra: string;
  conversions: number;
  contacts: number;
}

/**
 * The full "voir tout" expansion of a breakdown panel — every city or sector
 * over the range, ranked as the parent ordered them. Presentational: the parent
 * owns the fetch and passes the rows in.
 */
@Component({
  selector: 'app-terrain-breakdown-dialog',
  host: { class: 'modal-form', '(keydown.escape)': 'close.emit()' },
  templateUrl: './terrain-breakdown-dialog.html',
  styleUrl: './terrain-breakdown-dialog.scss',
})
export class TerrainBreakdownDialog {
  /** Dialog title, e.g. `Toutes les villes`. */
  readonly title = input.required<string>();
  /** Small caps label above the title. */
  readonly eyebrow = input('Terrain');
  /** Header for the qualifier column (`Secteur`, `Villes`). */
  readonly extraLabel = input.required<string>();
  readonly rows = input<BreakdownRow[]>([]);

  readonly close = output<void>();

  protected readonly count = computed(() => this.rows().length);
}
