/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Minimal object-schema field shape needed to decide single- vs multi-value
 * semantics. Matches the `fields` map served by the ObjectStack meta API
 * without importing the full schema type.
 */
export interface MultiValueFieldDef {
  type?: string;
  multiple?: boolean;
}

/** Types whose persisted value is ALWAYS an array of scalars. */
const ALWAYS_MULTI_TYPES = new Set(['multiselect', 'checkboxes', 'tags']);

/**
 * Types that become array-shaped when flagged `multiple: true`. Mirrors the
 * server-side write pipeline (framework #2552): per the spec, `multiple`
 * applies to select/lookup/file/image; `radio` shares the select semantics
 * and `user` is stored identically to `lookup` (the runtime expands
 * `Field.user` to `type: 'user'`, not `'lookup'`).
 */
const MULTI_CAPABLE_TYPES = new Set(['select', 'radio', 'lookup', 'user', 'file', 'image']);

/** Whether the given object-schema field stores an array of scalars. */
export function isMultiValueField(def: MultiValueFieldDef | undefined | null): boolean {
  const t = def?.type;
  if (!t) return false;
  if (ALWAYS_MULTI_TYPES.has(t)) return true;
  return MULTI_CAPABLE_TYPES.has(t) && def?.multiple === true;
}

/**
 * Return a copy of `patch` where any lone scalar aimed at a multi-value
 * field (per the object schema) is wrapped into a single-element array.
 * A scalar written verbatim silently corrupts the column shape for every
 * array-consumer (#2204); the server normalizes too (framework #2552), but
 * the client should never emit the wrong shape in the first place.
 *
 * Only unambiguous scalars (string/number/boolean) are wrapped — arrays
 * pass through untouched and anything else is left for server validation.
 */
export function normalizeMultiValuePatch(
  patch: Record<string, unknown>,
  fields: Record<string, MultiValueFieldDef> | undefined | null,
): Record<string, unknown> {
  if (!fields) return patch;
  let out: Record<string, unknown> | null = null;
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || Array.isArray(value)) continue;
    if (!isMultiValueField(fields[key])) continue;
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      if (!out) out = { ...patch };
      out[key] = [value];
    }
  }
  return out ?? patch;
}
