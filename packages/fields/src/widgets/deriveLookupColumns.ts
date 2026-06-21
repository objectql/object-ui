import type { LookupColumnDef } from '@object-ui/types';

/**
 * System / audit fields that carry no disambiguating value in a record picker.
 * Excluded from auto-derived columns so the picker shows business data, not
 * bookkeeping.
 */
const SYSTEM_FIELDS = new Set<string>([
  'id', '_id',
  'created', 'modified', 'created_at', 'updated_at',
  'created_by', 'updated_by', 'modified_by',
  'owner_id', 'organization_id', 'space', 'company_id',
  'instance_state', 'locked', 'is_deleted', 'deleted',
]);

/**
 * Field types that don't render usefully as a compact picker column (large
 * blobs, media, geometry, free-form text). Kept out of auto-derived columns.
 */
const NON_TABULAR_TYPES = new Set<string>([
  'json', 'object', 'grid', 'html', 'richtext', 'markdown', 'code',
  'image', 'file', 'avatar', 'vector', 'location', 'geometry',
  'textarea', 'secret', 'password', 'encrypted',
]);

export interface DeriveColumnsOptions {
  /** Primary display field — always the leading column. */
  displayField: string;
  /** Maximum number of columns to derive (including the display field). */
  max?: number;
}

interface ObjectSchemaLike {
  fields?: Record<string, { type?: string; label?: string; hidden?: boolean }>;
  /** Object-level "fields to display in search result cards" (spec metadata). */
  displayFields?: unknown;
}

function dedupe(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * Derive sensible Record Picker columns from a referenced object's schema when
 * a lookup field declares no explicit `lookup_columns`.
 *
 * Priority:
 *   1. The referenced object's own `displayFields` ("fields to display in
 *      search result cards") — the author's declared search-card shape.
 *   2. Otherwise the display field plus the next few business fields in
 *      declaration order, skipping system/audit fields and heavy non-tabular
 *      types.
 *
 * The result gives every lookup a multi-column, disambiguating picker with zero
 * field-level configuration. Column `type` is carried through so the picker can
 * render currency / select / date cells via the shared cell renderer.
 *
 * Returns an empty array when no usable schema is available, in which case the
 * caller should fall back to the single display-field column.
 */
export function deriveLookupColumns(
  objectSchema: ObjectSchemaLike | null | undefined,
  { displayField, max = 4 }: DeriveColumnsOptions,
): LookupColumnDef[] {
  const fields = objectSchema?.fields ?? {};
  const fieldDef = (name: string) => fields[name] ?? {};
  const toCol = (name: string): LookupColumnDef => {
    const f = fieldDef(name);
    return { field: name, ...(f.label ? { label: f.label } : {}), ...(f.type ? { type: f.type } : {}) };
  };

  if (Object.keys(fields).length === 0) return [];

  // 1. Honour the object's explicit search-card fields when present.
  const declared = objectSchema?.displayFields;
  if (Array.isArray(declared) && declared.length > 0) {
    const names = (declared as unknown[]).filter(
      (n): n is string => typeof n === 'string' && n.length > 0,
    );
    const ordered = dedupe([displayField, ...names.filter((n) => n !== displayField)]);
    return ordered.slice(0, max).map(toCol);
  }

  // 2. Derive from the field set in declaration order.
  const candidates = Object.keys(fields).filter((name) => {
    if (name === displayField) return false;
    if (SYSTEM_FIELDS.has(name)) return false;
    const f = fieldDef(name);
    if (f.hidden) return false;
    if (f.type && NON_TABULAR_TYPES.has(f.type)) return false;
    return true;
  });

  const ordered = dedupe([displayField, ...candidates]);
  return ordered.slice(0, max).map(toCol);
}
