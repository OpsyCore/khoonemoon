/**
 * «خروجی گرفتن» — the household's own data, as a file.
 *
 * A family app that holds years of bills and chores but offers no way out is a
 * trap: if the service goes away, so does the record of who paid for the fridge.
 * Two formats cover the two real reasons to ask:
 *
 * - JSON: a complete archive, for moving to another tool or keeping a copy.
 * - CSV: the ledger, because the person who wants the numbers opens Excel.
 *
 * Everything here is pure so the ugly parts — quoting, Excel's BOM, Persian
 * headers — are testable without a database.
 */

/** Excel reads a bare UTF-8 CSV as mojibake, so the BOM is not optional. */
export const UTF8_BOM = "\uFEFF";

export type CsvColumn<T> = {
  /** Header shown in the spreadsheet. Persian on purpose: the reader is a person. */
  header: string;
  value: (row: T) => string | number | null | undefined;
};

/**
 * Quotes a field for CSV. A value containing a comma, a quote or a newline must
 * be wrapped, and its own quotes doubled — otherwise one note with a comma in it
 * silently shifts every following column by one.
 */
export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function toCsv<T>({
  columns,
  rows,
  bom = true,
}: {
  columns: CsvColumn<T>[];
  rows: T[];
  bom?: boolean;
}): string {
  const header = columns.map((column) => csvEscape(column.header)).join(",");

  const body = rows.map((row) =>
    columns.map((column) => csvEscape(column.value(row))).join(","),
  );

  return (bom ? UTF8_BOM : "") + [header, ...body].join("\r\n") + "\r\n";
}

export type ExportableRecord = {
  record_type: string;
  title: string;
  amount: number | string;
  currency: string;
  category: string | null;
  note: string | null;
  occurred_at: string;
  due_at: string | null;
  paid_at: string | null;
};

export const LEDGER_CSV_COLUMNS: CsvColumn<ExportableRecord>[] = [
  { header: "نوع", value: (row) => row.record_type },
  { header: "عنوان", value: (row) => row.title },
  { header: "مبلغ", value: (row) => row.amount },
  { header: "واحد", value: (row) => row.currency },
  { header: "دسته", value: (row) => row.category },
  { header: "توضیح", value: (row) => row.note },
  { header: "تاریخ ثبت", value: (row) => row.occurred_at },
  { header: "سررسید", value: (row) => row.due_at },
  { header: "تاریخ پرداخت", value: (row) => row.paid_at },
];

export type ExportTable = { name: string; rows: unknown[] };

export type ExportArchive = {
  exported_at: string;
  note: string;
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
};

/**
 * Shapes the archive a person will actually open: a manifest they can read plus
 * the rows. `counts` is duplicated into a flat map so a reader can tell at a
 * glance whether a table came back empty or was skipped.
 */
export function buildArchive({
  tables,
  now,
}: {
  tables: ExportTable[];
  now: Date;
}): ExportArchive {
  const byName: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const table of tables) {
    byName[table.name] = table.rows;
    counts[table.name] = table.rows.length;
  }

  return {
    exported_at: now.toISOString(),
    note: "این فایل شامل گزیده‌ای از داده‌های قابل مشاهده است؛ تعداد رکوردها ممکن است محدود باشد و فایل‌های مدارک در آن نیستند.",
    tables: byName,
    counts,
  };
}

/** `khoonemoon-2026-10-29.csv` — ASCII so no server has to encode it. */
export function exportFileName({
  extension,
  now,
}: {
  extension: "json" | "csv";
  now: Date;
}): string {
  const stamp = now.toISOString().slice(0, 10);
  return `khoonemoon-${stamp}.${extension}`;
}
