/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Local mirror of `@objectstack/spec` `deriveRecordSurface` (framework #2578).
 *
 * A record's default surface — full `page` vs a `drawer`/`modal` overlay — is
 * DERIVED from how heavy the record is (visible, non-system field count), not
 * authored: per ADR-0085 §2 a `recordSurface` object key would fail the
 * admission test (field count is machine-inferable). Field-heavy objects open
 * create/edit/detail as a full page; light ones as a drawer. Mobile always
 * pages (overlays are cramped on phones). An explicit `schema.layout` or
 * per-view navigation config still wins — this is only the default.
 *
 * Kept local because objectui pins `@objectstack/spec@^11.7.0`, which predates
 * the export. Consolidate to
 * `import { deriveRecordSurface } from '@objectstack/spec/data'` when objectui
 * adopts spec >= 11.10 (framework #2578). The field set + threshold below mirror
 * the spec helper exactly so the two agree.
 */

/** Audit/system fields excluded from the "how heavy is this record" count. */
const RECORD_SURFACE_SYSTEM_FIELDS: ReadonlySet<string> = new Set([
  'created_at', 'created_by', 'updated_at', 'updated_by',
  'organization_id', 'tenant_id', 'is_deleted', 'deleted_at',
]);

/** At/above this many authorable fields, a record opens as a full page. */
export const RECORD_SURFACE_PAGE_THRESHOLD = 12;

export type RecordSurface = 'page' | 'drawer';

export interface RecordSurfaceOptions {
  viewport?: 'mobile' | 'desktop';
  pageThreshold?: number;
}

/** Count visible, non-system fields on an object schema. */
function countAuthorableFields(objectSchema: unknown): number {
  const fields = (objectSchema as { fields?: unknown } | null)?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return 0;
  let n = 0;
  for (const [name, f] of Object.entries(fields as Record<string, { hidden?: boolean } | undefined>)) {
    if (f?.hidden === true) continue;
    if (RECORD_SURFACE_SYSTEM_FIELDS.has(name)) continue;
    n++;
  }
  return n;
}

/**
 * Derive the default record surface for an object schema. Field-heavy → `page`,
 * otherwise `drawer`; mobile always `page`.
 */
export function deriveRecordSurface(objectSchema: unknown, opts: RecordSurfaceOptions = {}): RecordSurface {
  if (opts.viewport === 'mobile') return 'page';
  const threshold = opts.pageThreshold ?? RECORD_SURFACE_PAGE_THRESHOLD;
  return countAuthorableFields(objectSchema) >= threshold ? 'page' : 'drawer';
}
