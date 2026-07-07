/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import type { FieldMetadata, SelectOptionMetadata } from '@object-ui/types';
import { ComponentRegistry, percentDisplayValue } from '@object-ui/core';
import { useLocalization } from '@object-ui/i18n';
import { Badge, Avatar, AvatarImage, AvatarFallback, Button, Checkbox, EmptyValue, cn } from '@object-ui/components';
import { Check, X, Copy, Phone as PhoneIcon, MapPin } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/react';
import { SchemaRendererContext as _SchemaRendererContext } from '@object-ui/react';

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
function useLookupName(referenceTo: string | undefined, value: unknown): string | undefined {
  const ctx = React.useContext(_SchemaRendererContext);
  const dataSource = ctx?.dataSource;
  const [, force] = React.useState(0);

  const isResolvable =
    !!referenceTo &&
    !!dataSource &&
    typeof dataSource.find === 'function' &&
    (typeof value === 'string' || typeof value === 'number') &&
    value !== '';
  const cacheKey = isResolvable ? `${referenceTo}:${String(value)}` : '';

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
          const result = await (dataSource as any).find(referenceTo, {
            $filter: { id: value },
            options: { $top: 1 },
          });
          const records: any[] = Array.isArray(result)
            ? result
            : (result?.value || result?.data || []);
          record = records[0];
        }
        const name = pickRecordDisplayName(record);
        lookupNameCache.set(cacheKey, { state: 'ok', name });
      } catch {
        lookupNameCache.set(cacheKey, { state: 'err' });
      }
      force((n) => n + 1);
    })();

    lookupNameCache.set(cacheKey, { state: 'pending', promise });
  }, [cacheKey, isResolvable, referenceTo, value, dataSource]);

  if (!isResolvable) return undefined;
  const entry = lookupNameCache.get(cacheKey);
  return entry?.state === 'ok' ? entry.name : undefined;
}

/**
 * Safe label resolver for cell-level UI strings. Falls back to the English
 * default when no I18nProvider is available or when the key is missing.
 */
function useFieldLabel() {
  try {
    const { t } = useObjectTranslation();
    return (key: string, fallback: string) => {
      const v = t(key);
      return !v || v === key ? fallback : v;
    };
  } catch {
    return (_k: string, fallback: string) => fallback;
  }
}

import { TextField } from './widgets/TextField';
import { NumberField } from './widgets/NumberField';
import { BooleanField } from './widgets/BooleanField';
import { SelectField } from './widgets/SelectField';
import { DateField } from './widgets/DateField';
import { EmailField } from './widgets/EmailField';
import { PhoneField } from './widgets/PhoneField';
import { UrlField } from './widgets/UrlField';
import { CurrencyField } from './widgets/CurrencyField';
import { TextAreaField } from './widgets/TextAreaField';
import { RichTextField } from './widgets/RichTextField';
import { LookupField } from './widgets/LookupField';
import { DateTimeField } from './widgets/DateTimeField';
import { TimeField } from './widgets/TimeField';
import { PercentField } from './widgets/PercentField';
import { PasswordField } from './widgets/PasswordField';
import { FileField } from './widgets/FileField';
import { ImageField } from './widgets/ImageField';
import { LocationField } from './widgets/LocationField';
import { FormulaField } from './widgets/FormulaField';
import { SummaryField } from './widgets/SummaryField';
import { AutoNumberField } from './widgets/AutoNumberField';
import { UserField } from './widgets/UserField';
import { ObjectField } from './widgets/ObjectField';
import { VectorField } from './widgets/VectorField';
import { GridField } from './widgets/GridField';
// New widgets according to @objectstack/spec
import { ColorField } from './widgets/ColorField';
import { SliderField } from './widgets/SliderField';
import { RatingField } from './widgets/RatingField';
import { CodeField } from './widgets/CodeField';
import { AvatarField } from './widgets/AvatarField';
import { AddressField } from './widgets/AddressField';
import { GeolocationField } from './widgets/GeolocationField';
import { SignatureField } from './widgets/SignatureField';
import { QRCodeField } from './widgets/QRCodeField';
import { MasterDetailField } from './widgets/MasterDetailField';

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
 * Trailing `.00` is dropped when the value is a whole number — Salesforce
 * convention: `$1,234.50` keeps cents; `$1,234` does not.
 */
import { resolveFieldCurrency } from './currency';
export { resolveFieldCurrency };

export function formatCurrency(value: number, currency?: string): string {
  const isWhole = Number.isFinite(value) && value === Math.trunc(value);
  const maxFrac = isWhole ? 0 : 2;
  if (!currency) {
    return formatNumber(value, maxFrac);
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFrac,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(maxFrac)}`;
  }
}

/**
 * Format currency value in compact form for mobile display.
 * E.g., $150,000 → $150K, $1,200,000 → $1.2M
 * When `currency` is undefined, returns a compact number without symbol.
 */
export function formatCompactCurrency(value: number, currency?: string): string {
  if (!currency) {
    try {
      const formatted = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);
      return formatted.replace(/\.0(?=[KMBT])/, '');
    } catch {
      return String(value);
    }
  }
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
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
export function formatNumber(value: number, decimals: number = 2): string {
  try {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return value.toFixed(decimals);
  }
}

/**
 * Format percent value
 * Handles both decimal (0.8 = 80%) and whole number (80 = 80%) inputs.
 */
export function formatPercent(value: number, precision: number = 0): string {
  // Scale a fraction-stored percent (0.8 → 80%) via the shared core helper, so
  // the list cell and the dashboard measure formatter (`formatMeasure`) agree.
  const displayValue = percentDisplayValue(value);
  return `${displayValue.toFixed(precision)}%`;
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

/**
 * Format date as relative time (e.g., "2 days ago", "Today", "Overdue 3d")
 *
 * `dueLike` gates the "Overdue" wording — a past `start_date`/`created_at`
 * isn't overdue, only a past due/deadline-semantic field is. Non-due-like
 * past dates render as "Nd ago" instead.
 */
export function formatRelativeDate(value: string | Date | number, options?: { dueLike?: boolean }): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as any);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = startOfDate.getTime() - startOfToday.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) {
    const absDays = Math.abs(diffDays);
    if (absDays <= 7) return options?.dueLike ? `Overdue ${absDays}d` : `${absDays}d ago`;
    return formatDate(date);
  }
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  return formatDate(date);
}

/**
 * Format date value
 */
export function formatDate(value: string | Date | number, style?: string, options?: { dueLike?: boolean }): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as any);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—';

  if (style === 'short') {
    // Compact format for mobile: "Jan 15, '24"
    const month = date.toLocaleDateString('en-US', { month: 'short' });
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
  return date.toLocaleDateString(undefined, {
    year: isCurrentYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format datetime value
 */
export function formatDateTime(value: string | Date | number): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as any);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—';
  
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Text field cell renderer
 */
export function TextCellRenderer({ value }: CellRendererProps): React.ReactElement {
  const safe = coerceToSafeValue(value);
  if (safe == null || safe === '') return <EmptyValue />;
  return <span className="truncate">{String(safe)}</span>;
}

/**
 * Number field cell renderer
 */
export function NumberCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
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
  const scale = typeof numField.scale === 'number' ? numField.scale : undefined;
  const num = Number(safe);
  const formatted = !isNaN(num)
    ? new Intl.NumberFormat('en-US', {
        minimumFractionDigits: scale ?? 0,
        maximumFractionDigits: scale ?? 20,
      }).format(num)
    : String(safe);
  
  return <span className="tabular-nums">{formatted}</span>;
}

/**
 * Currency field cell renderer
 */
export function CurrencyCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  if (value == null) return <EmptyValue />;
  
  const safe = coerceToSafeValue(value);
  // Resolve the display currency via the shared precedence: field `currency` →
  // `currencyConfig.defaultCurrency` → the tenant default (ADR-0053). When none
  // is known, render a plain number — never a guessed symbol (silently assuming
  // USD mis-displays non-USD orgs, e.g. RMB amounts shown as $).
  const { currency: tenantCurrency } = useLocalization();
  const currency = resolveFieldCurrency(field as any, tenantCurrency);
  const num = Number(safe);
  const formatted = !isNaN(num)
    ? formatCurrency(num, currency)
    : String(safe);

  return <span className="tabular-nums font-medium whitespace-nowrap">{formatted}</span>;
}

// Fields that store percentage values as whole numbers (0-100) rather than fractions (0-1)
const WHOLE_PERCENT_FIELD_PATTERN = /progress|completion/;

/**
 * Percent field cell renderer with mini progress bar
 */
export function PercentCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
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
  const formatted = isWholePercentField ? `${numValue.toFixed(precision)}%` : formatPercent(numValue, precision);
  const clampedBar = Math.max(0, Math.min(100, barValue));
  
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 rounded-full bg-muted ring-1 ring-inset ring-border/60 overflow-hidden shrink-0"
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
      <span className="tabular-nums whitespace-nowrap">{formatted}</span>
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
  const formatted = formatDate(safe as string | Date, style, { dueLike });

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
  if (!value) return <EmptyValue />;
  const safe = coerceToSafeValue(value);
  const date = safe != null ? new Date(safe as string | number) : null;
  if (date === null || isNaN(date.getTime())) return <EmptyValue />;

  const datePart = date.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString(undefined, {
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
      return (
        <span key={key} className="inline-flex items-center gap-1.5 text-sm">
          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClass)} aria-hidden="true" />
          <span className="truncate">{label}</span>
        </span>
      );
    }

    const colorClasses = getBadgeColorClasses(option?.color, val);
    return (
      <Badge
        key={key}
        variant="outline"
        className={colorClasses}
      >
        {label}
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
  if (!value) return <EmptyValue />;

  const label = useFieldLabel();
  const safe = String(coerceToSafeValue(value) ?? '');
  const [copied, setCopied] = React.useState(false);

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
  if (!value) return <EmptyValue />;

  const label = useFieldLabel();
  const safe = String(coerceToSafeValue(value) ?? '');
  const [copied, setCopied] = React.useState(false);

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
  return <span className="text-sm truncate">{fileName}</span>;
}

/**
 * Image field cell renderer (with thumbnails)
 */
export function ImageCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <EmptyValue />;

  // An image value may be a plain URL string, an object ({ url | src | href }),
  // or an array of either. Normalize so a string-URL field (common — e.g. a
  // `cover` seeded with a CDN link) renders a thumbnail instead of a broken
  // <img src=""> placeholder.
  const urlOf = (v: any): string =>
    typeof v === 'string' ? v : (v?.url || v?.src || v?.href || v?.thumbnailUrl || '');
  const nameOf = (v: any, fallback: string): string =>
    (v && typeof v === 'object' && (v.name || v.original_name)) || fallback;

  if (Array.isArray(value)) {
    const imgs = value.map((v) => ({ url: urlOf(v), name: nameOf(v, 'Image') })).filter((i) => i.url);
    if (imgs.length === 0) return <EmptyValue />;
    return (
      <div className="flex -space-x-2">
        {imgs.slice(0, 3).map((img, idx) => (
          <img
            key={idx}
            src={img.url}
            alt={img.name || `Image ${idx + 1}`}
            className="size-8 rounded-md border-2 border-white object-cover"
          />
        ))}
        {imgs.length > 3 && (
          <div className="size-8 rounded-md border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
            +{imgs.length - 3}
          </div>
        )}
      </div>
    );
  }

  const url = urlOf(value);
  if (!url) return <EmptyValue />;
  return (
    <img
      src={url}
      alt={nameOf(value, 'Image')}
      className="size-10 rounded-md object-cover"
    />
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
  const resolvedName = useLookupName(referenceTo, primaryPrimitiveId);

  if (value == null || value === '') return <EmptyValue />;

  // A reference can arrive as a JSON-encoded object string — e.g. an
  // unresolved external-id reference '{"externalId":"Website Relaunch"}'.
  // Parse it and render a label instead of leaking raw JSON into the cell.
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const parsed = JSON.parse(s) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          const display =
            pickRecordDisplayName(parsed) ||
            String(parsed.externalId ?? parsed.id ?? parsed._id ?? '');
          if (display) return <span className="truncate">{display}</span>;
        }
      } catch { /* not JSON — fall through to normal resolution */ }
    }
  }

  // Server-side $expand returns the related record as a nested object
  // (e.g. { id, name }). Render its display name directly — no fetch needed.
  if (!Array.isArray(value) && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const display = pickRecordDisplayName(obj) || String(obj.id || obj._id || '');
    if (display) {
      return <span className="truncate">{display}</span>;
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
            label = pickRecordDisplayName(item as Record<string, unknown>) || String((item as any).id || (item as any)._id || '[Object]');
          } else {
            const r = resolveLabel(item);
            label = r.text;
            muted = r.muted;
          }
          return (
            <span
              key={idx}
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                muted
                  ? 'bg-muted/40 text-muted-foreground'
                  : 'bg-gray-50 text-gray-700 dark:bg-gray-800/50 dark:text-gray-200',
              )}
            >
              {label}
            </span>
          );
        })}
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    const label =
      pickRecordDisplayName(value as Record<string, unknown>) ||
      String((value as any).id || (value as any)._id || '[Object]');
    return <span className="truncate">{label}</span>;
  }

  // Primitive value (e.g. raw ID): try options → resolver → opaque-ID placeholder → raw
  const { text, muted } = resolveLabel(value);
  return <span className={cn('truncate', muted && 'text-muted-foreground')}>{text}</span>;
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
    return <span className="truncate">{String(value)}</span>;
  }
  
  if (Array.isArray(value)) {
    return (
      <div className="flex -space-x-2">
        {value.slice(0, 3).map((user, idx) => {
          // Primitive user in array
          if (typeof user !== 'object' || user === null) {
            return (
              <span key={idx} className="truncate text-sm">
                {String(user)}
              </span>
            );
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
      <span className="truncate">{name}</span>
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
  // inline-block + max-w-full so `truncate` (overflow-hidden/ellipsis/nowrap)
  // actually clamps to the cell width. On a bare inline <span> truncate never
  // clips — there is no width box — and its `white-space:nowrap` also defeats
  // the parent cell's `break-words`, so a long name-keyed map / address JSON
  // spills into the neighbouring column (objectui#2578). The title keeps the
  // full value on hover.
  return <span className="block max-w-full font-mono text-xs text-gray-600 truncate" title={text}>{text}</span>;
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
    address: JsonCellRenderer,
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



/**
 * Map field type to form component type
 * 
 * @param fieldType - The ObjectQL field type identifier to convert
 * (for example: `"text"`, `"number"`, `"date"`, `"lookup"`).
 * @returns The normalized form field type string used in the form schema
 * (for example: `"input"`, `"textarea"`, `"date-picker"`, `"select"`).
 */
export function mapFieldTypeToFormType(fieldType: string): string {
  const typeMap: Record<string, string> = {
    // Text-based fields
    text: 'field:text',
    textarea: 'field:textarea',
    markdown: 'field:markdown', // Markdown editor (fallback to textarea)
    html: 'field:html', // Rich text editor (fallback to textarea)
    richtext: 'field:richtext', // WYSIWYG rich-text editor
    secret: 'field:password', // encrypted-at-rest value — mask input like a password

    // Numeric fields
    number: 'field:number',
    currency: 'field:currency',
    percent: 'field:percent',
    slider: 'field:slider',
    progress: 'field:slider', // bounded 0..100 progress — edit via slider
    rating: 'field:rating',

    // Date/Time fields
    date: 'field:date',
    datetime: 'field:datetime',
    time: 'field:time',

    // Boolean
    boolean: 'field:boolean',
    toggle: 'field:boolean', // toggle is a boolean rendered as a switch

    // Selection fields
    select: 'field:select',
    multiselect: 'field:multiselect',
    radio: 'field:radio',
    checkboxes: 'field:checkboxes',
    tags: 'field:tags',
    lookup: 'field:lookup',
    master_detail: 'field:master_detail',
    tree: 'field:lookup', // hierarchical reference — pick the parent via a lookup
    // `user` is a lookup specialized to sys_user; `owner` mirrors it (record
    // ownership). Both render via the UserField person-picker (delegates to the
    // lookup picker). Without these they would fall through to `field:text`.
    user: 'field:user',
    owner: 'field:owner',

    // Contact fields
    email: 'field:email',
    phone: 'field:phone',
    url: 'field:url',

    // File / media fields
    file: 'field:file',
    image: 'field:image',
    avatar: 'field:avatar',
    video: 'field:file', // uploads as a file
    audio: 'field:file', // uploads as a file
    signature: 'field:signature',

    // Special / enhanced fields
    password: 'field:password',
    location: 'field:location', // Location/map field (fallback to input)
    geolocation: 'field:geolocation',
    address: 'field:address',
    color: 'field:color',
    code: 'field:code',
    json: 'field:code', // JSON edited in the code editor
    qrcode: 'field:qrcode',
    vector: 'field:vector',

    // Embedded structured values (stored as JSON on the row)
    object: 'field:object',
    composite: 'field:object', // embedded object
    record: 'field:object', // name-keyed map
    repeater: 'field:grid', // embedded array of rows

    // Auto-generated/computed fields (typically read-only)
    formula: 'field:formula',
    summary: 'field:summary',
    auto_number: 'field:auto_number',
  };

  return typeMap[fieldType] || 'field:text';
}

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

  // Length validation for text fields
  if (field.min_length) {
    rules.minLength = {
      value: field.min_length,
      message: typeof field.min_length_message === 'string' ? field.min_length_message : undefined,
      messageKey: 'validation.minLength',
    };
  }

  if (field.max_length) {
    rules.maxLength = {
      value: field.max_length,
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

// Create wrapper renderers for field widgets to work with ComponentDemo
function createFieldRenderer(FieldWidget: React.ComponentType<any>) {
  const FieldRenderer: React.FC<any> = ({ schema, className, value: initialValue, ...props }) => {
    const [value, setValue] = React.useState(initialValue ?? schema?.value ?? '');
    
    const field = {
      name: schema?.name || 'field',
      label: schema?.label,
      type: schema?.type,
      placeholder: schema?.placeholder,
      required: schema?.required,
      readonly: schema?.readonly || schema?.readOnly,
      help: schema?.help,
      description: schema?.description,
      defaultValue: schema?.defaultValue || schema?.value,
      ...schema,
    };

    const handleChange = React.useCallback((newValue: any) => {
      setValue(newValue);
      if (props.onChange) {
        props.onChange(newValue);
      }
    }, [props]);

    const readonly = schema?.readonly || schema?.readOnly || false;

    return (
      <div 
        className="grid w-full items-center gap-1.5"
        data-obj-id={schema?.id}
        data-obj-type={schema?.type}
      >
        {schema?.label && (
          <label htmlFor={schema.id} className={schema.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
            {schema.label}
          </label>
        )}
        <FieldWidget
          value={value}
          onChange={handleChange}
          field={field}
          readonly={readonly}
          className={className}
        />
        {schema?.description && (
          <p className="text-sm text-gray-500">{schema.description}</p>
        )}
      </div>
    );
  };
  
  FieldRenderer.displayName = `FieldRenderer(${FieldWidget.displayName || FieldWidget.name || 'Component'})`;
  
  return FieldRenderer;
}

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
};

/**
 * Every field type the form can render (the canonical list of supported types).
 * Exported so inline editing can be checked against it — a form type must
 * either have an inline editor or be explicitly excluded, see
 * `INLINE_EXCLUDED_FIELD_TYPES` and its drift-guard test.
 */
export const FORM_FIELD_TYPES: readonly string[] = Object.freeze(Object.keys(fieldWidgetMap));

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
]);

export function registerField(fieldType: string): void {
  const loader = fieldWidgetMap[fieldType];
  if (!loader) {
    console.warn(`Unknown field type: ${fieldType}`);
    return;
  }
  
  // Create lazy component
  const LazyFieldWidget = React.lazy(loader);
  
  // Register with field namespace - NO WRAPPER to allow form renderer to control label/layout
  ComponentRegistry.register(fieldType, LazyFieldWidget, {
    namespace: 'field',
    skipFallback: FIELD_TYPES_SKIP_FALLBACK.has(fieldType),
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

/**
 * Legacy function - kept for backward compatibility
 * @deprecated Use registerAllFields() instead
 */
export function registerFields() {
  // Basic fields - wrapped for documentation compatibility
  // `text` collides with the display text widget in @object-ui/components.
  // Display semantics ({ type: 'text', content: '...' }) are the dominant
  // usage across the docs/blocks catalog, so we keep this renderer accessible
  // only via the namespaced `field:text` key and let the display widget win
  // the bare `text` lookup.
  ComponentRegistry.register('text', createFieldRenderer(TextField), { namespace: 'field', skipFallback: true });
  // `textarea`/`select` collide with the `ui:*` form-input primitives that own
  // the bare keys; namespaced-only (forms use `field:<type>`). See the shared
  // FIELD_TYPES_SKIP_FALLBACK note above registerField().
  ComponentRegistry.register('textarea', createFieldRenderer(TextAreaField), { namespace: 'field', skipFallback: true });
  ComponentRegistry.register('number', createFieldRenderer(NumberField), { namespace: 'field' });
  ComponentRegistry.register('boolean', createFieldRenderer(BooleanField), { namespace: 'field' });
  ComponentRegistry.register('select', createFieldRenderer(SelectField), { namespace: 'field', skipFallback: true });
  ComponentRegistry.register('date', createFieldRenderer(DateField), { namespace: 'field' });
  ComponentRegistry.register('datetime', createFieldRenderer(DateTimeField), { namespace: 'field' });
  // Namespaced-only: no other renderer legitimately owns the bare 'time' key,
  // but the fallback still triggered noisy "bare-name overwritten" warnings on
  // every re-registration (e.g. hot reload / re-init in a shared registry).
  ComponentRegistry.register('time', createFieldRenderer(TimeField), { namespace: 'field', skipFallback: true });
  
  // Contact fields - wrapped for documentation compatibility
  // `email` collides with the `ui:email` input variant; namespaced-only so the
  // display/input primitive keeps the bare key (forms use `field:email`).
  ComponentRegistry.register('email', createFieldRenderer(EmailField), { namespace: 'field', skipFallback: true });
  ComponentRegistry.register('phone', createFieldRenderer(PhoneField), { namespace: 'field' });
  ComponentRegistry.register('url', createFieldRenderer(UrlField), { namespace: 'field' });
  
  // Specialized fields - wrapped for documentation compatibility
  ComponentRegistry.register('currency', createFieldRenderer(CurrencyField), { namespace: 'field' });
  ComponentRegistry.register('percent', createFieldRenderer(PercentField), { namespace: 'field' });
  // `password` collides with the `ui:password` input variant; namespaced-only.
  ComponentRegistry.register('password', createFieldRenderer(PasswordField), { namespace: 'field', skipFallback: true });
  // `markdown` collides with the markdown DISPLAY renderer (plugin-markdown:markdown),
  // which owns bare `{ type: 'markdown', content }`; the field renderer here is the
  // RichText editor, reached by forms via `field:markdown`. Namespaced-only.
  ComponentRegistry.register('markdown', createFieldRenderer(RichTextField), { namespace: 'field', skipFallback: true });
  // `html` collides with the HTML-rendering display widget. Keep the
  // markdown field, but expose the HTML field only via `field:html` so the
  // display widget remains the default for { type: 'html', content }.
  ComponentRegistry.register('html', createFieldRenderer(RichTextField), { namespace: 'field', skipFallback: true });
  ComponentRegistry.register('lookup', createFieldRenderer(LookupField), { namespace: 'field' });
  // master_detail = child-side FK lookup (single value, typically required). See
  // fieldWidgetMap above for rationale.
  ComponentRegistry.register('master_detail', createFieldRenderer(LookupField), { namespace: 'field' });
  
  // File fields
  ComponentRegistry.register('file', createFieldRenderer(FileField), { namespace: 'field' });
  // `image` collides with the display image widget; namespaced-only.
  ComponentRegistry.register('image', createFieldRenderer(ImageField), { namespace: 'field', skipFallback: true });
  
  // Location field
  ComponentRegistry.register('location', createFieldRenderer(LocationField), { namespace: 'field' });
  
  // Computed/Read-only fields
  ComponentRegistry.register('formula', createFieldRenderer(FormulaField), { namespace: 'field' });
  ComponentRegistry.register('summary', createFieldRenderer(SummaryField), { namespace: 'field' });
  ComponentRegistry.register('auto_number', createFieldRenderer(AutoNumberField), { namespace: 'field' });
  
  // User fields
  ComponentRegistry.register('user', createFieldRenderer(UserField), { namespace: 'field' });
  ComponentRegistry.register('owner', createFieldRenderer(UserField), { namespace: 'field' });
  
  // Complex data types
  ComponentRegistry.register('object', createFieldRenderer(ObjectField), { namespace: 'field' });
  ComponentRegistry.register('vector', createFieldRenderer(VectorField), { namespace: 'field' });
  // `grid` collides with the layout grid component; namespaced-only.
  ComponentRegistry.register('grid', createFieldRenderer(GridField), { namespace: 'field', skipFallback: true });
  
  // NEW: Additional field types from @objectstack/spec
  ComponentRegistry.register('color', createFieldRenderer(ColorField), { namespace: 'field' });
  // `slider` collides with the `ui:slider` display control; namespaced-only.
  ComponentRegistry.register('slider', createFieldRenderer(SliderField), { namespace: 'field', skipFallback: true });
  ComponentRegistry.register('rating', createFieldRenderer(RatingField), { namespace: 'field' });
  ComponentRegistry.register('code', createFieldRenderer(CodeField), { namespace: 'field' });
  // `avatar` collides with the display avatar widget; namespaced-only.
  ComponentRegistry.register('avatar', createFieldRenderer(AvatarField), { namespace: 'field', skipFallback: true });
  // Namespaced-only — see the 'time' registration above for rationale.
  ComponentRegistry.register('address', createFieldRenderer(AddressField), { namespace: 'field', skipFallback: true });
  ComponentRegistry.register('geolocation', createFieldRenderer(GeolocationField), { namespace: 'field' });
  ComponentRegistry.register('signature', createFieldRenderer(SignatureField), { namespace: 'field' });
  ComponentRegistry.register('qrcode', createFieldRenderer(QRCodeField), { namespace: 'field' });
}

export * from './widgets/types';
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
export * from './widgets/RecordPickerDialog';
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

// Initialize registry
registerAllFields();
