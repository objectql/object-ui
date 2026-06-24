// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasetDefaultInspector — the curated designer for an analytics `dataset`
 * (ADR-0021). Replaces the generic whole-draft JSON SchemaForm with structured,
 * fool-proof editors for the dataset's parts:
 *
 *   - base `object`,
 *   - `include` relationships (the join allowlist — D-C),
 *   - `dimensions` (name + field/`relationship.field` + type + granularity), and
 *   - `measures` (name + aggregate + field + certified + format/currency/derived).
 *
 * The base object, the included relationships, and every `field` are picked
 * from the live object graph (a searchable combo over {@link useDatasetFieldCatalog})
 * — not recalled by hand — so authoring matches mainstream low-code dataset
 * builders. The aggregate / type / granularity are closed dropdowns so an
 * author can't type an unsupported value. Each combo still allows a custom
 * value as an escape hatch (offline catalog, computed path). Edits flow through
 * `onPatch`; the DatasetPreview on the canvas re-runs live as the draft changes.
 */

import * as React from 'react';
import { AlertTriangle, ArrowRight, Plus, Trash2, X } from 'lucide-react';
import { Badge, Button, Label } from '@object-ui/components';
import {
  InspectorShell,
  InspectorTextField,
  InspectorSelectField,
  InspectorCheckboxField,
  appendArray,
  spliceArray,
} from './_shared';
import { InspectorComboField, type InspectorComboOption } from './InspectorComboField';
import { toFieldName } from '../previews/object-fields-io';
import { formatMeasure } from '@object-ui/core';
import {
  useObjectOptions,
  useDatasetFieldCatalog,
  useDatasetUsage,
  fieldTypeToDimensionType,
} from './useDatasetFields';
import type { MetadataDefaultInspectorProps } from '../default-inspector-registry';

// Closed to what the dataset compiler supports (no array_agg/string_agg in v1).
const AGGREGATE_OPTIONS = [
  { value: 'count', label: 'count' },
  { value: 'sum', label: 'sum' },
  { value: 'avg', label: 'avg' },
  { value: 'min', label: 'min' },
  { value: 'max', label: 'max' },
  { value: 'count_distinct', label: 'count distinct' },
];

const DIMENSION_TYPE_OPTIONS = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
  { value: 'date', label: 'date' },
  { value: 'boolean', label: 'boolean' },
  { value: 'lookup', label: 'lookup' },
];

const DATE_GRANULARITY_OPTIONS = [
  { value: '', label: '— none —' },
  { value: 'day', label: 'day' },
  { value: 'week', label: 'week' },
  { value: 'month', label: 'month' },
  { value: 'quarter', label: 'quarter' },
  { value: 'year', label: 'year' },
];

const DERIVED_OP_OPTIONS = [
  { value: 'ratio', label: 'ratio (a ÷ b)' },
  { value: 'sum', label: 'sum (a + b)' },
  { value: 'difference', label: 'difference (a − b)' },
  { value: 'product', label: 'product (a × b)' },
];

// Display-format picker options — a business user shouldn't have to know numeral
// syntax (`$0,0.00`), so the inspector offers kind + decimals + currency and
// generates the `format`/`currency` strings.
const FORMAT_KIND_OPTIONS = [
  { value: 'raw', label: 'Raw number' },
  { value: 'number', label: 'Number — 1,234.5' },
  { value: 'currency', label: 'Currency — $1,234.50' },
  { value: 'percent', label: 'Percent — 12.3%' },
];
const DECIMALS_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
];
const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'INR', label: 'INR (₹)' },
  { value: 'CAD', label: 'CAD ($)' },
  { value: 'AUD', label: 'AUD ($)' },
];

type Dimension = { name?: string; label?: string; field?: string; type?: string; dateGranularity?: string };
type DerivedSpec = { op?: string; of?: string[] };
type Measure = {
  name?: string;
  label?: string;
  aggregate?: string;
  field?: string;
  certified?: boolean;
  format?: string;
  currency?: string;
  derived?: DerivedSpec;
};

function SectionHeader({ title, count, onAdd, addLabel }: { title: string; count: number; onAdd?: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">{title}</Label>
        <Badge variant="outline" className="text-[10px]">{count}</Badge>
      </div>
      {onAdd && (
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]" onClick={onAdd}>
          <Plus className="h-3 w-3" /> {addLabel}
        </Button>
      )}
    </div>
  );
}

/** Native disclosure for a row's optional / advanced fields. */
function Advanced({ children }: { children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer select-none list-none text-[11px] text-muted-foreground hover:text-foreground">
        <span className="inline-flex items-center gap-1">
          <ArrowRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          Advanced
        </span>
      </summary>
      <div className="mt-1.5 space-y-1.5 border-l pl-2.5">{children}</div>
    </details>
  );
}

/** Best-effort parse of a stored measure format into the picker's {kind, decimals}. */
function parseMeasureFormat(format?: string, currency?: string): { kind: string; decimals: number } {
  const f = (format ?? '').trim();
  const m = f.match(/\.(0+)/);
  const decimals = m ? Math.min(m[1].length, 2) : 0;
  if (currency || /[$£€¥₹]/.test(f)) return { kind: 'currency', decimals };
  if (f.includes('%')) return { kind: 'percent', decimals };
  if (f) return { kind: 'number', decimals };
  return { kind: 'raw', decimals: 0 };
}

/** Generate {format, currency} from the picker selection. */
function buildMeasureFormat(kind: string, decimals: number, currency: string): { format?: string; currency?: string } {
  const dp = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
  switch (kind) {
    case 'number': return { format: `0,0${dp}`, currency: undefined };
    case 'currency': return { format: `0,0${dp}`, currency: currency || 'USD' };
    case 'percent': return { format: `0${dp}%`, currency: undefined };
    default: return { format: undefined, currency: undefined };
  }
}

/**
 * Structured display-format picker for a measure. Maps {kind, decimals, currency}
 * ⇄ the spec's `format`/`currency` strings and shows a live sample so a business
 * user never has to hand-write a numeral pattern.
 */
function MeasureFormatField({ measure, onPatch, disabled }: { measure: Measure; onPatch: (p: Partial<Measure>) => void; disabled?: boolean }) {
  const { kind, decimals } = parseMeasureFormat(measure.format, measure.currency);
  const currency = measure.currency || 'USD';
  const apply = (k: string, d: number, c: string) => onPatch(buildMeasureFormat(k, d, c));
  const sample = formatMeasure(kind === 'percent' ? 0.1234 : 1234.5, measure.format, measure.currency);
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <InspectorSelectField label="Display format" value={kind} options={FORMAT_KIND_OPTIONS} onCommit={(v) => apply(v, decimals, currency)} disabled={disabled} />
        {kind !== 'raw' && (
          <InspectorSelectField label="Decimals" value={String(decimals)} options={DECIMALS_OPTIONS} onCommit={(v) => apply(kind, parseInt(v, 10) || 0, currency)} disabled={disabled} />
        )}
      </div>
      {kind === 'currency' && (
        <InspectorSelectField label="Currency" value={currency} options={CURRENCY_OPTIONS} onCommit={(v) => apply(kind, decimals, v)} disabled={disabled} />
      )}
      {kind !== 'raw' && (
        <p className="text-[10px] text-muted-foreground">Sample: <span className="font-mono tabular-nums">{sample}</span></p>
      )}
    </div>
  );
}

/** The relationship prefix of a `relationship.field` path that isn't yet in `include`, else null. */
function missingRelationship(field: string | undefined, include: string[]): string | null {
  if (!field || !field.includes('.')) return null;
  const rel = field.split('.')[0];
  return rel && !include.includes(rel) ? rel : null;
}

/** Inline author-time warning: a `relationship.field` whose join isn't declared in `include`. */
function RelWarning({ rel, onAdd, disabled }: { rel: string; onAdd?: () => void; disabled?: boolean }) {
  return (
    <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      <span>Relationship <code className="font-mono">{rel}</code> isn't in Included relationships.</span>
      {!disabled && onAdd && (
        <button type="button" className="underline hover:no-underline" onClick={onAdd}>Add it</button>
      )}
    </p>
  );
}

export function DatasetDefaultInspector({ draft, onPatch, readOnly, name }: MetadataDefaultInspectorProps) {
  const label = typeof draft.label === 'string' ? draft.label : '';
  const description = typeof draft.description === 'string' ? draft.description : '';
  const object = typeof draft.object === 'string' ? draft.object : '';
  const include: string[] = Array.isArray(draft.include) ? (draft.include as string[]) : [];
  const dimensions: Dimension[] = Array.isArray(draft.dimensions) ? (draft.dimensions as Dimension[]) : [];
  const measures: Measure[] = Array.isArray(draft.measures) ? (draft.measures as Measure[]) : [];
  const datasetName = typeof draft.name === 'string' ? draft.name : undefined;

  // In create mode the host passes an empty `name` (the PK is assigned on first
  // save). Mirror ReportDefaultInspector: expose an editable Name that auto-
  // derives a snake_case slug from the label until the author edits it directly,
  // so a dataset created through the canvas saves with a valid identifier instead
  // of dead-ending on the empty-name identity rule.
  const createMode = !name;
  const nameTouched = React.useRef(false);
  const nameValue = typeof draft.name === 'string' ? (draft.name as string) : '';

  const { options: objectOptions, loading: objectsLoading } = useObjectOptions();
  const { relationships, fieldOptions, loading: catalogLoading } = useDatasetFieldCatalog(object, include);
  const usage = useDatasetUsage(datasetName);

  const objectComboOptions: InspectorComboOption[] = React.useMemo(
    () => objectOptions.map((o) => ({ value: o.name, label: o.label })),
    [objectOptions],
  );
  const relationshipComboOptions: InspectorComboOption[] = React.useMemo(
    () => relationships.map((r) => ({ value: r.name, label: r.label, hint: r.referenceTo ? `→ ${r.referenceTo}` : undefined })),
    [relationships],
  );
  const fieldComboOptions: InspectorComboOption[] = React.useMemo(
    () => fieldOptions.map((f) => ({ value: f.value, label: f.label, hint: f.type, group: f.group })),
    [fieldOptions],
  );

  const baseLabel = objectComboOptions.find((o) => o.value === object)?.label ?? object;

  const patchDimension = (i: number, patch: Partial<Dimension>) =>
    onPatch({ dimensions: dimensions.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  const patchMeasure = (i: number, patch: Partial<Measure>) =>
    onPatch({ measures: measures.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });

  // Picking a field auto-infers the dimension type from the field's framework
  // type (region:string, close_date:date, …) — the BI "pick field, type follows"
  // convention — while leaving the Type select free to override.
  const leafName = (path: string) => (path.includes('.') ? path.split('.').pop() ?? path : path);
  const pickDimensionField = (i: number, v: string) => {
    const opt = fieldOptions.find((o) => o.value === v);
    const patch: Partial<Dimension> = opt?.type ? { field: v, type: fieldTypeToDimensionType(opt.type) } : { field: v };
    if (!dimensions[i]?.name) patch.name = leafName(v); // auto-name from field when unnamed
    patchDimension(i, patch);
  };
  const pickMeasureField = (i: number, v: string) => {
    const patch: Partial<Measure> = { field: v };
    if (!measures[i]?.name) patch.name = leafName(v); // auto-name from field when unnamed
    patchMeasure(i, patch);
  };

  return (
    <InspectorShell kindLabel="Dataset" title={String(label || draft.name || 'Dataset')} onClose={() => {}} hideClose>
      {datasetName && !usage.loading && (
        <p
          className={
            usage.reports + usage.dashboards > 0
              ? 'rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300'
              : 'text-[11px] text-muted-foreground'
          }
        >
          {usage.reports + usage.dashboards > 0
            ? `Bound by ${usage.reports} report${usage.reports === 1 ? '' : 's'} · ${usage.dashboards} dashboard${usage.dashboards === 1 ? '' : 's'} — changes affect them.`
            : 'Not yet bound by any report or dashboard.'}
        </p>
      )}

      {createMode && (
        <InspectorTextField
          label="Name"
          value={nameValue}
          onCommit={(v) => { nameTouched.current = true; onPatch({ name: toFieldName(v) }); }}
          placeholder="snake_case identifier"
          disabled={readOnly}
          mono
        />
      )}
      <InspectorTextField
        label="Label"
        value={label}
        onCommit={(v) => {
          // Live-derive the snake_case name from the label until the author edits
          // the Name field directly (create mode only).
          const patch: Record<string, unknown> = { label: v };
          if (createMode && !nameTouched.current) patch.name = toFieldName(v);
          onPatch(patch);
        }}
        disabled={readOnly}
      />
      <InspectorTextField label="Description" value={description} onCommit={(v) => onPatch({ description: v })} disabled={readOnly} />
      <InspectorComboField
        label="Base object"
        value={object}
        onCommit={(v) => onPatch({ object: v })}
        options={objectComboOptions}
        loading={objectsLoading}
        placeholder="Select an object…"
        searchPlaceholder="Search objects…"
        disabled={readOnly}
        mono
      />

      {/* Included relationships (the join allowlist) */}
      <div className="border-t pt-3 space-y-1.5">
        <SectionHeader
          title="Included relationships"
          count={include.length}
          addLabel="Add"
          onAdd={readOnly ? undefined : () => onPatch({ include: appendArray(include, '') })}
        />
        {include.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-center text-[11px] text-muted-foreground">
            No joins. Add a relationship (a lookup field on <code>{baseLabel || 'the base object'}</code>) to use <code>relationship.field</code> dimensions/measures.
          </p>
        ) : (
          include.map((rel, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <InspectorComboField
                value={rel}
                onCommit={(v) => onPatch({ include: include.map((r, idx) => (idx === i ? v : r)) })}
                options={relationshipComboOptions}
                loading={catalogLoading}
                placeholder="Select a relationship…"
                searchPlaceholder="Search relationships…"
                disabled={readOnly}
                mono
              />
              {!readOnly && (
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" onClick={() => onPatch({ include: spliceArray(include, i, null) })} aria-label="Remove relationship">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
        {object && include.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 pt-0.5 text-[10px] text-muted-foreground">
            <span className="font-mono font-medium">{baseLabel}</span>
            {include.map((rel, i) => {
              const r = relationships.find((x) => x.name === rel);
              return (
                <span key={i} className="inline-flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 opacity-60" />
                  <span className="font-mono">{rel}{r?.referenceTo ? ` (${r.referenceTo})` : ''}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Dimensions */}
      <div className="border-t pt-3 space-y-2">
        <SectionHeader
          title="Dimensions"
          count={dimensions.length}
          addLabel="Add dimension"
          onAdd={readOnly ? undefined : () => onPatch({ dimensions: appendArray(dimensions, { name: '', field: '', type: 'string' }) })}
        />
        {dimensions.map((d, i) => (
          <div key={i} className="rounded-md border p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Dimension {i + 1}</span>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove dimension"
                  title="Remove dimension"
                  className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onPatch({ dimensions: spliceArray(dimensions, i, null) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <InspectorTextField label="Name" value={d.name ?? ''} onCommit={(v) => patchDimension(i, { name: v })} placeholder="e.g. region" disabled={readOnly} mono />
            <InspectorComboField
              label="Field"
              value={d.field ?? ''}
              onCommit={(v) => pickDimensionField(i, v)}
              options={fieldComboOptions}
              loading={catalogLoading}
              placeholder="field or relationship.field"
              searchPlaceholder="Search fields…"
              disabled={readOnly}
              mono
            />
            {(() => { const rel = missingRelationship(d.field, include); return rel ? <RelWarning rel={rel} disabled={readOnly} onAdd={() => onPatch({ include: appendArray(include, rel) })} /> : null; })()}
            <InspectorSelectField label="Type" value={d.type} options={DIMENSION_TYPE_OPTIONS} onCommit={(v) => patchDimension(i, { type: v })} disabled={readOnly} />
            <Advanced>
              <InspectorTextField label="Label (optional)" value={d.label ?? ''} onCommit={(v) => patchDimension(i, { label: v || undefined })} placeholder={d.name || 'Display label'} disabled={readOnly} />
              {d.type === 'date' && (
                <InspectorSelectField label="Date bucket" value={d.dateGranularity ?? ''} options={DATE_GRANULARITY_OPTIONS} onCommit={(v) => patchDimension(i, { dateGranularity: v || undefined })} disabled={readOnly} />
              )}
            </Advanced>
          </div>
        ))}
      </div>

      {/* Measures */}
      <div className="border-t pt-3 space-y-2">
        <SectionHeader
          title="Measures"
          count={measures.length}
          addLabel="Add measure"
          onAdd={readOnly ? undefined : () => onPatch({ measures: appendArray(measures, { name: '', aggregate: 'sum', field: '', certified: false }) })}
        />
        {measures.map((m, i) => {
          const otherMeasures = measures.filter((_, idx) => idx !== i).map((x) => x.name).filter((n): n is string => !!n);
          const derived = m.derived;
          return (
            <div key={i} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Measure {i + 1}</span>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove measure"
                    title="Remove measure"
                    className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onPatch({ measures: spliceArray(measures, i, null) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <InspectorTextField label="Name" value={m.name ?? ''} onCommit={(v) => patchMeasure(i, { name: v })} placeholder="e.g. revenue" disabled={readOnly} mono />
              <InspectorSelectField label="Aggregate" value={m.aggregate} options={AGGREGATE_OPTIONS} onCommit={(v) => patchMeasure(i, { aggregate: v })} disabled={readOnly} />
              <InspectorComboField
                label="Field"
                value={m.field ?? ''}
                onCommit={(v) => pickMeasureField(i, v)}
                options={fieldComboOptions}
                loading={catalogLoading}
                placeholder="field (optional for count)"
                searchPlaceholder="Search fields…"
                disabled={readOnly}
                mono
              />
              {(() => { const rel = missingRelationship(m.field, include); return rel ? <RelWarning rel={rel} disabled={readOnly} onAdd={() => onPatch({ include: appendArray(include, rel) })} /> : null; })()}
              <InspectorCheckboxField label="Certified" value={!!m.certified} onCommit={(v) => patchMeasure(i, { certified: v })} disabled={readOnly} />
              <Advanced>
                <InspectorTextField label="Label (optional)" value={m.label ?? ''} onCommit={(v) => patchMeasure(i, { label: v || undefined })} placeholder={m.name || 'Display label'} disabled={readOnly} />
                <MeasureFormatField measure={m} onPatch={(pp) => patchMeasure(i, pp)} disabled={readOnly} />
                <InspectorCheckboxField
                  label="Derived — computed from other measures"
                  value={!!derived}
                  onCommit={(v) => patchMeasure(i, { derived: v ? { op: 'ratio', of: [] } : undefined })}
                  disabled={readOnly}
                />
                {derived && (
                  <div className="space-y-1.5 rounded-md border border-dashed p-2">
                    <InspectorSelectField label="Operation" value={derived.op} options={DERIVED_OP_OPTIONS} onCommit={(v) => patchMeasure(i, { derived: { ...derived, op: v } })} disabled={readOnly} />
                    <Label className="text-xs text-muted-foreground">Operands (other measures)</Label>
                    {(() => { const need = derived.op === 'ratio' || derived.op === 'difference' ? 2 : 1; const have = Array.isArray(derived.of) ? derived.of.length : 0; return have < need ? <p className="text-[10px] text-amber-600 dark:text-amber-400">Select {need === 2 ? 'exactly 2 measures' : 'at least 1 measure'} for {derived.op}.</p> : null; })()}
                    {otherMeasures.length === 0 ? (
                      <p className="text-[11px] italic text-muted-foreground">Add other measures first.</p>
                    ) : (
                      <div className="space-y-1">
                        {otherMeasures.map((nm) => {
                          const checked = Array.isArray(derived.of) && derived.of.includes(nm);
                          return (
                            <InspectorCheckboxField
                              key={nm}
                              label={nm}
                              value={checked}
                              disabled={readOnly}
                              onCommit={(v) => {
                                const current = Array.isArray(derived.of) ? derived.of : [];
                                const next = v ? [...current, nm] : current.filter((x) => x !== nm);
                                patchMeasure(i, { derived: { ...derived, of: next } });
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Advanced>
            </div>
          );
        })}
      </div>
    </InspectorShell>
  );
}
