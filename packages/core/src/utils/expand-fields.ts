/**
 * ObjectUI — expand-fields utility
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { columnIdentity } from './column-identity.js';

/**
 * Relational ("reference-bearing") field types whose stored value is a foreign
 * key into another object — and which therefore benefit from `$expand` so a
 * list / grid / detail cell can render the related record's display name
 * instead of a bare id placeholder ("—").
 *
 * `user` is a lookup specialised to `sys_user`: it carries the same `reference`
 * + id storage and the server resolves it through the same expand path as
 * `lookup` / `master_detail`, so a `user` column that is NOT requested for
 * expansion comes back as a raw user id and renders as "—" (objectui#2032).
 *
 * Note on `tree`: a self-referencing hierarchy field is a reference too, so it
 * belongs in this set; whether the backend materialises the expanded object
 * for it is a server concern — requesting it is harmless and forward-compatible.
 *
 * ## One family, three consumers
 *
 * This is the reference-bearing FAMILY, not the `$expand` builder's private
 * list, and three concerns already read it under three different words:
 *
 *  - `$expand` construction — `buildExpandFields` below ("expandable");
 *  - predicate-record projection — `predicate-record.ts` ("relational");
 *  - the object form's data-source wiring — `needsDataSourceWiring` in
 *    `packages/components/src/renderers/form/form.tsx`, which decides which
 *    registered widget gets `dataSource` / `dependentValues` /
 *    `dependsOnLabels` threaded to it.
 *
 * The third one used to be a second hand-maintained copy, and this comment used
 * to claim the set "mirrors the form layer's `DATA_SOURCE_FIELD_TYPES`
 * (`lookup` / `master_detail` / `tree`)". That was true for 15 days. The form's
 * copy then gained `capability-multiselect` (objectui#2403) and, the same day,
 * `object-ref` / `filter-condition` / `recipient-picker` (objectui#2421), after
 * which the two sets were not in a subset relation in EITHER direction — `user`
 * only here, three picker names only there — and no gate could say so
 * (objectui#4790). The form now DERIVES from this set instead of restating it:
 *
 *     form's data-source rule  ==  EXPANDABLE_FIELD_TYPES
 *                                  + three widget-hint-only picker names
 *
 * The extension is one-directional and cannot fold back into this set:
 * `object-ref` / `filter-condition` / `recipient-picker` are widget HINTS, never
 * declarable field types (`widgetHintOnly: true` in
 * `app-shell/src/utils/paramValueShape.ts`), so no object schema can produce a
 * field whose `type` is one of them.
 *
 * Stated so it reads as a decision rather than a surprise: **adding a member
 * here also grants that type the form's data-source wiring.** That is the
 * intended coupling — a type whose stored value is a foreign key needs a
 * `DataSource` to resolve that key on the read path (expand) and on the edit
 * path (the picker) alike.
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
      // `columnIdentity` handles all three entry shapes (bare string, spec
      // `{field}`, legacy `{name}`/`{fieldName}`) and resolves canonical-first
      // — the same precedence every renderer now uses, so what gets expanded
      // and what gets rendered can no longer name two different fields (#3104).
      const name = columnIdentity(col);
      if (name) columnFieldNames.add(name);
    }
    return referenceFieldNames.filter((f) => columnFieldNames.has(f));
  }

  return referenceFieldNames;
}
