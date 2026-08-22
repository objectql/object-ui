/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Shared field-rendering helpers for the dashboard data widgets.
 *
 * Both the table widget cells (`ObjectDataTable`) and the drill-to-record
 * detail drawer (`RecordDetailDrawer`) must format a field value identically —
 * a currency in the table must read as a currency in the record drawer. These
 * helpers centralize that logic so the two surfaces never drift:
 *
 * - {@link indexObjectFields} normalizes an object schema's `fields` (array or
 *   map form) into a `name → def` lookup.
 * - {@link buildFieldMeta} derives the `FieldMeta` consumed by the shared
 *   `@object-ui/fields` cell renderers from an object-schema field definition
 *   (with optional per-column overrides + translated select options).
 * - {@link renderFieldValue} turns a raw value + `FieldMeta` into a React node
 *   using the same currency / percent / date / cell-renderer rules as the grid.
 */

import React from 'react';
import {
  getCellRenderer,
  resolveCellRendererType,
  formatCurrency,
  formatPercent,
  formatDate,
  // THE GATE the maintainer ruled onto this package's surface (objectui#4914,
  // ruling B). Read from `@object-ui/fields` here — the spelling the ruling
  // names — which re-exports the single implementation homed in
  // `@object-ui/core`.
  isRetiredFieldType,
  reportRetiredFieldType,
} from '@object-ui/fields';

/**
 * Field types treated as relations (rendered as links to the related record).
 *
 * `owner` left this set with objectui#4914; {@link isLookupType} refuses every
 * retired spelling ahead of the membership test, so the deletion is lockstep
 * hygiene rather than the behavioural half.
 */
const LOOKUP_TYPES = new Set(['lookup', 'reference', 'master_detail', 'user']);

/**
 * Framework / system audit fields hidden from auto-derived columns and the
 * record-detail drawer. Authors wanting them can pass an explicit whitelist.
 */
export const SYSTEM_FIELDS = new Set([
  'id', 'organization_id', 'tenant_id', 'created_at', 'updated_at',
  'created_by', 'updated_by', 'deleted_at', 'deleted_by', 'version',
  '_id', '__typename',
]);

/** Whether a field name/def is a framework/system field that should be hidden. */
export function isSystemField(name: string, def?: any): boolean {
  if (def && (def.isSystem === true || def.system === true)) return true;
  return SYSTEM_FIELDS.has(name);
}

/** Field types whose `options` carry per-value labels worth translating. */
const OPTION_TYPES = new Set(['select', 'picklist', 'dropdown', 'status']);

/** Numeric-flavoured field types (right-aligned in tables). */
export const NUMERIC_FIELD_TYPES = new Set([
  'currency', 'money', 'number', 'integer', 'decimal', 'float', 'percent', 'percentage',
]);

export interface FieldMeta {
  name: string;
  label: string;
  type?: string;
  options?: Array<{ value: any; label: string; color?: string }>;
  referenceTo?: unknown;
  format?: string;
  currency?: string;
  decimals?: number;
}

/**
 * Normalize an object schema's `fields` into a `{ name → def }` map. Accepts
 * both the array form (`[{ name, type, ... }]`) and the keyed map form
 * (`{ name: { type, ... } }`). Returns an empty object when no schema.
 */
export function indexObjectFields(objectSchema: any): Record<string, any> {
  const out: Record<string, any> = {};
  const fields = objectSchema?.fields;
  if (!fields) return out;
  if (Array.isArray(fields)) {
    for (const def of fields) if (def?.name) out[def.name] = def;
  } else {
    for (const [name, def] of Object.entries(fields)) out[name] = { name, ...(def as any) };
  }
  return out;
}

export interface BuildFieldMetaParams {
  accessorKey: string;
  label: string;
  /** Field definition from the object schema (if known). */
  def?: any;
  /** Object name, used to translate select-option labels. */
  objectName?: string;
  /** Translator for per-option labels (from `useSafeFieldLabel`). */
  fieldOptionLabel?: (objectName: string, field: string, value: string, fallback: string) => string;
  /** Per-column overrides (table columns may pin type/format/options). */
  overrides?: {
    type?: string;
    format?: string;
    options?: any;
    referenceTo?: unknown;
    currency?: string;
    decimals?: number;
  };
}

/**
 * Build the `FieldMeta` for a single field, resolving `referenceTo`, currency
 * and decimals from the schema field def and translating select options.
 * Column-level overrides win over schema-derived values.
 */
export function buildFieldMeta(params: BuildFieldMetaParams): FieldMeta {
  const { accessorKey, label, def: meta, objectName, fieldOptionLabel, overrides = {} } = params;

  const referenceTo =
    overrides.referenceTo ??
    meta?.referenceTo ??
    (typeof meta?.reference === 'string' ? meta.reference : meta?.reference?.to) ??
    meta?.target;

  let options: Array<{ value: any; label: string; color?: string }> | undefined =
    overrides.options ?? meta?.options;

  if (objectName && options && fieldOptionLabel && OPTION_TYPES.has(meta?.type)) {
    options = options.map((opt: any) => {
      if (opt == null) return opt;
      const value = typeof opt === 'object' ? opt.value : opt;
      const fallback = typeof opt === 'object' ? (opt.label || String(value)) : String(value);
      return {
        value,
        label: fieldOptionLabel(objectName, accessorKey, String(value), fallback),
        color: typeof opt === 'object' ? opt.color : undefined,
      };
    });
  }

  return {
    name: accessorKey,
    label,
    type: overrides.type ?? meta?.type,
    options,
    referenceTo,
    format: overrides.format ?? meta?.format,
    currency: overrides.currency ?? meta?.currency ?? meta?.defaultCurrency,
    // `scale` (decimal places), not `precision` (total digit count) — see #2131.
    decimals: overrides.decimals ?? meta?.decimals ?? meta?.scale,
  };
}

/** Whether a `FieldMeta` should be right-aligned (numeric / currency / percent). */
export function isNumericFieldMeta(fieldMeta: Pick<FieldMeta, 'type' | 'format'>): boolean {
  return (
    NUMERIC_FIELD_TYPES.has(fieldMeta.type as string) ||
    (typeof fieldMeta.format === 'string' && /^[$¥€£]|%$|0/.test(fieldMeta.format))
  );
}

/**
 * Render a raw field value to a React node using the same currency / percent /
 * date / cell-renderer rules as the dashboard table. Returns `''` for nullish /
 * empty values.
 *
 * `tenantCurrency` (localization.currency, ADR-0053) backstops a currency
 * field/format that declares no explicit code of its own, so both the table
 * cell and the record-detail drawer honor the tenant default.
 */
export function renderFieldValue(
  value: any,
  fieldMeta: FieldMeta,
  tenantCurrency?: string,
  // BCP-47 display locale from `useDisplayLocale()` (objectui#4553). Optional
  // and last, so an existing caller that passes nothing keeps the behavior it
  // had. This is a plain function rather than a component, so the locale has to
  // arrive as an argument — there is no hook to read it from here.
  displayLocale?: string,
): React.ReactNode {
  if (value == null || value === '') return '';
  const fmt = fieldMeta.format;
  if (typeof fmt === 'string' && /^\$|¥|€|£/.test(fmt) && typeof value === 'number') {
    // Honor explicit `currency`; else infer from the leading symbol so we never
    // silently fall back to USD when the author wrote `¥`/`€`; finally fall back
    // to the tenant default currency.
    const symbolMap: Record<string, string> = { '$': 'USD', '¥': 'JPY', '€': 'EUR', '£': 'GBP' };
    const inferred = symbolMap[fmt[0]];
    return formatCurrency(value, fieldMeta.currency || inferred || tenantCurrency);
  }
  if (typeof fmt === 'string' && /%/.test(fmt) && typeof value === 'number') {
    const decimals = (fmt.match(/0\.(0+)%/) || [undefined, ''] as any)[1].length;
    // The RAW stored value goes to `formatPercent`, which applies
    // `percentDisplayValue` — the single source of truth for percent display
    // scaling (`@object-ui/core`), whose doc comment says so in those words.
    // This is the same call the list-view percent cell makes for an ordinary
    // percent column (`PercentCellRenderer` in `@object-ui/fields`), so a
    // percent now reads identically as a record field, as a grid cell and as a
    // dashboard measure.
    //
    // ⚠️ This call site used to make the fraction/points decision AGAIN, with a
    // local copy that had drifted from the one it duplicated (objectui#5607):
    //
    //   const normalized = value > 1 ? value / 100 : value;
    //   return formatPercent(normalized * 100, decimals, displayLocale);
    //
    // Three measured divergences, all of them the one defect — a caller
    // re-deciding what core owns:
    //  - `(value / 100) * 100` is NOT value-preserving in binary floating
    //    point. It re-introduced, one call frame upstream, exactly the round
    //    trip objectui#4590 removed from inside `formatPercent`: 19,978 of
    //    199,000 values on the 0.001-step grid to 200 change bit pattern and
    //    1,108 rendered strings move, every one a last-digit off-by-one —
    //    a stored `1.605` rendered `1.60%` where half-up is `1.61%`.
    //  - A stored fraction below 0.01 was scaled TWICE: the local `* 100` put
    //    it below 1, so core's fraction arm scaled it again — `0.005` (0.5%)
    //    rendered `50.00%`, a factor of 100.
    //  - The local test was `value > 1`, not core's symmetric `|value| < 1`,
    //    so a negative already in points was treated as a fraction: `-5`
    //    rendered `-500.00%`.
    // Deleting the branch fixes all three, because they were never three bugs.
    return formatPercent(value, decimals, displayLocale);
  }
  if (typeof fmt === 'string' && /[YMDHms]/.test(fmt)) {
    return formatDate(value, fmt);
  }
  const Renderer = getCellRenderer(resolveCellRendererType(fieldMeta as any));
  return <Renderer value={value} field={fieldMeta as any} />;
}

/**
 * Whether a field is a relation/lookup (used to drive `$expand`).
 *
 * THE GATE (objectui#4914, ruling B) runs ahead of the membership test.
 * Measured before the ruling: `isLookupType('owner')` was `true`, at exactly
 * the same level as `isLookupType('reference')` — a retired spelling holding
 * first-class relation status. It answers `false` now, and says why once.
 */
export function isLookupType(t: unknown): boolean {
  if (typeof t === 'string' && isRetiredFieldType(t)) {
    reportRetiredFieldType(t);
    return false;
  }
  return LOOKUP_TYPES.has(t as string);
}
