/**
 * Client-side spreadsheet export via ExcelJS. Writes a styled `.xlsx` workbook
 * (bold header band, borders, banded/tinted rows). The ExcelJS bundle is loaded
 * lazily on first export, so pages that only display the table never pay for it.
 */

/** One column in an exported sheet: its header, value getter and optional width. */
export interface XlsxColumn<T> {
  header: string;
  value: (row: T) => string | number;
  /** Column width in characters; auto-sized from content when omitted. */
  width?: number;
}

/** Optional shaping for {@link exportRowsToXlsx}. */
export interface XlsxOptions<T> {
  sheetName?: string;
  /** Prepend an auto-incrementing "N°" column. */
  numbered?: boolean;
  /** ARGB fill (e.g. `'FFECFDF5'`) applied to a row's cells, or undefined for none. */
  rowFill?: (row: T) => string | undefined;
}

const HEADER_FILL = 'FF18181B'; // zinc-900 band
const HEADER_TEXT = 'FFFFFFFF';
const BORDER = 'FFECECEE'; // hairline

/**
 * Build and download a styled `.xlsx` file from `rows`. Column order/headers come
 * from `columns`; each row's cells are read through the column `value` getters.
 * Runs entirely in the browser.
 */
export async function exportRowsToXlsx<T>(
  rows: readonly T[],
  columns: readonly XlsxColumn<T>[],
  filename: string,
  options: XlsxOptions<T> = {},
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(options.sheetName ?? 'Feuille1', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = [
    ...(options.numbered ? ['N°'] : []),
    ...columns.map((c) => c.header),
  ];
  sheet.addRow(headers);

  rows.forEach((row, i) => {
    const cells = [
      ...(options.numbered ? [i + 1] : []),
      ...columns.map((c) => c.value(row)),
    ];
    const added = sheet.addRow(cells);
    const fill = options.rowFill?.(row);
    if (fill) {
      added.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      });
    }
  });

  // Column widths: explicit, else auto-sized from content (clamped).
  const numberWidth = options.numbered ? [6] : [];
  const contentWidths = columns.map((c) => {
    if (c.width) {
      return c.width;
    }
    const longest = Math.max(
      c.header.length,
      ...rows.map((r) => String(c.value(r) ?? '').length),
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
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // Subtle hairline borders + roomy rows (taller rows + a left indent read as
  // cell padding in Excel). Row numbers stay centered.
  const hair = { style: 'thin' as const, color: { argb: BORDER } };
  sheet.eachRow((row, rowNumber) => {
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.border = { top: hair, left: hair, bottom: hair, right: hair };
      const centered = rowNumber > 1 && options.numbered && colNumber === 1;
      cell.alignment = {
        vertical: 'middle',
        horizontal: centered ? 'center' : 'left',
        indent: centered ? 0 : 1,
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
