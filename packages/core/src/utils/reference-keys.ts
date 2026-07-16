/**
 * ObjectUI — reference-key canonicalization
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Backend object schemas follow the ObjectStack convention and name a
 * relational field's target object `reference`
 * (e.g. `{ type: 'lookup', reference: 'showcase_account' }`), while ObjectUI's
 * types — and most in-repo consumers — historically read `reference_to`
 * (some legacy configs also carry camelCase `referenceTo`). A consumer that
 * reads only one key silently loses the relation under the other convention:
 * the exact bug HeaderHighlight had (#2407 / PR #2587), where a served
 * `reference`-keyed lookup rendered a raw id.
 *
 * `normalizeFieldReferenceKeys` stamps BOTH snake_case keys onto the field
 * definition whenever any of the three spellings is present, so downstream
 * reads work regardless of which single key they check. It mutates the field
 * in place — the ObjectStack adapter caches the schema object and re-serves
 * it, so the one pass must stick — and is idempotent. Keys that are already
 * set are never overwritten.
 */
export function normalizeFieldReferenceKeys<T>(fieldDef: T): T {
  if (!fieldDef || typeof fieldDef !== 'object') return fieldDef;
  const f = fieldDef as Record<string, unknown>;
  const target = f.reference_to ?? f.reference ?? f.referenceTo;
  if (target == null || target === '') return fieldDef;
  if (f.reference_to === undefined) f.reference_to = target;
  if (f.reference === undefined) f.reference = target;
  return fieldDef;
}

/**
 * Apply {@link normalizeFieldReferenceKeys} to every field of an object
 * schema. Accepts both field-container shapes the metadata API serves —
 * a `name → def` map or an array of defs — and tolerates anything else by
 * returning the input untouched. Mutates in place; idempotent.
 *
 * This is meant to run at the choke point where object schemas enter the
 * client (`ObjectStackAdapter.getObjectSchema`, the app-shell metadata
 * provider) so per-consumer dual-key fallbacks can't drift.
 */
export function normalizeSchemaReferenceKeys<T>(schema: T): T {
  const fields =
    schema && typeof schema === 'object' ? (schema as { fields?: unknown }).fields : null;
  if (!fields || typeof fields !== 'object') return schema;
  const defs = Array.isArray(fields) ? fields : Object.values(fields);
  for (const def of defs) normalizeFieldReferenceKeys(def);
  return schema;
}
