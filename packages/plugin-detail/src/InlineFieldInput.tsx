/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  SelectField,
  BooleanField,
  LookupField,
  UserField,
  NumberField,
  CurrencyField,
  PercentField,
  CapabilityMultiSelectField,
  coerceToSafeValue,
} from '@object-ui/fields';
import { PermissionFacetLink } from './renderers/PermissionFacetLink';

/**
 * Field types that carry a `reference_to` for relational metadata but are NOT
 * edited via the lookup picker (they have their own dedicated inputs/renderers).
 * Used so the inline-edit branch doesn't hijack them into a record picker.
 *
 * Exported because `DetailSection`'s per-field editability gate keys off the
 * same set (a computed field is never editable), so the two must not drift.
 */
export const TEXTUAL_REF_FALLBACK_TYPES = new Set(['formula', 'summary', 'rollup', 'auto_number']);

/**
 * Extract the id a reference widget expects from a value that may already be
 * an `$expand`-ed record object (`{ id, name, ... }`), an array of those, or a
 * bare id. Mirrors the display logic in `LookupCellRenderer` so edit-mode and
 * read-mode agree on which id a relationship points at.
 */
export function extractLookupId(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(extractLookupId);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return obj.id ?? obj._id ?? obj.value ?? '';
  }
  return value;
}

export interface InlineFieldInputProps {
  /**
   * Enriched field metadata — `type` plus any objectSchema enrichment (options,
   * currency, precision, format, reference_to, widget…). The caller owns
   * enrichment so read-mode and edit-mode agree on the same resolved field
   * shape. Kept as a loose bag (matching the widgets' `field` props) since the
   * exact key set varies by field type.
   */
  field: Record<string, any>;
  /** Current field value (may be an `$expand`-ed record object for references). */
  value: any;
  /** Called with the next value whenever the user edits the field. */
  onChange: (value: any) => void;
  /** DataSource used by reference (lookup / master_detail / user) pickers. */
  dataSource?: any;
  /** Auto-focus the underlying input on mount (wired to the entered field). */
  autoFocus?: boolean;
}

/**
 * The single inline-edit input for a record field, extracted from
 * `DetailSection` so any record-level surface — the details body AND the
 * highlights strip (objectui#2407) — renders an identical editor. Covers every
 * widget the detail body handles: `SelectField`, `BooleanField`, `LookupField`,
 * `UserField`, `CapabilityMultiSelectField` (#2403), the `permission-facet-link`
 * read-only facet (#2403), the numeric widgets (`NumberField` /
 * `CurrencyField` / `PercentField`, objectui#2572), and the plain date/text
 * input (with ISO date coercion + object-value guarding so an unexpanded
 * reference never leaks "[object Object]").
 *
 * Editability GATING (computed types, `readonly`, system fields, object
 * lifecycle) stays with the host — this component only renders the editor once
 * the host has decided the field is editable.
 */
export const InlineFieldInput: React.FC<InlineFieldInputProps> = ({
  field,
  value,
  onChange,
  dataSource,
  autoFocus,
}) => {
  const editType = field.type;
  // Per-field widget override (ADR-0056 P2) — honor a `widget` hint before the
  // type switch so a structured editor (e.g. the capability multi-select on
  // sys_permission_set.system_permissions) replaces the raw type in inline
  // edit too, matching the form path.
  const editWidget = (field as any).widget;
  // Permission facets are designed in Studio, never edited in Setup — even in
  // section edit mode they stay a read-only summary + deep-link.
  if (editWidget === 'permission-facet-link') {
    return <PermissionFacetLink value={value} field={field as any} />;
  }
  if (editWidget === 'capability-multiselect') {
    return (
      <CapabilityMultiSelectField
        value={value}
        onChange={(v: any) => onChange(v)}
        field={field as any}
        dataSource={dataSource}
      />
    );
  }
  // Picklist → real Select widget so users see localized option labels and
  // can't free-type invalid values.
  if (editType === 'select' && Array.isArray(field.options) && field.options.length > 0) {
    return (
      <SelectField
        field={field as any}
        value={value == null ? '' : String(value)}
        onChange={(v) => onChange(v)}
      />
    );
  }
  // Boolean → Switch widget instead of free-text "true"/"false".
  if (editType === 'boolean') {
    return (
      <BooleanField
        field={field as any}
        value={!!value}
        onChange={(v) => onChange(v)}
      />
    );
  }
  // Reference fields (lookup / master_detail / tree / user / owner) store an id
  // but may arrive `$expand`-ed as a record object. A plain text input would
  // stringify that to "[object Object]", so render the real picker. The value
  // is passed through UNCOLLAPSED (objectui#2572 item 1): `LookupField`
  // resolves an expanded record object directly (display name included), so
  // stripping it to a bare id here would force the picker's hydration effect
  // to re-fetch the referenced record just to recover the name the record
  // page's `populate=` already delivered. `extractLookupId` stays exported for
  // write-side callers that need the bare id.
  const isUserRef = editType === 'user' || editType === 'owner';
  const isLookupRef =
    editType === 'lookup' ||
    editType === 'master_detail' ||
    editType === 'tree' ||
    (!!field.reference_to && !TEXTUAL_REF_FALLBACK_TYPES.has(editType as string));
  if (isUserRef || isLookupRef) {
    const RefWidget = isUserRef ? UserField : LookupField;
    return (
      <RefWidget
        field={field as any}
        value={value}
        onChange={(v: any) => onChange(v)}
        dataSource={dataSource}
      />
    );
  }
  // Numeric types → the SAME dedicated widgets the form uses (objectui#2572
  // item 3), so inline edit gets a real number input (numeric keyboard,
  // min/max/step from the field metadata) and currency/percent keep their
  // symbol adornment + display conversion instead of a free-text input.
  // (`decimal`/`integer` are not spec FieldTypes — metadata should declare
  // `number` with `scale`, so they are deliberately not aliased here.)
  if (editType === 'number') {
    return <NumberField field={field as any} value={value} onChange={(v: any) => onChange(v)} autoFocus={autoFocus} />;
  }
  if (editType === 'currency') {
    return <CurrencyField field={field as any} value={value} onChange={(v: any) => onChange(v)} autoFocus={autoFocus} />;
  }
  if (editType === 'percent') {
    return <PercentField field={field as any} value={value} onChange={(v: any) => onChange(v)} autoFocus={autoFocus} />;
  }
  const isDate = editType === 'date' || editType === 'datetime';
  const inputType = isDate ? 'date' : 'text';
  // <input type="date"> needs a YYYY-MM-DD string; raw ISO timestamps
  // ("2026-02-14T14:46:20.862Z") leave the picker blank. Slice down to the date
  // portion so existing values round-trip correctly.
  const inputValue = value == null
    ? ''
    : isDate
      ? (() => {
          const s = String(value);
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
          const d = new Date(s);
          return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA');
        })()
      // Coerce objects (e.g. an unexpanded reference that slipped through type
      // detection) to a readable label rather than leaking "[object Object]".
      : typeof value === 'object'
        ? String(coerceToSafeValue(value) ?? '')
        : String(value);
  return (
    <input
      type={inputType}
      autoFocus={autoFocus}
      className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      value={inputValue}
      onChange={(e) => {
        const v = e.target.value;
        // Re-emit dates as full ISO so backend validation that expects ISO
        // timestamps keeps working.
        if (isDate && v) {
          const iso = new Date(v + 'T00:00:00').toISOString();
          onChange(iso);
        } else {
          onChange(v);
        }
      }}
    />
  );
};
