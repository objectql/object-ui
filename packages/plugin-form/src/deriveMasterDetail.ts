/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Derive a master-detail child collection's grid columns + relationship FK from
 * object metadata, so a master-detail form can be configured with just the
 * child object name instead of a hand-authored columns block. Pure (no React /
 * no I/O) so it is unit-testable; the async schema fetch lives in the component.
 */

import type { GridColumn } from '@object-ui/fields';

/** Minimal shape of an object schema as returned by `DataSource.getObjectSchema`. */
export interface ObjectSchemaLike {
  name?: string;
  fields?: Record<string, any>;
}

/** Fields never shown as editable line-item columns. */
const SYSTEM_FIELDS = new Set([
  'id', '_id', 'recordId',
  'created_at', 'updated_at', 'created_by', 'updated_by',
  'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
  'organization_id', 'tenant_id', 'space', 'owner',
]);

/** Field names that hold a line's sort position — excluded from the editable
 *  columns and the row form (the grid stamps them on drag-reorder instead). */
const SORT_FIELD_NAMES = new Set(['position', 'sort_order', 'sequence', 'line_no', 'line_number', 'sort']);

/** Field types that are not directly editable in a line-item grid. */
const NON_EDITABLE_TYPES = new Set([
  'formula', 'summary', 'rollup', 'autonumber', 'auto_number',
  'file', 'image', 'avatar', 'json', 'object', 'grid', 'table',
  'location', 'vector', 'html', 'markdown', 'richtext',
]);

/** Map an ObjectQL field type to a LineItems grid column type. */
export function fieldTypeToColumnType(type: string | undefined): GridColumn['type'] {
  switch (type) {
    case 'number':
    case 'percent':
    case 'rating':
    case 'slider':
      return 'number';
    case 'currency':
      return 'currency';
    case 'date':
    case 'datetime':
    case 'time':
      return 'date';
    case 'select':
    case 'picklist':
    case 'radio':
    case 'boolean':
    case 'toggle':
      return 'select';
    case 'lookup':
    case 'master_detail':
      return 'lookup';
    default:
      return 'text';
  }
}

function optionsFor(def: any): GridColumn['options'] | undefined {
  if (def?.type === 'boolean' || def?.type === 'toggle') {
    return [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ];
  }
  const raw = def?.options;
  if (!Array.isArray(raw)) return undefined;
  return raw.map((o: any) =>
    typeof o === 'object' && o !== null
      ? { label: String(o.label ?? o.value), value: String(o.value) }
      : { label: String(o), value: String(o) },
  );
}

/**
 * Find the field on the child object that points back to the parent — the
 * master_detail/lookup field whose `reference` is the parent object. Prefer
 * `master_detail` over `lookup` when both exist.
 */
export function findRelationshipField(
  childSchema: ObjectSchemaLike | undefined,
  parentObjectName: string,
): string | undefined {
  const fields = childSchema?.fields;
  if (!fields || typeof fields !== 'object') return undefined;
  let lookupMatch: string | undefined;
  for (const [name, def] of Object.entries(fields)) {
    const d = def as any;
    if (d?.reference !== parentObjectName) continue;
    if (d?.type === 'master_detail') return name; // strongest match
    if (d?.type === 'lookup' && !lookupMatch) lookupMatch = name;
  }
  return lookupMatch;
}

/**
 * Default-visible column budget for an auto-derived inline grid. An inline
 * line-item grid lives in a constrained width (modal / detail card), so we show
 * a focused set by default and mark the rest `defaultHidden` — they are NOT
 * dropped: the grid's column chooser reveals them on demand (the mainstream
 * "personalize columns" pattern; cf. Odoo `optional` / Salesforce column
 * personalization). Required columns are always visible. Authors can override
 * with explicit `columns` / `inlineColumns` (no curation), or `maxColumns: 0`.
 */
export const DEFAULT_MAX_INLINE_COLUMNS = 6;

/** Field names that read as a record's primary/display column. */
const NAME_LIKE_FIELDS = ['name', 'title', 'subject', 'label', 'full_name', 'display_name', 'code'];

/** Lower number = kept first when filling the column budget. */
const TYPE_FILL_PRIORITY: Record<string, number> = {
  select: 0,
  currency: 1,
  number: 1,
  lookup: 2,
  date: 3,
  text: 4,
};

/**
 * Choose the default-visible subset of `max` columns — always keeping the
 * primary (name-like) column and every required column, then filling the
 * remaining budget by type usefulness. Columns NOT in the visible set are
 * marked `defaultHidden` (revealable via the grid's column chooser); none are
 * dropped, so business-critical fields stay reachable. Output preserves the
 * original schema order so the grid still reads naturally.
 */
function curateColumns(cols: GridColumn[], max: number): GridColumn[] {
  if (max <= 0 || cols.length <= max) return cols;
  const visible = new Set<string>();
  const primary = cols.find((c) => NAME_LIKE_FIELDS.includes(c.field)) ?? cols[0];
  if (primary) visible.add(primary.field);
  for (const c of cols) if (c.required) visible.add(c.field); // required is always visible
  const remaining = cols
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !visible.has(c.field))
    .sort((a, b) => (TYPE_FILL_PRIORITY[a.c.type] ?? 5) - (TYPE_FILL_PRIORITY[b.c.type] ?? 5) || a.i - b.i);
  for (const { c } of remaining) {
    if (visible.size >= max) break;
    visible.add(c.field);
  }
  // Keep every column; collapse the overflow into the chooser.
  return cols.map((c) => (visible.has(c.field) ? c : { ...c, defaultHidden: true }));
}

/**
 * Derive editable grid columns from a child object's fields, skipping system /
 * audit fields, non-editable types, and the back-reference FK to the parent.
 * Every editable column is returned; those beyond {@link DEFAULT_MAX_INLINE_COLUMNS}
 * are flagged `defaultHidden` (collapsed into the grid's column chooser, not
 * dropped). Pass `maxColumns: 0` to flag none.
 */
export function deriveColumns(
  childSchema: ObjectSchemaLike | undefined,
  opts: { relationshipField?: string; exclude?: string[]; maxColumns?: number } = {},
): GridColumn[] {
  const fields = childSchema?.fields;
  if (!fields || typeof fields !== 'object') return [];
  const exclude = new Set([...(opts.exclude ?? []), ...(opts.relationshipField ? [opts.relationshipField] : [])]);
  const cols: GridColumn[] = [];
  for (const [name, def] of Object.entries(fields)) {
    const d = def as any;
    if (SYSTEM_FIELDS.has(name) || exclude.has(name) || SORT_FIELD_NAMES.has(name)) continue;
    if (d?.system || d?.readonly || d?.hidden) continue;
    if (NON_EDITABLE_TYPES.has(d?.type)) continue;
    const col: GridColumn = {
      field: name,
      label: d?.label || name,
      type: fieldTypeToColumnType(d?.type),
      required: !!d?.required,
    };
    const options = optionsFor(d);
    if (col.type === 'select' && options) col.options = options;
    if (col.type === 'lookup') {
      col.reference = d?.reference;
      col.displayField = d?.display_field || d?.reference_field;
    }
    // Field-level CEL conditional rules (B2 in grids). Carried through verbatim
    // so the grid cell evaluates them per row (against the row + `parent`
    // header). requiredWhen falls back to the conditionalRequired alias.
    if (d?.readonlyWhen) col.readonlyWhen = d.readonlyWhen;
    if (d?.requiredWhen ?? d?.conditionalRequired) col.requiredWhen = d.requiredWhen ?? d.conditionalRequired;
    // A field carrying an arithmetic `expression` (e.g. amount = quantity *
    // unit_price) becomes a live read-only computed column. The expression may
    // be a bare string or the normalized CEL envelope `{ dialect, source }`.
    const expr = typeof d?.expression === 'string' ? d.expression : d?.expression?.source;
    if (expr && typeof expr === 'string') {
      col.computed = true;
      col.expr = expr;
      col.required = false; // computed → never user-entered, so never required
      if (typeof d?.scale === 'number') col.scale = d.scale;
    }
    cols.push(col);
  }
  const maxColumns = opts.maxColumns ?? DEFAULT_MAX_INLINE_COLUMNS;
  return curateColumns(cols, maxColumns);
}

/**
 * Fill in missing widget metadata on author-supplied grid columns from the
 * child object's field definitions. A view often lists columns as bare
 * `{ field, label }` (the common, ergonomic authoring form) — without a `type`
 * those cells fall back to a plain text `<Input>`, so a lookup, date, number or
 * picklist field silently renders as free text. This resolves each such
 * column's `type` (plus `options` / `reference` / computed `expr`) from the
 * schema, exactly as {@link deriveColumns} would, while preserving the author's
 * column set, order and labels. A column that already declares a `type` is left
 * untouched — the author's explicit choice always wins.
 */
export function hydrateColumns(
  columns: GridColumn[] | undefined,
  childSchema: ObjectSchemaLike | undefined,
): GridColumn[] {
  const cols = columns ?? [];
  const fields = childSchema?.fields;
  if (!cols.length || !fields || typeof fields !== 'object') return cols;
  return cols.map((col) => {
    if (col.type) return col; // explicit type — respect the author's choice
    const d = (fields as any)[col.field];
    if (!d) return col; // unknown field — leave as-is (grid falls back to text)
    const type = fieldTypeToColumnType(d?.type);
    const next: GridColumn = { ...col, type };
    if (next.label == null) next.label = d?.label || col.field;
    if (next.required == null) next.required = !!d?.required;
    const options = optionsFor(d);
    if (type === 'select' && options && !next.options) next.options = options;
    if (type === 'lookup') {
      if (next.reference == null) next.reference = d?.reference;
      if (next.displayField == null) next.displayField = d?.display_field || d?.reference_field;
    }
    if (next.readonlyWhen == null && d?.readonlyWhen) next.readonlyWhen = d.readonlyWhen;
    if (next.requiredWhen == null && (d?.requiredWhen ?? d?.conditionalRequired)) {
      next.requiredWhen = d.requiredWhen ?? d.conditionalRequired;
    }
    const expr = typeof d?.expression === 'string' ? d.expression : d?.expression?.source;
    if (!next.computed && expr && typeof expr === 'string') {
      next.computed = true;
      next.expr = expr;
      next.required = false; // computed → never user-entered, so never required
      if (typeof d?.scale === 'number') next.scale = d.scale;
    }
    return next;
  });
}

/** Computed / non-input field types — excluded from the row form (read-only,
 *  server-derived). Unlike grid columns we DO keep rich inputs (textarea,
 *  richtext, file, image, json…) since the row form has room for them. */
const NON_INPUT_TYPES = new Set(['formula', 'summary', 'rollup', 'autonumber', 'auto_number']);

/**
 * Field names for a child's full "row form" (the per-row expand editor) — every
 * editable business field, skipping system/audit fields, the back-reference FK,
 * and computed types. Broader than {@link deriveColumns} (which only returns
 * grid-friendly types): the form has room for textarea/richtext/file/etc.
 */
export function deriveFormFields(
  childSchema: ObjectSchemaLike | undefined,
  opts: { relationshipField?: string; exclude?: string[] } = {},
): string[] {
  const fields = childSchema?.fields;
  if (!fields || typeof fields !== 'object') return [];
  const exclude = new Set([...(opts.exclude ?? []), ...(opts.relationshipField ? [opts.relationshipField] : [])]);
  const out: string[] = [];
  for (const [name, def] of Object.entries(fields)) {
    const d = def as any;
    if (SYSTEM_FIELDS.has(name) || exclude.has(name) || SORT_FIELD_NAMES.has(name)) continue;
    if (d?.system || d?.hidden) continue;
    if (NON_INPUT_TYPES.has(d?.type)) continue;
    out.push(name);
  }
  return out;
}

/** Inline-edit form factor. */
export type InlineMode = 'grid' | 'form';

/** Rich / form-only field types that read poorly in a narrow grid cell — their
 *  presence on a child tips the smart default toward the per-row `form`. */
const FORM_ONLY_TYPES = new Set([
  'textarea', 'richtext', 'html', 'markdown', 'rich-text',
  'file', 'image', 'avatar', 'attachment', 'json', 'location', 'address',
]);

/** Above this many editable business fields, the grid gets cramped → `form`. */
export const SMART_FORM_FIELD_THRESHOLD = 8;

/**
 * Resolve the inline-edit form factor for a child collection.
 *   - explicit `'grid'` / `'form'` win;
 *   - otherwise (`true` / undefined) pick by the child's shape: a `form` when it
 *     has rich/form-only fields or more than {@link SMART_FORM_FIELD_THRESHOLD}
 *     editable business fields, else a `grid`.
 */
export function resolveInlineMode(
  childSchema: ObjectSchemaLike | undefined,
  inlineEdit: boolean | InlineMode | undefined,
  opts: { relationshipField?: string } = {},
): InlineMode {
  if (inlineEdit === 'grid' || inlineEdit === 'form') return inlineEdit;
  const fields = (childSchema?.fields ?? {}) as Record<string, any>;
  const names = deriveFormFields(childSchema, { relationshipField: opts.relationshipField });
  const hasRich = names.some((n) => FORM_ONLY_TYPES.has(fields[n]?.type));
  if (hasRich) return 'form';
  if (names.length > SMART_FORM_FIELD_THRESHOLD) return 'form';
  return 'grid';
}

/** Field names that read as a per-line money total (summed into the footer). */
const AMOUNT_LIKE_FIELDS = ['amount', 'total', 'subtotal', 'line_total', 'line_amount', 'net_amount'];

/**
 * Choose which numeric column feeds the running total. The line total is, in
 * order of preference: a computed numeric column (e.g. amount = qty × price),
 * an `amount`/`total`-named numeric column, the last currency column, then the
 * last numeric column. Preferring the LAST currency over the first stops a
 * grid from accidentally summing `quantity` or `unit_price`.
 */
function pickAmountField(columns: GridColumn[]): string | undefined {
  const numeric = columns.filter((c) => c.type === 'number' || c.type === 'currency');
  if (numeric.length === 0) return undefined;
  const computed = numeric.find((c) => c.computed);
  if (computed) return computed.field;
  const named = numeric.find((c) => AMOUNT_LIKE_FIELDS.includes(c.field));
  if (named) return named.field;
  const lastCurrency = [...numeric].reverse().find((c) => c.type === 'currency');
  if (lastCurrency) return lastCurrency.field;
  return numeric[numeric.length - 1].field;
}

export interface DerivedDetail {
  childObject: string;
  relationshipField: string;
  columns: GridColumn[];
  /** Field names for the per-row expand form (broader than `columns`). */
  formFields: string[];
  /** Inline-edit form factor (grid = editable cells; form = list + per-row form). */
  mode: InlineMode;
  /** First numeric column, used as the running-total source when none is set. */
  amountField?: string;
  /** Child field holding the line sort position, if any — the grid stamps it on
   *  drag-reorder so order persists (excluded from the editable columns). */
  sortField?: string;
}

/**
 * Resolve a child collection's full config (FK + columns) from its object
 * schema. Throws when no relationship to the parent can be found. The caller
 * supplies any explicit overrides (relationshipField / columns / amountField),
 * which win over the derived values.
 */
export function deriveDetail(
  childObject: string,
  childSchema: ObjectSchemaLike | undefined,
  parentObjectName: string,
  override: { relationshipField?: string; columns?: GridColumn[]; amountField?: string; inlineEdit?: boolean | InlineMode } = {},
): DerivedDetail {
  const relationshipField = override.relationshipField || findRelationshipField(childSchema, parentObjectName);
  if (!relationshipField) {
    throw new Error(
      `MasterDetailForm: could not find a lookup/master_detail field on "${childObject}" referencing "${parentObjectName}". ` +
      `Set relationshipField explicitly.`,
    );
  }
  const columns = override.columns?.length
    ? hydrateColumns(override.columns, childSchema)
    : deriveColumns(childSchema, { relationshipField });
  const amountField = override.amountField || pickAmountField(columns);
  const formFields = deriveFormFields(childSchema, { relationshipField });
  // Resolve mode from the explicit override, else the relationship field's
  // `inlineEdit` value, else the smart default from the child's shape.
  const inlineEdit = override.inlineEdit ?? (childSchema?.fields as any)?.[relationshipField]?.inlineEdit;
  const mode = resolveInlineMode(childSchema, inlineEdit, { relationshipField });
  const sortField = Object.keys(childSchema?.fields ?? {}).find((n) => SORT_FIELD_NAMES.has(n));
  return { childObject, relationshipField, columns, formFields, mode, amountField, sortField };
}
