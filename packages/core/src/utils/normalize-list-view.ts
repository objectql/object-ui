/**
 * ObjectUI — list-view vocabulary canonicalization
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectUI's `list-view` node historically used a different vocabulary from
 * `@objectstack/spec` for the same concepts (`fields` where the spec says
 * `columns`, `viewType` where it says `type`, …). Issue #2231 closed the
 * type-level fork; #2890 closes the vocabulary fork.
 *
 * Stored view metadata in user databases still carries the legacy keys, so the
 * renderer cannot simply stop accepting them. Per AGENTS.md Commandment #0.1 the
 * answer is NOT a per-read-site `??` fallback — those fossilize a second de-facto
 * contract and drift apart (they already had: `ObjectGrid` preferred `columns`
 * in one branch and `fields` in another). Instead legacy acceptance lives HERE,
 * in one documented normalizer at the component boundary, mirroring
 * `normalizeSchemaReferenceKeys` (object schemas) and the spec's own
 * `normalizeVisibleWhen` / `normalizeFilterOperator` migration bridges.
 *
 * Note this cannot be a `z.preprocess` on `ListViewSchema`: nothing on the
 * render path parses view metadata through zod (the zod schemas are used by the
 * CLI validator, the VS Code extension and tests only), so a schema-level fold
 * would never run. The guarantee comes from the call site instead — `ListView`
 * normalizes before it reads anything.
 *
 * The fold is deliberately one-directional: the canonical key wins when both are
 * present, and the legacy key is REMOVED from the result so a read-site that was
 * missed fails loudly instead of quietly taking the legacy path. Like a spec
 * migration bridge, this is expected to be dropped in a future major once stored
 * metadata has been migrated.
 *
 * Non-mutating and allocation-frugal: returns the input by reference when there
 * is nothing to fold, so `ListView`'s downstream `useMemo`s keep a stable
 * dependency identity on the common (already-canonical) path.
 *
 * Currently folded:
 *  - `fields` → `columns` (#2890 scope A step 1)
 *  - `viewType`: a missing kind, or the view CATEGORY `'list'` that AI-authored
 *    metadata stores and hosts forward verbatim, becomes the renderable `'grid'`
 *    — otherwise it reaches the renderer's typeless default branch and shows as
 *    a red "Unknown component type" box.
 */
export function normalizeListViewSchema<T>(schema: T): T {
  if (!schema || typeof schema !== 'object') return schema;
  const s = schema as Record<string, unknown>;

  const legacyFields = s.fields;
  const foldColumns = Array.isArray(legacyFields);
  const viewType = s.viewType;
  const defaultViewKind = !viewType || viewType === 'list';
  if (!foldColumns && !defaultViewKind) return schema;

  const next: Record<string, unknown> = { ...s };
  if (foldColumns) {
    if (!Array.isArray(next.columns)) next.columns = legacyFields;
    delete next.fields;
  }
  if (defaultViewKind) next.viewType = 'grid';
  return next as T;
}
