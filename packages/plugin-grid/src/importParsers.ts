/**
 * ObjectUI – Copyright (c) 2024-present ObjectStack Inc.
 * Licensed under MIT.
 *
 * Pure parsing & type-inference helpers for the Import Wizard. Kept free of
 * React so they can be unit-tested in isolation and so the (heavier) Excel
 * parser can be code-split behind a dynamic import — CSV/paste imports never
 * pay for ExcelJS.
 *
 * Every parser produces the same shape the wizard consumes: a `string[][]`
 * whose first row is the header. Empty rows are dropped to match the
 * spreadsheet "trailing blank lines don't count" intuition.
 */

/** A column's inferred semantic type, used to power smart mapping & UI hints. */
export type InferredType = 'text' | 'number' | 'boolean' | 'date' | 'datetime';

/** Error codes thrown by {@link parseSpreadsheetFile}; callers map these to i18n. */
export const ImportParseError = {
  /** Extension is neither a delimited text file nor a supported spreadsheet. */
  Unsupported: 'IMPORT_UNSUPPORTED_FILE',
  /** Legacy binary .xls — ExcelJS only reads OOXML (.xlsx). */
  LegacyXls: 'IMPORT_LEGACY_XLS',
} as const;

/**
 * Quote-aware parser for delimited text (CSV/TSV). Handles RFC-4180 style
 * doubled quotes and quoted fields containing the delimiter or newlines.
 * Trailing whitespace on each field is trimmed, and all-empty rows skipped.
 */
export function parseDelimited(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') { inQuotes = true; }
    else if (ch === delimiter) { row.push(field.trim()); field = ''; }
    else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = []; field = '';
      if (ch === '\r') i++;
    } else { field += ch; }
  }
  row.push(field.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/** Back-compat alias — the wizard historically called this `parseCSV`. */
export const parseCSV = (text: string): string[][] => parseDelimited(text, ',');

/** Format an ExcelJS cell value into the canonical string the wizard expects. */
function formatCellValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const iso = v.toISOString();
    // Pure dates (midnight UTC) render as YYYY-MM-DD; keep time otherwise.
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    // Formula cell → use its computed result.
    if ('result' in o) return formatCellValue(o.result);
    // Rich text → concatenate runs.
    if (Array.isArray(o.richText)) return o.richText.map((r) => String((r as { text?: unknown }).text ?? '')).join('');
    // Hyperlink → prefer display text.
    if ('text' in o) return formatCellValue(o.text);
    if ('hyperlink' in o) return String(o.hyperlink ?? '');
    if ('error' in o) return String(o.error ?? '');
    return '';
  }
  return String(v);
}

/**
 * Parse the first worksheet of an .xlsx workbook into `string[][]`. ExcelJS is
 * loaded lazily so it stays out of the main bundle.
 */
export async function parseExcelArrayBuffer(buffer: ArrayBuffer): Promise<string[][]> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const width = ws.columnCount;
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (excelRow) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) {
      cells.push(formatCellValue(excelRow.getCell(c).value).trim());
    }
    if (cells.some((c) => c !== '')) rows.push(cells);
  });
  return rows;
}

/**
 * Parse any supported import file into `string[][]`. Delimited text is read as
 * UTF-8; .xlsx is parsed via {@link parseExcelArrayBuffer}. Throws an
 * {@link ImportParseError} code for unsupported / legacy formats.
 */
export async function parseSpreadsheetFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const text = await file.text();
    return parseDelimited(text, name.endsWith('.tsv') ? '\t' : ',');
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    return parseExcelArrayBuffer(await file.arrayBuffer());
  }
  if (name.endsWith('.xls')) throw new Error(ImportParseError.LegacyXls);
  throw new Error(ImportParseError.Unsupported);
}

/**
 * Parse a paste payload (clipboard) into `string[][]`. Prefers an HTML
 * `<table>` (what Excel/Sheets put on the clipboard, preserving structure),
 * falling back to tab- or comma-delimited plain text. Returns `null` when the
 * payload holds no tabular data.
 */
export function parseClipboardTable(html: string | null, text: string | null): string[][] | null {
  if (html && /<table[\s>]/i.test(html) && typeof DOMParser !== 'undefined') {
    const rows = parseHtmlTable(html);
    if (rows.length) return rows;
  }
  if (text && text.trim()) {
    // Excel/Sheets copy as TSV; lone-value pastes have neither tab nor comma.
    const delimiter = text.includes('\t') ? '\t' : ',';
    const rows = parseDelimited(text, delimiter);
    if (rows.length) return rows;
  }
  return null;
}

function parseHtmlTable(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];
  const out: string[][] = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll('th,td').forEach((td) => cells.push((td.textContent ?? '').trim()));
    if (cells.some((c) => c !== '')) out.push(cells);
  });
  return out;
}

/** Boolean-looking tokens, excluding 0/1 (those read as numbers, not flags). */
const BOOLEAN_TOKENS = new Set(['true', 'false', 'yes', 'no', 'y', 'n', '是', '否']);
/** Max cells sampled per column when inferring type — caps cost on huge files. */
const INFER_SAMPLE_LIMIT = 50;

const isNumberLike = (s: string) => s !== '' && !isNaN(Number(s));
const isBooleanLike = (s: string) => BOOLEAN_TOKENS.has(s.toLowerCase());
const hasTimeComponent = (s: string) => /\d{1,2}:\d{2}/.test(s) || /T\d{2}:\d{2}/.test(s);
const isDateLike = (s: string) => !isNumberLike(s) && !isNaN(Date.parse(s));

/**
 * Infer a column's semantic type from a sample of its values. Empty cells are
 * ignored; a column is only assigned a non-text type when *every* sampled value
 * matches it (conservative — avoids mislabelling mixed columns). Order matters:
 * boolean before number before date so 0/1 stay numeric and years stay numbers.
 */
export function inferColumnType(values: Array<string | undefined>): InferredType {
  const samples = values
    .map((v) => (v ?? '').trim())
    .filter((v) => v !== '')
    .slice(0, INFER_SAMPLE_LIMIT);
  if (samples.length === 0) return 'text';
  if (samples.every(isBooleanLike)) return 'boolean';
  if (samples.every(isNumberLike)) return 'number';
  if (samples.every(isDateLike)) return samples.some(hasTimeComponent) ? 'datetime' : 'date';
  return 'text';
}

/** Whether an inferred column type can reasonably feed a given object field type. */
export function isTypeCompatible(inferred: InferredType, fieldType: string): boolean {
  switch (inferred) {
    case 'number': return ['number', 'currency', 'percent'].includes(fieldType);
    case 'boolean': return fieldType === 'boolean';
    case 'date': case 'datetime': return fieldType === 'date' || fieldType === 'datetime';
    case 'text': return true;
    default: return true;
  }
}
