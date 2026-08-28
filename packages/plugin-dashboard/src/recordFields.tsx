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
// The reference-bearing field family, read as the object `@object-ui/core`
// publishes rather than restated here (objectui#5692). Imported from its home
// package, the way the other converged consumers do, so the identity pin has a
// single object to spy on.
import { EXPANDABLE_FIELD_TYPES } from '@object-ui/core';

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

/**
 * The override vocabulary this package's two field surfaces share.
 *
 * ⚠️ This type is a DERIVATION SOURCE, not only a shape: `ObjectDataTable`'s
 * two column bands are both `Exclude<keyof FieldMeta, …>` — `EnrichedColumn`'s
 * write-side tombstones (objectui#6373) and `AuthoredColumnOverrides`' read-side
 * refusal band (objectui#6425). So a member REMOVED here silently leaves both
 * bands, and any refusal that rode on its membership stops enforcing with
 * nothing going red. A member being retired must therefore be re-refused
 * explicitly at that seam before it leaves this type — see
 * `ObjectDataTableRetiredDecimalsTombstone` in `ObjectDataTable.tsx`, which is
 * what `decimals` left behind.
 *
 * ⛔ `decimals` was RETIRED from this type by objectui#6625 — written from the
 * schema def on every call and read by nothing (zero `.decimals` member reads
 * across `@object-ui/fields`, `@object-ui/i18n`, `@object-ui/components`,
 * `@object-ui/core` and this package, measured against a `.scale` positive
 * control that hits `NumberField.tsx` / `GridField.tsx` / `index.tsx`). If a
 * reader is ever wanted here it reads `scale` — the field def's decimal-places
 * key, which is what the retired write resolved to anyway and what
 * `NumberCellRenderer` already reads (`precision` is the total digit count, a
 * different question — objectui#2131). ⛔ Do not resurrect `decimals`.
 */
export interface FieldMeta {
  name: string;
  label: string;
  type?: string;
  options?: Array<{ value: any; label: string; color?: string }>;
  referenceTo?: unknown;
  format?: string;
  currency?: string;
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
  /**
   * Per-column overrides (table columns may pin type/format/options).
   *
   * A subset of {@link FieldMeta}, which is what makes that type the pool
   * `ObjectDataTable`'s refusal band derives from. `decimals` left with the
   * member (objectui#6625): its last feeder went when objectui#6425's ruling
   * removed the authored read from `ObjectDataTable.enrich()`, and
   * `RecordDetailDrawer` — the only other caller — passes no overrides at all.
   */
  overrides?: {
    type?: string;
    format?: string;
    options?: any;
    referenceTo?: unknown;
    currency?: string;
  };
}

/**
 * Build the `FieldMeta` for a single field, resolving `referenceTo` and
 * currency from the schema field def and translating select options.
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
    // ⛔ No `decimals` — RETIRED by objectui#6625. It resolved
    // `meta?.decimals ?? meta?.scale` on every call and reached no reader; the
    // `overrides.decimals ??` head of that chain had already lost its only
    // feeder to objectui#6425's ruling. A future reader reads `scale`.
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
 * Measured before the ruling: `isLookupType('owner')` was `true` — a retired
 * spelling holding first-class relation status. It answers `false` now, and
 * says why once.
 *
 * The membership half is no longer a private table (objectui#5692). It used to
 * be `new Set(['lookup', 'reference', 'master_detail', 'user'])`, one of TWO
 * copies this package held — the other inline in `computeLookupExpand` — and
 * neither derived from nor pinned against {@link EXPANDABLE_FIELD_TYPES}, the
 * family `@object-ui/core` publishes for exactly this question. objectui#5312's
 * claim to have converted "the LAST private copy" was false by these two: they
 * predate that sweep and were outside its file surface.
 *
 * The convergence moved membership in two directions, each decided by
 * measurement rather than by preference (objectui#5692):
 *
 *  - `tree` is GAINED. A self-referencing hierarchy field is reference-bearing,
 *    it is a member of the spec's closed `FieldType`, and the form / grid road
 *    already `$expand`s it. The dashboard road giving it the same treatment is
 *    family behaviour restored, not a new decision.
 *  - `reference` is DROPPED, and dropping it is a no-op on spec-compliant data.
 *    The spelling is absent from `@objectstack/spec`'s closed `FieldType`
 *    vocabulary and is refused by `FieldSchema.safeParse` — measured with
 *    `lookup` / `master_detail` / `user` / `tree` as live controls and the
 *    retired `owner` plus a nonsense spelling as dead ones — so no
 *    spec-compliant object schema can declare a field whose stored type is
 *    `reference`. Where the spelling IS live it is a legacy DIALECT alias on the
 *    action-param surface, folded to `lookup` before any field-type data is read
 *    (`PARAM_TYPE_ALIASES` in `app-shell/src/utils/paramToField.ts`). Keeping it
 *    here would be a lenient renderer-side alias for off-spec metadata, which is
 *    what AGENTS.md #0.1 bans.
 *
 * Extending this surface later: OR in a second, surface-local set, the way the
 * object form's `needsDataSourceWiring` does. Never
 * `new Set([...EXPANDABLE_FIELD_TYPES, …])` — a copy re-forks the table, which
 * is the defect this change removed, and the identity pin fails on it by design.
 */
export function isLookupType(t: unknown): boolean {
  if (typeof t === 'string' && isRetiredFieldType(t)) {
    reportRetiredFieldType(t);
    return false;
  }
  return EXPANDABLE_FIELD_TYPES.has(t as string);
}
