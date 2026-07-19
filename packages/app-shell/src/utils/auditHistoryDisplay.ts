/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * auditHistoryDisplay — pure helpers that turn raw `sys_audit_log`
 * `old_value` / `new_value` payloads into display-ready history diffs for
 * the record page History tab.
 *
 * The audit writer stores raw field values (ISO datetimes, lookup ids,
 * select values), and its `before` snapshot is read back through the query
 * path while `after` is the raw write result — so server-computed fields
 * (formula / summary / autonumber) appear only on one side and would show a
 * phantom "value → —" change on every write. These helpers:
 *
 *  1. drop computed / hidden / system-noise fields from the diff,
 *  2. drop no-op changes where both sides are empty (null vs '' vs []),
 *  3. format values by field type (dates localized, booleans as Yes/No,
 *     select values mapped to option labels, lookup ids mapped to record
 *     names via a caller-resolved id → label map).
 */

/** Minimal structural view of an object field definition. */
export interface AuditFieldDef {
  type?: string;
  label?: string;
  hidden?: boolean;
  options?: unknown[];
  reference_to?: string | string[];
  reference?: string | string[];
  [k: string]: unknown;
}

export interface RawAuditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditValueFormatContext {
  /** i18n translate fn (i18next-style). Optional — falls back to English. */
  t?: (key: string, options?: Record<string, unknown>) => string;
  /** BCP-47 locale for date formatting. Defaults to the browser locale. */
  locale?: string;
  /** target object name → (record id → display label), for lookup fields. */
  lookupLabels?: Map<string, Map<string, string>>;
}

/** Audit noise: always change, never user-meaningful (mirrors the writer). */
const NOISE_FIELDS = new Set(['id', '_id', 'created_at', 'created_by', 'updated_at', 'updated_by']);

/** Tenant plumbing auto-injected on every record — no business meaning. */
const SYSTEM_FIELDS = new Set(['organization_id', 'tenant_id', 'is_deleted', 'deleted_at', 'space']);

/**
 * Server-computed field types. Their audit snapshots are captured
 * asymmetrically (see module docs), so any diff on them is unreliable —
 * and as derived values their changes are implied by the source fields.
 */
const COMPUTED_FIELD_TYPES = new Set(['formula', 'summary', 'rollup', 'autonumber', 'auto_number']);

const isEmptyValue = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const safeStringify = (v: unknown): string => {
  try {
    return JSON.stringify(v) ?? 'undefined';
  } catch {
    return String(v);
  }
};

/** Parse an old_value/new_value cell (JSON string or already-parsed object). */
export function parseAuditValue(v: unknown): Record<string, unknown> | null {
  if (!v) return null;
  if (typeof v === 'object') return v as Record<string, unknown>;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Union-diff two audit payloads into the changes worth showing. Fields whose
 * definition marks them computed or hidden are dropped, as are system/noise
 * columns and changes where both sides are empty.
 */
export function collectAuditChanges(
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown> | null,
  fields?: Record<string, AuditFieldDef> | null,
): RawAuditChange[] {
  const keys = new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]);
  const out: RawAuditChange[] = [];
  for (const key of keys) {
    if (NOISE_FIELDS.has(key) || SYSTEM_FIELDS.has(key)) continue;
    const def = fields?.[key];
    if (def) {
      if (def.hidden === true) continue;
      if (typeof def.type === 'string' && COMPUTED_FIELD_TYPES.has(def.type)) continue;
    }
    const from = oldObj?.[key];
    const to = newObj?.[key];
    if (isEmptyValue(from) && isEmptyValue(to)) continue;
    if (safeStringify(from) === safeStringify(to)) continue;
    out.push({ field: key, from, to });
  }
  return out;
}

/** Lookup reference target when it is a single concrete object (skip polymorphic). */
function lookupTarget(def: AuditFieldDef | undefined): string | null {
  const target = def?.reference_to ?? def?.reference;
  return typeof target === 'string' && target.length > 0 ? target : null;
}

const asIdList = (v: unknown): Array<string> => {
  if (v === null || v === undefined || v === '') return [];
  const list = Array.isArray(v) ? v : [v];
  return list
    .map((item) =>
      typeof item === 'string' || typeof item === 'number'
        ? String(item)
        : typeof item === 'object' && item !== null && 'id' in (item as any)
          ? String((item as any).id)
          : null,
    )
    .filter((id): id is string => !!id);
};

/**
 * Collect referenced-record ids per lookup target object across a set of
 * changes, so the caller can batch-resolve display labels in one query per
 * target object.
 */
export function collectLookupIds(
  changes: RawAuditChange[],
  fields?: Record<string, AuditFieldDef> | null,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const change of changes) {
    const target = lookupTarget(fields?.[change.field]);
    if (!target) continue;
    const ids = [...asIdList(change.from), ...asIdList(change.to)];
    if (ids.length === 0) continue;
    let set = out.get(target);
    if (!set) out.set(target, (set = new Set()));
    for (const id of ids) set.add(id);
  }
  return out;
}

function formatScalar(def: AuditFieldDef | undefined, value: unknown, ctx: AuditValueFormatContext): string {
  const type = def?.type;

  if (type === 'boolean' || typeof value === 'boolean') {
    const truthy = value === true || value === 'true' || value === 1;
    const key = truthy ? 'common.yes' : 'common.no';
    const fallback = truthy ? 'Yes' : 'No';
    return ctx.t ? ctx.t(key, { defaultValue: fallback }) : fallback;
  }

  if (type === 'date' || type === 'datetime') {
    const d = new Date(value as string | number);
    if (!Number.isNaN(d.getTime())) {
      try {
        return type === 'date'
          ? d.toLocaleDateString(ctx.locale)
          : d.toLocaleString(ctx.locale, { dateStyle: 'medium', timeStyle: 'short' });
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  if (Array.isArray(def?.options)) {
    for (const o of def!.options!) {
      const ov = o && typeof o === 'object' ? ((o as any).value ?? (o as any).name) : o;
      if (ov === value || String(ov) === String(value)) {
        const ol = o && typeof o === 'object' ? ((o as any).label ?? (o as any).name ?? ov) : o;
        return String(ol);
      }
    }
  }

  const target = lookupTarget(def);
  if (target) {
    const label = ctx.lookupLabels?.get(target)?.get(String(value));
    if (label) return label;
  }

  if (typeof value === 'object' && value !== null) return safeStringify(value);
  return String(value);
}

/**
 * Format one side of a change for display. Empty → '' (the timeline renders
 * its own em-dash); arrays → per-item formatting joined with ", ".
 */
export function formatAuditValue(
  def: AuditFieldDef | undefined,
  value: unknown,
  ctx: AuditValueFormatContext = {},
): string {
  if (isEmptyValue(value)) return '';
  if (Array.isArray(value)) return value.map((v) => formatScalar(def, v, ctx)).join(', ');
  return formatScalar(def, value, ctx);
}
