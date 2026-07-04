/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Server-managed fields that must NEVER be included in create/update payloads.
 * They are owned by the backend and round-tripping them can cause the request
 * to be rejected (e.g. PATCH 404 / 400).
 */
const SERVER_MANAGED_FIELDS = new Set([
  'id',
  '_id',
  'created_at',
  'updated_at',
  'createdAt',
  'updatedAt',
  'organization_id',
  'organizationId',
]);

/**
 * Field types that are read-only / computed and must not be persisted.
 */
const COMPUTED_FIELD_TYPES = new Set([
  'formula',
  'summary',
  'rollup',
  'lookup_value',
  'auto_number',
  'autonumber',
  'computed',
]);

/**
 * Strip server-managed and computed fields from a form payload before sending
 * it to `dataSource.create()` / `dataSource.update()`.
 *
 * - Drops well-known server-owned keys (id, created_at, organization_id, …).
 * - When `objectSchema` is provided, drops fields that are flagged as
 *   `computed` / `formula` / `readOnly` or whose type is in
 *   {@link COMPUTED_FIELD_TYPES}.
 * - When `objectSchema` is provided, also drops keys that don't appear in
 *   `objectSchema.fields` at all (these are typically server-projected
 *   relationships or flattened lookups like `full_name`).
 */
export function sanitizeFormData(
  data: Record<string, any>,
  objectSchema?: { fields?: Record<string, any> } | null,
): Record<string, any> {
  if (!data || typeof data !== 'object') return data;

  const out: Record<string, any> = {};
  const fields = objectSchema?.fields;

  for (const [key, value] of Object.entries(data)) {
    if (SERVER_MANAGED_FIELDS.has(key)) continue;

    if (fields) {
      const fieldDef = fields[key];
      // Drop unknown keys (flattened/derived projections like full_name).
      if (!fieldDef) continue;
      const t = String(fieldDef.type || '').toLowerCase();
      if (COMPUTED_FIELD_TYPES.has(t)) continue;
      if (fieldDef.computed === true) continue;
      if (fieldDef.formula) continue;
      if (fieldDef.readOnly === true || fieldDef.readonly === true) continue;
    }

    out[key] = value;
  }

  return out;
}
