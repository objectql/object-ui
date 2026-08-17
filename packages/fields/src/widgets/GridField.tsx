import React, { useCallback, useRef } from 'react';
import { FieldWidgetComponentProps } from './types';
import {
  cn,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Checkbox,
  Label,
} from '@object-ui/components';
import { Plus, Trash2, SlidersHorizontal, Maximize2, Copy, GripVertical } from 'lucide-react';
import { resolveFieldRuleState } from '@object-ui/core';
import { useDisplayLocale } from '@object-ui/i18n';
import { LookupField } from './LookupField';
import { FileCell } from './FileField';
import { toDateInputValue, toDateTimeInputValue, fromDateTimeInputValue } from './nativeDateValue';
import { toDomProps } from './toDomProps';
import { toHostGroupProps } from './toHostGroupProps';

/**
 * GridField / LineItemsField — editable child-grid ("line items") widget.
 *
 * ## Where the host's label and help text land, and why (objectui#4857)
 *
 * This widget forwarded nothing a host handed it, so the field's visible label
 * pointed `for` at an id no element carried and the help text had zero
 * consumers. Measured on `origin/main` at `e71c854ce`, a real form, editable
 * state, `description` set:
 *
 * ```
 * bare (no columns)   for=DANGLING hostIdEl=NONE consumers=0  focusables=[button]
 * columns + one row   for=DANGLING hostIdEl=NONE consumers=0  focusables=[drag,
 *                       input(Item), input(Qty), button(Duplicate row),
 *                       button(Remove row), input(Item), input(Qty), button(Add)]
 * ```
 *
 * The bare row's single focusable is the auxiliary "Add line" BUTTON — labelable,
 * but routing the host id (and so the label's `for`) onto it would make the
 * field's label NAME the add-row action and make a click on the label insert a
 * row. Every realistic config is a composite: many cell inputs, each with its
 * own `aria-label`, under one container. So this widget declares
 * `labelling: 'group'` (see `FIELD_WIDGET_LABELLING` in `../index`) — the
 * objectui#3961 composite shape, like `address` — and the CONTAINER consumes the
 * host's keys:
 *
 *  - editable / list mode: the root div takes the DOM pass-through minus `name`
 *    (DOM-legal on form controls only — the objectui#3291 leak) and minus
 *    `aria-invalid` (control-channel state; this grid reports validity per CELL,
 *    with its own inline marks), answering `role="group"` only when a host
 *    actually named it — `CheckboxesField`'s split, key for key.
 *  - readonly: the table replaces the inputs entirely, so that surface takes the
 *    name AND the description via `toHostGroupProps` — `'instead-of-the-inputs'`.
 *
 * A controlled component: `value` is an array of row objects, `onChange`
 * receives the next array. It renders one editable cell per configured
 * column, supports add / delete row, and shows a running total of a numeric
 * column. This is the renderer for the `field:grid` widget and the cell
 * engine behind the master-detail subform (see ADR-0001).
 *
 * Column config (a subset of `GridColumnDefinition`):
 *   { name, label?, type?, options?, width?, required?, prefix?, step? }
 *   type ∈ 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time'
 *        | 'select' | 'lookup' | 'file'
 *
 * Field-level config (from `GridFieldMetadata`):
 *   columns, min_rows, max_rows, allow_add, allow_delete, total_field
 */

export interface GridColumn {
  /**
   * The column's field name — the key it reads and writes on each row object.
   *
   * Spelled `name`, exactly as the declared `GridColumnDefinition`
   * (`@object-ui/types`) and the grid docs page say (objectui#3951). This
   * widget used to read a divergent `field` key, so metadata authored against
   * the published type rendered every cell empty plus a React key warning.
   * There is deliberately no tolerant alias bridging the retired spelling to
   * this one: a single spelling, enforced at the producer — AGENTS.md #0.1.
   *
   * (Wording note: do not restate that rule as an alternation expression over
   * the two key names. `column-identity.ratchet.test.ts` (objectui#3104) scans
   * these files line by line and cannot tell prose from code, so spelling the
   * shape out here registers as a new dual read and fails the gate.)
   */
  name: string;
  label?: string;
  /**
   * Cell control + read/write adapter for the column.
   *
   * `date` / `datetime` / `time` are three DISTINCT controls, not one
   * (objectui#3569). Collapsing `datetime` onto the `date` control did not
   * merely under-render it — `<input type="date">` hands back a bare
   * `YYYY-MM-DD` on change, so touching the day of a `datetime` cell silently
   * DELETED its time component from the record.
   */
  type?: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time' | 'select' | 'lookup' | 'file';
  options?: Array<{ label: string; value: string }>;
  width?: number;
  required?: boolean;
  prefix?: string;
  step?: number;
  /** For `type: 'lookup'` — the referenced object and label/id fields. */
  reference?: string;
  displayField?: string;
  idField?: string;
  /** Multi-value column: multi-record lookup, or multi-file upload cell. */
  multiple?: boolean;
  /** For `type: 'file'` — accepted MIME types / extensions for the picker
   *  (e.g. `['image/*', '.pdf']`). Omit to accept anything. */
  accept?: string[];
  /**
   * Hidden from the grid by default but revealable via the column chooser.
   * Set by `deriveColumns` for fields beyond the default-visible budget — the
   * data is NOT dropped (it's just collapsed, like Odoo's `optional` columns /
   * Salesforce column personalization), so business-critical fields stay
   * reachable. Required columns are never default-hidden.
   */
  defaultHidden?: boolean;
  /**
   * A computed (read-only) column whose value is derived live from sibling
   * cells via {@link expr} — e.g. an invoice line's `amount = quantity *
   * unit_price`. The grid renders it read-only, recomputes it as the row's
   * inputs change, and writes the result back into the row so it persists
   * (and any running total reflects it). The classic spreadsheet pattern used
   * by QuickBooks / Stripe / NetSuite line grids — nobody types the amount.
   */
  computed?: boolean;
  /** Arithmetic expression for a {@link computed} column. Supports `+ - * / %`,
   *  parentheses, numeric literals and field refs (`record.qty` or bare `qty`). */
  expr?: string;
  /** Decimal places to round a computed numeric/currency result to. */
  scale?: number;
  /** For `type: 'lookup'` — when a record is picked, copy its fields into any
   *  sibling columns of the same name (e.g. a product's unit_price/description).
   *  On by default for lookup columns; set `false` to disable the auto-fill. */
  autofill?: boolean;
  /**
   * CEL predicate: when TRUE for this row, the cell is **read-only** (B2 field
   * rules, generalized to grid cells). Evaluated per row against the row as
   * `record` plus the header as `parent` (so a line locks when
   * `parent.status == 'paid'` *or* on an intra-row condition like
   * `record.kind == 'auto'`). Client-side UX; fails open (stays editable).
   */
  readonlyWhen?: string | { dialect?: string; source: string };
  /**
   * CEL predicate: when TRUE for this row, the cell is **required** (flagged
   * inline-invalid while empty). Same `record` + `parent` scope as
   * {@link readonlyWhen}.
   */
  requiredWhen?: string | { dialect?: string; source: string };
}

type Row = Record<string, any>;

const isNumeric = (t?: string) => t === 'number' || t === 'currency';

/** Comfortable minimum widths per column type so cells never get crushed; the
 *  grid scrolls horizontally instead. Authors can still pin a `width`. */
const MIN_WIDTH_BY_TYPE: Record<string, number> = {
  text: 160,
  select: 132,
  lookup: 168,
  number: 104,
  currency: 116,
  date: 150,
  // `<input type="datetime-local">` renders a day AND a wall clock, so it needs
  // materially more room than a date cell before the browser starts eliding.
  datetime: 200,
  time: 116,
  file: 168,
};
const minWidthFor = (c: GridColumn): number => c.width ?? MIN_WIDTH_BY_TYPE[c.type ?? 'text'] ?? 132;

/**
 * Per-column sizing. Text columns flex to absorb slack (so the description
 * never gets crushed), while numeric / select / date / lookup columns get a
 * fixed sensible width — the role-based sizing every enterprise line grid uses
 * (Qty stays narrow, Description stays wide). Authors can still pin `width`.
 */
function widthStyle(c: GridColumn): React.CSSProperties {
  if (c.width) return { width: c.width, minWidth: c.width };
  if ((c.type ?? 'text') === 'text') return { minWidth: 180 }; // flex, no fixed width
  const w = MIN_WIDTH_BY_TYPE[c.type ?? 'text'] ?? 132;
  return { width: w, minWidth: w };
}

// ── Safe arithmetic evaluator for computed columns ──────────────────────────
// A tiny recursive-descent parser over `+ - * / %`, parentheses, numeric
// literals and field references (`record.qty` or bare `qty`). Deliberately NOT
// eval()/Function() — only arithmetic, no code execution. Returns a finite
// number, or null when the expression is unparseable or any referenced cell is
// blank/non-numeric (so a computed amount reads "—" until its inputs exist).
type Tok = { t: 'num' | 'id' | 'op' | 'lp' | 'rp'; v: string };

function tokenize(s: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if ((c >= '0' && c <= '9') || c === '.') {
      let j = i + 1;
      while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) j++;
      toks.push({ t: 'num', v: s.slice(i, j) }); i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9_.]/.test(s[j])) j++;
      toks.push({ t: 'id', v: s.slice(i, j) }); i = j; continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '%') { toks.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { toks.push({ t: 'lp', v: c }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp', v: c }); i++; continue; }
    return null; // unsupported character → bail (treat as non-computable)
  }
  return toks;
}

/** Resolve an identifier (`record.quantity` / `quantity`) to a numeric cell. */
function resolveRef(id: string, row: Row): number | null {
  const field = id.startsWith('record.') ? id.slice('record.'.length) : id;
  const raw = row?.[field];
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Evaluate an arithmetic `expr` against `row`. null when blank/unparseable. */
export function evalArith(expr: string, row: Row): number | null {
  const toks = tokenize(expr);
  if (!toks || toks.length === 0) return null;
  let pos = 0;
  let bad = false;
  const peek = () => toks[pos];
  const next = () => toks[pos++];

  function factor(): number {
    const tk = peek();
    if (!tk) { bad = true; return NaN; }
    if (tk.t === 'op' && tk.v === '-') { next(); return -factor(); }
    if (tk.t === 'op' && tk.v === '+') { next(); return factor(); }
    if (tk.t === 'num') { next(); return Number(tk.v); }
    if (tk.t === 'id') { next(); const v = resolveRef(tk.v, row); if (v === null) { bad = true; return NaN; } return v; }
    if (tk.t === 'lp') {
      next();
      const v = expression();
      const close = next();
      if (!close || close.t !== 'rp') bad = true;
      return v;
    }
    bad = true; return NaN;
  }
  function term(): number {
    let v = factor();
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/' || peek().v === '%')) {
      const op = next().v;
      const r = factor();
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  }
  function expression(): number {
    let v = term();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const result = expression();
  if (bad || pos !== toks.length || !Number.isFinite(result)) return null;
  return result;
}

/**
 * Recompute every {@link GridColumn.computed} cell in `row` from its sibling
 * inputs, returning a new row. Called after each edit so computed columns and
 * the running total stay live, and so the computed value persists in the batch.
 */
/**
 * Build the row patch for a lookup-cell selection: set the FK column to the
 * chosen record's id, and (unless the column opts out with `autofill: false`)
 * copy any of the record's fields whose names match a sibling column — the
 * catalog-typeahead behaviour (pick a product → its unit_price/description fill
 * in). Skips the lookup column itself and computed columns. Pure + exported so
 * it is unit-testable independent of the picker UI.
 */
export function lookupAutofillPatch(columns: GridColumn[], col: GridColumn, record: any): Row {
  const patch: Row = { [col.name]: record?.value ?? record?.id ?? record?._id };
  if (col.autofill !== false && record && typeof record === 'object') {
    for (const other of columns) {
      if (other.name === col.name || other.computed || other.type === 'lookup') continue;
      const v = record[other.name];
      if (v !== undefined && v !== null && v !== '') patch[other.name] = v;
    }
  }
  return patch;
}

export function computeRow(columns: GridColumn[], row: Row): Row {
  const computedCols = columns.filter((c) => c.computed && c.expr);
  if (computedCols.length === 0) return row;
  const next = { ...row };
  for (const c of computedCols) {
    const v = evalArith(c.expr!, next);
    if (v === null) { next[c.name] = null; continue; }
    const scale = c.scale ?? (c.type === 'currency' ? 2 : undefined);
    next[c.name] = scale != null ? Number(v.toFixed(scale)) : v;
  }
  return next;
}

/** True for the three temporal column types, which all need a formatter on the
 *  read-only surfaces rather than the raw stored string (objectui#3569). */
const isTemporal = (t?: string) => t === 'date' || t === 'datetime' || t === 'time';

/**
 * Read-only display text for a temporal cell (objectui#3569).
 *
 * The stored shapes differ per type and so must the rendering — which is only
 * decidable now that `datetime`/`time` are no longer collapsed onto `date`:
 *
 * - `date` — a calendar day. Formatted from its VERBATIM `YYYY-MM-DD` parts via
 *   a local `Date`, never by parsing the stored string: `new Date('2026-06-17')`
 *   is UTC midnight, so reading local calendar components back out of it moves
 *   the day to the 16th everywhere west of Greenwich.
 * - `datetime` — an instant. Rendered as local day + local time, the same basis
 *   `toDateTimeInputValue` uses for the editor, so the two never disagree (and
 *   matching `DateTimeField`'s own read-only rendering).
 * - `time` — a zone-less wall clock (`HH:mm[:ss]`); it is already display-ready.
 *
 * An unparseable value falls through to its raw string rather than rendering
 * "Invalid Date" — showing the user what is actually stored beats hiding it.
 *
 * `locale` is threaded rather than left to `Intl`'s default (objectui#4468):
 * the default is the MACHINE's locale, which has nothing to do with the
 * session, so a Chinese form rendered `6/17/2026` in its line items.
 */
function temporalText(type: string | undefined, value: any, locale: string): string {
  const raw = String(value);
  if (type === 'time') return raw;
  if (type === 'date') {
    const ymd = toDateInputValue(value);
    if (!ymd) return raw;
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale);
  }
  const dt = value instanceof Date ? value : new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return `${dt.toLocaleDateString(locale)} ${dt.toLocaleTimeString(locale)}`;
}

/** Read-only display text for a cell in list mode (select → option label,
 *  currency/number → formatted, date/datetime/time → localized, empty → em
 *  dash). Lookups render separately. */
function displayText(c: GridColumn, value: any, locale: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (isTemporal(c.type)) return temporalText(c.type, value, locale);
  if (c.type === 'file') {
    const files = Array.isArray(value) ? value : [value];
    if (files.length === 0) return '—';
    if (files.length > 1) return `${files.length} files`;
    const f = files[0];
    return typeof f === 'string' ? f : f?.name || f?.original_name || 'File';
  }
  if (c.type === 'select' && Array.isArray(c.options)) {
    const opt = c.options.find((o) => String(o.value) === String(value));
    return opt ? opt.label : String(value);
  }
  if (isNumeric(c.type)) {
    const n = Number(value);
    if (Number.isFinite(n)) return c.type === 'currency' ? `${c.prefix || '¥'}${n.toLocaleString()}` : n.toLocaleString();
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function coerce(type: string | undefined, raw: string): any {
  if (isNumeric(type)) {
    if (raw === '' || raw == null) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  // `<input type="datetime-local">` hands back a ZONE-LESS local wall clock;
  // storing that verbatim would put the write on a different basis from the
  // read (`toDateTimeInputValue`), so a user in UTC+8 who picked 08:33 would
  // store 08:33Z and see 16:33 back. The pair must be used as a pair — this is
  // the same contract `DateTimeField` follows (objectui#3127 / #3569).
  // `date` and `time` need no conversion: their controls already emit exactly
  // the stored shape (`YYYY-MM-DD`, `HH:mm`).
  if (type === 'datetime') return fromDateTimeInputValue(raw);
  return raw;
}

/** Sum a numeric column across rows (ignoring blanks/NaN). */
export function sumColumn(rows: Row[], field: string): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((acc, r) => {
    const v = Number(r?.[field]);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
}

export function GridField({
  value,
  onChange,
  field,
  readonly,
  disabled,
  className,
  onRowExpand,
  displayMode,
  onAdd,
  ...props
}: FieldWidgetComponentProps<Row[]> & {
  /** When provided, each row shows an "expand" button that opens the row in a
   *  full form (the host — e.g. MasterDetailForm — renders the drawer/modal and
   *  writes the edited values back). Lets a "fat" child be edited in a real form
   *  while the grid stays a quick at-a-glance editor. */
  onRowExpand?: (rowIndex: number) => void;
  /** 'grid' (default) = editable cells; 'list' = read-only rows whose primary
   *  action is per-row edit (via `onRowExpand`) and whose Add opens a new row
   *  in the full form (via `onAdd`). The form-factor for "fat" children. */
  displayMode?: 'grid' | 'list';
  /** In 'list' mode, "Add" calls this (host opens the full form for a new row)
   *  instead of inserting a blank inline row. */
  onAdd?: () => void;
  /** The header/parent record, bound as `parent` when evaluating a column's
   *  `readonlyWhen` / `requiredWhen` CEL predicate — so a line cell can react to
   *  the header (`parent.status == 'paid'`). Supplied by MasterDetailForm. */
  contextRecord?: Record<string, unknown>;
}) {
  const cfg = (field || {}) as any;
  const allColumns: GridColumn[] = cfg.columns || [];
  const rows: Row[] = Array.isArray(value) ? value : [];
  const contextRecord = props.contextRecord;
  // The one locale channel every field renderer resolves through: tenant
  // regional default → active UI language → 'en' (objectui#4468). Read here
  // and passed down, since `displayText` is a pure helper.
  const displayLocale = useDisplayLocale();

  // Per-cell CEL rule state (B2 in grids). A column with no readonlyWhen/
  // requiredWhen resolves to its static flags (cheap fast-path — no engine
  // call). Otherwise evaluate against the row (`record`) + header (`parent`).
  const cellRules = useCallback(
    (c: GridColumn, row: Row): { readonly: boolean; required: boolean } => {
      if (!c.readonlyWhen && !c.requiredWhen) {
        return { readonly: false, required: !!c.required };
      }
      const s = resolveFieldRuleState(
        { readonlyWhen: c.readonlyWhen, requiredWhen: c.requiredWhen },
        (row || {}) as Record<string, unknown>,
        { required: !!c.required, readonly: false },
        undefined,
        contextRecord ? { parent: contextRecord } : undefined,
      );
      return { readonly: s.readonly, required: s.required };
    },
    [contextRecord],
  );
  // List mode: rows are read-only at-a-glance; editing happens in the full form.
  const isList = displayMode === 'list' && !readonly;

  // Column visibility — a curated default-visible set with the rest revealable
  // via the column chooser (mainstream "personalize columns" pattern). Required
  // columns are always visible; nothing is ever silently dropped.
  const [extraShown, setExtraShown] = React.useState<Set<string>>(() => new Set());
  const optionalColumns = allColumns.filter((c) => c.defaultHidden && !c.required);
  const columns: GridColumn[] = allColumns.filter(
    (c) => !c.defaultHidden || c.required || extraShown.has(c.name),
  );
  const toggleColumn = useCallback((fieldName: string) => {
    setExtraShown((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) next.delete(fieldName);
      else next.add(fieldName);
      return next;
    });
  }, []);

  const allowAdd = cfg.allow_add !== false && !readonly && !disabled;
  const allowDelete = cfg.allow_delete !== false && !readonly && !disabled;
  const allowDuplicate = cfg.allow_duplicate !== false && allowAdd;
  // Per-row "expand to full form" (mainstream hybrid: quick grid + rich form).
  const showExpand = typeof onRowExpand === 'function' && !readonly;
  // Enterprise line grids (NetSuite/SAP/Salesforce) show a line-number column.
  const showLineNumbers = cfg.show_line_numbers !== false;
  const minRows: number = cfg.min_rows ?? 0;
  const maxRows: number | undefined = cfg.max_rows;
  const totalField: string | undefined =
    cfg.total_field || cfg.amount_field || cfg.amountField;
  // When set, the row's order is persisted by stamping `row[sortField] = index`
  // on every change — so drag-reorder survives a reload (the app adds a numeric
  // position field and lists sort by it). Without it, reorder is order-of-entry.
  const sortField: string | undefined = cfg.sort_field;
  // Drag-to-reorder is on for editable grids (off in read-only / list mode).
  const allowReorder = cfg.reorderable !== false && !readonly && !disabled;

  const emit = useCallback(
    (next: Row[]) => {
      onChange?.(sortField ? next.map((r, i) => ({ ...r, [sortField]: i })) : next);
    },
    [onChange, sortField],
  );

  const blankRow = useCallback((): Row => {
    const blank: Row = {};
    for (const c of columns) blank[c.name] = null;
    return blank;
  }, [columns]);

  /**
   * Merge a field patch into a row. `rowIdx === rows.length` targets the
   * trailing "ghost" row (always-present empty line) — editing it materialises
   * a new real row, so the user never has to click "Add line" to keep entering.
   * Computed columns are recomputed for the touched row on every change.
   */
  const applyPatch = useCallback(
    (rowIdx: number, patch: Row) => {
      const isGhost = rowIdx >= rows.length;
      if (isGhost) {
        if (maxRows != null && rows.length >= maxRows) return;
        emit([...rows, computeRow(columns, { ...blankRow(), ...patch })]);
        return;
      }
      emit(rows.map((r, i) => (i === rowIdx ? computeRow(columns, { ...r, ...patch }) : r)));
    },
    [rows, columns, maxRows, blankRow, emit],
  );

  const applyCell = useCallback(
    (rowIdx: number, columnName: string, value: any) => applyPatch(rowIdx, { [columnName]: value }),
    [applyPatch],
  );

  /**
   * A lookup cell selection — set the FK id and auto-fill any sibling cells
   * whose column name matches a field on the chosen record (and isn't itself a
   * lookup/computed column). The catalog-typeahead behaviour every invoicing
   * tool has: pick a product → its unit_price / description drop into the row.
   * Opt out per column with `autofill: false`.
   */
  const applyLookupSelection = useCallback(
    (rowIdx: number, col: GridColumn, record: any) => {
      applyPatch(rowIdx, lookupAutofillPatch(columns, col, record));
    },
    [columns, applyPatch],
  );

  /** Set a cell to an already-typed value (lookup ids, etc.) without coercion. */
  const setCellValue = useCallback(
    (rowIdx: number, columnName: string, value: any) => applyCell(rowIdx, columnName, value),
    [applyCell],
  );

  const setCell = useCallback(
    (rowIdx: number, col: GridColumn, raw: string) => {
      applyCell(rowIdx, col.name, coerce(col.type, raw));
    },
    [applyCell],
  );

  const addRow = useCallback(() => {
    if (maxRows != null && rows.length >= maxRows) return;
    emit([...rows, blankRow()]);
  }, [rows, blankRow, maxRows, emit]);

  // Keyboard navigation across cells (spreadsheet-style): the table is a focus
  // grid. Enter / ArrowUp / ArrowDown move between rows in the same column;
  // Tab / Shift-Tab fall through to the browser's natural row-major order
  // (and into the ever-present ghost row, so tabbing past the last cell starts
  // a new line). Cells carry data-cell="row-col" so we can target neighbours.
  const gridRef = useRef<HTMLTableElement>(null);
  const focusCell = useCallback((rowIdx: number, colIdx: number) => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${rowIdx}-${colIdx}"]`);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) el.select();
    }
  }, []);
  const onCellKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        focusCell(rowIdx + 1, colIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (rowIdx > 0) focusCell(rowIdx - 1, colIdx);
      }
    },
    [focusCell],
  );

  const removeRow = useCallback(
    (rowIdx: number) => {
      if (rows.length <= minRows) return;
      emit(rows.filter((_, i) => i !== rowIdx));
    },
    [rows, minRows, emit],
  );

  /** Duplicate a row (id stripped so the copy persists as a new record),
   *  inserted directly below the original — handy for near-identical lines. */
  const duplicateRow = useCallback(
    (rowIdx: number) => {
      if (maxRows != null && rows.length >= maxRows) return;
      const src = rows[rowIdx];
      if (!src) return;
      const { id: _i, _id: _i2, recordId: _i3, ...copy } = src as any;
      const next = [...rows];
      next.splice(rowIdx + 1, 0, { ...copy });
      emit(next);
    },
    [rows, maxRows, emit],
  );

  /** Move a row from one position to another (drag-to-reorder). */
  const moveRow = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
      const next = [...rows];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      emit(next);
    },
    [rows, emit],
  );
  const dragIndex = useRef<number | null>(null);

  const hasRowActions = showExpand || allowDelete || allowDuplicate;
  const actionColWidth = ((showExpand ? 1 : 0) + (allowDuplicate ? 1 : 0) + (allowDelete ? 1 : 0)) * 34 + 12;

  const showTotal = !!totalField;
  const total = showTotal ? sumColumn(rows, totalField!) : 0;
  // Align the running total under the column it sums (not blindly under the
  // last column). The label sits right-aligned immediately to its left.
  const totalColIndex = showTotal ? Math.max(0, columns.findIndex((c) => c.name === totalField)) : -1;

  // Column chooser — reveal/hide the optional (default-hidden) columns. Only
  // rendered when there are optional columns to manage.
  const columnChooser = optionalColumns.length > 0 ? (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          data-testid="line-items-columns"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Columns
          {extraShown.size > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
              +{extraShown.size}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">Optional columns</div>
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {optionalColumns.map((c) => {
            const id = `col-toggle-${c.name}`;
            return (
              <Label
                key={c.name}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-normal hover:bg-muted"
              >
                <Checkbox
                  id={id}
                  checked={extraShown.has(c.name)}
                  onCheckedChange={() => toggleColumn(c.name)}
                />
                <span className="truncate">{c.label || c.name}</span>
              </Label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  ) : null;

  // ── Read-only / view rendering ────────────────────────────────────────────
  if (readonly) {
    return (
      <div
        // No input of the field's own renders here, so this surface is the only
        // candidate for the host's name AND description (objectui#4857; the
        // objectui#3990/#4005 route). Standalone rendering hands down none of
        // the keys, so nothing is emitted and the markup is unchanged.
        {...toHostGroupProps(props, 'instead-of-the-inputs')}
        className={cn('space-y-2', className)}
      >
        {columnChooser && <div className="flex justify-end">{columnChooser}</div>}
        <div className="border border-border rounded-lg overflow-x-auto" data-testid="line-items-readonly">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              {showLineNumbers && (
                <th className="w-10 px-2 py-2 text-right text-xs font-medium text-muted-foreground">#</th>
              )}
              {columns.map((c) => (
                <th
                  key={c.name}
                  style={{ minWidth: minWidthFor(c) }}
                  className={cn(
                    'px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap',
                    isNumeric(c.type) ? 'text-right' : 'text-left',
                  )}
                >
                  {c.label || c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(columns.length + (showLineNumbers ? 1 : 0), 1)}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No items
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {showLineNumbers && (
                    <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">{rowIdx + 1}</td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.name}
                      className={cn('px-3 py-2 text-foreground', isNumeric(c.type) && 'text-right tabular-nums')}
                    >
                      {c.type === 'lookup' && row[c.name] != null && row[c.name] !== '' ? (
                        <LookupField
                          value={row[c.name]}
                          onChange={() => {}}
                          readonly
                          field={{ reference: c.reference, display_field: c.displayField, id_field: c.idField } as any}
                        />
                      ) : c.type === 'file' || isTemporal(c.type) ? (
                        // A temporal column printed with `String(value)` puts
                        // the raw stored ISO on screen — `2026-06-17T00:00:00.000Z`
                        // for a date, and for a datetime it would ALSO have been
                        // wrong to render as a bare day (objectui#3569). Now that
                        // the three types are distinct, each formats as itself.
                        displayText(c, row[c.name], displayLocale)
                      ) : row[c.name] != null && row[c.name] !== '' ? (
                        String(row[c.name])
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {showTotal && (
            <tfoot className="border-t border-border bg-muted/40">
              <tr>
                <td
                  colSpan={Math.max((showLineNumbers ? 1 : 0) + totalColIndex, 1)}
                  className="px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right font-semibold text-foreground tabular-nums">
                  {total.toLocaleString()}
                </td>
                {columns.length - totalColIndex - 1 > 0 && (
                  <td colSpan={columns.length - totalColIndex - 1} />
                )}
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>
    );
  }

  // ── Editable rendering ──────────────────────────────────────────────────────
  // A trailing "ghost" empty row is always present in grid mode (start-with-one
  // + auto-append): editing it materialises a real row, so the user keeps
  // entering lines without clicking "Add". Index-based keys keep the input
  // mounted across materialisation, so focus/caret survive the transition.
  const hasGhost = !isList && allowAdd && (maxRows == null || rows.length < maxRows);
  const displayRows: Row[] = hasGhost ? [...rows, blankRow()] : rows;

  /** Cell content: read-only display (list mode / computed columns) or an
   *  editable borderless control (spreadsheet feel). */
  const renderCellInput = (c: GridColumn, colIdx: number, rowIdx: number, row: Row) => {
    const val = row?.[c.name];
    // A readonlyWhen-TRUE cell is locked: treat like the form-wide `disabled`.
    const locked = disabled || cellRules(c, row).readonly;
    // List (form-factor) mode → read-only at-a-glance display.
    if (isList) {
      if (c.type === 'lookup' && val != null && val !== '') {
        return (
          <LookupField value={val} onChange={() => {}} readonly
            field={{ reference: c.reference, display_field: c.displayField, id_field: c.idField } as any} />
        );
      }
      return (
        <span className={cn('px-2 text-sm text-foreground', isNumeric(c.type) && 'tabular-nums', (val == null || val === '') && 'text-muted-foreground')}>
          {displayText(c, val, displayLocale)}
        </span>
      );
    }
    // Computed column → read-only, recomputed live, formatted.
    if (c.computed) {
      return (
        <span
          className={cn('block px-2 text-sm tabular-nums', isNumeric(c.type) ? 'text-right' : 'text-left', (val == null || val === '') ? 'text-muted-foreground' : 'text-foreground')}
          title="Computed"
          data-computed={c.name}
        >
          {displayText(c, val, displayLocale)}
        </span>
      );
    }
    if (c.type === 'lookup') {
      return (
        <LookupField
          value={val}
          onChange={(v: any) => setCellValue(rowIdx, c.name, v)}
          onSelectRecord={(rec: any) => applyLookupSelection(rowIdx, c, rec)}
          compact
          field={{ reference: c.reference, display_field: c.displayField, id_field: c.idField, multiple: c.multiple, options: c.options, placeholder: '—' } as any}
          disabled={locked}
        />
      );
    }
    // File / image column → a real upload control in the cell (objectui#2360),
    // not a text input: chips for uploaded files + a compact picker button.
    if (c.type === 'file') {
      return (
        <FileCell
          value={val}
          onChange={(v: any) => setCellValue(rowIdx, c.name, v)}
          multiple={c.multiple}
          accept={Array.isArray(c.accept) && c.accept.length > 0 ? c.accept.join(',') : undefined}
          disabled={locked}
          aria-label={c.label || c.name}
          data-cell={`${rowIdx}-${colIdx}`}
        />
      );
    }
    if (c.type === 'select') {
      return (
        <Select value={val != null ? String(val) : ''} onValueChange={(v) => setCell(rowIdx, c, v)} disabled={locked}>
          <SelectTrigger className="h-8 rounded-none border-0 bg-transparent px-2 shadow-none focus:ring-1 focus:ring-ring/60" aria-label={c.label || c.name}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {(c.options || []).map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <div className="relative">
        {c.type === 'currency' && (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{c.prefix || '¥'}</span>
        )}
        <Input
          data-cell={`${rowIdx}-${colIdx}`}
          onKeyDown={(e) => onCellKeyDown(e, rowIdx, colIdx)}
          className={cn(
            'h-8 rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-1 focus-visible:ring-ring/60',
            c.type === 'currency' && 'pl-6',
            isNumeric(c.type) && 'text-right tabular-nums',
          )}
          type={
            c.type === 'date'
              ? 'date'
              : c.type === 'datetime'
                ? 'datetime-local'
                : c.type === 'time'
                  ? 'time'
                  : isNumeric(c.type)
                    ? 'number'
                    : 'text'
          }
          step={isNumeric(c.type) ? c.step ?? 'any' : undefined}
          aria-label={c.label || c.name}
          // A temporal cell holding the API's ISO shape (`2026-06-17T14:30:00.000Z`)
          // is SILENTLY rejected by the native control — the attribute lands in
          // the DOM but `input.value` reads back `''` and the cell paints empty
          // (objectui#3566, the sub-grid face of #3127). So each type reads
          // through its own adapter:
          //   date     → `YYYY-MM-DD`; the control writes that shape back
          //              verbatim, so no paired conversion on `onChange`.
          //   datetime → `YYYY-MM-DDTHH:mm` local; PAIRED with
          //              `fromDateTimeInputValue` in `coerce` so read and write
          //              share one basis (objectui#3569).
          //   time     → `HH:mm[:ss]` is already the stored shape, both ways.
          value={
            c.type === 'date'
              ? toDateInputValue(val)
              : c.type === 'datetime'
                ? toDateTimeInputValue(val)
                : val != null
                  ? String(val)
                  : ''
          }
          onChange={(e) => setCell(rowIdx, c, e.target.value)}
          disabled={locked}
        />
      </div>
    );
  };

  // DOM pass-through (objectui#4857): the container carries the form renderer's
  // id / aria-labelledby / aria-describedby, but NOT its `name` (DOM-legal on
  // form controls only — the objectui#3291 leak) and NOT its `aria-invalid`
  // (control-channel state; this grid reports validity per CELL with its own
  // inline marks). `CheckboxesField`'s split, key for key.
  const {
    'aria-invalid': _hostAriaInvalid,
    name: _domName,
    ...groupDomProps
  } = toDomProps(props);
  // The container answers `role="group"` only when a host actually NAMED it by
  // IDREF (objectui#3961) — standalone rendering (a bare SDUI node) hands down
  // no `aria-labelledby`, emits no role, and keeps its markup unchanged.
  const isLabelledGroup = groupDomProps['aria-labelledby'] != null;

  return (
    <div
      {...groupDomProps}
      role={isLabelledGroup ? 'group' : undefined}
      className={cn('space-y-2', className)}
      data-testid="line-items"
    >
      {columnChooser && <div className="flex justify-end">{columnChooser}</div>}
      <div className="border border-border rounded-lg overflow-x-auto">
        <table ref={gridRef} className="w-full text-sm">
          <thead className="bg-muted/60 border-b border-border">
            <tr>
              {showLineNumbers && (
                <th className={cn('px-2 py-2 text-right text-xs font-medium text-muted-foreground', allowReorder ? 'w-14' : 'w-10')}>#</th>
              )}
              {columns.map((c) => (
                <th
                  key={c.name}
                  className={cn(
                    'px-2 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap',
                    isNumeric(c.type) ? 'text-right' : 'text-left',
                  )}
                  style={widthStyle(c)}
                >
                  {c.label || c.name}
                  {c.required && !c.computed && <span className="text-destructive"> *</span>}
                </th>
              ))}
              {hasRowActions && <th style={{ width: actionColWidth }} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isList && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (hasRowActions ? 1 : 0) + (showLineNumbers ? 1 : 0)}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No items yet — click “{cfg.add_label || 'Add'}” to begin.
                </td>
              </tr>
            ) : (
              displayRows.map((row, rowIdx) => {
                const isGhost = hasGhost && rowIdx === rows.length;
                const reorderable = allowReorder && !isGhost && !isList;
                return (
                  <tr
                    key={rowIdx}
                    className={cn('group', !isGhost && 'hover:bg-muted/30')}
                    {...(allowReorder && !isGhost
                      ? {
                          onDragOver: (e: React.DragEvent) => { if (dragIndex.current != null) e.preventDefault(); },
                          onDrop: (e: React.DragEvent) => {
                            e.preventDefault();
                            if (dragIndex.current != null) { moveRow(dragIndex.current, rowIdx); dragIndex.current = null; }
                          },
                        }
                      : {})}
                  >
                    {showLineNumbers && (
                      <td className="px-1 py-1 text-right align-middle text-xs text-muted-foreground tabular-nums">
                        <span className="inline-flex items-center justify-end gap-0.5">
                          {reorderable && (
                            <span
                              draggable
                              onDragStart={() => { dragIndex.current = rowIdx; }}
                              onDragEnd={() => { dragIndex.current = null; }}
                              className="cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
                              title="Drag to reorder"
                              aria-label="Drag to reorder"
                              data-testid={`line-items-drag-${rowIdx}`}
                            >
                              <GripVertical className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <span className={cn(isGhost && 'opacity-30')}>{rowIdx + 1}</span>
                        </span>
                      </td>
                    )}
                    {columns.map((c, colIdx) => {
                      // Inline validation: a required, non-computed cell that's
                      // empty on a real (non-ghost) row flags red in place. The
                      // "required" verdict honors a column's `requiredWhen` CEL
                      // rule (B2), evaluated against the row + parent header.
                      const required = cellRules(c, row).required;
                      const invalid = !isGhost && !isList && required && !c.computed && (row[c.name] == null || row[c.name] === '');
                      return (
                        <td
                          key={c.name}
                          aria-invalid={invalid || undefined}
                          title={invalid ? `${c.label || c.name} is required` : undefined}
                          data-testid={invalid ? `line-items-invalid-${rowIdx}-${c.name}` : undefined}
                          className={cn(
                            'border-r border-border/40 px-1 py-0.5 align-middle last:border-r-0',
                            isList && 'px-2 py-1.5',
                            invalid && 'bg-destructive/5 ring-1 ring-inset ring-destructive/50',
                          )}
                        >
                          {renderCellInput(c, colIdx, rowIdx, row)}
                        </td>
                      );
                    })}
                    {hasRowActions && (
                      <td className="px-1 py-0.5 align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-0.5">
                          {!isGhost && showExpand && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              aria-label="Open row"
                              title="Open full form"
                              data-testid={`line-items-expand-${rowIdx}`}
                              onClick={() => onRowExpand!(rowIdx)}
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isGhost && allowDuplicate && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              // Always visible (not hover-revealed): row actions must be
                              // discoverable and reachable on touch/coarse-pointer devices,
                              // which have no hover. The action column width is reserved
                              // regardless, so this adds no layout shift.
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              aria-label="Duplicate row"
                              title="Duplicate line"
                              data-testid={`line-items-duplicate-${rowIdx}`}
                              onClick={() => duplicateRow(rowIdx)}
                              disabled={disabled || (maxRows != null && rows.length >= maxRows)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isGhost && allowDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              // Always visible — see the duplicate button above.
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              aria-label="Remove row"
                              data-testid={`line-items-remove-${rowIdx}`}
                              onClick={() => removeRow(rowIdx)}
                              disabled={disabled || rows.length <= minRows}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          {showTotal && (
            <tfoot className="border-t border-border bg-muted/40">
              <tr>
                <td
                  colSpan={Math.max((showLineNumbers ? 1 : 0) + totalColIndex, 1)}
                  className="px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right font-semibold text-foreground tabular-nums" data-testid="line-items-total">
                  {total.toLocaleString()}
                </td>
                {(columns.length - totalColIndex - 1 + (hasRowActions ? 1 : 0)) > 0 && (
                  <td colSpan={columns.length - totalColIndex - 1 + (hasRowActions ? 1 : 0)} />
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {allowAdd && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={isList && onAdd ? onAdd : addRow}
          disabled={maxRows != null && rows.length >= maxRows}
          data-testid="line-items-add"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {cfg.add_label || 'Add line'}
        </Button>
      )}
    </div>
  );
}

/** Semantic alias — the master-detail subform's child grid. */
export const LineItemsField = GridField;
