/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import type { FieldMetadata, SelectOptionMetadata } from '@object-ui/types';
import { ComponentRegistry, percentDisplayValue, getRecordDisplayName } from '@object-ui/core';
import { useLocalization, useDisplayLocale, formatDisplayNumber } from '@object-ui/i18n';
import { Badge, Avatar, AvatarImage, AvatarFallback, Button, Checkbox, EmptyValue, cn } from '@object-ui/components';
import { Check, X, Copy, Phone as PhoneIcon, MapPin } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/react';
import { SchemaRendererContext as _SchemaRendererContext } from '@object-ui/react';
import { useRelatedRecordActions } from '@object-ui/react';
import { withFieldCarrier } from './withFieldCarrier';
// Pure formatting rule shared with `AddressField`'s readonly branch — no React,
// so this does not pull the widget out of its lazy chunk (objectui#4037).
import { formatAddress, type AddressValue } from './widgets/address-format';

// Module-level cache so multiple renderers fetching the same lookup ID
// only trigger one network call. Keyed by `${objectName}:${id}`.
type LookupCacheEntry =
  | { state: 'pending'; promise: Promise<void> }
  | { state: 'ok'; name: string | undefined }
  | { state: 'err' };
const lookupNameCache: Map<string, LookupCacheEntry> = new Map();

/**
 * Pick the most reasonable display name from an arbitrary record object.
 * Tries common name-like keys in priority order, then falls back to undefined.
 */
export function pickRecordDisplayName(
  record: Record<string, unknown> | null | undefined,
  preferredField?: string,
): string | undefined {
  if (!record || typeof record !== 'object') return undefined;
  // Caller-provided hint (typically the target object's displayNameField)
  // beats every heuristic so domain-specific names like `legal_name` win.
  if (preferredField) {
    const pv = record[preferredField];
    if (typeof pv === 'string' && pv.trim()) return pv.trim();
    if (typeof pv === 'number') return String(pv);
  }
  const candidates = ['name', 'full_name', 'display_name', 'label', 'title', 'subject', 'username'];
  for (const k of candidates) {
    const v = record[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  // Salesforce-style: build a composite name from common person-record
  // fields when no top-level display field is present. Preferred over the
  // raw `email` fallback below so `Bob Lin` beats `bob.lin@acme.com`.
  const first = record['first_name'];
  const last = record['last_name'];
  const salutation = record['salutation'];
  const composite = [salutation, first, last]
    .filter((p) => typeof p === 'string' && (p as string).trim())
    .map((p) => (p as string).trim())
    .join(' ');
  if (composite) return composite;
  // Email is the last-resort identifier (better than the opaque id).
  const email = record['email'];
  if (typeof email === 'string' && email.trim()) return email.trim();
  // Heuristic fallback: pick the first string-valued field whose name looks
  // like a human-facing identifier (legal_name, framework_name, control_number,
  // policy_code, etc.). This covers domain schemas that don't use the
  // hardcoded canonical names above. We skip obvious metadata keys.
  const SKIP = new Set([
    'id', '_id', 'organization_id', 'created_by', 'updated_by',
    'created_at', 'updated_at', 'tenant_id',
  ]);
  const SUFFIXES = ['_name', '_title', '_number', '_code', '_label'];
  for (const [k, v] of Object.entries(record)) {
    if (SKIP.has(k)) continue;
    if (k.endsWith('_id')) continue;
    if (!SUFFIXES.some((s) => k.endsWith(s))) continue;
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

// Module-level cache of referenced-object schemas (keyed by object name) so
// many lookup cells pointing at the same object trigger ONE metadata fetch.
type RefSchemaCacheEntry =
  | { state: 'pending'; promise: Promise<void> }
  | { state: 'ok'; schema: unknown }
  | { state: 'err' };
const refObjectSchemaCache: Map<string, RefSchemaCacheEntry> = new Map();

/**
 * Fetch (and cache) the referenced object's schema via
 * `dataSource.getObjectSchema`. Resolves to `undefined` when the data source
 * doesn't expose schema metadata or the fetch fails — callers fall back to the
 * key heuristic in that case.
 */
async function fetchRefObjectSchema(dataSource: any, referenceTo: string): Promise<any> {
  const settled = () => {
    const entry = refObjectSchemaCache.get(referenceTo);
    return entry?.state === 'ok' ? entry.schema : undefined;
  };
  const existing = refObjectSchemaCache.get(referenceTo);
  if (existing?.state === 'pending') {
    await existing.promise;
    return settled();
  }
  if (existing) return settled();
  const getSchema = dataSource?.getObjectSchema;
  if (typeof getSchema !== 'function') return undefined;
  const promise = Promise.resolve()
    .then(() => getSchema.call(dataSource, referenceTo))
    .then((schema: unknown) => { refObjectSchemaCache.set(referenceTo, { state: 'ok', schema }); })
    .catch(() => { refObjectSchemaCache.set(referenceTo, { state: 'err' }); });
  refObjectSchemaCache.set(referenceTo, { state: 'pending', promise });
  await promise;
  return settled();
}

/**
 * React hook wrapper over {@link fetchRefObjectSchema}: returns the referenced
 * object's schema once loaded (re-rendering when it lands), `undefined` while
 * pending or when schema metadata isn't available.
 */
function useRefObjectSchema(referenceTo: string | undefined): any {
  const ctx = React.useContext(_SchemaRendererContext);
  const dataSource = ctx?.dataSource as any;
  const [, force] = React.useState(0);
  const canFetch =
    !!referenceTo && !!dataSource && typeof dataSource.getObjectSchema === 'function';

  React.useEffect(() => {
    if (!canFetch) return;
    const entry = refObjectSchemaCache.get(referenceTo!);
    if (entry && entry.state !== 'pending') return; // settled before this render
    let alive = true;
    fetchRefObjectSchema(dataSource, referenceTo!).then(() => {
      if (alive) force((n) => n + 1);
    });
    return () => { alive = false; };
  }, [canFetch, referenceTo, dataSource]);

  if (!canFetch) return undefined;
  const entry = refObjectSchemaCache.get(referenceTo!);
  return entry?.state === 'ok' ? entry.schema : undefined;
}

/**
 * Resolve an expanded/fetched lookup record to its display name the same way
 * the picker does (issue #2357): explicit `displayField` first, then the
 * unified ADR-0079 resolver against the referenced object's schema
 * (`nameField`/`displayNameField` → `titleFormat` → type-aware derivation,
 * which excludes autonumber). Only when no schema is available does it fall
 * back to {@link pickRecordDisplayName}, whose `_number`/`_code` suffix scan
 * can otherwise surface an autonumber (`0001`) over the record's real name.
 */
function resolveLookupRecordName(
  record: Record<string, unknown> | null | undefined,
  refSchema?: any,
  displayField?: string,
): string | undefined {
  if (!record || typeof record !== 'object') return undefined;
  if (refSchema) {
    const resolved = getRecordDisplayName(refSchema, record, { titleField: displayField });
    // Stop short of the resolver's `Record #<id>` / `Untitled` floor so the
    // cell keeps its own id-placeholder handling for nameless records.
    const id = (record as any).id ?? (record as any)._id;
    const isFloor =
      resolved === 'Untitled' || (id != null && resolved === `Record #${id}`);
    if (!isFloor && resolved) return resolved;
  }
  return pickRecordDisplayName(record, displayField);
}

/**
 * Heuristic: detect strings that look like opaque foreign-key IDs (e.g. nanoid
 * or BSON ObjectId). Used so we don't display random gibberish to users when
 * a lookup wasn't expanded.
 */
export function isLikelyOpaqueId(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  // 12-32 chars, only [A-Za-z0-9_-], no whitespace.
  if (!/^[A-Za-z0-9_-]{12,32}$/.test(v)) return false;
  // Must have BOTH upper- and lower-case letters (real words rarely do at this length).
  // Also accept tokens that contain `_` or `-` separators alongside any case mix.
  const hasUpper = /[A-Z]/.test(v);
  const hasLower = /[a-z]/.test(v);
  const hasDigitOrSep = /[0-9_-]/.test(v);
  return (hasUpper && hasLower) || (hasUpper && hasDigitOrSep) || (hasLower && hasDigitOrSep);
}

/**
 * Fetch-on-demand resolver for foreign-key IDs that weren't expanded by the
 * server. Reads `dataSource` from SchemaRendererContext; safely no-ops if
 * the context isn't installed. Returns the resolved display name or
 * `undefined` while pending or unresolvable.
 */
function useLookupName(
  referenceTo: string | undefined,
  value: unknown,
  displayField?: string,
): string | undefined {
  const ctx = React.useContext(_SchemaRendererContext);
  const dataSource = ctx?.dataSource;
  const [, force] = React.useState(0);

  const isResolvable =
    !!referenceTo &&
    !!dataSource &&
    typeof dataSource.find === 'function' &&
    (typeof value === 'string' || typeof value === 'number') &&
    value !== '';
  // The preferred display field is part of the cache identity: two columns
  // targeting the same record with different `display_field`s must not
  // serve each other's cached name (#2926 ⑧).
  const cacheKey = isResolvable
    ? `${referenceTo}:${String(value)}:${displayField ?? ''}`
    : '';

  React.useEffect(() => {
    if (!isResolvable) return;
    const existing = lookupNameCache.get(cacheKey);
    if (existing && existing.state !== 'pending' && (existing as any).promise == null) return;
    if (existing?.state === 'pending') return;

    const promise: Promise<void> = (async () => {
      try {
        let record: Record<string, unknown> | undefined;
        if (typeof (dataSource as any).findOne === 'function') {
          record = await (dataSource as any).findOne(referenceTo, value);
        } else {
          // Top-level `$top`, not `{ options: { $top: 1 } }` (objectui#4025):
          // `options` is not a `QueryParams` key and no adapter reads it. Here
          // the nesting was harmless — the filter is primary-key equality, so
          // the answer is at most one row with or without a cap — but it is the
          // same spelling that cost `object-kanban` its row cap, and leaving one
          // live instance in the repo is what makes the next one look precedented.
          const result = await (dataSource as any).find(referenceTo, {
            $filter: { id: value },
            $top: 1,
          });
          const records: any[] = Array.isArray(result)
            ? result
            : (result?.value || result?.data || []);
          record = records[0];
        }
        // Resolve through the referenced object's schema (nameField /
        // titleFormat) so the chip agrees with the picker — the bare key
        // heuristic alone can surface an autonumber over the real name.
        const schema = await fetchRefObjectSchema(dataSource, referenceTo!);
        const name = resolveLookupRecordName(record, schema, displayField);
        lookupNameCache.set(cacheKey, { state: 'ok', name });
      } catch {
        lookupNameCache.set(cacheKey, { state: 'err' });
      }
      force((n) => n + 1);
    })();

    lookupNameCache.set(cacheKey, { state: 'pending', promise });
  }, [cacheKey, isResolvable, referenceTo, value, displayField, dataSource]);

  if (!isResolvable) return undefined;
  const entry = lookupNameCache.get(cacheKey);
  return entry?.state === 'ok' ? entry.name : undefined;
}

/**
 * Safe label resolver for cell-level UI strings. Falls back to the English
 * default when no I18nProvider is available or when the key is missing.
 */
function useFieldLabel() {
  // useObjectTranslation is provider-safe (its context read is optional and
  // react-i18next falls back to the global instance), so no try/catch —
  // wrapping a hook call in try/catch violates rules-of-hooks: a throw after
  // some hooks ran would desync hook order on the next render.
  const { t } = useObjectTranslation();
  return (key: string, fallback: string) => {
    const v = t(key);
    return !v || v === key ? fallback : v;
  };
}

/**
 * Raw translate fn (with interpolation params) for cell-level strings, or
 * undefined when no I18nProvider is mounted — callers keep their English
 * fallback in that case.
 */
function useFieldTranslate(): ((key: string, params?: Record<string, unknown>) => string) | undefined {
  // useObjectTranslation is provider-safe (optional context read; react-i18next
  // falls back to the global instance), so it never throws — no try/catch, which
  // would wrap a hook call and violate rules-of-hooks. Mirrors useFieldLabel.
  const { t } = useObjectTranslation();
  return t as (key: string, params?: Record<string, unknown>) => string;
}

// Only the two symbols this module actually CALLS are imported eagerly. Every
// field widget used to be imported here as well, statically, purely to hand a
// component reference to the docs-demo `createFieldRenderer()` wrapper —
// removed with it (objectui#3910). The live registration path resolves widgets
// through the lazy loaders in `fieldWidgetMap` below, so nothing here needs a
// static reference; the widgets stay publicly available via the `export * from
// './widgets/…'` block at the end of this file.
import { ImageLightbox } from './widgets/ImageLightbox';
import { readFileValues } from './widgets/file-value';

/**
 * Cell renderer props
 */
export interface CellRendererProps {
  value: any;
  field: FieldMetadata;
  isEditing?: boolean;
  onChange?: (value: any) => void;
}

/**
 * Coerce a value to a safe primitive for rendering.
 * Handles MongoDB wrapper types ($numberDecimal, $oid, $date), expanded
 * reference objects, and arrays so that no raw object is ever passed as
 * a React child — preventing React error #310.
 */
export function coerceToSafeValue(value: unknown): string | number | boolean | null | undefined {
  if (value == null) return value as null | undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    // A reference/expanded value can arrive as a JSON-encoded object string —
    // e.g. an unresolved external-id reference '{"externalId":"Website Relaunch"}'.
    // Parse and extract a human label instead of leaking raw JSON into the cell.
    const s = value.trim();
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try { return coerceToSafeValue(JSON.parse(s)); } catch { /* not JSON — fall through */ }
    }
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (v != null && typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        return String(obj.name || obj.label || obj.externalId || obj.id || obj._id || '[Object]');
      }
      return String(v);
    }).join(', ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // MongoDB numeric wrapper: { $numberDecimal: "250000" }
    if ('$numberDecimal' in obj) return Number(obj.$numberDecimal);
    // MongoDB ObjectId wrapper: { $oid: "abc123" }
    if ('$oid' in obj) return String(obj.$oid);
    // MongoDB date wrapper: { $date: "2024-01-01T00:00:00Z" }
    if ('$date' in obj) return String(obj.$date);
    // Expanded reference / general object: extract name/label/externalId/id
    return String(obj.name || obj.label || obj.externalId || obj.id || obj._id || '[Object]');
  }
  return String(value);
}

/**
 * Format currency value. When `currency` is undefined, falls back to a
 * plain number with thousands separators (no symbol). Silently assuming
 * USD for unconfigured currency fields was the #1 source of "why is my
 * RMB amount showing as dollars?" bug reports.
 *
 * Trailing minor units are dropped when the value is a whole number —
 * Salesforce convention: `$1,234.50` keeps cents; `$1,234` does not. Wholeness
 * picks ONE fraction-digit width, never a range: a whole amount shows 0 digits,
 * and a fractional amount shows the width the CURRENCY has — so a real cents
 * value of `.50` renders `.50`, not `.5`, and a yen amount renders `¥1,235`
 * rather than cents the yen does not have.
 */
import { resolveFieldCurrency, currencyFractionDigits } from './currency';
export { resolveFieldCurrency };

export function formatCurrency(value: number, currency?: string, locale?: string): string {
  const isWhole = Number.isFinite(value) && value === Math.trunc(value);
  // ONE width for both bounds, not a range (objectui#4332). The symbol branch
  // used to pass `minimumFractionDigits: 0` against a wholeness-switched
  // maximum, which handed Intl the range [0, 2] — and Intl then emits the
  // SHORTEST representation in range, so a genuine cents value of `.50` was
  // printed as `.5`: `$1,234.5` instead of the `$1,234.50` promised above.
  // It was the only branch that did: the no-currency branch reaches
  // `formatNumber`, which sets both bounds to the width it is given, and the
  // bad-currency fallback below has always used `toFixed`. Both already
  // rendered `1,234.50` for the same amount.
  //
  // The non-whole width is the CURRENCY's own ISO 4217 minor-unit count, not a
  // literal 2 (objectui#4361). Passing 2 for every currency on earth OVERRODE
  // what `Intl` already knows: JPY has no minor unit and KWD has three, so a
  // yen amount was printed with cents it does not have (`¥1,234.50`) and a
  // dinar amount one digit short (`KWD 1.50`).
  //
  // The wholeness switch itself is NOT retired — dropping both bounds and
  // letting `Intl` decide would fix the digit count by turning `$1,234` back
  // into `$1,234.00`, which is exactly the convention this function documents
  // and objectui#4033 pinned. It is extended instead: whole amounts drop the
  // fraction for EVERY currency (`KWD 1`, not `KWD 1.000`), fractional amounts
  // take that currency's own count.
  //
  // With no currency in hand there is nothing to derive from, so that branch
  // keeps the historical 2.
  const fracDigits = isWhole ? 0 : currency ? currencyFractionDigits(currency) : 2;
  if (!currency) {
    return formatNumber(value, fracDigits, locale);
  }
  try {
    return formatDisplayNumber(value, {
      locale,
      currency,
      minimumFractionDigits: fracDigits,
      maximumFractionDigits: fracDigits,
    });
  } catch {
    return `${currency} ${value.toFixed(fracDigits)}`;
  }
}

/**
 * Format currency value in compact form for mobile display.
 * E.g., $150,000 → $150K, $1,200,000 → $1.2M
 * When `currency` is undefined, returns a compact number without symbol.
 */
export function formatCompactCurrency(value: number, currency?: string, locale?: string): string {
  if (!currency) {
    try {
      const formatted = formatDisplayNumber(value, {
        locale,
        notation: 'compact',
        maximumFractionDigits: 1,
      });
      return formatted.replace(/\.0(?=[KMBT])/, '');
    } catch {
      return String(value);
    }
  }
  try {
    const formatted = formatDisplayNumber(value, {
      locale,
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    // Strip trailing ".0" before compact suffix for consistent cross-environment output
    // e.g. "$150.0K" → "$150K" while keeping "$1.5M" intact
    return formatted.replace(/\.0(?=[KMBT])/, '');
  } catch {
    return `${currency} ${value}`;
  }
}

/**
 * Format a plain number with thousands separators, no currency symbol.
 * Used as a safe fallback when a currency-typed field has no `currency`
 * configured — we'd rather render `1,234.50` than silently assume USD.
 */
export function formatNumber(value: number, decimals: number = 2, locale?: string): string {
  try {
    // Deliberately passes NO `scale`: `decimals` here is a display width the
    // caller chose, not a field's declared scale, so the ordinal no-grouping
    // policy must not fire. `formatCurrency`'s no-currency fallback lands here
    // with `decimals: 0` for a whole amount — that is still money and must keep
    // its separators.
    return formatDisplayNumber(value, {
      locale,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } catch {
    return value.toFixed(decimals);
  }
}

/**
 * The percent rendering itself, on a value ALREADY in display magnitude (`80`
 * means 80%).
 *
 * Split out from {@link formatPercent} because `PercentCellRenderer`'s
 * whole-percent branch needs this exact rendering under a DIFFERENT scaling
 * policy (see there). Two copies of the expression is precisely the drift
 * `percentDisplayValue`'s doc comment exists to prevent, so there is one copy
 * and the scaling decision is made by the caller.
 */
function formatPercentBody(displayValue: number, precision: number, locale?: string): string {
  try {
    // `style: 'percentPoints'` renders a value that is ALREADY in percentage
    // points, so there is no `/ 100` here. Going through `Intl` rather than
    // appending a literal '%' is what buys the locale's percent CONVENTION and
    // not merely its separators: German writes `1.235 %` with a no-break space
    // before the sign, English `1,235%` with none, Turkish puts the sign in
    // FRONT. Both bounds are set to `precision` so the width is exactly the one
    // the caller asked for — the same contract `toFixed` gave.
    //
    // ⚠️ NOT `style: 'percent'` (objectui#4590). That style wants a FRACTION, so
    // this used to divide by 100 for `Intl` to multiply straight back — and the
    // round trip is not value-preserving. `Intl` formats from the SHORTEST
    // decimal representation of the double it is handed, and the quotient's is
    // not the authored one: `1.005` is `1.005`, but `1.005 / 100` is
    // `0.010049999999999999`, which percent-scales to `1.0049999999999999` and
    // rounds DOWN — so a stored 1.005 rendered `1.00%` where half-up is `1.01%`.
    // The DIVISION lost the digit, not the rounding, which is why it reproduced
    // in every locale and why 27,577 of 1,200,003 ordinary en-US forms moved
    // (0.005-step grid to 2,000, precisions 0/1/2), every one a last-digit
    // off-by-one. The same artefact reached the top of the double range:
    // `MAX_SAFE_INTEGER` points rendered `…740,990%` for `…740,991%`.
    //
    // The affix is unchanged by the switch: `'percentPoints'` is `Intl`'s
    // `style: 'unit'` / `unit: 'percent'` / `unitDisplay: 'narrow'`, measured
    // byte-identical to `style: 'percent'` across all 171 locale tags in #4576
    // and re-measured on THIS call shape in #4590 — 720 combinations (10 locales
    // x 18 values x 4 precisions), 0 convention diffs, 130 numeral diffs.
    // `formatMeasure` renders through the same option, so a percentage point
    // reads identically in a list cell and in a dashboard measure.
    return formatDisplayNumber(displayValue, {
      locale,
      style: 'percentPoints',
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  } catch {
    return `${displayValue.toFixed(precision)}%`;
  }
}

/**
 * Format percent value.
 * Handles both decimal (0.8 = 80%) and whole number (80 = 80%) inputs.
 *
 * `locale` is the third positional parameter, matching {@link formatNumber} and
 * {@link formatCurrency} — the shape the sibling formatters already use.
 * Callers should pass the tag from `useDisplayLocale()`.
 *
 * Before objectui#4553 this function took no locale and never touched `Intl`:
 * its whole body was `${percentDisplayValue(value).toFixed(precision)}%`, so it
 * rendered in NO locale rather than the machine's — an ASCII decimal mark and
 * never a grouping separator, byte-identical on every machine. That made
 * `1235%` the output everywhere, which is wrong in en-US as well as in German,
 * so the grouping and the locale are fixed together: en output MOVES from
 * `1235%` to `1,235%` at four digits and up, and that move is the fix.
 */
export function formatPercent(value: number, precision: number = 0, locale?: string): string {
  // Scale a fraction-stored percent (0.8 → 80%) via the shared core helper, so
  // the list cell and the dashboard measure formatter (`formatMeasure`) agree.
  const displayValue = percentDisplayValue(value);
  return formatPercentBody(displayValue, precision, locale);
}

/**
 * Humanize a snake_case or kebab-case string into Title Case.
 * Used as fallback label when no explicit option.label exists.
 * 
 * Examples:
 *   "in_progress" → "In Progress"
 *   "high-priority" → "High Priority"
 *   "active" → "Active"
 */
export function humanizeLabel(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Options shared by {@link formatDate} / {@link formatRelativeDate}. */
export interface DateDisplayOptions {
  dueLike?: boolean;
  /** BCP-47 display locale (ADR-0053 tenant default); falls back to the runtime locale. */
  locale?: string;
  /** i18n translate fn for phrases `Intl` can't produce (the "Overdue Nd" wording). */
  t?: (key: string, params?: Record<string, unknown>) => string;
}

/**
 * Localized day-granularity relative phrase ("Tomorrow", "3 days ago", "明天",
 * "3天前"), sentence-cased for locales whose `Intl` output starts lowercase.
 */
function formatRelativeDays(diffDays: number, locale?: string): string {
  try {
    const phrase = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diffDays, 'day');
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  } catch {
    // Invalid locale tag — degrade to English rather than crash the cell.
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    return diffDays > 0 ? `In ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
  }
}

/**
 * Format date as relative time (e.g., "3 days ago", "Today", "Overdue 3d"),
 * localized via `Intl.RelativeTimeFormat` (objectstack-ai/objectstack#3040).
 *
 * `dueLike` gates the "Overdue" wording — a past `start_date`/`created_at`
 * isn't overdue, only a past due/deadline-semantic field is. Non-due-like
 * past dates render as plain "N days ago" instead. The overdue phrase has no
 * `Intl` equivalent, so it resolves through `options.t` (key
 * `fields.relativeDate.overdue`) with an English fallback.
 */
export function formatRelativeDate(value: string | Date | number, options?: DateDisplayOptions): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as any);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = startOfDate.getTime() - startOfToday.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Beyond the ±7-day window, fall back to the absolute (already localized) form.
  if (diffDays < -7 || diffDays > 7) return formatDate(date, undefined, options);

  if (diffDays < -1 && options?.dueLike) {
    const absDays = Math.abs(diffDays);
    const key = 'fields.relativeDate.overdue';
    const translated = options.t?.(key, { count: absDays });
    return translated && translated !== key ? translated : `Overdue ${absDays}d`;
  }
  return formatRelativeDays(diffDays, options?.locale);
}

/**
 * Format date value
 */
export function formatDate(value: string | Date | number, style?: string, options?: DateDisplayOptions): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as any);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—';

  if (style === 'short') {
    // Compact format for mobile: "Jan 15, '24" / "1月 15, '24".
    // Only the MONTH token is localized: the surrounding compact shape (day,
    // apostrophe + 2-digit year) is a deliberate fixed layout for narrow
    // cards, not a locale-derived one. The tag comes from `options.locale`
    // like the default branch below — hardcoding `'en-US'` here made this the
    // one branch that ignored a locale its caller had threaded (objectui#4272).
    const month = date.toLocaleDateString(options?.locale, { month: 'short' });
    const day = date.getDate();
    const year = String(date.getFullYear()).slice(-2);
    return `${month} ${day}, '${year}`;
  }

  if (style === 'relative') {
    return formatRelativeDate(date, options);
  }
  
  // Default format: locale-aware human-readable. Drop the year when it
  // matches the current year — Salesforce / HubSpot / Linear all do this
  // because the year is rarely useful for in-progress records and the
  // verbose "2026年7月21日" form crowds cards and table cells. Past- /
  // future-year dates keep the year so users can disambiguate.
  const isCurrentYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(options?.locale, {
    year: isCurrentYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format datetime value.
 *
 * `options` mirrors {@link formatDate}'s and is optional, so an existing
 * caller that passes nothing keeps the exact runtime-default behavior it had.
 * Before objectui#4272 the parameter did not exist at all, which meant no
 * caller could localize this function however hard it tried — it always handed
 * `Intl` an `undefined` tag, i.e. the MACHINE's locale, which is neither of
 * the repo's two locale channels. Callers should pass the tag from
 * `useDisplayLocale()`.
 */
export function formatDateTime(value: string | Date | number, options?: DateDisplayOptions): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as any);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(options?.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Single-line cell value with a working ellipsis and a full-text fallback.
 *
 * `truncate` on a bare inline `<span>` never clips — an inline box has no
 * width box for `overflow:hidden` / `text-overflow:ellipsis` to act on, so
 * the value renders at full content width and the tail is silently cut by
 * whatever ancestor happens to clip (the detail card edge), with no ellipsis
 * (objectui#3466; same mechanism as the JSON cell in objectui#2578).
 * Block-level + `max-w-full` gives the span its parent's width to truncate
 * against, and as a flex item its `overflow:hidden` zeroes the automatic
 * min-size so it can shrink below the text width. The `title` keeps the full
 * text reachable on hover — host rows (detail sections) put their inline-edit
 * hint in *their* `title`, so the value's full text must live on the value
 * element itself, where it takes precedence under the cursor.
 */
function TruncatedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}): React.ReactElement {
  return (
    <span className={cn('block max-w-full truncate', className)} title={text}>
      {text}
    </span>
  );
}

/**
 * Text field cell renderer
 */
export function TextCellRenderer({ value }: CellRendererProps): React.ReactElement {
  const safe = coerceToSafeValue(value);
  if (safe == null || safe === '') return <EmptyValue />;
  return <TruncatedText text={String(safe)} />;
}

/**
 * Number field cell renderer
 */
export function NumberCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  // Hook before the empty-value early return — a value flipping between null
  // and set must not change the hook count between renders (same rule as
  // CurrencyCellRenderer below).
  const locale = useDisplayLocale();
  if (value == null) return <EmptyValue />;

  const safe = coerceToSafeValue(value);
  const numField = field as any;
  // Decimal places come from `scale` (the `s` in a `decimal(p, s)` column),
  // NOT `precision` — `precision` is the TOTAL digit count (`p`), and reading
  // it here padded every value out to that width (e.g. `1` from a
  // decimal(10, 0) column rendered as "1.0000000000"). When `scale` is
  // declared we pad to it so a fixed display is honoured (e.g. an amount with
  // scale 2 → "16.00", a field with scale 3 → "3.140"); when it is absent we
  // keep the minimum at 0 so trailing zeros are trimmed and only cap the
  // maximum (20 = Intl max) to preserve the value's natural precision.
  //
  // `scale` is also the grouping POLICY input (objectui#4033): a declared
  // `scale: 0` with no currency is a discrete integer — a year, a fiscal
  // period, an ordinal — and those are rendered ungrouped, so a `Field.number`
  // year finally shows `2026` instead of `2,026`. An ABSENT scale keeps
  // grouping: absent means "decimals unknown", not "integer". The policy and
  // its interim status live in `formatDisplayNumber`, not here.
  const scale = typeof numField.scale === 'number' ? numField.scale : undefined;
  const num = Number(safe);
  const formatted = !isNaN(num)
    ? formatDisplayNumber(num, {
        locale,
        scale,
        minimumFractionDigits: scale ?? 0,
        maximumFractionDigits: scale ?? 20,
      })
    : String(safe);
  
  return <span className="tabular-nums">{formatted}</span>;
}

/**
 * Currency field cell renderer
 */
export function CurrencyCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  // Hooks before the empty-value early return — a value flipping between
  // null and set must not change the hook count between renders.
  const { currency: tenantCurrency } = useLocalization();
  const locale = useDisplayLocale();
  if (value == null) return <EmptyValue />;

  const safe = coerceToSafeValue(value);
  // Resolve the display currency via the shared precedence: field `currency` →
  // `currencyConfig.defaultCurrency` → the tenant default (ADR-0053). When none
  // is known, render a plain number — never a guessed symbol (silently assuming
  // USD mis-displays non-USD orgs, e.g. RMB amounts shown as $).
  const currency = resolveFieldCurrency(field as any, tenantCurrency);
  const num = Number(safe);
  const formatted = !isNaN(num)
    ? formatCurrency(num, currency, locale)
    : String(safe);

  return <span className="tabular-nums font-medium whitespace-nowrap">{formatted}</span>;
}

// Fields that store percentage values as whole numbers (0-100) rather than fractions (0-1)
const WHOLE_PERCENT_FIELD_PATTERN = /progress|completion/;

/**
 * Percent field cell renderer with mini progress bar
 */
export function PercentCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  // Hook before the empty-value early return — a value flipping between null
  // and set must not change the hook count between renders (same rule as
  // NumberCellRenderer / CurrencyCellRenderer above).
  const locale = useDisplayLocale();
  if (value == null) return <EmptyValue />;

  const safe = coerceToSafeValue(value);
  const percentField = field as any;
  const precision = percentField.precision ?? 0;
  const numValue = Number(safe);
  if (isNaN(numValue)) {
    return <span className="tabular-nums whitespace-nowrap">{String(safe)}</span>;
  }
  // Use field name to disambiguate 0-1 fraction vs 0-100 whole number:
  // Fields like "progress" or "completion" store values as 0-100, not 0-1
  const isWholePercentField = WHOLE_PERCENT_FIELD_PATTERN.test(field?.name?.toLowerCase() || '');
  const barValue = isWholePercentField
    ? numValue
    : (numValue > -1 && numValue < 1) ? numValue * 100 : numValue;
  // Both branches render through the same locale-aware body (objectui#4553);
  // they differ ONLY in the scaling policy, which is the whole point of the
  // branch. The whole-percent branch used to be a second bare `toFixed` path,
  // so before this card a `progress` field was ungrouped and unlocalized even
  // where an ordinary percent column would not have been — leaving it behind
  // would have made ONE grid internally inconsistent, which is worse than the
  // uniform defect it had.
  const formatted = isWholePercentField
    ? formatPercentBody(numValue, precision, locale)
    : formatPercent(numValue, precision, locale);
  const clampedBar = Math.max(0, Math.min(100, barValue));
  
  // Layout contract (objectstack#5066): THE NUMBER IS THE CONTENT, THE BAR IS
  // DECORATION. The bar used to be `w-16 shrink-0` while the value span was
  // shrinkable, so in a narrow clipping container — a `record:highlights` chip
  // is `basis-[9rem]`/`min-w-[7rem]` and clips with `truncate` — the 64px bar
  // took the space and the value was silently cut mid-digit: a stored `33.33`
  // rendered `33%` in the DOM but read as `3` on screen, with no ellipsis and
  // nothing in the accessible name to signal the loss.
  //
  // So the priority is inverted: the value span is `shrink-0` (never sacrificed)
  // and the bar keeps `w-16` only as its PREFERRED width, free to shrink away
  // under pressure. It is deliberately NOT `flex-1` — growing is not wanted, or
  // every wide grid cell would stretch its bar; `w-16` stays the upper bound and
  // wide containers look exactly as before.
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className="h-1.5 w-16 min-w-0 shrink rounded-full bg-muted ring-1 ring-inset ring-border/60 overflow-hidden"
        role="progressbar"
        aria-valuenow={clampedBar}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${clampedBar}%` }}
        />
      </div>
      <span className="shrink-0 tabular-nums whitespace-nowrap">{formatted}</span>
    </div>
  );
}

/** Field names that trigger warning badge when boolean value is false */
const STATUS_FIELD_NAMES = new Set([
  'active', 'is_active', 'enabled', 'is_enabled', 'verified', 'is_verified',
]);

/**
 * Boolean field cell renderer (Airtable-style checkbox)
 * Supports semantic rendering for completion fields (green indicator)
 * and warning badge for active/enabled fields when false.
 */
export function BooleanCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  if (value == null) {
    return <span className="flex items-center justify-center"><EmptyValue /></span>;
  }

  // Semantic rendering for completion fields (green circle indicator)
  // Only match exact field names to avoid false positives
  const fieldName = field?.name?.toLowerCase() || '';
  const isCompletionField = fieldName === 'completed' || fieldName === 'is_completed'
    || fieldName === 'done' || fieldName === 'is_done';

  if (isCompletionField) {
    return (
      <div className="flex items-center justify-center">
        {value ? (
          <div className="size-5 rounded-full bg-green-500 flex items-center justify-center" role="img" aria-label="Completed" data-testid="completion-indicator">
            <Check className="size-3 text-white" />
          </div>
        ) : (
          <div className="size-5 rounded-full border-2 border-muted-foreground/30" role="img" aria-label="Not completed" data-testid="completion-indicator" />
        )}
      </div>
    );
  }

  // Warning badge for active/enabled fields when false
  if (STATUS_FIELD_NAMES.has(fieldName) && !value) {
    return (
      <Badge variant="destructive" className="text-xs" data-testid="boolean-warning-badge">
        {field?.label || humanizeLabel(fieldName)} — Off
      </Badge>
    );
  }

  return (
    <div className="flex items-center justify-start">
      <Checkbox checked={!!value} disabled className="pointer-events-none" />
    </div>
  );
}

/**
 * Date field cell renderer
 */
export function DateCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  // `useDisplayLocale()`, NOT `useLocalization().locale` (objectui#4468). The
  // raw tenant locale is `undefined` on any workspace that never configured
  // one, and `Intl` reads the MACHINE's locale from `undefined` — so a `zh`
  // console rendered `逾期 6 天` (which resolves through `t`, the ACTIVE UI
  // language) beside `In 3 days` and `6 days ago` (which resolve through
  // `Intl`) on the SAME row. One channel for both halves, or the row
  // disagrees with itself.
  const locale = useDisplayLocale();
  const t = useFieldTranslate();
  if (!value) return <EmptyValue />;
  const safe = coerceToSafeValue(value);
  const dateField = field as any;
  const style = dateField.format || 'relative';

  // A date is only *semantically* a due/deadline when the field says so — a
  // plain "start_date" or "created_at" in the past is neither overdue text
  // nor red, even though it renders in the same relative-time style.
  const fieldName = String(dateField?.name || dateField?.accessorKey || dateField?.key || '').toLowerCase();
  const dueLike =
    dateField?.dueLike === true ||
    /(^|_)(due|deadline|expires?|expiry|expiration|expected_close|target_close|sla|return_by|renewal|next_action)(_|$)/.test(fieldName);
  const formatted = formatDate(safe as string | Date, style, { dueLike, locale, t });

  const date = safe != null ? new Date(safe as string | number) : null;
  const isValidDate = date !== null && !isNaN(date.getTime());
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isOverdue = dueLike && isValidDate && date! < startOfToday;
  const isoString = isValidDate ? date!.toISOString() : String(safe);

  return (
    <span
      className={`tabular-nums${isOverdue ? ' text-red-600' : ''}`}
      title={isoString}
    >
      {formatted}
    </span>
  );
}

/**
 * DateTime field cell renderer (Airtable-style with date and time visually separated)
 */
export function DateTimeCellRenderer({ value }: CellRendererProps): React.ReactElement {
  // Hook before every early return — a value flipping between null and set
  // must not change the hook count between renders (same rule as the number /
  // currency renderers above). This is the site objectui#4468 caught rendering
  // `8/11/2026 12:00 am` inside an otherwise Chinese grid: both calls passed
  // `undefined`, i.e. the machine's locale, on every session.
  const locale = useDisplayLocale();
  if (!value) return <EmptyValue />;
  const safe = coerceToSafeValue(value);
  const date = safe != null ? new Date(safe as string | number) : null;
  if (date === null || isNaN(date.getTime())) return <EmptyValue />;

  const datePart = date.toLocaleDateString(locale, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
  // `hour12` stays declared: this is the compact Airtable-style cell, and the
  // 12-hour face is its design, not a locale artefact. Locales that write no
  // am/pm marker simply ignore it.
  const timePart = date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();

  return (
    <span className="tabular-nums text-sm whitespace-nowrap">
      <span>{datePart}</span>
      <span className="ml-2 text-muted-foreground">{timePart}</span>
    </span>
  );
}

// Semantic color mapping (auto-detect from value text for priority & status fields)
// Keys use underscore notation; lookup normalizes spaces/hyphens to underscores automatically.
// Chinese keys are stored as-is and matched directly (no normalization side-effects).
const SEMANTIC_COLOR_MAP: Record<string, string> = {
  // Priority values (en)
  critical: 'red',
  urgent: 'red',
  high: 'orange',
  medium: 'yellow',
  normal: 'blue',
  low: 'gray',
  none: 'gray',
  // Status values (en)
  paid: 'green',
  completed: 'green',
  done: 'green',
  active: 'green',
  approved: 'green',
  resolved: 'green',
  pending: 'yellow',
  waiting: 'yellow',
  on_hold: 'yellow',
  shipped: 'blue',
  in_progress: 'blue',
  open: 'blue',
  processing: 'blue',
  draft: 'gray',
  new: 'gray',
  inactive: 'gray',
  closed: 'gray',
  cancelled: 'red',
  canceled: 'red',
  rejected: 'red',
  failed: 'red',
  overdue: 'red',
  delivered: 'purple',
  archived: 'indigo',
  // CRM lifecycle values (en)
  contacted: 'blue',
  qualified: 'purple',
  converted: 'green',
  won: 'green',
  lost: 'red',
  // Priority values (zh)
  紧急: 'red',
  严重: 'red',
  高: 'orange',
  中: 'yellow',
  普通: 'blue',
  低: 'gray',
  无: 'gray',
  // Status values (zh)
  新建: 'gray',
  草稿: 'gray',
  待处理: 'yellow',
  待审核: 'yellow',
  待联系: 'yellow',
  挂起: 'yellow',
  进行中: 'blue',
  处理中: 'blue',
  已联系: 'blue',
  跟进中: 'blue',
  已发货: 'blue',
  打开: 'blue',
  已确认: 'green',
  已审核: 'green',
  已通过: 'green',
  已完成: 'green',
  已支付: 'green',
  已签收: 'green',
  已转化: 'green',
  成单: 'green',
  赢得: 'green',
  已签约: 'green',
  已交付: 'purple',
  已归档: 'indigo',
  已关闭: 'gray',
  已取消: 'red',
  已拒绝: 'red',
  失败: 'red',
  逾期: 'red',
  流失: 'red',
  丢失: 'red',
};

// Color to Tailwind class mapping for custom Badge styling
// Color → Tailwind class mapping for status-style badges.
// Uses the modern "soft pill" pattern (Tailwind UI style): -50 background,
// -700 text, hairline -200 border. Dark mode mirrors with -950/40 surface
// and -300 text. This keeps status fields readable without the heavy,
// candy-colored look of the older -100/-300/-800 combination.
const BADGE_COLOR_MAP: Record<string, string> = {
  gray: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-200 dark:border-gray-700/60',
  red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60',
  orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60',
  yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900/60',
  green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/60',
  blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60',
  purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60',
  pink: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-900/60',
};

// Solid color → Tailwind background class for the small dot used by the
// `appearance: 'dot'` rendering of select/status fields. Uses the -500 shade
// for both light and dark modes so the dot remains a clear visual anchor
// without becoming a heavy color block.
const DOT_COLOR_MAP: Record<string, string> = {
  gray: 'bg-gray-400 dark:bg-gray-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
};

// Color palette used by the deterministic fallback when no schema/semantic
// color matches. Excludes 'gray' to ensure visual contrast between values.
const BADGE_FALLBACK_PALETTE: readonly string[] = [
  'blue', 'green', 'purple', 'orange', 'pink', 'indigo', 'yellow', 'red',
];

/**
 * Stable string hash (djb2-ish) → palette index.
 * Same value always yields the same color across renders/sessions.
 */
function hashToColor(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) + h) ^ value.charCodeAt(i);
  }
  const idx = Math.abs(h) % BADGE_FALLBACK_PALETTE.length;
  return BADGE_FALLBACK_PALETTE[idx];
}

/**
 * Map a hex color (e.g. '#8B5CF6') to the nearest named palette color the
 * badge/dot maps understand. Object field options almost always declare colors
 * as HEX, so without this the explicit author color is ignored and a semantic/
 * hash heuristic takes over (e.g. a purple 'In Review' rendered alarming-red).
 * Low-saturation hexes resolve to 'gray'; otherwise bucket by hue.
 */
function hexToPaletteName(hex: string): string | undefined {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return undefined;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (sat < 0.22) return 'gray';
  let hue: number;
  if (max === r) hue = (((g - b) / d) % 6 + 6) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  if (hue >= 345 || hue < 15) return 'red';
  if (hue < 30) return 'orange';
  if (hue < 60) return 'yellow';
  if (hue < 170) return 'green';
  if (hue < 238) return 'blue';
  if (hue < 250) return 'indigo';
  if (hue < 295) return 'purple';
  return 'pink';
}

/** Normalize an option color to a named palette key: pass known names through,
 *  resolve hex to the nearest palette color, else undefined. */
function resolveColorName(color?: string): string | undefined {
  if (!color) return undefined;
  if (BADGE_COLOR_MAP[color]) return color;
  if (color.charAt(0) === '#') return hexToPaletteName(color);
  return undefined;
}

export function getBadgeColorClasses(color?: string, val?: unknown): string {
  const named = resolveColorName(color);
  if (named && BADGE_COLOR_MAP[named]) return BADGE_COLOR_MAP[named];
  if (val == null || val === '') return 'bg-muted text-muted-foreground border-border';
  const key = String(val).toLowerCase().replace(/[\s-]/g, '_');
  const semantic = SEMANTIC_COLOR_MAP[key];
  if (semantic && BADGE_COLOR_MAP[semantic]) return BADGE_COLOR_MAP[semantic];
  // Deterministic fallback so distinct values are visually distinguishable
  // even when metadata declares no colors.
  return BADGE_COLOR_MAP[hashToColor(key)];
}

/**
 * Resolve a semantic color name (e.g. "red", "green") for a value, suitable
 * for callers that need a raw color token rather than CSS classes (for
 * example, the Gantt renderer paints bars via inline styles).
 *
 * Resolution order: explicit option color → semantic value mapping →
 * deterministic hash fallback. Returns `undefined` only when no value is
 * supplied so the caller can fall back to its own default.
 */
export function getSemanticColorName(color?: string, val?: unknown): string | undefined {
  const named = resolveColorName(color);
  if (named && BADGE_COLOR_MAP[named]) return named;
  if (val == null || val === '') return undefined;
  const key = String(val).toLowerCase().replace(/[\s-]/g, '_');
  const semantic = SEMANTIC_COLOR_MAP[key];
  if (semantic) return semantic;
  return hashToColor(key);
}

// Resolved hex values for the -500 shade of each palette color. Mirrors
// `DOT_COLOR_MAP` and is consumed by callers that paint via inline styles
// (e.g. Gantt task bars, where Tailwind classes can't be applied to dynamic
// `style={}` values).
const COLOR_NAME_HEX: Record<string, string> = {
  gray: '#6b7280',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  indigo: '#6366f1',
  purple: '#a855f7',
  pink: '#ec4899',
};

/**
 * Map a semantic color name to its Tailwind -500 hex value. Used by
 * inline-style consumers (Gantt bars). Falls back to the supplied default
 * (or the platform default blue) when the name is unrecognized.
 */
export function getSemanticHex(name?: string, fallback: string = '#3b82f6'): string {
  if (!name) return fallback;
  return COLOR_NAME_HEX[name] ?? fallback;
}

/**
 * Select field cell renderer.
 *
 * Two visual styles, controlled by `field.appearance` (renderer-level option,
 * not part of the `@objectstack/spec` field schema):
 *   - `'badge'` (default for spec compatibility): soft-pill colored badge.
 *   - `'dot'`: a small colored dot followed by the option label. Used by
 *     dense list/grid contexts to keep the table visually quiet — repeated
 *     filled badges across many rows create heavy visual noise.
 *
 * Metadata always wins: callers can pass `appearance: 'badge'` on the field
 * descriptor to force the legacy badge in any context.
 */
export function SelectCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  const selectField = field as any;
  const options: SelectOptionMetadata[] = selectField.options || [];
  const appearance: 'badge' | 'dot' = selectField.appearance === 'dot' ? 'dot' : 'badge';

  if (value == null || value === '') return <EmptyValue />;

  // Match a stored value to a configured option, falling back to a
  // case-insensitive comparison so seed data with mixed case
  // (e.g. "Referral" stored, "referral" defined) still resolves to the
  // localized option label.
  const findOption = (val: any): SelectOptionMetadata | undefined => {
    const exact = options.find(opt => opt.value === val);
    if (exact) return exact;
    const norm = String(val).toLowerCase();
    return options.find(opt => String(opt.value).toLowerCase() === norm);
  };

  const renderOne = (val: any, key?: number): React.ReactElement => {
    const option = findOption(val);
    const label = option?.label || humanizeLabel(String(val));

    if (appearance === 'dot') {
      // Resolve a real CSS color for the dot. Prefer explicit option color,
      // then semantic mapping for the value, then deterministic palette.
      const colorName = resolveColorName(option?.color)
        || SEMANTIC_COLOR_MAP[String(val).toLowerCase().replace(/[\s-]/g, '_')]
        || hashToColor(String(val).toLowerCase().replace(/[\s-]/g, '_'));
      const dotClass = DOT_COLOR_MAP[colorName] || DOT_COLOR_MAP.gray;
      // max-w-full bounds the (otherwise content-sized) inline-flex box so the
      // inner truncate can engage; title keeps the full label on hover
      // (objectui#3466, same class of bug as the badge branch below).
      return (
        <span key={key} className="inline-flex max-w-full items-center gap-1.5 text-sm" title={label}>
          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClass)} aria-hidden="true" />
          <span className="min-w-0 truncate">{label}</span>
        </span>
      );
    }

    const colorClasses = getBadgeColorClasses(option?.color, val);
    // max-w-full + inner truncate: in bounded containers (detail highlight
    // strip columns, grid cells) an overlong label used to clip mid-glyph at
    // the container edge; now the badge shrinks and ellipsizes, with the full
    // label on hover.
    return (
      <Badge
        key={key}
        variant="outline"
        className={cn('max-w-full min-w-0', colorClasses)}
        title={label}
      >
        <span className="truncate">{label}</span>
      </Badge>
    );
  };

  // Handle multiple values
  if (Array.isArray(value)) {
    return (
      <div className={cn('flex flex-wrap', appearance === 'dot' ? 'gap-x-3 gap-y-1' : 'gap-1')}>
        {value.map((val, idx) => renderOne(val, idx))}
      </div>
    );
  }

  return renderOne(value);
}

/**
 * Email field cell renderer
 */
export function EmailCellRenderer({ value }: CellRendererProps): React.ReactElement {
  // Hooks before the empty-value early return (rules-of-hooks).
  const label = useFieldLabel();
  const [copied, setCopied] = React.useState(false);
  if (!value) return <EmptyValue />;

  const safe = String(coerceToSafeValue(value) ?? '');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(safe).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* clipboard not available */ });
  };
  
  return (
    <span className="inline-flex items-center gap-1 group/email">
      <Button
        variant="link"
        className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800"
        asChild
      >
        <a
          href={`mailto:${safe}`}
          onClick={(e) => e.stopPropagation()}
        >
          {safe}
        </a>
      </Button>
      <button
        type="button"
        className="opacity-0 group-hover/email:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        onClick={handleCopy}
        aria-label={label('detail.copyEmail', 'Copy email')}
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </span>
  );
}

/**
 * URL field cell renderer
 */
export function UrlCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <EmptyValue />;
  
  const safe = String(coerceToSafeValue(value) ?? '');
  return (
    <Button
      variant="link"
      className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800"
      asChild
    >
      <a
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {safe}
      </a>
    </Button>
  );
}

/**
 * Phone field cell renderer
 */
export function PhoneCellRenderer({ value }: CellRendererProps): React.ReactElement {
  // Hooks before the empty-value early return (rules-of-hooks).
  const label = useFieldLabel();
  const [copied, setCopied] = React.useState(false);
  if (!value) return <EmptyValue />;

  const safe = String(coerceToSafeValue(value) ?? '');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(safe).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* clipboard not available */ });
  };
  
  return (
    <span className="inline-flex items-center gap-1 group/phone">
      <a
        href={`tel:${safe}`}
        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
        onClick={(e) => e.stopPropagation()}
      >
        <PhoneIcon className="h-3 w-3" />
        {safe}
      </a>
      <button
        type="button"
        className="opacity-0 group-hover/phone:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        onClick={handleCopy}
        aria-label={label('detail.copyPhone', 'Copy phone number')}
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </span>
  );
}

/**
 * File field cell renderer
 */
export function FileCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  if (!value) return <EmptyValue />;
  
  const fileField = field as any;
  const isMultiple = fileField.multiple;
  
  if (Array.isArray(value)) {
    const count = value.length;
    return (
      <span className="text-sm text-gray-600">
        {count} {count === 1 ? 'file' : 'files'}
      </span>
    );
  }
  
  const fileName = value.name || value.original_name || 'File';
  return <TruncatedText text={String(fileName)} className="text-sm" />;
}

/**
 * Image field cell renderer (with thumbnails + click-to-zoom).
 *
 * An image value may be a plain URL string, an object ({ url | src | href … }),
 * a bare `sys_file` id, or an array of any of those. Normalising through
 * `readFileValues` (which resolves a bare id to its stable download URL) means
 * a string-URL field, a CDN link, and an unexpanded reference all render a
 * thumbnail instead of a broken `<img src="">` placeholder.
 *
 * Clicking a thumbnail opens a full-screen lightbox (single or gallery). The
 * click is `stopPropagation`-guarded so, inside a grid row, enlarging an image
 * doesn't also trigger row navigation.
 */
export function ImageCellRenderer({ value }: CellRendererProps): React.ReactElement {
  const { t } = useObjectTranslation();
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  const imgs = React.useMemo(
    () =>
      readFileValues(value, 'Image')
        .filter((v) => v.url)
        .map((v) => ({ url: v.url as string, name: v.name })),
    [value],
  );

  if (!value || imgs.length === 0) return <EmptyValue />;

  const imageAlt = (idx: number, name?: string) =>
    name || t('fields.image.imageAlt', { index: idx + 1 });
  const open = (idx: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxIndex(idx);
  };
  const multiple = imgs.length > 1;

  const lightbox = lightboxIndex !== null && (
    <ImageLightbox
      images={imgs}
      index={lightboxIndex}
      open
      onOpenChange={(o) => !o && setLightboxIndex(null)}
      onIndexChange={setLightboxIndex}
    />
  );

  if (multiple) {
    return (
      <>
        <div className="flex -space-x-2">
          {imgs.slice(0, 3).map((img, idx) => (
            <img
              key={idx}
              src={img.url}
              alt={imageAlt(idx, img.name)}
              onClick={open(idx)}
              className="size-8 cursor-zoom-in rounded-md border-2 border-background object-cover transition-transform hover:scale-110 hover:z-10"
            />
          ))}
          {imgs.length > 3 && (
            <button
              type="button"
              onClick={open(3)}
              className="size-8 rounded-md border-2 border-background bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground hover:bg-muted/80"
            >
              +{imgs.length - 3}
            </button>
          )}
        </div>
        {lightbox}
      </>
    );
  }

  return (
    <>
      <img
        src={imgs[0].url}
        alt={imageAlt(0, imgs[0].name)}
        onClick={open(0)}
        className="size-10 cursor-zoom-in rounded-md object-cover transition-transform hover:scale-105"
      />
      {lightbox}
    </>
  );
}

/**
 * The referenced record's id inside one lookup value — an `$expand`-ed record
 * object (`{ id, name, … }`) or the raw foreign key itself. `undefined` when
 * the value carries no id we could address (e.g. an unresolved external-id
 * reference), which the link below reads as "not navigable".
 */
function referencedRecordId(item: unknown): string | number | undefined {
  if (item == null || item === '') return undefined;
  if (typeof item === 'object') {
    const id = (item as Record<string, unknown>).id ?? (item as Record<string, unknown>)._id;
    if (typeof id === 'number') return id;
    return typeof id === 'string' && id !== '' ? id : undefined;
  }
  if (typeof item === 'string' || typeof item === 'number') return item;
  return undefined;
}

/**
 * Wrap a lookup's display value in a link to the record it references
 * (objectui#4336).
 *
 * On the record detail page a valued lookup used to render as plain text plus
 * a copy button — the referenced document's name was right there and there was
 * no way to reach it, so users copied the number and searched for it from the
 * list. Related-list cells pointing at a third object were dead in the same
 * way. Both surfaces resolve through `LookupCellRenderer`, so the affordance
 * belongs here, once.
 *
 * **The URL is not built here.** This package has no router and no business
 * knowing what a record route looks like; the host publishes its own builder
 * through `RelatedRecordActionsContext` (`recordHref` / `openRecord`) — the
 * same one the related list's row navigation uses. No host, or a host that
 * cannot route to that object, renders the value EXACTLY as before: no anchor,
 * no styling change, nothing to un-learn (Studio designer, embedded renderers,
 * standalone grids).
 *
 * A real `href` rather than a click handler, so middle-click / ⌘-click / "copy
 * link address" behave the way a link is supposed to; a plain left click is
 * handed to the host so navigation stays in-app.
 */
function ReferencedRecordLink({
  objectName,
  recordId,
  className,
  children,
}: {
  objectName?: string;
  recordId?: string | number;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const host = useRelatedRecordActions();
  const navigable = !!objectName && recordId != null && recordId !== '';
  const href =
    navigable && host?.recordHref
      ? host.recordHref(objectName as string, recordId as string | number)
      : null;

  if (!href) return <>{children}</>;

  return (
    <a
      href={href}
      className={cn('text-primary underline-offset-4 hover:underline', className)}
      onClick={(e) => {
        // The rows this cell sits in carry their own click handlers — the
        // detail row copies the field value, a related-list row opens ITS own
        // record. Following the reference must not also fire those.
        e.stopPropagation();
        // Modifier and non-primary clicks belong to the browser (new tab, new
        // window) — that is the point of rendering a real href.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        // No SPA handler: let the anchor navigate on its own.
        if (!host?.openRecord) return;
        e.preventDefault();
        host.openRecord(objectName as string, recordId as string | number);
      }}
    >
      {children}
    </a>
  );
}

/**
 * Lookup/Master-Detail field cell renderer.
 *
 * Display order:
 * 1. Embedded record object (`{ id, name, ... }` from `$expand`) → use its name
 * 2. Static `field.options[]` (e.g. when the lookup is a closed enum) → look up label
 * 3. Fetch-on-demand: when the value is a primitive ID and `field.reference_to`
 *    is known, resolve via dataSource and show the related record's display name.
 *    Falls back to a muted placeholder while pending and on failure.
 *
 * Record → name resolution (1 and 3) goes through the referenced object's
 * schema when the data source exposes it (`displayField` → nameField/titleFormat
 * → derivation, see {@link resolveLookupRecordName}), so the chip and the
 * picker agree (issue #2357).
 */
export function LookupCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  // ObjectStack object metadata uses `reference` for the lookup target while the
  // objectui types call it `reference_to`. Every other reader (LookupField,
  // UserField, DetailSection, RelatedList, …) accepts both; this read cell must
  // too, or a picked/opaque id never resolves to a name and the cell shows the
  // muted "—" placeholder forever (e.g. after inline-editing a lookup).
  const referenceTo =
    (field as { reference_to?: string }).reference_to ||
    (field as { reference?: string }).reference;

  // Explicit author-chosen display field on the lookup — beats every resolver.
  // ObjectGrid forwards `display_field` on the column meta (RELATIONAL_META_KEYS)
  // the same way it forwards `reference` (#2926 ⑧).
  const displayField =
    (field as { display_field?: string }).display_field ||
    (field as { displayField?: string }).displayField ||
    (field as { reference_field?: string }).reference_field ||
    undefined;

  // Referenced object's schema (nameField / titleFormat) so expanded records
  // resolve through the same unified resolver as the picker (issue #2357).
  const refSchema = useRefObjectSchema(referenceTo);

  // Pick the FIRST primitive id we see (for arrays, only the first one is auto-resolved
  // to keep the cell cheap; multi-value lookups should generally be expanded server-side).
  const primaryPrimitiveId = (() => {
    if (Array.isArray(value)) {
      const firstPrimitive = value.find(
        (v) => v != null && (typeof v === 'string' || typeof v === 'number') && v !== '',
      );
      return firstPrimitive;
    }
    if (
      value != null &&
      value !== '' &&
      (typeof value === 'string' || typeof value === 'number') &&
      typeof value !== 'object'
    ) {
      return value;
    }
    return undefined;
  })();

  // Always call the hook (rules of hooks). It safely no-ops when inputs are missing.
  const resolvedName = useLookupName(referenceTo, primaryPrimitiveId, displayField);

  if (value == null || value === '') return <EmptyValue />;

  // A reference can arrive as a JSON-encoded object string — e.g. an
  // unresolved external-id reference '{"externalId":"Website Relaunch"}'.
  // Parse it and render a label instead of leaking raw JSON into the cell.
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('{') && s.endsWith('}')) {
      // Compute inside try, render outside — constructing JSX in a try/catch
      // doesn't catch its render errors anyway (react-hooks/error-boundaries).
      let parsedDisplay = '';
      let parsedId: string | number | undefined;
      try {
        const parsed = JSON.parse(s) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          parsedDisplay =
            resolveLookupRecordName(parsed, refSchema, displayField) ||
            String(parsed.externalId ?? parsed.id ?? parsed._id ?? '');
          // An external-id reference has no record id yet — stays unlinked.
          parsedId = referencedRecordId(parsed);
        }
      } catch { /* not JSON — fall through to normal resolution */ }
      if (parsedDisplay) {
        return (
          <ReferencedRecordLink objectName={referenceTo} recordId={parsedId}>
            <TruncatedText text={parsedDisplay} />
          </ReferencedRecordLink>
        );
      }
    }
  }

  // Server-side $expand returns the related record as a nested object
  // (e.g. { id, name }). Render its display name directly — no fetch needed.
  if (!Array.isArray(value) && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const display =
      resolveLookupRecordName(obj, refSchema, displayField) || String(obj.id || obj._id || '');
    if (display) {
      return (
        <ReferencedRecordLink objectName={referenceTo} recordId={referencedRecordId(obj)}>
          <TruncatedText text={display} />
        </ReferencedRecordLink>
      );
    }
  }

  const options: Array<{ value: unknown; label: string }> =
    (field as { options?: Array<{ value: unknown; label: string }> }).options || [];

  // Resolve a primitive ID to a label. Order:
  //   options → server-resolved name (via useLookupName) → muted placeholder for opaque IDs → raw value
  const resolveLabel = (val: unknown): { text: string; muted: boolean } => {
    if (options.length > 0) {
      const found = options.find((opt) => String(opt.value) === String(val));
      if (found) return { text: found.label, muted: false };
    }
    if (val === primaryPrimitiveId && resolvedName) {
      return { text: resolvedName, muted: false };
    }
    if (isLikelyOpaqueId(val)) {
      // Don't dump a random-looking ID at the user. Show a soft placeholder
      // that conveys "this is a reference, name unavailable".
      return { text: '—', muted: true };
    }
    return { text: String(val), muted: false };
  };

  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, idx) => {
          let label: string;
          let muted = false;
          if (item != null && typeof item === 'object') {
            label = resolveLookupRecordName(item as Record<string, unknown>, refSchema, displayField) || String((item as any).id || (item as any)._id || '[Object]');
          } else {
            const r = resolveLabel(item);
            label = r.text;
            muted = r.muted;
          }
          // Each chip is one referenced record, so each links on its own —
          // there is no single destination a multi-value cell could point at.
          return (
            <ReferencedRecordLink
              key={idx}
              objectName={referenceTo}
              recordId={referencedRecordId(item)}
              className="text-inherit"
            >
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  muted
                    ? 'bg-muted/40 text-muted-foreground'
                    : 'bg-gray-50 text-gray-700 dark:bg-gray-800/50 dark:text-gray-200',
                )}
              >
                {label}
              </span>
            </ReferencedRecordLink>
          );
        })}
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    const label =
      resolveLookupRecordName(value as Record<string, unknown>, refSchema, displayField) ||
      String((value as any).id || (value as any)._id || '[Object]');
    return (
      <ReferencedRecordLink objectName={referenceTo} recordId={referencedRecordId(value)}>
        <TruncatedText text={label} />
      </ReferencedRecordLink>
    );
  }

  // Primitive value (e.g. raw ID): try options → resolver → opaque-ID placeholder → raw
  // The value IS the foreign key, so it addresses the record even when the
  // display name could not be resolved (the muted placeholder) — a reference
  // that is present but unnamed is still worth being able to open.
  const { text, muted } = resolveLabel(value);
  return (
    <ReferencedRecordLink objectName={referenceTo} recordId={referencedRecordId(value)}>
      <TruncatedText text={text} className={muted ? 'text-muted-foreground' : undefined} />
    </ReferencedRecordLink>
  );
}

/**
 * Formula field cell renderer (read-only)
 */
export function FormulaCellRenderer({ value }: CellRendererProps): React.ReactElement {
  const safe = coerceToSafeValue(value);
  if (safe == null || safe === '') return <EmptyValue />;
  return (
    <span className="text-gray-700 font-mono text-sm">
      {String(safe)}
    </span>
  );
}

/**
 * User/Owner field cell renderer (with avatars)
 */
export function UserCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <EmptyValue />;

  // Primitive value: just display the ID/username as text
  if (typeof value !== 'object') {
    return <TruncatedText text={String(value)} />;
  }
  
  if (Array.isArray(value)) {
    return (
      <div className="flex -space-x-2">
        {value.slice(0, 3).map((user, idx) => {
          // Primitive user in array
          if (typeof user !== 'object' || user === null) {
            return <TruncatedText key={idx} text={String(user)} className="text-sm" />;
          }
          const name = user.name || user.username || 'User';
          const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          
          return (
            <Avatar
              key={idx}
              className="size-8 border-2 border-white"
              title={name}
            >
              {user.image && <AvatarImage src={user.image} alt={name} />}
              <AvatarFallback className="bg-blue-500 text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          );
        })}
        {value.length > 3 && (
          <Avatar className="size-8 border-2 border-white">
            <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
              +{value.length - 3}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    );
  }
  
  const name = value.name || value.username || 'User';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8">
        {value.image && <AvatarImage src={value.image} alt={name} />}
        <AvatarFallback className="bg-blue-500 text-white text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      <TruncatedText text={String(name)} />
    </div>
  );
}

/**
 * Field Registry
 * Stores mapping between field types and their renderers.
 */
const fieldRegistry = new Map<string, React.FC<CellRendererProps>>();

/**
 * Register a custom field renderer
 * @param type Field type (e.g. 'text', 'location', 'my-custom-type')
 * @param renderer React component to render the field
 */
export function registerFieldRenderer(type: string, renderer: React.FC<CellRendererProps>) {
  fieldRegistry.set(type, renderer);
}

/**
 * Format hints (e.g. `{ type: 'text', format: 'phone' }`) that should
 * map to a richer cell renderer than the bare type would imply. The
 * canonical ObjectStack pattern uses `Field.text({ format: 'phone' })`
 * for plain text columns that should still render with a tel: link,
 * `Field.text({ format: 'url' })` for clickable links, etc.
 *
 * Only applies when the field's base type is a generic text type;
 * explicit types like 'phone'/'email'/'currency' already win without
 * any format hint.
 */
const FORMAT_TO_RENDERER: Record<string, string> = {
  phone: 'phone',
  tel: 'phone',
  telephone: 'phone',
  email: 'email',
  url: 'url',
  uri: 'url',
  link: 'url',
  currency: 'currency',
  money: 'currency',
  percent: 'percent',
  percentage: 'percent',
};

const TEXTUAL_BASE_TYPES = new Set(['text', 'textarea', 'string', 'longtext', '']);

/**
 * Resolve the canonical cell-renderer key for a field. Accepts either a
 * raw type string (back-compat) or a field-metadata object so that
 * format hints (`format: 'phone'` etc.) can promote a plain `text`
 * field to its richer renderer counterpart.
 */
export function resolveCellRendererType(fieldOrType: string | { type?: string; format?: string } | null | undefined): string {
  if (!fieldOrType) return 'text';
  if (typeof fieldOrType === 'string') return fieldOrType;
  const baseType = (fieldOrType.type || '').toLowerCase();
  const formatRaw = fieldOrType.format;
  const format = typeof formatRaw === 'string' ? formatRaw.toLowerCase() : '';
  if (format && FORMAT_TO_RENDERER[format] && TEXTUAL_BASE_TYPES.has(baseType)) {
    return FORMAT_TO_RENDERER[format];
  }
  return fieldOrType.type || 'text';
}

/**
 * Renders structured/embedded values (json, object, composite, record,
 * address, geolocation) as compact, readable JSON. Objects and arrays are
 * stringified; primitives fall through to their string form.
 */
export function JsonCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (value == null || value === '') return <EmptyValue />;
  let text: string;
  if (typeof value === 'object') {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  } else {
    text = String(value);
  }
  // The original site of the block-level+max-w-full+title pattern
  // (objectui#2578) — now shared with every single-line value renderer via
  // TruncatedText (objectui#3466).
  return <TruncatedText text={text} className="font-mono text-xs text-gray-600" />;
}

/**
 * Renders a `color` value as a swatch alongside its hex/string value.
 */
export function ColorSwatchCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (value == null || value === '') return <EmptyValue />;
  const color = String(value);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className="h-3.5 w-3.5 rounded border border-black/10 shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="font-mono text-xs">{color}</span>
    </span>
  );
}

const LazyMarkdownContent = React.lazy(() => import('./widgets/MarkdownContent'));

/**
 * Renders `markdown` / `richtext` values as formatted GFM markdown (lazy-loaded,
 * sanitized) instead of the raw markup string.
 */
export function MarkdownCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (value == null || value === '') return <EmptyValue />;
  return (
    <React.Suspense fallback={<span className="text-sm text-muted-foreground">{String(value).slice(0, 80)}</span>}>
      <LazyMarkdownContent value={String(value)} />
    </React.Suspense>
  );
}

/**
 * Minimal HTML sanitizer for display: drops <script>/<style>/<iframe> blocks,
 * inline event handlers, and javascript: URLs. Defense-in-depth — stored HTML
 * is authored by users with write access, but is never trusted blindly.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '$1="#"');
}

/**
 * Renders an `html` value as sanitized, formatted HTML instead of raw markup.
 */
export function HtmlCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (value == null || value === '') return <EmptyValue />;
  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert break-words"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(value)) }}
    />
  );
}

/**
 * Renders a `location`/`geolocation` value as readable coordinates with a pin.
 * Accepts `{ lat, lng }` / `{ latitude, longitude }`, a `"lat,lng"` string,
 * or a `[lat, lng]` array. Falls back to compact JSON for anything else.
 */
export function LocationCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (value == null || value === '') return <EmptyValue />;
  let lat: number | undefined;
  let lng: number | undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, any>;
    lat = typeof v.lat === 'number' ? v.lat : typeof v.latitude === 'number' ? v.latitude : undefined;
    lng = typeof v.lng === 'number' ? v.lng : typeof v.lon === 'number' ? v.lon : typeof v.longitude === 'number' ? v.longitude : undefined;
  } else if (Array.isArray(value) && value.length === 2) {
    lat = Number(value[0]);
    lng = Number(value[1]);
  } else if (typeof value === 'string') {
    const parts = value.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      [lat, lng] = parts;
    }
  }
  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
    return (
      <span className="inline-flex items-center gap-1 text-sm tabular-nums">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </span>
    );
  }
  return <JsonCellRenderer value={value} field={{} as any} />;
}

/**
 * Renders an `address` value as a formatted single-line postal address instead
 * of stringified JSON (objectui#4037).
 *
 * The detail page's display registry mapped `address` to {@link JsonCellRenderer},
 * so a populated address read as `{"street":"中策路 1 号","city":"杭州",…}` on the
 * detail page and in its inline-edit read state — while the very same value
 * rendered correctly in the create/edit dialog, whose input registry has always
 * carried `address`. Read side only: nothing about the input widget changes.
 *
 * Layout is not invented here. It is {@link formatAddress} — the rule
 * `AddressField`'s own readonly branch already applied, over the sub-field set
 * its inputs expose — so a readonly form and a detail page cannot spell one
 * stored address two ways.
 *
 * Anything `formatAddress` cannot recognize falls back to compact JSON rather
 * than rendering blank: an unknown shape stays visible (today's behaviour) and
 * is never silently swallowed by the fix.
 */
export function AddressCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (value == null || value === '') return <EmptyValue />;
  // A plain string address (some apps store one) is already display-ready.
  if (typeof value === 'string') return <TruncatedText text={value} className="text-sm" />;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const formatted = formatAddress(value as AddressValue);
    if (formatted) return <TruncatedText text={formatted} className="text-sm" />;
    // An object carrying no recognized part: `{}` reads as empty, while
    // `{ foo: 1 }` keeps its JSON so real data is never hidden.
    if (Object.keys(value as Record<string, unknown>).length === 0) return <EmptyValue />;
  }
  return <JsonCellRenderer value={value} field={{} as any} />;
}

/**
 * Get the appropriate cell renderer for a field type
 */
export function getCellRenderer(fieldType: string): React.FC<CellRendererProps> {
  // 1. Try exact match in registry
  if (fieldRegistry.has(fieldType)) {
    return fieldRegistry.get(fieldType)!;
  }
  
  // 2. Fallback to standard mappings if not overridden
  const standardMap: Record<string, React.FC<CellRendererProps>> = {
    text: TextCellRenderer,
    textarea: TextCellRenderer,
    markdown: MarkdownCellRenderer,
    html: HtmlCellRenderer,
    richtext: MarkdownCellRenderer,
    code: TextCellRenderer,
    qrcode: TextCellRenderer,
    number: NumberCellRenderer,
    currency: CurrencyCellRenderer,
    percent: PercentCellRenderer,
    progress: PercentCellRenderer,
    slider: NumberCellRenderer,
    rating: NumberCellRenderer,
    boolean: BooleanCellRenderer,
    toggle: BooleanCellRenderer,
    date: DateCellRenderer,
    datetime: DateTimeCellRenderer,
    time: TextCellRenderer,
    select: SelectCellRenderer,
    status: SelectCellRenderer,
    multiselect: SelectCellRenderer,
    radio: SelectCellRenderer,
    checkboxes: SelectCellRenderer,
    tags: SelectCellRenderer,
    lookup: LookupCellRenderer,
    master_detail: LookupCellRenderer,
    tree: LookupCellRenderer,
    email: EmailCellRenderer,
    url: UrlCellRenderer,
    phone: PhoneCellRenderer,
    file: FileCellRenderer,
    video: FileCellRenderer,
    audio: FileCellRenderer,
    image: ImageCellRenderer,
    avatar: ImageCellRenderer,
    signature: ImageCellRenderer,
    formula: FormulaCellRenderer,
    summary: FormulaCellRenderer,
    auto_number: TextCellRenderer,
    user: UserCellRenderer,
    owner: UserCellRenderer,
    password: () => <span>••••••</span>,
    secret: () => <span>••••••</span>,
    location: LocationCellRenderer,
    geolocation: LocationCellRenderer,
    address: AddressCellRenderer,
    color: ColorSwatchCellRenderer,
    json: JsonCellRenderer,
    object: JsonCellRenderer,
    composite: JsonCellRenderer,
    record: JsonCellRenderer,
    repeater: ({ value }: CellRendererProps) => {
      const n = Array.isArray(value) ? value.length : 0;
      return n > 0
        ? <span className="text-gray-500 italic">{n} 项</span>
        : <EmptyValue />;
    },
    vector: () => <span className="text-gray-500 italic">[Vector]</span>,
    grid: () => <span className="text-gray-500 italic">[Grid]</span>,
  };

  // 3. Register standard renderers implicitly if not present
  // This ensures that if we call registerFieldRenderer('text', Custom), it works,
  // but if we don't, we get the standard one.
  return standardMap[fieldType] || TextCellRenderer;
}

// Register standard renderers immediately
registerFieldRenderer('lookup', LookupCellRenderer);
registerFieldRenderer('master_detail', LookupCellRenderer);
registerFieldRenderer('select', SelectCellRenderer);
registerFieldRenderer('status', SelectCellRenderer);
registerFieldRenderer('user', UserCellRenderer);
registerFieldRenderer('owner', UserCellRenderer);

// Register getCellRenderer in the bridge so RecordPickerDialog can access it
// via LookupField without circular imports.
import { setCellRendererResolver } from './widgets/_cell-renderer-bridge';
setCellRendererResolver(getCellRenderer);



// `mapFieldTypeToFormType` moved to './field-type-alias' (re-exported below) so
// FieldEditWidget can resolve spec aliases without importing this barrel.
export { mapFieldTypeToFormType } from './field-type-alias';
import { mapFieldTypeToFormType } from './field-type-alias';

/**
 * Formats file size in bytes to human-readable string
 * @param bytes - File size in bytes (must be non-negative)
 * @returns Formatted string (e.g., "5 MB", "1.5 GB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 0 || !Number.isFinite(bytes)) {
    return '0 B';
  }
  
  if (bytes === 0) {
    return '0 B';
  }
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * Build validation rules from field metadata
 * @param field - Field metadata from ObjectStack
 * @returns Validation rule object compatible with react-hook-form
 */
export function buildValidationRules(field: any): any {
  const rules: any = {};

  // Required validation. Emit a bare `true` for the auto-generated case rather
  // than baking an English message here: the form renderer localizes it via
  // `t('validation.required', { field })`. A field-authored `required_message`
  // still wins and is passed through verbatim.
  if (field.required) {
    rules.required = typeof field.required_message === 'string'
      ? field.required_message
      : true;
  }

  // Standard validation messages are localized by the form renderer, which has
  // an i18n `t` in scope. We therefore emit `message: undefined` for the
  // auto-generated case and tag each rule with a `messageKey` (+ any interp
  // vars); a field-authored `*_message` is a string and passes through as-is,
  // still winning over the localized default. See form.tsx `localizeRule`.

  // Length validation for text fields. The spec-canonical keys are camelCase
  // (`minLength`/`maxLength`, @objectstack/spec FieldSchema — what the server
  // record-validator enforces); the snake_case pair is the legacy objectui
  // spelling, kept as fallback (framework#1878/#1891 naming-drift closeout).
  const minLength = (field as any).minLength ?? field.min_length;
  if (minLength) {
    rules.minLength = {
      value: minLength,
      message: typeof field.min_length_message === 'string' ? field.min_length_message : undefined,
      messageKey: 'validation.minLength',
    };
  }

  const maxLength = (field as any).maxLength ?? field.max_length;
  if (maxLength) {
    rules.maxLength = {
      value: maxLength,
      message: typeof field.max_length_message === 'string' ? field.max_length_message : undefined,
      messageKey: 'validation.maxLength',
    };
  }

  // Number range validation
  if (field.min !== undefined) {
    rules.min = {
      value: field.min,
      message: typeof field.min_message === 'string' ? field.min_message : undefined,
      messageKey: 'validation.min',
    };
  }

  if (field.max !== undefined) {
    rules.max = {
      value: field.max,
      message: typeof field.max_message === 'string' ? field.max_message : undefined,
      messageKey: 'validation.max',
    };
  }

  // Pattern validation
  if (field.pattern) {
    rules.pattern = {
      value: typeof field.pattern === 'string' ? new RegExp(field.pattern) : field.pattern,
      message: typeof field.pattern_message === 'string' ? field.pattern_message : undefined,
      messageKey: 'validation.pattern',
    };
  }

  // Email validation
  if (field.type === 'email') {
    rules.pattern = {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: undefined,
      messageKey: 'validation.email',
    };
  }

  // URL validation
  if (field.type === 'url') {
    rules.pattern = {
      value: /^https?:\/\/.+/,
      message: undefined,
      messageKey: 'validation.url',
    };
  }

  // Custom validation function
  if (field.validate) {
    rules.validate = field.validate;
  }

  return Object.keys(rules).length > 0 ? rules : undefined;
}

/**
 * Evaluate a conditional expression for field visibility
 * @param condition - Condition object from field metadata
 * @param formData - Current form values
 * @returns Whether the condition is met
 */
export function evaluateCondition(condition: any, formData: any): boolean {
  if (!condition) return true;

  // Simple field equality check
  if (condition.field && condition.value !== undefined) {
    const fieldValue = formData[condition.field];
    if (condition.operator === '=' || condition.operator === '==') {
      return fieldValue === condition.value;
    } else if (condition.operator === '!=') {
      return fieldValue !== condition.value;
    } else if (condition.operator === '>') {
      return fieldValue > condition.value;
    } else if (condition.operator === '>=') {
      return fieldValue >= condition.value;
    } else if (condition.operator === '<') {
      return fieldValue < condition.value;
    } else if (condition.operator === '<=') {
      return fieldValue <= condition.value;
    } else if (condition.operator === 'in') {
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    }
  }

  // AND/OR logic
  if (condition.and && Array.isArray(condition.and)) {
    return condition.and.every((c: any) => evaluateCondition(c, formData));
  }

  if (condition.or && Array.isArray(condition.or)) {
    return condition.or.some((c: any) => evaluateCondition(c, formData));
  }

  // Default to true if condition format is unknown
  return true;
}

// TOMBSTONE (objectui#3910, ruling B of objectui#3798) — `createFieldRenderer()`
// lived here. It wrapped a field widget in synthesized label/description chrome
// plus a local `useState` + `onChange`, which let a BARE field node render
// standalone under `SchemaRenderer`. Only `registerFields()` (below, also
// removed) ever called it, and only the docs site called that — so the chrome
// existed nowhere a real application could reach, and the docs demos showed a
// rendering no app produces. The catalog's field examples are form-hosted now
// (`{ type: 'form', fields: [...] }`), where the real form renderer owns label
// and value state. Do not re-add a second, demo-only registration path: one
// registration seam is the whole point (objectui#3308).

/**
 * Field widget map for lazy loading
 * Maps field type to widget component
 */
const fieldWidgetMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  // Basic fields
  'text': () => import('./widgets/TextField').then(m => ({ default: m.TextField })),
  'textarea': () => import('./widgets/TextAreaField').then(m => ({ default: m.TextAreaField })),
  'number': () => import('./widgets/NumberField').then(m => ({ default: m.NumberField })),
  'boolean': () => import('./widgets/BooleanField').then(m => ({ default: m.BooleanField })),
  'select': () => import('./widgets/SelectField').then(m => ({ default: m.SelectField })),
  'date': () => import('./widgets/DateField').then(m => ({ default: m.DateField })),
  'datetime': () => import('./widgets/DateTimeField').then(m => ({ default: m.DateTimeField })),
  'time': () => import('./widgets/TimeField').then(m => ({ default: m.TimeField })),
  
  // Contact fields
  'email': () => import('./widgets/EmailField').then(m => ({ default: m.EmailField })),
  'phone': () => import('./widgets/PhoneField').then(m => ({ default: m.PhoneField })),
  'url': () => import('./widgets/UrlField').then(m => ({ default: m.UrlField })),
  
  // Selection fields (multi-value / option groups)
  'multiselect': () => import('./widgets/MultiSelectField').then(m => ({ default: m.MultiSelectField })),
  'radio': () => import('./widgets/RadioField').then(m => ({ default: m.RadioField })),
  'checkboxes': () => import('./widgets/CheckboxesField').then(m => ({ default: m.CheckboxesField })),
  'tags': () => import('./widgets/TagsField').then(m => ({ default: m.TagsField })),

  // Specialized fields
  'currency': () => import('./widgets/CurrencyField').then(m => ({ default: m.CurrencyField })),
  'percent': () => import('./widgets/PercentField').then(m => ({ default: m.PercentField })),
  'password': () => import('./widgets/PasswordField').then(m => ({ default: m.PasswordField })),
  'markdown': () => import('./widgets/RichTextField').then(m => ({ default: m.RichTextField })),
  'html': () => import('./widgets/RichTextField').then(m => ({ default: m.RichTextField })),
  'richtext': () => import('./widgets/RichTextField').then(m => ({ default: m.RichTextField })),
  'lookup': () => import('./widgets/LookupField').then(m => ({ default: m.LookupField })),
  // master_detail represents the child-side FK to its parent. In create/edit forms it
  // must render as a single-value lookup picker (it is typically NOT NULL). The legacy
  // MasterDetailField widget modelled this as a one-to-many list, which is incorrect
  // for the child-side and prevented users from filling the required parent reference.
  'master_detail': () => import('./widgets/LookupField').then(m => ({ default: m.LookupField })),
  
  // File fields
  'file': () => import('./widgets/FileField').then(m => ({ default: m.FileField })),
  'image': () => import('./widgets/ImageField').then(m => ({ default: m.ImageField })),
  
  // Location field
  'location': () => import('./widgets/LocationField').then(m => ({ default: m.LocationField })),
  
  // Computed/Read-only fields
  'formula': () => import('./widgets/FormulaField').then(m => ({ default: m.FormulaField })),
  'summary': () => import('./widgets/SummaryField').then(m => ({ default: m.SummaryField })),
  'auto_number': () => import('./widgets/AutoNumberField').then(m => ({ default: m.AutoNumberField })),
  
  // User fields
  'user': () => import('./widgets/UserField').then(m => ({ default: m.UserField })),
  'owner': () => import('./widgets/UserField').then(m => ({ default: m.UserField })),
  
  // Complex data types
  'object': () => import('./widgets/ObjectField').then(m => ({ default: m.ObjectField })),
  'vector': () => import('./widgets/VectorField').then(m => ({ default: m.VectorField })),
  'grid': () => import('./widgets/GridField').then(m => ({ default: m.GridField })),
  
  // Additional field types from @objectstack/spec
  'color': () => import('./widgets/ColorField').then(m => ({ default: m.ColorField })),
  'slider': () => import('./widgets/SliderField').then(m => ({ default: m.SliderField })),
  'rating': () => import('./widgets/RatingField').then(m => ({ default: m.RatingField })),
  'code': () => import('./widgets/CodeField').then(m => ({ default: m.CodeField })),
  'avatar': () => import('./widgets/AvatarField').then(m => ({ default: m.AvatarField })),
  'address': () => import('./widgets/AddressField').then(m => ({ default: m.AddressField })),
  'geolocation': () => import('./widgets/GeolocationField').then(m => ({ default: m.GeolocationField })),
  'signature': () => import('./widgets/SignatureField').then(m => ({ default: m.SignatureField })),
  'qrcode': () => import('./widgets/QRCodeField').then(m => ({ default: m.QRCodeField })),

  // Widget-hint-only pickers (reached via a field `widget:` override, never a
  // bare field `type`). They render a *picker* over machine data an admin would
  // otherwise have to type — used by sys_sharing_rule (ADR-0056 P2 pattern):
  //   object-ref       → choose a registered object by name
  //   filter-condition → visual criteria builder scoped to the chosen object
  //   recipient-picker → record picker whose target follows a sibling type
  'object-ref': () => import('./widgets/ObjectRefField').then(m => ({ default: m.ObjectRefField })),
  'filter-condition': () => import('./widgets/FilterConditionField').then(m => ({ default: m.FilterConditionField })),
  'recipient-picker': () => import('./widgets/RecipientPickerField').then(m => ({ default: m.RecipientPickerField })),
};

/**
 * Every field type the form can render (the canonical list of supported types).
 * Exported so inline editing can be checked against it — a form type must
 * either have an inline editor or be explicitly excluded, see
 * `INLINE_EXCLUDED_FIELD_TYPES` and its drift-guard test.
 */
export const FORM_FIELD_TYPES: readonly string[] = Object.freeze(Object.keys(fieldWidgetMap));

/**
 * Resolve an arbitrary field-type spelling to the widget key the form uses.
 * A key already present in the widget map resolves to itself; spec aliases
 * (`toggle`, `json`, `repeater`, `secret`, …) resolve through
 * {@link mapFieldTypeToFormType}; anything unknown falls back to `text` —
 * the same fallback the form renderer applies.
 *
 * Consumers that render field widgets outside the form (e.g. the app-shell
 * `ActionParamDialog`) use this + {@link getLazyFieldWidget} so their type
 * support can never drift behind the form surface (ADR-0059).
 */
export function resolveFormWidgetType(fieldType: string): string {
  if (fieldWidgetMap[fieldType]) return fieldType;
  const mapped = mapFieldTypeToFormType(fieldType).replace(/^field:/, '');
  return fieldWidgetMap[mapped] ? mapped : 'text';
}

/** Cache so each widget type creates one lazy component (and one chunk request). */
const lazyFieldWidgets = new Map<string, React.ComponentType<any>>();

/**
 * Lazily-loaded form field widget for a field type. Shares the exact loaders
 * of {@link fieldWidgetMap} (the same components `registerField` registers for
 * forms), wrapped in `React.lazy` and cached per type — so a consumer can
 * render any form-supported field type without eagerly bundling every widget.
 * Render inside a `<Suspense>` boundary. Unknown types resolve to the `text`
 * widget via {@link resolveFormWidgetType}.
 */
export function getLazyFieldWidget(fieldType: string): React.ComponentType<any> {
  const key = resolveFormWidgetType(fieldType);
  let Widget = lazyFieldWidgets.get(key);
  if (!Widget) {
    Widget = React.lazy(fieldWidgetMap[key]);
    lazyFieldWidgets.set(key, Widget);
  }
  return Widget;
}

/**
 * Register a specific field type lazily
 * @param fieldType - The field type to register (e.g., 'text', 'number')
 * 
 * @example
 * // Register only the text field
 * registerField('text');
 */
// Field types whose short name collides with a display/ui/view/plugin component
// registered elsewhere (e.g. the display widgets and form-input primitives in
// @object-ui/components, or the markdown display plugin). These remain
// accessible via the namespaced `field:<type>` key — which is how forms resolve
// them (see form.tsx renderFieldComponent + mapFieldTypeToFormType) — but must
// not overwrite the bare `<type>` fallback, which the display/ui primitive owns
// and which page schemas expect (e.g. `{ type: 'markdown', content }` → the
// markdown renderer, not the RichText editor). Without skipFallback each of
// these logged a "bare-name fallback is being overwritten" warning at boot.
const FIELD_TYPES_SKIP_FALLBACK = new Set([
  // Display widgets (text/html/image/avatar/grid live in @object-ui/components
  // or @object-ui/layout as the bare-name owners).
  'text',
  'html',
  'image',
  'avatar',
  'grid',
  // Form-input primitives owned by `ui:*` in @object-ui/components.
  'textarea',
  'select',
  'email',
  'password',
  'slider',
  // Display renderer owned by `plugin-markdown:markdown`.
  'markdown',
  // No other package owns the bare `time`/`address` key, but `registerField`
  // wraps each call in a fresh `React.lazy(...)`, so re-registration (HMR,
  // re-import) fails the registry's identity check every time and logs the
  // same "bare-name fallback overwritten" warning at every boot regardless.
  'time',
  'address',
  // Widget-hint-only pickers — resolved solely via `field:<widget>`, so the
  // bare-key fallback is never wanted.
  'object-ref',
  'filter-condition',
  'recipient-picker',
]);

/**
 * Widgets whose labelled surface is NOT a labelable HTML element, so a host's
 * `<label for>` cannot reach it and the association has to go by IDREF instead
 * (`ComponentMeta.labelling`, objectui#3961). Two shapes, one declaration:
 *
 *  - real composites — `address` / `geolocation` render several inputs under one
 *    container, and `checkboxes` / `radio` / `rating` / `multiselect` a set of
 *    choice controls; the host's label names the GROUP, each sub-control keeps
 *    its own name (a sub-label, or the chip's own text content).
 *  - `file` is not composite at all: it has exactly ONE control, the dropzone,
 *    which is a `div[role="button"]` (it is the keyboard path to the hidden file
 *    input). It is here because a `div` cannot be `for`-labelled, not because it
 *    is a group, and it renders NO `role="group"` — the dropzone itself takes the
 *    `aria-labelledby`.
 *
 * Measured, not assumed: every entry was verified in a real form to be a widget
 * whose host label either resolved to nothing (`address` / `geolocation`, whose
 * sub-input ids overwrote the host id — objectui#3343) or resolved to an element
 * that cannot carry it (`checkboxes` / `radio` / `rating` / `file` /
 * `multiselect`). In both shapes the visible group label was, before this
 * declaration, the accessible name of NOTHING.
 *
 * `multiselect` arrived one issue later (objectui#3975) for a coverage reason,
 * not a mechanism one: #3961's probe covered the six above, and re-running it
 * over the full widget map afterwards found `multiselect` on the byte-identical
 * failure shape as `checkboxes` — the host id kept, on the chip row's wrapper
 * `div`, where a `for` is inert. Same declaration, same container answer.
 *
 * A widget NOT listed here takes the single-control path unchanged. That is the
 * safe default: the host keeps emitting `for`, and a composite that forgot to
 * declare itself is caught by the label-association tests (objectui#3952) rather
 * than silently emitting an `aria-labelledby` onto a container with no role.
 */
const FIELD_TYPES_GROUP_LABELLED = new Set([
  'address',
  'geolocation',
  'checkboxes',
  'radio',
  'rating',
  'file',
  // objectui#3975 — the residual after #3961's six, same shape as `checkboxes`.
  'multiselect',
]);

export function registerField(fieldType: string): void {
  const loader = fieldWidgetMap[fieldType];
  if (!loader) {
    console.warn(`Unknown field type: ${fieldType}`);
    return;
  }
  
  // Create lazy component
  const LazyFieldWidget = React.lazy(loader);

  // Register with field namespace. No LAYOUT wrapper — the form renderer owns
  // label/description/spacing. The only thing wrapped is the metadata carrier:
  // `withFieldCarrier` maps `SchemaRenderer`'s `schema` node onto `field`
  // (objectui#3233) and renders nothing of its own.
  ComponentRegistry.register(fieldType, withFieldCarrier(LazyFieldWidget), {
    namespace: 'field',
    skipFallback: FIELD_TYPES_SKIP_FALLBACK.has(fieldType),
    // Only the group-labelled widgets carry the key; everything else leaves it
    // absent, which the form renderer reads as `'control'` (objectui#3961). One
    // spelling of the default, in one place.
    ...(FIELD_TYPES_GROUP_LABELLED.has(fieldType) ? { labelling: 'group' as const } : null),
  });
}

/**
 * Register all field types (for backward compatibility)
 * This function auto-registers all field widgets on import.
 * 
 * For better tree-shaking, use registerField() to register only needed fields.
 * 
 * @example
 * // Register all fields at once
 * registerAllFields();
 */
export function registerAllFields(): void {
  Object.keys(fieldWidgetMap).forEach(fieldType => {
    registerField(fieldType);
  });
}

// TOMBSTONE (objectui#3910, ruling B of objectui#3798) — `registerFields()` lived
// here. It registered every widget wrapped in `createFieldRenderer` (above) under
// the same `field:<type>` keys `registerAllFields()` owns, so whoever called it
// LAST won the registry. Its only caller was the docs site, which needed the
// synthesized label + `onChange` to render a bare field node standalone.
//
// objectui#3308 ruled "registration gets exactly one path"; the implementation
// (PR #3793) then disproved the assumption that this was a redundant duplicate —
// it was a demo host adapter, and switching the docs site to `registerAllFields()`
// alone would have left the demo inputs inert. Ruling B of objectui#3798 resolved
// that by moving the docs catalog's field examples to form hosting
// (`{ type: 'form', fields: [...] }`), which deletes the need for the adapter
// instead of relocating it: the form renderer already owns label and value state,
// so the docs now show what a real application actually renders.
//
// Do not re-add this or any second registration path. `registerAllFields()` (and
// `registerField()` for one type) is the seam; a docs- or test-only wrapper that
// re-registers `field:<type>` silently shadows the live entry for every consumer
// sharing the registry.
//
// TOMBSTONE (objectui#3308, ADR-0049 enforce-or-remove) — `field:capability-multiselect`
// was registered inside `registerFields()`, and ONLY there. Because the docs site
// was that function's sole caller, the key never existed on the live path, so a
// field authored with `widget: 'capability-multiselect'` resolved to nothing in
// every real app while a comment here advertised it as usable from a record form.
// Nothing stamped the hint either: ADR-0056 P1 stamps `permission-facet-link` on
// all six `sys_permission_set` facets (`data-objectstack/src/index.ts`
// applyFieldWidgetOverrides) and P2 put the capability editor in Studio. The
// widget NAME stays retired — do not add it to `fieldWidgetMap`.
// `CapabilityMultiSelectField` itself lives on as a plain component, imported and
// rendered directly by Studio's `PermissionMatrixEditor` (ADR-0056 P2's design).

export * from './widgets/types';
// File field value shapes (ObjectStack ADR-0104 D3 wave 2) — the single
// arbiter of reference vs expanded vs legacy-blob form, shared by the upload
// widgets and by action-param serialization.
export * from './widgets/file-value';
export * from './FieldEditWidget';
export * from './widgets/TextField';
export * from './widgets/NumberField';
export * from './widgets/BooleanField';
export * from './widgets/SelectField';
export * from './widgets/DateField';
export * from './widgets/DateTimeField';
export * from './widgets/TimeField';
export * from './widgets/EmailField';
export * from './widgets/PhoneField';
export * from './widgets/UrlField';
export * from './widgets/CurrencyField';
export * from './widgets/PercentField';
export * from './widgets/PasswordField';
export * from './widgets/TextAreaField';
export * from './widgets/RichTextField';
export * from './widgets/LookupField';
export * from './widgets/CapabilityMultiSelectField';
export * from './widgets/ObjectRefField';
export * from './widgets/FilterConditionField';
export * from './widgets/RecipientPickerField';
export * from './widgets/RecordPickerDialog';
// Shared picker-column derivation (ADR-0085 highlightFields → displayFields →
// schema walk) — consumed by LookupField AND by RelatedList's Add-picker so a
// lookup picker and a related-list Add dialog of the same object agree on
// columns (#3365).
export * from './widgets/deriveLookupColumns';
export * from './widgets/FileField';
export * from './widgets/ImageField';
export { ImageCropperDialog } from './widgets/ImageCropperDialog';
export type { ImageCropperDialogProps } from './widgets/ImageCropperDialog';
export * from './widgets/LocationField';
export * from './widgets/FormulaField';
export * from './widgets/SummaryField';
export * from './widgets/AutoNumberField';
export * from './widgets/UserField';
export * from './widgets/ObjectField';
export * from './widgets/VectorField';
export * from './widgets/GridField';
// New widgets according to @objectstack/spec
export * from './widgets/ColorField';
export * from './widgets/SliderField';
export * from './widgets/RatingField';
export * from './widgets/CodeField';
export * from './widgets/AvatarField';
export * from './widgets/AddressField';
export * from './widgets/GeolocationField';
export * from './widgets/SignatureField';
export * from './widgets/QRCodeField';
export * from './widgets/MasterDetailField';
export * from './widgets/MultiSelectField';
export * from './widgets/RadioField';
export * from './widgets/CheckboxesField';
export * from './widgets/TagsField';

// The SDUI-node → `field` adapter every registration here goes through
// (objectui#3233). Exported so a widget registered OUTSIDE this repo can reach
// the same single-carrier guarantee instead of re-growing a `field || schema`
// read of its own.
export { withFieldCarrier } from './withFieldCarrier';

// The whitelist that decides what a widget's `...props` spread may put on a
// DOM element (objectui#3291) — the runtime executor of the "DOM pass-through"
// block of `FieldWidgetComponentProps`. Exported for the same reason as
// `withFieldCarrier` above: a widget authored outside this repo needs to reach
// it, or it re-grows the bare spread this closed.
export { toDomProps } from './widgets/toDomProps';
export type { DomProps } from './widgets/toDomProps';

// The native date/time control value adapters (objectui#3127). `DateTimeField`
// is ISO-canonical on BOTH sides — it takes the record's ISO instant and hands
// an ISO instant back, which is also the wire form the platform's `datetime`
// value contract requires (`InstantValueSchema`: an ISO-8601 instant with an
// explicit zone), so no consumer has to convert at its own serialization
// boundary. `ActionParamDialog` used to (objectstack#5061 removed it — the
// zone-less wall clock it produced was the one shape the validator rejects).
// Exported for the same reason as `toDomProps` above: a widget authored outside
// this repo needs the same pair, and a second copy of "what the local wall clock
// of an instant is" would drift from this one.
export {
  toDateInputValue,
  toDateTimeInputValue,
  fromDateTimeInputValue,
} from './widgets/nativeDateValue';

// Initialize registry
registerAllFields();
