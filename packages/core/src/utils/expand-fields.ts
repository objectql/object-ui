/**
 * ObjectUI — expand-fields utility
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Relational ("reference-bearing") field types whose stored value is a foreign
 * key into another object — and which therefore benefit from `$expand` so a
 * list / grid / detail cell can render the related record's display name
 * instead of a bare id placeholder ("—").
 *
 * This mirrors the form layer's `DATA_SOURCE_FIELD_TYPES`
 * (`lookup` / `master_detail` / `tree`) and additionally covers `user` — a
 * lookup specialised to `sys_user`. The server resolves `user` through the
 * same expand path as `lookup` / `master_detail` (it carries the same
 * `reference` + id storage), so a `user` column that is NOT requested for
 * expansion comes back as a raw user id and renders as "—". Keeping the set
 * here as the single source of truth is what closes that gap.
 *
 * Note on `tree`: a self-referencing hierarchy field is a reference too, so it
 * belongs in this set; whether the backend materialises the expanded object
 * for it is a server concern — requesting it is harmless and forward-compatible.
 */
export const EXPANDABLE_FIELD_TYPES: ReadonlySet<string> = new Set([
  'lookup',
  'master_detail',
  'tree',
  'user',
]);

/**
 * Whether a field definition is a reference-bearing type that can be `$expand`-ed.
 * Only the field's `type` matters here — the `reference` / `reference_to` target
 * is irrelevant to the decision, so this works regardless of which canonical key
 * the schema uses to name the related object.
 */
export function isExpandableFieldType(fieldDef: unknown): boolean {
  return (
    !!fieldDef &&
    typeof fieldDef === 'object' &&
    EXPANDABLE_FIELD_TYPES.has((fieldDef as { type?: unknown }).type as string)
  );
}

/**
 * Build an array of field names that should be included in `$expand`
 * when fetching data. This scans the given object schema fields
 * (and optional column configuration) for reference-bearing field types
 * (see {@link EXPANDABLE_FIELD_TYPES}: `lookup` / `master_detail` / `tree` /
 * `user`), so the backend (e.g. objectql) returns expanded objects instead of
 * raw foreign-key IDs.
 *
 * @param schemaFields - Object map of field metadata from `getObjectSchema()`,
 *   e.g. `{ account: { type: 'lookup', reference: 'accounts' }, ... }`.
 * @param columns - Optional explicit column list. When provided, only
 *   reference fields that appear in `columns` are expanded — list/grid/kanban
 *   views pass their VISIBLE columns here so wide objects don't pay to expand
 *   relations no cell will show. Accepts `string[]` or `ListColumn[]` (objects
 *   with a `field` property).
 * @returns Array of field names to pass as `$expand` (empty → omit `$expand`).
 *
 * @example
 * ```ts
 * const fields = {
 *   name: { type: 'text' },
 *   account: { type: 'lookup', reference: 'accounts' },
 *   parent: { type: 'master_detail', reference: 'contacts' },
 *   assignee: { type: 'user', reference: 'sys_user' },
 * };
 * buildExpandFields(fields);
 * // → ['account', 'parent', 'assignee']
 *
 * buildExpandFields(fields, ['name', 'account']);
 * // → ['account']   (only the visible reference columns)
 * ```
 */
export function buildExpandFields(
  schemaFields?: Record<string, any> | null,
  columns?: (string | { field?: string; name?: string; fieldName?: string })[],
): string[] {
  if (!schemaFields || typeof schemaFields !== 'object') {
    return [];
  }

  // Collect every reference-bearing field name from the schema.
  const referenceFieldNames: string[] = [];
  for (const [fieldName, fieldDef] of Object.entries(schemaFields)) {
    if (isExpandableFieldType(fieldDef)) {
      referenceFieldNames.push(fieldName);
    }
  }

  if (referenceFieldNames.length === 0) {
    return [];
  }

  // When columns are provided, restrict expansion to visible columns only.
  if (columns && Array.isArray(columns) && columns.length > 0) {
    const columnFieldNames = new Set<string>();
    for (const col of columns) {
      if (typeof col === 'string') {
        columnFieldNames.add(col);
      } else if (col && typeof col === 'object') {
        const name = col.field ?? col.name ?? col.fieldName;
        if (name) columnFieldNames.add(name);
      }
    }
    return referenceFieldNames.filter((f) => columnFieldNames.has(f));
  }

  return referenceFieldNames;
}
