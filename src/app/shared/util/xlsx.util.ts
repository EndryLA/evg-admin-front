/**
 * Client-side spreadsheet export via ExcelJS. Writes a styled `.xlsx` workbook
 * (bold header band, borders, optionally recoloured rows). The ExcelJS bundle is loaded
 * lazily on first export, so pages that only display the table never pay for it.
 */

// Type-only — erased at compile time, so ExcelJS stays lazily loaded.
import type { Worksheet } from 'exceljs';

/** One column in an exported sheet: its header, value getter and optional width. */
export interface XlsxColumn<T> {
  header: string;
  value: (row: T) => string | number;
  /** Column width in characters; auto-sized from content when omitted. */
  width?: number;
}

/** One tab of a multi-sheet workbook — see {@link exportSheetsToXlsx}. */
export interface XlsxSheet<T> {
  name: string;
  rows: readonly T[];
  columns: readonly XlsxColumn<T>[];
  /** Prepend an auto-incrementing "N°" column. */
  numbered?: boolean;
  /**
   * Overrides the "N°" cell for a row (`numbered` must be on), for sheets whose
   * numbering restarts mid-way — e.g. contacts then conversions on one tab.
   */
  rowNumber?: (row: T, index: number) => number;
  /** ARGB font colour (e.g. `'FFFF0000'`) for a row's cells, or undefined for the default. */
  rowTextColor?: (row: T) => string | undefined;
}

const HEADER_FILL = 'FF18181B'; // zinc-900 band
const HEADER_TEXT = 'FFFFFFFF';
const BORDER = 'FFECECEE'; // hairline

/** Stands in for a blank cell, so an empty value reads as "asked, no answer". */
const EMPTY_CELL = '/';

/** Grace period before the blob URL is released, so Safari can start the download. */
const REVOKE_DELAY_MS = 30_000;

/**
 * Build and download a styled `.xlsx` file with one tab per entry in `sheets`.
 * Column order/headers come from each sheet's `columns`; cells are read through
 * the column `value` getters. Sheets with no rows are skipped; if none has rows,
 * nothing is downloaded. Runs entirely in the browser.
 */
export async function exportSheetsToXlsx(
  // Each tab has its own row type, so the workbook is heterogeneous; type safety
  // is kept per sheet by building each entry as an `XlsxSheet<T>`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: readonly XlsxSheet<any>[],
  filename: string,
): Promise<void> {
  const filled = sheets.filter((s) => s.rows.length > 0);
  if (filled.length === 0) {
    return;
  }

  // ExcelJS is CommonJS: the production build exposes it only as the namespace's
  // `default`, while the dev server synthesizes named exports. Accept either, or
  // `Workbook` is undefined in prod builds only.
  const ns = await import('exceljs');
  const { Workbook } = ns.default ?? ns;
  const workbook = new Workbook();

  for (const spec of filled) {
    writeSheet(workbook.addWorksheet(spec.name, {
      views: [{ state: 'frozen', ySplit: 1 }],
    }), spec);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  // Safari only honours `download` on an anchor that is in the document, and
  // cancels the transfer if the object URL is revoked while it is still
  // starting — so attach before clicking and revoke on a later task.
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** Fill one worksheet with `spec`'s header band, rows, widths and borders. */
function writeSheet<T>(sheet: Worksheet, spec: XlsxSheet<T>): void {
  const { rows, columns, numbered, rowNumber, rowTextColor } = spec;

  sheet.addRow([...(numbered ? ['N°'] : []), ...columns.map((c) => c.header)]);

  rows.forEach((row, i) => {
    const cells = [
      ...(numbered ? [rowNumber ? rowNumber(row, i) : i + 1] : []),
      ...columns.map((c) => cellValue(c.value(row))),
    ];
    const added = sheet.addRow(cells);
    const color = rowTextColor?.(row);
    if (color) {
      added.eachCell((cell) => {
        cell.font = { color: { argb: color } };
      });
    }
  });

  // Column widths: explicit, else auto-sized from content (clamped).
  const numberWidth = numbered ? [6] : [];
  const contentWidths = columns.map((c) => {
    if (c.width) {
      return c.width;
    }
    const longest = Math.max(
      c.header.length,
      ...rows.map((r) => String(cellValue(c.value(r))).length),
    );
    return Math.min(Math.max(longest + 4, 16), 55);
  });
  [...numberWidth, ...contentWidths].forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // Header band.
  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });

  // Subtle hairline borders, roomy rows, everything centered in its cell.
  const hair = { style: 'thin' as const, color: { argb: BORDER } };
  sheet.eachRow((row) => {
    row.height = 20;
    row.eachCell((cell) => {
      cell.border = { top: hair, left: hair, bottom: hair, right: hair };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  });
}

/**
 * A column's value, with anything unknown rendered as {@link EMPTY_CELL}:
 * null/undefined, a blank string, and the `—` placeholder the display helpers
 * return for absent data (which belongs on screen, not in a sheet).
 */
function cellValue(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined) {
    return EMPTY_CELL;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const text = value.trim();
  return text === '' || text === '—' ? EMPTY_CELL : value;
}
