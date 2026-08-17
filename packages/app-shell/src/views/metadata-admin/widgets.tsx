// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in widget renderers for SchemaForm.
 *
 * These cover the common widget hints declared in spec `*.form.ts`
 * files (e.g. `widget: 'ref:object'`, `widget: 'master-detail'`).
 *
 * Each widget receives `WidgetProps`:
 *   - schema     — the JSONSchema fragment for THIS field (so widgets
 *                  for nested arrays can read items.properties)
 *   - value      — the current value
 *   - onChange   — write-back callback
 *   - readOnly   — disable
 *   - context    — out-of-band data (object list, ObjectQL fields, …)
 *
 * To register a new widget, add an entry to `WIDGETS` below. To wire
 * extra context (e.g. a fields list), extend `WidgetContext` in
 * SchemaForm.tsx and prefetch it in ResourceEditPage.
 */

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Button,
  Label,
  Switch,
  LazyIcon,
  toKebabIconName,
  Popover,
  PopoverTrigger,
  PopoverContent,
  FilterBuilder,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@object-ui/components';
import type { ComponentMeta } from '@object-ui/core';
import { ChevronDown, ChevronsUpDown, ChevronUp, Eye, EyeOff, Plus, Search, Trash2 } from 'lucide-react';
import { iconNames } from 'lucide-react/dynamic.mjs';
import { toast } from 'sonner';
import { useObjectTranslation } from '@object-ui/i18n';
import { useMetadataLocale, t, tFormat } from './i18n';
import { foldFilterGroupToSpecRules, FILTER_FOLD_REFUSAL_KEYS } from '../viewFilterFold';
import { ColorVariantPicker } from './color-variant-field';
import { ConditionBuilder } from './inspectors/ConditionBuilder';
import { expressionSource, writeExpressionSource } from './inspectors/expression-envelope';

export interface WidgetContext {
  /** Names of all object metadata records (for `ref:object`). */
  objectNames?: string[];
  /** Loading flag for the object list. */
  objectsLoading?: boolean;
  /**
   * Field catalog of the bound object. Drives the `field-ref` /
   * `field-multi` pickers so View config props that reference a field
   * (kanban.groupByField, calendar.startDateField, chart.xAxisField, …)
   * render as dropdowns of the object's real fields instead of free text.
   */
  objectFields?: Array<{ name: string; label?: string; type?: string }>;
  /** Loading flag for the field catalog. */
  objectFieldsLoading?: boolean;
  /**
   * View catalog of the bound/source object. Drives the `view-ref` picker
   * so `interfaceConfig.sourceView` renders as a dropdown of the source
   * object's real views instead of a free-text name the author can typo.
   */
  objectViews?: Array<{ name: string; label?: string }>;
  /** Loading flag for the view catalog. */
  objectViewsLoading?: boolean;
  /**
   * Action catalog of the bound/source object. Drives the `action-multi`
   * picker so interface-page toolbar `buttons` reference the object's real
   * actions (ActionSchema) instead of free-text — correct-by-construction.
   */
  objectActions?: Array<{ name: string; label?: string; locations?: string[] }>;
  /** Loading flag for the action catalog. */
  objectActionsLoading?: boolean;
  /**
   * Per-value sub-schemas for the `dynamic-config` widget: a map from a parent
   * field's value (e.g. the chosen driver id) to the JSON-Schema describing the
   * config object for that value. Lets a single `config` field render different
   * fields depending on a sibling selection (driver → connection settings).
   */
  dynamicSchemas?: Record<string, { properties?: Record<string, any>; required?: string[] }>;
  /**
   * Component ids placed on the page being edited — extracted from the draft's
   * `regions[].components[]` tree (see {@link collectPageComponentIds}). Drives
   * the `ref:component` picker so a page variable's `source` (the component that
   * writes it) is chosen from the real components on the canvas instead of a
   * free-text id the author can typo.
   */
  componentIds?: Array<{ id: string; type?: string; label?: string }>;
}

export interface WidgetProps {
  /**
   * The host field id, handed down ONLY to a widget declared
   * `labelling: 'control'` in {@link WIDGET_LABELLING} — the host's
   * `<Label htmlFor>` points at it, so the widget must put it on the LABELABLE
   * element that is the field's primary control (objectui#4871).
   *
   * A `'group'` widget receives `undefined` here on purpose: `<label for>` is
   * inert on a container, and taking the id anyway would make the IDREF resolve
   * while still naming nobody — the cosmetic half-fix objectui#4010 refused.
   */
  id?: string;
  /**
   * The host label's own `id`, handed down ONLY to a widget declared
   * `labelling: 'group'`. The widget answers it with `aria-labelledby` on the
   * surface that IS the field (a `role="group"` / `role="radiogroup"`
   * container), which is the one naming channel that works on a non-labelable
   * element. `undefined` for `'control'` widgets — one label, one channel
   * (objectui#3978).
   */
  ariaLabelledBy?: string;
  schema: Record<string, any>;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
  context?: WidgetContext;
  /** Optional FormFieldSpec with type/options/reference/constraints */
  fieldSpec?: {
    field: string;
    type?: string;
    options?: Array<{ label: string; value: string; color?: string }>;
    reference?: string;
    maxLength?: number;
    minLength?: number;
    min?: number;
    max?: number;
    multiple?: boolean;
    dependsOn?: string | string[];  // NEW: field name(s) this widget depends on
    /** Sub-fields for `composite` / `repeater` types */
    fields?: Array<any>;
    /** Code editor language (for type=code) */
    language?: string;
    /** Form-level helpers passed through from FormField */
    label?: string;
    placeholder?: string;
    helpText?: string;
    widget?: string;
    colSpan?: number;
    immutable?: boolean;
    readonly?: boolean;
    required?: boolean;
  };
  /** All form data (for reading dependency values) */
  formData?: Record<string, unknown>;
}

export type WidgetRenderer = (props: WidgetProps) => React.ReactElement;

/* -------------------------------------------------------------------------- */
/* ref:object — pick an object by name                                        */
/* -------------------------------------------------------------------------- */

function RefObjectWidget({
  id,
  value,
  onChange,
  readOnly,
  context,
}: WidgetProps) {
  const locale = useMetadataLocale();
  const names = context?.objectNames ?? [];
  const v = value == null ? '' : String(value);
  if (context?.objectsLoading) {
    return (
      <Input
        id={id}
        value={v}
        disabled
        placeholder={t('engine.form.loadingObjects', locale)}
      />
    );
  }
  // If list is empty (e.g. no objects defined yet), fall back to a
  // freeform text input so the user can still type a value.
  if (names.length === 0) {
    return (
      <Input
        id={id}
        value={v}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={t('engine.form.noObjects', locale)}
      />
    );
  }
  return (
    <Select
      value={v}
      onValueChange={(next) => onChange(next || undefined)}
      disabled={readOnly}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={t('engine.form.selectObject', locale)} />
      </SelectTrigger>
      <SelectContent>
        {names.map((n) => (
          <SelectItem key={n} value={n}>
            {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* -------------------------------------------------------------------------- */
/* ref:component — pick a component id from the page's canvas tree             */
/* -------------------------------------------------------------------------- */

/**
 * Walk a page draft's `regions[].components[]` tree and collect every component
 * that carries an `id`, returning `{ id, type, label }` in document order (and
 * de-duplicated on id, first-wins). Traverses nested containers via any array-
 * valued `components` / `children` under a node or its `properties`, so ids
 * inside `page:tabs` / `page:section` style containers are surfaced too.
 *
 * Used to fuel the `ref:component` picker (a page variable's `source` names the
 * component that writes it). Exported for unit testing.
 */
export function collectPageComponentIds(
  draft: unknown,
): Array<{ id: string; type?: string; label?: string }> {
  const out: Array<{ id: string; type?: string; label?: string }> = [];
  const seen = new Set<string>();
  const visitNode = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    const id = rec.id;
    if (typeof id === 'string' && id && !seen.has(id)) {
      seen.add(id);
      out.push({
        id,
        type: typeof rec.type === 'string' ? rec.type : undefined,
        label: typeof rec.label === 'string' ? rec.label : undefined,
      });
    }
    // Recurse into nested component collections — directly on the node and
    // under `properties` (some container components nest children there).
    visitList(rec.components);
    visitList(rec.children);
    const props = rec.properties;
    if (props && typeof props === 'object') {
      visitList((props as Record<string, unknown>).components);
      visitList((props as Record<string, unknown>).children);
    }
  };
  const visitList = (list: unknown): void => {
    if (Array.isArray(list)) for (const n of list) visitNode(n);
  };
  if (draft && typeof draft === 'object') {
    const regions = (draft as Record<string, unknown>).regions;
    if (Array.isArray(regions)) {
      for (const region of regions) {
        if (region && typeof region === 'object') {
          visitList((region as Record<string, unknown>).components);
        }
      }
    }
  }
  return out;
}

/**
 * Single component-id picker for a page variable's `source` — the component
 * whose selection writes the variable (e.g. an `element:record_picker` with
 * `id="project_picker"`). Component ids come from `context.componentIds`
 * (extracted from the page draft's region/component tree). A stored value not
 * present in the tree is still shown so a stale/renamed id survives; when the
 * page has no components yet, degrades to a free-text input so the field stays
 * editable. Mirrors {@link RefObjectWidget} / {@link ViewRefWidget}.
 */
function RefComponentWidget({ id, value, onChange, readOnly, context }: WidgetProps) {
  const locale = useMetadataLocale();
  const components = context?.componentIds ?? [];
  const current = value == null ? '' : String(value);
  // No components placed yet → free-text fallback so the field is still usable.
  if (components.length === 0) {
    return (
      <Input
        id={id}
        value={current}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={t('engine.form.noComponents', locale)}
      />
    );
  }
  const inTree = !current || components.some((c) => c.id === current);
  return (
    <Select
      value={current || NO_FIELD}
      onValueChange={(v) => onChange(v === NO_FIELD ? undefined : v)}
      disabled={readOnly}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={t('engine.form.selectComponent', locale)} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_FIELD}>
          <span className="text-muted-foreground">{t('engine.form.none', locale)}</span>
        </SelectItem>
        {!inTree && current && (
          <SelectItem value={current}>
            <span className="flex items-center gap-2">
              <span className="font-mono">{current}</span>
              <span className="text-xs text-muted-foreground">{t('engine.form.notInObject', locale)}</span>
            </span>
          </SelectItem>
        )}
        {components.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              <span className="font-mono">{c.id}</span>
              {(c.label || c.type) && (
                <span className="text-xs text-muted-foreground">{c.label || c.type}</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* -------------------------------------------------------------------------- */
/* object-selector — multi-select object picker                               */
/* -------------------------------------------------------------------------- */

function ObjectSelectorWidget({
  id,
  value,
  onChange,
  readOnly,
  context,
  fieldSpec,
}: WidgetProps) {
  const locale = useMetadataLocale();
  const names = context?.objectNames ?? [];
  const multiple = fieldSpec?.multiple ?? false;
  
  // Parse value: string[], string (comma-separated), or empty
  const selectedValues = React.useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    return String(value).split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  const handleToggle = (objName: string) => {
    if (readOnly) return;
    
    if (!multiple) {
      onChange(objName);
      return;
    }

    const newSelection = selectedValues.includes(objName)
      ? selectedValues.filter(v => v !== objName)
      : [...selectedValues, objName];
    
    onChange(newSelection);
  };

  const handleRemove = (objName: string) => {
    if (readOnly) return;
    const newSelection = selectedValues.filter(v => v !== objName);
    onChange(multiple ? newSelection : '');
  };

  if (context?.objectsLoading) {
    return <Input id={id} value={t('engine.form.loadingObjects', locale)} readOnly disabled />;
  }

  return (
    <div className="space-y-2">
      {/* Selected items */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map(obj => (
            <div
              key={obj}
              className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-sm"
            >
              <span>{obj}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemove(obj)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Object picker */}
      <Select
        value=""
        onValueChange={handleToggle}
        disabled={readOnly || names.length === 0}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={multiple ? t('engine.form.addObjects', locale) : t('engine.form.selectObject', locale)} />
        </SelectTrigger>
        <SelectContent>
          {names.map(name => (
            <SelectItem key={name} value={name} disabled={!multiple && selectedValues.includes(name)}>
              {name}
              {selectedValues.includes(name) && ' ✓'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* field-selector — smart field picker (depends on selected object)          */
/* -------------------------------------------------------------------------- */

function FieldSelectorWidget({
  id,
  value,
  onChange,
  readOnly,
  fieldSpec,
  formData,
}: WidgetProps) {
  const locale = useMetadataLocale();
  const [fields, setFields] = React.useState<Array<{ name: string; label: string; type: string }>>([]);
  const [loading, setLoading] = React.useState(false);
  
  // Resolve dependency: fieldSpec.dependsOn or fieldSpec.reference or 'objectName'
  const dependsOnRaw = fieldSpec?.dependsOn || fieldSpec?.reference || 'objectName';
  const dependsOnField = Array.isArray(dependsOnRaw) ? dependsOnRaw[0] : dependsOnRaw;
  const objectName = formData?.[dependsOnField] as string | undefined;

  // Load fields when objectName changes
  React.useEffect(() => {
    if (!objectName) {
      setFields([]);
      return;
    }

    setLoading(true);
    fetch(`/api/v1/objects/${objectName}/fields`)
      .then(r => r.json())
      .then(data => {
        setFields(data.fields || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load fields:', err);
        setFields([]);
        setLoading(false);
      });
  }, [objectName]);

  const multiple = fieldSpec?.multiple ?? false;
  
  // Parse value
  const selectedValues = React.useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    return String(value).split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  const handleToggle = (fieldName: string) => {
    if (readOnly) return;
    
    if (!multiple) {
      onChange(fieldName);
      return;
    }

    const newSelection = selectedValues.includes(fieldName)
      ? selectedValues.filter(v => v !== fieldName)
      : [...selectedValues, fieldName];
    
    onChange(newSelection);
  };

  const handleRemove = (fieldName: string) => {
    if (readOnly) return;
    const newSelection = selectedValues.filter(v => v !== fieldName);
    onChange(multiple ? newSelection : '');
  };

  if (!objectName) {
    return <Input id={id} value={t('engine.form.selectObjectFirst', locale)} readOnly disabled />;
  }

  if (loading) {
    return <Input id={id} value={t('engine.form.loadingFields', locale)} readOnly disabled />;
  }

  return (
    <div className="space-y-2">
      {/* Selected fields */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map(field => {
            const fieldMeta = fields.find(f => f.name === field);
            return (
              <div
                key={field}
                className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-sm"
              >
                <span>{fieldMeta?.label || field}</span>
                <code className="text-xs text-muted-foreground">{fieldMeta?.type}</code>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemove(field)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Field picker */}
      <Select
        value=""
        onValueChange={handleToggle}
        disabled={readOnly || fields.length === 0}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={multiple ? t('engine.form.addFields', locale) : t('engine.form.selectField', locale)} />
        </SelectTrigger>
        <SelectContent>
          {fields.map(f => (
            <SelectItem key={f.name} value={f.name} disabled={!multiple && selectedValues.includes(f.name)}>
              <div className="flex items-center gap-2">
                <span>{f.label || f.name}</span>
                <code className="text-xs text-muted-foreground">{f.type}</code>
                {selectedValues.includes(f.name) && ' ✓'}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* master-detail — inline row editor for array-of-object fields               */
/* -------------------------------------------------------------------------- */

function MasterDetailWidget({
  schema,
  value,
  onChange,
  readOnly,
  context,
  ariaLabelledBy,
}: WidgetProps) {
  const locale = useMetadataLocale();
  // Unwrap anyOf/oneOf: pick the first array-of-object branch.
  let resolved = schema as Record<string, any> | undefined;
  if (resolved?.anyOf || resolved?.oneOf) {
    const branches = (resolved.anyOf ?? resolved.oneOf) as any[];
    const objBranch = branches.find(
      (b) => b?.type === 'array' && b?.items?.type === 'object',
    );
    if (objBranch) resolved = { ...resolved, ...objBranch };
  }
  const items = (resolved?.items ?? {}) as Record<string, any>;
  const itemProps = (items.properties ?? {}) as Record<string, any>;
  const required = new Set<string>(
    Array.isArray(items.required) ? items.required : [],
  );
  const rows = Array.isArray(value) ? (value as any[]) : [];
  const cols = Object.keys(itemProps);

  if (cols.length === 0) {
    // Falls back to JSON if the array items aren't a typed object.
    return (
      <div
        role="group"
        aria-labelledby={ariaLabelledBy}
        className="rounded border border-dashed border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300"
      >
        {t('engine.form.masterDetailSchemaError', locale)}
      </div>
    );
  }

  function updateRow(idx: number, patch: Record<string, unknown>) {
    const next = rows.slice();
    next[idx] = { ...(next[idx] ?? {}), ...patch };
    onChange(next);
  }
  function addRow() {
    onChange([...rows, {}]);
  }
  function removeRow(idx: number) {
    const next = rows.slice();
    next.splice(idx, 1);
    onChange(next);
  }

  return (
    // A table of per-cell inputs plus row actions — a composite, so the host's
    // visible label names this container by IDREF (objectui#4871). Same shape
    // and same reason as `grid`'s `labelling: 'group'` in packages/fields
    // (objectui#4857): no `<label for>` can reach a table.
    <div className="space-y-2" role="group" aria-labelledby={ariaLabelledBy}>
      <div className="overflow-x-auto rounded border border-border/40">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground"
                >
                  {(itemProps[c]?.title as string) ?? c}
                  {required.has(c) && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={cols.length + 1}
                  className="px-2 py-3 text-center text-xs text-muted-foreground"
                >
                  {t('engine.form.noRows', locale)}
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={idx} className="border-t border-border/30">
                {cols.map((c) => (
                  <td key={c} className="p-1">
                    <RowCell
                      schema={itemProps[c]}
                      value={(row ?? {})[c]}
                      readOnly={readOnly}
                      context={context}
                      onChange={(v) => updateRow(idx, { [c]: v })}
                    />
                  </td>
                ))}
                <td className="p-1 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(idx)}
                    disabled={readOnly}
                    className="h-7 w-7 p-0"
                    aria-label={t('engine.form.removeRow', locale)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        disabled={readOnly}
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> {t('engine.form.addRow', locale)}
      </Button>
    </div>
  );
}

function RowCell({
  schema,
  value,
  readOnly,
  context,
  onChange,
}: {
  schema: Record<string, any>;
  value: unknown;
  readOnly?: boolean;
  context?: WidgetContext;
  onChange: (v: unknown) => void;
}) {
  // ref:object hint inside a row cell
  if (schema?.widget === 'ref:object') {
    return (
      <RefObjectWidget
        schema={schema}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        context={context}
      />
    );
  }
  // ref:component hint inside a row cell (page variable `source` picker)
  if (schema?.widget === 'ref:component') {
    return (
      <RefComponentWidget
        schema={schema}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        context={context}
      />
    );
  }
  // enum → dropdown
  const enumVals = schema?.enum as unknown[] | undefined;
  if (Array.isArray(enumVals) && enumVals.length > 0) {
    return (
      <Select
        value={value == null ? '' : String(value)}
        onValueChange={(v) => onChange(v || undefined)}
        disabled={readOnly}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {enumVals.map((o) => (
            <SelectItem key={String(o)} value={String(o)}>
              {String(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  // boolean → checkbox-ish
  if (schema?.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    );
  }
  // number
  if (schema?.type === 'number' || schema?.type === 'integer') {
    return (
      <Input
        type="number"
        value={value == null ? '' : String(value)}
        disabled={readOnly}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className="h-8 text-xs"
      />
    );
  }
  // default: text
  return (
    <Input
      value={value == null ? '' : String(value)}
      disabled={readOnly}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="h-8 text-xs"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* string-tags — chip input for string[] (e.g. searchableFields)              */
/* -------------------------------------------------------------------------- */

function StringTagsWidget({
  id,
  value,
  onChange,
  readOnly,
}: WidgetProps) {
  const locale = useMetadataLocale();
  const tags = Array.isArray(value) ? (value as string[]) : [];
  const [draft, setDraft] = React.useState('');

  function add(raw: string) {
    const parts = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...tags];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft('');
  }
  function remove(idx: number) {
    const next = tags.slice();
    next.splice(idx, 1);
    onChange(next);
  }

  return (
    <div className="rounded border border-input bg-background p-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
          >
            <span className="font-mono">{t}</span>
            {!readOnly && (
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          disabled={readOnly}
          placeholder={tags.length === 0 ? t('engine.form.tagsPlaceholder', locale) : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
              remove(tags.length - 1);
            }
          }}
          onBlur={() => draft && add(draft)}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* multiselect — pick from a fixed option set (array of enum)                 */
/* -------------------------------------------------------------------------- */

/** "grid" → "Grid", "start_date" → "Start Date". */
function humanizeOption(v: string): string {
  return v
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Toggleable option set for `array<enum>` fields (e.g.
 * `appearance.allowedVisualizations`). Options come from the JSON Schema's
 * `items.enum` (or `fieldSpec.options`); the value is the selected subset
 * as a `string[]`, preserving the enum's declared order. Replaces the
 * free-text tag input the generic array renderer fell back to — the author
 * picks from the real allowed values instead of typing (and mistyping) them.
 */
function MultiSelectWidget({ value, onChange, readOnly, schema, fieldSpec, ariaLabelledBy }: WidgetProps) {
  // Prefer explicit form options; else the JSON Schema enum on the items.
  const options: Array<{ label: string; value: string }> = React.useMemo(() => {
    if (Array.isArray(fieldSpec?.options) && fieldSpec!.options!.length) {
      return fieldSpec!.options!.map((o) => ({ label: o.label, value: o.value }));
    }
    const enumVals: unknown =
      schema?.items?.enum ?? schema?.enum ?? [];
    return (Array.isArray(enumVals) ? enumVals : [])
      .filter((v): v is string => typeof v === 'string')
      .map((v) => ({ label: humanizeOption(v), value: v }));
  }, [fieldSpec, schema]);

  const selected = React.useMemo(
    () => (Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === 'string') : []),
    [value],
  );

  function toggle(opt: string) {
    if (readOnly) return;
    // Keep selection ordered by the option list so behaviour is stable
    // (e.g. allowedVisualizations[0] = the default/initial visualization).
    const set = new Set(selected);
    if (set.has(opt)) set.delete(opt);
    else set.add(opt);
    const next = options.map((o) => o.value).filter((v) => set.has(v));
    onChange(next.length ? next : undefined);
  }

  if (options.length === 0) {
    // No known option set — degrade to the comma-tag editor so the field
    // is still editable rather than rendering an empty box.
    //
    // The degradation stays INSIDE this widget's named group rather than
    // handing the tag editor the host id: the declaration
    // (`multiselect: 'group'`) is read by the host BEFORE the option list is
    // known, so a fallback that changed naming channel would be exactly the
    // runtime self-selection objectui#4871 removed from `color-picker`. The
    // group is named; the tag input inside it is a sub-control.
    return (
      <div role="group" aria-labelledby={ariaLabelledBy}>
        <StringTagsWidget value={value} onChange={onChange} readOnly={readOnly} schema={schema} fieldSpec={fieldSpec} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={ariaLabelledBy}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={on}
            disabled={readOnly}
            onClick={() => toggle(o.value)}
            className={
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ' +
              (on
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted') +
              (readOnly ? ' opacity-60 cursor-not-allowed' : '')
            }
          >
            <span
              aria-hidden
              className={
                'flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border text-[9px] leading-none ' +
                (on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')
              }
            >
              {on ? '✓' : ''}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* field-ref / field-multi — pick object field(s) from the bound object       */
/* -------------------------------------------------------------------------- */

const NO_FIELD = '__none__';

/**
 * Single object-field picker. Used for View config props that reference one
 * field by name (titleField, groupByField, startDateField, colorField,
 * xAxisField, …). Field list comes from `context.objectFields`; a value not
 * present in the catalog is still shown so stale/custom values survive.
 */
function FieldRefWidget({ id, value, onChange, readOnly, context }: WidgetProps) {
  const locale = useMetadataLocale();
  const fields = context?.objectFields ?? [];
  const current = value == null ? '' : String(value);
  const inCatalog = !current || fields.some((f) => f.name === current);
  return (
    <Select
      value={current || NO_FIELD}
      onValueChange={(v) => onChange(v === NO_FIELD ? '' : v)}
      disabled={readOnly}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={fields.length ? t('engine.form.selectField', locale) : t('engine.form.noObjectBound', locale)} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_FIELD}>
          <span className="text-muted-foreground">{t('engine.form.none', locale)}</span>
        </SelectItem>
        {!inCatalog && current && (
          <SelectItem value={current}>
            <span className="font-mono">{current}</span>
            <span className="ml-2 text-xs text-muted-foreground">{t('engine.form.notInObject', locale)}</span>
          </SelectItem>
        )}
        {fields.map((f) => (
          <SelectItem key={f.name} value={f.name}>
            <span className="flex items-center gap-2">
              <span>{f.label || f.name}</span>
              <code className="text-xs text-muted-foreground">{f.name}</code>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Resolve a stored `sourceView` value against a source object's view catalog,
 * mirroring the runtime resolver (InterfaceListPage.resolveSourceView): a value
 * resolves if it's an exact view name, a bare name matching a view's
 * `<object>.<name>` suffix, or the special `default`/`list` (→ object default
 * view). `showStored` is true when the stored value needs a synthesized option
 * (i.e. it isn't already an exact catalog entry). Exported for unit tests.
 */
export function resolveStoredViewRef(
  views: Array<{ name: string; label?: string }>,
  current: string,
): { exact?: { name: string; label?: string }; suffixMatch?: { name: string; label?: string }; isSpecial: boolean; resolves: boolean; showStored: boolean } {
  const exact = current ? views.find((v) => v.name === current) : undefined;
  const suffixMatch = current && !exact ? views.find((v) => v.name.endsWith(`.${current}`)) : undefined;
  const isSpecial = current === 'default' || current === 'list';
  return { exact, suffixMatch, isSpecial, resolves: !!exact || !!suffixMatch || isSpecial, showStored: !!current && !exact };
}

/**
 * Single view picker for `interfaceConfig.sourceView`. Views come from
 * `context.objectViews` (the source object's views, loaded from the object
 * named by the sibling `source` field). A value not present in the catalog is
 * still shown so stale/custom names survive; clearing to "None" omits the
 * field, which the protocol treats as the object's default view. Replaces the
 * free-text input where an author could type a non-existent view name.
 */
function ViewRefWidget({ id, value, onChange, readOnly, context }: WidgetProps) {
  const locale = useMetadataLocale();
  const views = context?.objectViews ?? [];
  const current = value == null ? '' : String(value);
  // Mirror the runtime resolver (InterfaceListPage.resolveSourceView): a stored
  // value resolves if it's an exact view name, OR a bare name matching a view's
  // `<object>.<name>` suffix, OR the special `default`/`list` (→ object default
  // view). Only a value that resolves to NOTHING gets the "(not in object)" tag —
  // so a working bare value like `default` is no longer mislabelled.
  const { suffixMatch, resolves, showStored } = resolveStoredViewRef(views, current);
  return (
    <Select
      value={current || NO_FIELD}
      onValueChange={(v) => onChange(v === NO_FIELD ? undefined : v)}
      disabled={readOnly}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={views.length ? t('engine.form.selectEllipsis', locale) : t('engine.form.noObjectBound', locale)} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_FIELD}>
          <span className="text-muted-foreground">{t('engine.form.none', locale)}</span>
        </SelectItem>
        {showStored && (
          <SelectItem value={current}>
            <span className="flex items-center gap-2">
              <span>{suffixMatch?.label || current}</span>
              <code className="text-xs text-muted-foreground">{suffixMatch ? `\u2192 ${suffixMatch.name}` : current}</code>
              {!resolves && (
                <span className="ml-1 text-xs text-muted-foreground">{t('engine.form.notInObject', locale)}</span>
              )}
            </span>
          </SelectItem>
        )}
        {views.map((v) => (
          <SelectItem key={v.name} value={v.name}>
            <span className="flex items-center gap-2">
              <span>{v.label || v.name}</span>
              <code className="text-xs text-muted-foreground">{v.name}</code>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Ordered multi object-field picker. Used for props that reference a list of
 * fields (kanban card `columns`, gallery `visibleFields`, chart
 * `yAxisFields`, `searchableFields`, …). Preserves order; supports reorder
 * and removal; values outside the catalog are retained.
 */
function FieldRefMultiWidget({ value, onChange, readOnly, context, ariaLabelledBy }: WidgetProps) {
  const locale = useMetadataLocale();
  const fields = context?.objectFields ?? [];
  const selected: string[] = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string' && value
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  const labelFor = (name: string) => fields.find((f) => f.name === name)?.label || name;
  const remaining = fields.filter((f) => !selected.includes(f.name));

  const add = (name: string) => {
    if (!selected.includes(name)) onChange([...selected, name]);
  };
  const removeAt = (i: number) => {
    const next = selected.slice();
    next.splice(i, 1);
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const next = selected.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    // An ORDERED SET, not a single control: reorder/remove buttons per chip plus
    // an auxiliary "add" picker. Measured for objectui#4871's ledger — the add
    // picker (the only element that ever carried the host id) is gated behind
    // `!readOnly`, so a `control` declaration was true in the editable state and
    // DANGLING in the read-only one. A declaration that is conditionally true is
    // the shape the #4871 ruling removed, so the whole set is the named surface.
    <div className="space-y-2" role="group" aria-labelledby={ariaLabelledBy}>
      {selected.length > 0 && (
        <div className="space-y-1">
          {selected.map((name, i) => (
            <div
              key={name}
              className="flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-sm"
            >
              <span className="flex-1 truncate">
                {labelFor(name)}
                <code className="ml-2 text-xs text-muted-foreground">{name}</code>
              </span>
              {!readOnly && (
                <>
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === selected.length - 1}
                    onClick={() => move(i, 1)}
                    className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => removeAt(i)}
                    className="px-1 text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <Select value="" onValueChange={add} disabled={remaining.length === 0}>
          {/* No host id here: the group above is the named surface, and an id
              on this auxiliary trigger would make the host's `for` resolve to
              "add a field" — a label click would open the picker rather than
              name the set (objectui#4871, the #4857 `grid` reading). */}
          <SelectTrigger aria-label={t('engine.form.addField', locale)}>
            <SelectValue
              placeholder={
                fields.length
                  ? remaining.length
                    ? t('engine.form.addField', locale)
                    : t('engine.form.allFieldsAdded', locale)
                  : t('engine.form.noObjectBound', locale)
              }
            />
          </SelectTrigger>
          <SelectContent>
            {remaining.map((f) => (
              <SelectItem key={f.name} value={f.name}>
                <span className="flex items-center gap-2">
                  <span>{f.label || f.name}</span>
                  <code className="text-xs text-muted-foreground">{f.name}</code>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* icon — searchable Lucide icon picker                                       */
/* -------------------------------------------------------------------------- */

// Lucide ships ~1500+ kebab-case icon names; freeze once for O(1) reuse.
const LUCIDE_ICON_NAMES: readonly string[] = iconNames as string[];
const LUCIDE_ICON_SET: Set<string> = new Set(LUCIDE_ICON_NAMES);
// Cap the rendered grid — each cell mounts a lazily-loaded icon, so showing all
// ~1500 at once would fire a flood of chunk requests. The search box narrows it.
const ICON_RESULT_LIMIT = 120;

/**
 * Searchable icon picker for `widget: 'icon'` string fields (page/app/object
 * `icon`). Replaces the raw text input where an author had to know and type a
 * Lucide name. The trigger shows a live preview of the current icon; opening it
 * reveals a search box + a grid of matching icons (preview + name). Selecting
 * writes the kebab-case name string.
 *
 * Out-of-catalog values survive: a name that isn't a Lucide icon (e.g. one from
 * another library, or a typo to be fixed later) is still shown on the trigger as
 * plain text (LazyIcon degrades to a fallback glyph) and is offered as the first
 * "keep" option so re-opening the picker never silently drops it.
 *
 * Built inline (no Radix portal) so the search + grid render eagerly — the same
 * jsdom-friendly choice the other pickers' tests rely on.
 */
export function IconPickerWidget({ id, value, onChange, readOnly }: WidgetProps) {
  const locale = useMetadataLocale();
  const current = value == null ? '' : String(value);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const currentKebab = current ? toKebabIconName(current) : '';
  const inCatalog = !current || LUCIDE_ICON_SET.has(currentKebab);

  const q = toKebabIconName(query.trim());
  const allMatches = React.useMemo(
    () => (q ? LUCIDE_ICON_NAMES.filter((n) => n.includes(q)) : LUCIDE_ICON_NAMES),
    [q],
  );
  const results = allMatches.slice(0, ICON_RESULT_LIMIT);
  const truncated = allMatches.length > results.length;

  const select = (name: string | undefined) => {
    onChange(name || undefined);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={readOnly}
        onClick={() => !readOnly && setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LazyIcon name={inCatalog ? current : undefined} className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={'flex-1 truncate ' + (current ? 'font-mono' : 'text-muted-foreground')}>
          {current || t('engine.form.selectEllipsis', locale)}
        </span>
        {!inCatalog && current && (
          <span className="shrink-0 text-xs text-muted-foreground">{t('engine.form.notInObject', locale)}</span>
        )}
        <ChevronsUpDown aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('engine.form.chooseIcon', locale)}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={query}
              aria-label={t('engine.form.searchIcons', locale)}
              placeholder={t('engine.form.searchIcons', locale)}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <div
            id={id ? `${id}-listbox` : undefined}
            role="listbox"
            className="grid max-h-[52vh] grid-cols-6 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-8"
          >
            {current && (
              <button
                type="button"
                role="option"
                aria-selected={false}
                title={t('engine.form.none', locale)}
                onClick={() => select(undefined)}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded border border-dashed border-border p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Trash2 className="h-4 w-4" />
                <span className="w-full truncate text-center text-[9px] leading-tight">none</span>
              </button>
            )}
            {!inCatalog && current && (
              <button
                type="button"
                role="option"
                aria-selected
                title={current}
                onClick={() => select(current)}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded bg-accent p-1 text-accent-foreground ring-1 ring-primary"
              >
                <LazyIcon name={undefined} className="h-4 w-4" />
                <span className="w-full truncate text-center text-[9px] leading-tight">{current}</span>
              </button>
            )}
            {results.map((name) => {
              const selected = name === currentKebab;
              return (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={name}
                  onClick={() => select(name)}
                  className={
                    'flex aspect-square flex-col items-center justify-center gap-1 rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground ' +
                    (selected ? 'bg-accent text-accent-foreground ring-1 ring-primary' : '')
                  }
                >
                  <LazyIcon name={name} className="h-5 w-5" />
                  <span className="w-full truncate text-center text-[9px] leading-tight">{name}</span>
                </button>
              );
            })}
            {results.length === 0 && (
              <p className="col-span-full px-2 py-6 text-center text-sm text-muted-foreground">
                {t('engine.form.noMatchingIcons', locale)}
              </p>
            )}
          </div>

          {truncated && (
            <p className="text-center text-xs text-muted-foreground">
              {tFormat('engine.form.iconsTruncated', locale, { shown: results.length, total: allMatches.length })}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* registry                                                                   */
/* -------------------------------------------------------------------------- */

// NOTE: The "airtable" / "object-fields-table" widgets used to live here.
// Removed in the Plan C refactor (see ADR-0014 §"Why not Airtable mode"):
// editing fields-as-columns can only honestly expose a tiny subset of the
// Field protocol. Record-typed metadata fields (including object.fields)
// now use the built-in `RecordField` engine in SchemaForm, which renders
// inline cards with the full per-entry sub-form derived from the protocol.

/* -------------------------------------------------------------------------- */
/* FilterModeWidget — ADR-0047 end-user filter element selector.              */
/*                                                                            */
/* Airtable-parity authoring control for `interfaceConfig.userFilters`. The   */
/* protocol stores "no filter bar" as ABSENCE of the field (omit-is-none),    */
/* not a literal `element: 'none'` — so this widget exposes None as a         */
/* first-class, selectable UI state that maps to `onChange(undefined)`,       */
/* keeping the metadata clean while giving authors the explicit tri/quad-     */
/* state selector they expect. Dropdown/Toggle modes edit the exposed fields  */
/* inline (matching Airtable's "Dropdowns: <fields>").                        */
/* -------------------------------------------------------------------------- */

// `toggle` remains a valid (deprecated) element in the protocol for
// back-compat, but is intentionally NOT offered as an authoring mode here:
// it overlaps tabs (presets) + dropdown (per-field values) without adding
// expressive power, needs per-field defaultValues to be useful, and the
// matching tool (Airtable) converged on None/Tabs/Dropdown. See ADR-0047 §3.4a.
type UFElement = 'dropdown' | 'tabs' | 'toggle';
type UFMode = 'dropdown' | 'tabs';
interface UFField { field: string; showCount?: boolean; label?: string; [k: string]: unknown }
interface UFRule { field: string; operator: string; value?: unknown }
interface UFTab { name: string; label: string; icon?: string; filter?: UFRule[]; isDefault?: boolean; [k: string]: unknown }
interface UFValue { element?: UFElement; fields?: UFField[]; tabs?: unknown[]; showAllRecords?: boolean; [k: string]: unknown }

const FILTER_MODES: Array<{ key: 'none' | UFMode; label: string }> = [
  { key: 'none', label: 'None' },
  { key: 'tabs', label: 'Tabs' },
  { key: 'dropdown', label: 'Dropdown' },
];

const slugifyTabName = (s: string): string =>
  (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'tab';

function FilterModeWidget({ value, onChange, readOnly, context, ariaLabelledBy }: WidgetProps) {
  const uf = (value && typeof value === 'object' ? value : undefined) as UFValue | undefined;
  const mode: 'none' | UFElement = uf?.element ?? (uf ? 'dropdown' : 'none');
  const objectFields = context?.objectFields ?? [];

  const setMode = (next: 'none' | UFMode) => {
    if (readOnly) return;
    if (next === 'none') { onChange(undefined); return; }       // omit-is-none
    onChange({ ...(uf ?? {}), element: next });
  };

  const fields: UFField[] = Array.isArray(uf?.fields) ? (uf!.fields as UFField[]) : [];
  const patchFields = (nextFields: UFField[]) =>
    onChange({ ...(uf ?? {}), element: mode === 'none' ? 'dropdown' : mode, fields: nextFields });

  const selected = new Set(fields.map((f) => f.field));
  const remaining = objectFields.filter((f) => !selected.has(f.name));
  const labelFor = (name: string) => objectFields.find((f) => f.name === name)?.label || name;

  // A deprecated `element: 'toggle'` config still lands here — render its
  // field picker too so it stays editable, even though Toggle isn't offered
  // as a new authoring choice.
  const isFieldMode = mode === 'dropdown' || mode === 'toggle';

  // ── Tabs preset editing (ADR-0053) ──────────────────────────────────────
  // Read any shape (canonical {name,filter} or legacy {id,filters}) into the
  // canonical editing model; writes always emit the canonical form so authoring
  // converges on one schema.
  const readTabs = (): UFTab[] => {
    const raw = Array.isArray(uf?.tabs) ? (uf!.tabs as any[]) : [];
    return raw.map((t) => ({
      ...t,
      name: t?.name ?? t?.id ?? '',
      label: typeof t?.label === 'string' ? t.label : (t?.name ?? t?.id ?? ''),
      filter: Array.isArray(t?.filter)
        ? t.filter
        : Array.isArray(t?.filters)
          ? t.filters
              .filter((r: any) => Array.isArray(r) && r.length >= 2)
              .map((r: any) => ({ field: String(r[0]), operator: String(r[1]), value: r[2] }))
          : [],
      isDefault: t?.isDefault ?? t?.default,
    }));
  };
  const tabs = readTabs();

  const canonicalTab = (t: UFTab): UFTab => {
    const out: UFTab = { name: slugifyTabName(t.label || t.name), label: t.label || t.name || 'Tab' };
    if (t.icon) out.icon = t.icon;
    out.filter = Array.isArray(t.filter) ? t.filter : [];
    if (t.isDefault) out.isDefault = true;
    return out;
  };
  const writeTabs = (next: UFTab[]) => {
    const seen: Record<string, true> = {};
    const canon = next.map(canonicalTab).map((o) => {
      let n = o.name;
      if (seen[n]) { let k = 2; while (seen[`${o.name}_${k}`]) k++; n = `${o.name}_${k}`; }
      seen[n] = true;
      return { ...o, name: n };
    });
    onChange({ ...(uf ?? {}), element: 'tabs', tabs: canon });
  };
  const addTab = () => writeTabs([...tabs, { name: '', label: `Tab ${tabs.length + 1}`, filter: [] }]);
  const removeTab = (ti: number) => writeTabs(tabs.filter((_, i) => i !== ti));
  const moveTab = (ti: number, dir: -1 | 1) => {
    const next = [...tabs];
    const j = ti + dir;
    if (j < 0 || j >= next.length) return;
    [next[ti], next[j]] = [next[j], next[ti]];
    writeTabs(next);
  };
  const patchTab = (ti: number, patch: Partial<UFTab>) =>
    writeTabs(tabs.map((t, i) => (i === ti ? { ...t, ...patch } : t)));
  const setShowAllRecords = (c: boolean) => onChange({ ...(uf ?? {}), element: 'tabs', showAllRecords: c });

  return (
    // The host's visible label names this whole editor (mode choice + the field
    // / tab pickers that follow), by IDREF — objectui#4871. The inner
    // radiogroup keeps its OWN name: it is a sub-choice ("which element"), not
    // the field, and the two names are about different things.
    <div className="space-y-3" role="group" aria-labelledby={ariaLabelledBy}>
      {/* Segmented mode selector */}
      <div className="inline-flex rounded-md border border-input bg-background p-0.5" role="radiogroup" aria-label="Filter element">
        {FILTER_MODES.map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`filter-mode-${m.key}`}
              disabled={readOnly}
              onClick={() => setMode(m.key)}
              className={
                'px-3 py-1 text-xs font-medium rounded transition-colors ' +
                (active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted')
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Field picker for dropdown / toggle modes */}
      {isFieldMode && (
        <div className="space-y-2" data-testid="filter-mode-fields">
          {fields.length > 0 && (
            <div className="space-y-1">
              {fields.map((f, i) => (
                <div key={f.field} className="flex items-center gap-2 rounded border border-input bg-background px-2 py-1 text-sm">
                  <span className="flex-1 truncate">
                    {labelFor(f.field)}
                    <code className="ml-2 text-xs text-muted-foreground">{f.field}</code>
                  </span>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Switch
                      checked={!!f.showCount}
                      disabled={readOnly}
                      onCheckedChange={(c) => patchFields(fields.map((x, j) => (j === i ? { ...x, showCount: c } : x)))}
                    />
                    count
                  </label>
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label="Remove field"
                      onClick={() => patchFields(fields.filter((_, j) => j !== i))}
                      className="px-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!readOnly && remaining.length > 0 && (
            <Select onValueChange={(name) => patchFields([...fields, { field: name }])}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-mode-add-field">
                <SelectValue placeholder="+ Add filter field…" />
              </SelectTrigger>
              <SelectContent>
                {remaining.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.label || f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {objectFields.length === 0 && (
            <p className="text-xs text-muted-foreground">Bind a source object to pick filter fields.</p>
          )}
        </div>
      )}

      {/* Visual tab-preset editor for tabs mode (ADR-0053). Each tab is a pure
          filter preset { name, label, icon?, filter:[{field,operator,value}] };
          it never switches the view form (that is the Visualizations axis). */}
      {mode === 'tabs' && (
        <div className="space-y-2" data-testid="filter-mode-tabs-editor">
          {tabs.map((tab, ti) => (
            <div key={ti} className="rounded-md border border-input bg-background p-2 space-y-2" data-testid={`tab-preset-${ti}`}>
              <div className="flex items-center gap-1.5">
                <Input
                  value={tab.label}
                  placeholder="Tab label"
                  disabled={readOnly}
                  className="h-8 text-sm flex-1"
                  data-testid={`tab-label-${ti}`}
                  onChange={(e) => patchTab(ti, { label: e.target.value })}
                />
                <code className="text-[10px] text-muted-foreground shrink-0 max-w-[6rem] truncate" title={tab.name}>{tab.name}</code>
                {!readOnly && (
                  <>
                    <button type="button" aria-label="Move tab up" disabled={ti === 0}
                      onClick={() => moveTab(ti, -1)}
                      className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label="Move tab down" disabled={ti === tabs.length - 1}
                      onClick={() => moveTab(ti, 1)}
                      className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label="Remove tab"
                      onClick={() => removeTab(ti)}
                      className="px-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Per-tab filter — unified runtime FilterBuilder (popover). */}
              <div className="pl-1" data-testid={`tab-${ti}-filter`}>
                <FilterBuilderField
                  value={tab.filter as FilterRuleLite[] | undefined}
                  onChange={(f) => patchTab(ti, { filter: f as any })}
                  fields={objectFields}
                  readOnly={readOnly}
                />
              </div>
            </div>
          ))}

          {!readOnly && (
            <button type="button" data-testid="filter-mode-add-tab" onClick={addTab}
              className="inline-flex items-center text-xs font-medium text-primary hover:underline">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add tab
            </button>
          )}

          <label className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <Switch
              checked={uf?.showAllRecords !== false}
              disabled={readOnly}
              data-testid="filter-mode-show-all"
              onCheckedChange={setShowAllRecords}
            />
            Show “All records” tab
          </label>

          {objectFields.length === 0 && (
            <p className="text-xs text-muted-foreground">Bind a source object to build tab filter rules.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* action-multi — pick toolbar buttons from the source object's actions       */
/*                                                                            */
/* Interface-page `buttons` are object Actions (ActionSchema), not free text. */
/* This makes "buttons = object actions" correct-by-construction (the picker  */
/* only offers actions the object actually defines).                          */
/* -------------------------------------------------------------------------- */
function ActionMultiWidget({ value, onChange, readOnly, context, ariaLabelledBy }: WidgetProps) {
  const actions = context?.objectActions ?? [];
  const selected: string[] = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string' && value
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  const labelFor = (name: string) => actions.find((a) => a.name === name)?.label || name;
  const remaining = actions.filter((a) => !selected.includes(a.name));

  const add = (name: string) => { if (!selected.includes(name)) onChange([...selected, name]); };
  const removeAt = (i: number) => { const next = selected.slice(); next.splice(i, 1); onChange(next); };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const next = selected.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    // Same ordered-set shape as {@link FieldRefMultiWidget}, and the same
    // measured reason for `labelling: 'group'` (objectui#4871): the add trigger
    // that used to carry the host id disappears in the read-only state.
    <div className="space-y-2" data-testid="action-multi" role="group" aria-labelledby={ariaLabelledBy}>
      {selected.length > 0 && (
        <div className="space-y-1">
          {selected.map((name, i) => (
            <div key={name} className="flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-sm">
              <span className="flex-1 truncate">
                {labelFor(name)}
                <code className="ml-2 text-xs text-muted-foreground">{name}</code>
              </span>
              {!readOnly && (
                <>
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30">↑</button>
                  <button type="button" aria-label="Move down" disabled={i === selected.length - 1} onClick={() => move(i, 1)} className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30">↓</button>
                  <button type="button" aria-label={`Remove ${name}`} onClick={() => removeAt(i)} className="px-1 text-muted-foreground hover:text-destructive">×</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <Select value="" onValueChange={add} disabled={remaining.length === 0}>
          {/* No host id — see {@link FieldRefMultiWidget}'s add trigger. */}
          <SelectTrigger data-testid="action-multi-add" aria-label="Add action button">
            <SelectValue placeholder={actions.length ? (remaining.length ? '+ Add action button…' : 'All actions added') : 'Bind a source object to pick actions'} />
          </SelectTrigger>
          <SelectContent>
            {remaining.map((a) => (
              <SelectItem key={a.name} value={a.name}>
                <span className="flex items-center gap-2">
                  <span>{a.label || a.name}</span>
                  <code className="text-xs text-muted-foreground">{a.name}</code>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* filter-builder — the SAME runtime FilterBuilder used by the list toolbar,   */
/* reused in Studio for view/tab filters and the page base filter (unified UX).*/
/* Stored format stays spec ViewFilterRule[] ({field,operator,value}). Writes  */
/* use the CANONICAL @objectstack/spec operator vocabulary (the enum enforced  */
/* by ViewFilterRuleSchema); reads also accept legacy shorthand/camelCase      */
/* spellings still present in already-stored view metadata (gt / eq / isNull). */
/* -------------------------------------------------------------------------- */
/* The WRITE direction (builder group → spec `ViewFilterRule[]`) now lives in  */
/* `../viewFilterFold`, shared with the runtime list toolbar — this file used  */
/* to hold the only copy, which is why the toolbar had none and PUT its raw    */
/* FilterGroup (objectstack#5159). Its local `FB_TO_SPEC` table went with it:  */
/* the shared fold normalizes through the spec's own                           */
/* `normalizeFilterOperator`, which covers the four builder operators this     */
/* table had drifted behind (startsWith / endsWith / isNull / isNotNull).      */
/** Spec operator → FilterBuilder camelCase. Keys cover both the canonical
 *  vocabulary and legacy spellings (shorthand + snake/camel) so stored view
 *  metadata written before canonicalization still seeds the builder. */
const SPEC_TO_FB: Record<string, string> = {
  equals: 'equals', eq: 'equals',
  not_equals: 'notEquals', ne: 'notEquals', neq: 'notEquals', notEquals: 'notEquals',
  contains: 'contains', not_contains: 'notContains', notContains: 'notContains',
  is_empty: 'isEmpty', isEmpty: 'isEmpty', is_not_empty: 'isNotEmpty', isNotEmpty: 'isNotEmpty',
  greater_than: 'greaterThan', gt: 'greaterThan', greaterThan: 'greaterThan',
  less_than: 'lessThan', lt: 'lessThan', lessThan: 'lessThan',
  greater_than_or_equal: 'greaterOrEqual', gte: 'greaterOrEqual', greaterOrEqual: 'greaterOrEqual',
  less_than_or_equal: 'lessOrEqual', lte: 'lessOrEqual', lessOrEqual: 'lessOrEqual',
  before: 'before', after: 'after', between: 'between',
  in: 'in', not_in: 'notIn', nin: 'notIn', notIn: 'notIn',
};

interface FilterRuleLite { field: string; operator: string; value?: unknown }

function FilterBuilderField({ value, onChange, fields, readOnly, id }: {
  value?: FilterRuleLite[];
  onChange: (rules: FilterRuleLite[]) => void;
  fields: Array<{ name: string; label?: string; type?: string }>;
  readOnly?: boolean;
  /**
   * Host field id, forwarded onto the trigger BUTTON — a labelable element, so
   * the host's `<label for>` reaches it (objectui#4871). Only the standalone
   * `filter-builder` widget passes one; the in-widget call site inside
   * {@link FilterModeWidget}'s tab editor is a sub-control of a group and
   * carries its own name instead.
   */
  id?: string;
}) {
  // The metadata-admin `t` above is a static engine-string table; refusal
  // copy lives in the shared console locale packs, so it resolves through the
  // platform translator (same one ObjectView's toolbar toasts use).
  const { t: tr } = useObjectTranslation();
  const rules = Array.isArray(value) ? value : [];
  const group = {
    id: 'g',
    logic: 'and' as const,
    conditions: rules.map((r, i) => ({
      id: `c${i}`,
      // Keep the raw operator verbatim if the builder has no camelCase
      // equivalent, so it round-trips on save instead of being rewritten.
      operator: SPEC_TO_FB[r.operator] ?? r.operator ?? 'equals',
      field: r.field,
      value: (r.value as any) ?? '',
    })),
  };
  const fbFields = fields.map((f) => ({ value: f.name, label: f.label || f.name, type: f.type }));
  const summary = rules.length
    ? rules.map((r) => `${fields.find((f) => f.name === r.field)?.label || r.field}`).filter(Boolean).join(', ')
    : '';
  const handle = (g: any) => {
    // Shared with the runtime list toolbar (objectstack#5159). A group that
    // cannot fold losslessly — `logic: 'or'` over several rows, or a nested
    // group — is refused rather than silently written as AND, which is what
    // this callback used to do by dropping `g.logic` on the floor.
    const folded = foldFilterGroupToSpecRules(g);
    if (!folded.ok) {
      toast.error(tr(FILTER_FOLD_REFUSAL_KEYS[folded.reason]));
      return;
    }
    onChange(folded.rules as FilterRuleLite[]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" size="sm" disabled={readOnly}
          className="h-8 w-full justify-between text-xs font-normal" data-testid="filter-builder-trigger">
          <span className="truncate text-left">{summary || <span className="text-muted-foreground">+ Add filter…</span>}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[440px] max-w-[90vw] p-3">
        {fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">Bind a source object to add filter conditions.</p>
        ) : (
          <FilterBuilder fields={fbFields} value={group as any} onChange={handle} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterBuilderWidget({ id, value, onChange, readOnly, context }: WidgetProps) {
  return (
    // The whole face is ONE labelable element — a popover trigger `<button>` —
    // so this stays on the plain `<label for>` channel and simply stops dropping
    // the id the host hands down (objectui#4871: measured DANGLING before).
    <FilterBuilderField
      id={id}
      value={value as FilterRuleLite[] | undefined}
      onChange={(rules) => onChange(rules.length ? rules : undefined)}
      fields={context?.objectFields ?? []}
      readOnly={readOnly}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* color-picker / color-input — TWO registrations, picked by the HOST         */
/* -------------------------------------------------------------------------- */

/**
 * The semantic palette a colour field declares, or an EMPTY array when it
 * declares none (objectui#4871).
 *
 * This is the split point of what used to be one `color-picker` widget with a
 * runtime `if`. Both the host — which must know, BEFORE it writes the label,
 * whether this field renders a `radiogroup` or a labelable input — and the
 * widgets themselves read the palette through this one function, so producer
 * and consumer cannot disagree about which surface will render. (Same discipline
 * `packages/components`' `resolveFieldLabelling` follows against
 * `renderFieldComponent`.)
 */
export function colorPaletteOptions(
  schema: Record<string, unknown> | undefined,
  fieldSpec: WidgetProps['fieldSpec'],
): Array<{ value: string; label?: string }> {
  if (Array.isArray(fieldSpec?.options) && fieldSpec!.options!.length) {
    return fieldSpec!.options!.map((o) => ({ value: o.value, label: o.label }));
  }
  if (Array.isArray(schema?.enum)) {
    return (schema!.enum as unknown[])
      .filter((v): v is string => typeof v === 'string')
      .map((v) => ({ value: v }));
  }
  return [];
}

/**
 * Which of the two colour registrations a field resolves to — `'color-picker'`
 * (a declared palette ⇒ swatch `radiogroup`) or `'color-input'` (free colour ⇒
 * native picker).
 *
 * The maintainer ruling of 2026-08-17 (objectui#4871, point 4) split the single
 * conditional registration precisely so this choice happens in the HOST, from
 * the schema, ahead of the label — passing both naming channels down for the
 * widget to pick at runtime would have re-introduced the inference the ruling
 * removes.
 */
export function resolveColorWidgetKey(
  schema: Record<string, unknown> | undefined,
  fieldSpec: WidgetProps['fieldSpec'],
): 'color-picker' | 'color-input' {
  return colorPaletteOptions(schema, fieldSpec).length > 0 ? 'color-picker' : 'color-input';
}

/**
 * `color-picker` — a declared palette, rendered as a swatch `radiogroup`.
 * `labelling: 'group'`: `role="radiogroup"` is a container, so the host's label
 * publishes an id and this surface answers it by IDREF (objectui#4010 named the
 * group; objectui#4871 is what finally removed the host's dangling `for`).
 */
function ColorSwatchGroupWidget({ value, onChange, readOnly, schema, fieldSpec, ariaLabelledBy }: WidgetProps) {
  // Exactly one naming channel, chosen by which one the caller can supply
  // (`ColorVariantPickerNaming` makes that a type-level XOR, objectui#4010):
  // `SchemaForm` publishes a label id and takes the IDREF arm; a caller that
  // renders this widget standalone — with no visible label in a position to
  // publish an id — falls to the self-owned name, kept equal to the visible
  // text wherever there is one (WCAG 2.5.3).
  const naming = ariaLabelledBy
    ? ({ ariaLabelledBy } as const)
    : ({
        ariaLabel:
          fieldSpec?.label ?? (typeof schema?.title === 'string' ? schema.title : undefined) ?? 'Color',
      } as const);
  return (
    <ColorVariantPicker
      {...naming}
      value={value == null ? undefined : String(value)}
      onChange={(v) => onChange(v)}
      disabled={readOnly}
      options={colorPaletteOptions(schema, fieldSpec)}
    />
  );
}

/**
 * `color-input` — free colour, rendered as the native picker plus a hex mirror.
 * `labelling: 'control'`: `input[type="color"]` IS a labelable element and is
 * the field's primary control, so it takes the host id and the plain
 * `<label for>` names it. The hex box beside it edits the same value and carries
 * its own name — before objectui#4871 it had none at all.
 */
function ColorInputWidget({ id, value, onChange, readOnly }: WidgetProps) {
  const locale = useMetadataLocale();
  const v = value == null ? '' : String(value);
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="color"
        value={/^#([0-9a-f]{6})$/i.test(v) ? v : '#000000'}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 shrink-0 rounded border border-input bg-background p-0.5 disabled:opacity-60"
        // No `aria-label` beside the host's `<label for>`: an `aria-label` WINS
        // the accessible-name computation, so keeping the old constant here
        // would have overridden the field's visible label with "Color" — one
        // label, two channels, the broken one louder (objectui#3978).
        aria-label={id ? undefined : 'Color'}
      />
      <Input
        value={v}
        placeholder="#RRGGBB"
        disabled={readOnly}
        aria-label={t('engine.form.colorHex', locale)}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-8 text-sm font-mono"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* condition — no-code CEL predicate builder (visible / hidden / disabled / …) */
/* -------------------------------------------------------------------------- */

/**
 * `SchemaForm` routes every predicate-named field here (`visible` / `hidden` /
 * `disabled` / `condition` / `predicate` / `*When`), and most of those are
 * `ExpressionInputSchema` in the spec — so the value arriving is usually the
 * ADR-0089 envelope, not a string. `String(value)` put a literal
 * `[object Object]` in the editor and the commit wrote a bare string back over
 * the envelope; both go through the shared read/write pair now (#3218). The
 * pair is shape-preserving, so the plain-`string` predicate fields this widget
 * also serves keep round-tripping as strings.
 */
function ConditionWidget({ value, onChange, readOnly, context, ariaLabelledBy }: WidgetProps) {
  return (
    // `ConditionBuilder` is a multi-control composite (field / operator / value
    // rows plus add-condition buttons) shared with the curated inspectors, so
    // the naming wrapper lives HERE — the widget owns the host contract, the
    // shared builder stays host-agnostic (objectui#4871).
    <div role="group" aria-labelledby={ariaLabelledBy}>
      <ConditionBuilder
        value={expressionSource(value)}
        onCommit={(cel) => onChange(writeExpressionSource(value, cel))}
        fields={context?.objectFields}
        disabled={readOnly}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* secret — write-only / masked credential input (encrypt-on-write fields)     */
/* -------------------------------------------------------------------------- */

/**
 * The ADR-0100 credential read mask: a stored secret reads back as this, never
 * plaintext.
 *
 * Renamed off the bare `SECRET_MASK` (objectui#4650). This is the SAME constant
 * `@objectstack/spec/data` exports under that name from 17.0.0 \u2014 the protocol
 * moved it to `spec` (objectstack#7572) precisely so the engine's field-read
 * path and the settings REST boundary stop each declaring a byte-identical
 * literal bound by nothing but convention. objectui should therefore IMPORT it
 * rather than declare it, which is what the #4043 doctrine asks for; that
 * import cannot be written yet because this repo is still pinned to
 * `^17.0.0-rc.6`, which does not export the name.
 *
 * So the copy stays for now, under a name that cannot be read as the spec's own
 * definition, and the whole burn-down is this one line: when #4636 / PR #4639
 * raises the pin, replace the literal with
 * `export { SECRET_MASK as OBJECTUI_SECRET_MASK } from '@objectstack/spec/data'`
 * (or re-export it plainly and drop this alias). Nothing outside this package
 * reads it \u2014 `@object-ui/app-shell`'s barrel does not re-export it \u2014 so that
 * swap is internal.
 *
 * The eight U+2022 BULLET characters are spelled out rather than computed, on
 * the spec's own reasoning: a plain grep for the mask a client actually received
 * has to find this declaration. Tripwire: `__tests__/spec-symbol-parity.test.ts`.
 */
export const OBJECTUI_SECRET_MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

/**
 * `secret` widget — a write-only credential input for `secret` field types (and
 * `format: 'password'` / `writeOnly` props). A stored secret reads back masked,
 * so the box starts empty with a "leave blank to keep" hint; typing replaces it,
 * a reveal toggle shows what you type, and Clear removes it. Emits the typed
 * value (new secret), `OBJECTUI_SECRET_MASK` (blank + existing = keep, a no-op on write),
 * `null` (Clear), or `undefined` (blank + none).
 */
function SecretWidget({ value, onChange, readOnly, schema, id }: WidgetProps) {
  const stored = value === OBJECTUI_SECRET_MASK;
  const [reveal, setReveal] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(stored || value == null ? '' : String(value));
  const update = (v: string) => {
    setDraft(v);
    if (v === '') onChange(stored ? OBJECTUI_SECRET_MASK : undefined); // blank: keep if stored, else unset
    else onChange(v);
  };
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type={reveal ? 'text' : 'password'}
        value={draft}
        disabled={readOnly}
        autoComplete="off"
        placeholder={stored ? (schema?.description ? '•••••••• set — type to replace' : '•••••••• set — leave blank to keep') : (typeof schema?.description === 'string' ? '' : 'Enter a value')}
        onChange={(e) => update(e.target.value)}
        className="h-8 text-sm font-mono"
        // Same single-channel rule as `color-input`'s picker (objectui#4871):
        // this widget declares `labelling: 'control'`, so when the host hands
        // down an `id` its `<label for>` is the naming channel — and an
        // `aria-label` here WINS the accessible-name computation, which had the
        // visible field label ("API Key", "Client Secret") replaced by the
        // constant "Secret value" on every SchemaForm render. Kept only for a
        // caller that renders this widget with no host label at all.
        aria-label={id ? undefined : 'Secret value'}
      />
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={readOnly} aria-label={reveal ? 'Hide value' : 'Reveal value'} onClick={() => setReveal((r) => !r)}>
        {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      {stored && (
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 text-destructive hover:text-destructive" disabled={readOnly} onClick={() => { setDraft(''); onChange(null); }}>
          Clear
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* dynamic-config — sub-form whose schema is chosen by a sibling field value   */
/* -------------------------------------------------------------------------- */

/**
 * `dynamic-config` widget — renders an object field whose shape depends on a
 * SIBLING field\'s value. `fieldSpec.dependsOn` names the parent field (e.g.
 * `driver`); `context.dynamicSchemas[<parentValue>]` supplies the JSON-Schema
 * for the config object. The canonical case is a datasource\'s `config` field
 * that changes fields per driver, but it is generic: any "pick X → these
 * settings" pattern can reuse it by populating `dynamicSchemas`.
 */
function DynamicConfigWidget({ value, onChange, readOnly, fieldSpec, formData, context, ariaLabelledBy }: WidgetProps) {
  const dep = Array.isArray(fieldSpec?.dependsOn) ? fieldSpec!.dependsOn![0] : fieldSpec?.dependsOn;
  const depVal = dep ? (formData?.[dep] as string | undefined) : undefined;
  const sub = depVal != null ? context?.dynamicSchemas?.[String(depVal)] : undefined;
  const props = (sub?.properties ?? {}) as Record<string, any>;
  const required = new Set<string>(sub?.required ?? []);
  const cfg = (value && typeof value === 'object' ? (value as Record<string, unknown>) : {}) as Record<string, unknown>;
  const setKey = (k: string, v: unknown) => {
    const next = { ...cfg };
    if (v === undefined || v === '') delete next[k]; else next[k] = v;
    onChange(next);
  };

  if (!depVal) {
    // Every branch answers the host's IDREF, so the field's visible label owns
    // this surface in each of its three states (objectui#4871) — a group named
    // in one state and anonymous in another is the conditional shape the #4871
    // ruling removed.
    return (
      <div role="group" aria-labelledby={ariaLabelledBy} className="text-xs text-muted-foreground">
        Select {dep ?? 'an option'} to configure.
      </div>
    );
  }
  if (!sub || Object.keys(props).length === 0) {
    return (
      <div role="group" aria-labelledby={ariaLabelledBy} className="text-xs text-muted-foreground">
        No configuration needed for "{String(depVal)}".
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3" role="group" aria-labelledby={ariaLabelledBy}>
      {Object.entries(props).map(([key, p]) => {
        const label = (p as any)?.title || key;
        const cur = cfg[key];
        const isReq = required.has(key);
        if ((p as any)?.type === 'boolean') {
          return (
            <div key={key} className="flex items-center justify-between gap-2">
              <Label className="text-xs">{label}</Label>
              {/* Sub-controls of a `labelling: 'group'` widget carry their OWN
                  names (objectui#4857's composite rule) — this one was the last
                  anonymous control inside the group. */}
              <Switch aria-label={label} checked={Boolean(cur)} disabled={readOnly} onCheckedChange={(c) => setKey(key, c)} />
            </div>
          );
        }
        if (Array.isArray((p as any)?.enum)) {
          return (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}{isReq ? ' *' : ''}</Label>
              <Select value={cur != null ? String(cur) : ''} onValueChange={(v) => setKey(key, v)} disabled={readOnly}>
                <SelectTrigger className="h-8" aria-label={label}><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {((p as any).enum as unknown[]).map((o) => <SelectItem key={String(o)} value={String(o)}>{String(o)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        }
        const isSecret = (p as any)?.format === 'password' || (p as any)?.writeOnly === true;
        const isNum = (p as any)?.type === 'number' || (p as any)?.type === 'integer';
        return (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}{isReq ? ' *' : ''}</Label>
            {isSecret ? (
              // Credential sub-field → reuse the masked/keep/reveal secret input
              // so a config password (e.g. postgres) behaves like any secret field.
              <SecretWidget value={cur} onChange={(v) => setKey(key, v)} readOnly={readOnly} schema={p as Record<string, any>} />
            ) : (
              <Input
                type={isNum ? 'number' : 'text'}
                value={cur != null ? String(cur) : ''}
                disabled={readOnly}
                aria-label={label}
                onChange={(e) => setKey(key, isNum ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
                className="h-8 text-sm"
              />
            )}
            {(p as any)?.description && <p className="text-[11px] text-muted-foreground">{(p as any).description}</p>}
          </div>
        );
      })}
    </div>
  );
}

// `satisfies` (not a `Record<string, …>` annotation) so the KEY SET survives as
// a literal union — that union is what makes `WIDGET_LABELLING` below exhaustive
// BY CONSTRUCTION: adding a widget here without deciding how the host's label
// reaches it is a compile error, not a silent fall-through to the dangling-`for`
// path (objectui#4871, the registry gate ruled jointly with objectui#4857).
export const WIDGETS = {
  'ref:object': RefObjectWidget,
  'ref:component': RefComponentWidget,
  'filter-mode': FilterModeWidget,
  'object-selector': ObjectSelectorWidget,
  'field-selector': FieldSelectorWidget,
  'field-ref': FieldRefWidget,
  'field-multi': FieldRefMultiWidget,
  'action-multi': ActionMultiWidget,
  'filter-builder': FilterBuilderWidget,
  'view-ref': ViewRefWidget,
  'icon': IconPickerWidget,
  'color-picker': ColorSwatchGroupWidget,
  'color-input': ColorInputWidget,
  'condition': ConditionWidget,
  'master-detail': MasterDetailWidget,
  'string-tags': StringTagsWidget,
  'multiselect': MultiSelectWidget,
  'code': CodeWidget,
  'secret': SecretWidget,
  'dynamic-config': DynamicConfigWidget,
} satisfies Record<string, WidgetRenderer>;

/** Every key of {@link WIDGETS}, as a literal union. */
export type RegisteredWidgetKey = keyof typeof WIDGETS;

/**
 * The labelling vocabulary this host implements, DERIVED from the repo-wide
 * declaration type rather than restated (`ComponentMeta['labelling']`,
 * objectui#3961 → #4857 → #4871's joint ruling: no host may keep a local
 * variant of it).
 *
 * `'display'` is excluded on a MEASURED basis, not an editorial one: every one
 * of this registry's widgets is an editable control or an editable composite —
 * none is the "pure display in every state" case `'display'` names, so this host
 * has no display CHANNEL to route one to. Excluding it here means adding such a
 * widget is a compile error at the declaration, pointing at the host that must
 * grow the `#4788` wrapper first — instead of a `'display'` declaration silently
 * degrading to the group channel and naming nothing (a widget declared
 * `'display'` spreads no props, so an `aria-labelledby` handed to it lands
 * nowhere). Deriving by `Exclude` keeps the vocabulary single-sourced: rename or
 * re-spell a member in `packages/core` and this stops compiling.
 */
export type WidgetLabelling = Exclude<NonNullable<ComponentMeta['labelling']>, 'display'>;

/**
 * How the HOST's visible label reaches each registered widget — the reviewed
 * table that replaced seventeen scattered per-widget judgements (objectui#4871,
 * maintainer ruling of 2026-08-17, point 1: ledger first, then declare).
 *
 * Measured on real `SchemaForm` renders at `167ec42e7`, both states, three
 * columns per widget: does the host `for` RESOLVE and to a LABELABLE element /
 * is the rendered face labelable at all / does the group have an accessible
 * name. The ledger is in the PR body; the three readings that decided a
 * classification are called out on the widgets themselves.
 *
 * ## `'control'` — the host's `<label for>` reaches a real labelable element
 *
 * The widget puts `id` on the ONE labelable element that is the field's primary
 * control, in EVERY branch it can render (loading, empty-catalog, read-only).
 * Auxiliary affordances beside it — a chip's remove button, a reveal toggle —
 * keep their own names; they are not what the field's label names. "In every
 * branch" is the load-bearing half: `field-multi` and `action-multi` look like
 * this in the editable state and were measured DANGLING in the read-only one,
 * which is why they are NOT here.
 *
 * ## `'group'` — no `<label for>` can reach it; the WIDGET answers by IDREF
 *
 * Two shapes, one declaration, exactly as `packages/fields`' own table splits
 * them (objectui#4857):
 *
 *  - real composites — `filter-mode` (mode radiogroup + field/tab pickers),
 *    `master-detail` (a table of per-cell inputs), `condition` (predicate rows),
 *    `dynamic-config` (a driver-shaped sub-form), `field-multi` / `action-multi`
 *    (an ordered set with reorder/remove buttons plus an auxiliary add picker);
 *  - single non-labelable surfaces — `color-picker`'s `div[role="radiogroup"]`,
 *    `multiselect`'s `div[role="group"]` of checkbox buttons, and `code`, whose
 *    only focusable is Monaco's internal textarea that this widget never renders.
 *
 * The host publishes its label's `id`, drops the `for` (inert on a container,
 * and a second broken channel beside a working one — objectui#3978/#4010), and
 * hands the id down as `ariaLabelledBy`; the widget puts it on the surface that
 * IS the field.
 */
export const WIDGET_LABELLING: Record<RegisteredWidgetKey, WidgetLabelling> = {
  'ref:object': 'control',
  'ref:component': 'control',
  'filter-mode': 'group',
  'object-selector': 'control',
  'field-selector': 'control',
  'field-ref': 'control',
  'field-multi': 'group',
  'action-multi': 'group',
  'filter-builder': 'control',
  'view-ref': 'control',
  'icon': 'control',
  'color-picker': 'group',
  'color-input': 'control',
  'condition': 'group',
  'master-detail': 'group',
  'string-tags': 'control',
  'multiselect': 'group',
  'code': 'group',
  'secret': 'control',
  'dynamic-config': 'group',
};

/**
 * The declared labelling of a widget key, for the host's channel decision.
 * An UNREGISTERED key (a passthrough hint, a third-party name) resolves to
 * `'control'` — byte for byte what `FieldRow` emitted before the
 * declaration existed.
 */
export function widgetLabelling(widget: string | undefined): WidgetLabelling {
  if (!widget) return 'control';
  return WIDGET_LABELLING[widget as RegisteredWidgetKey] ?? 'control';
}

/* -------------------------------------------------------------------------- */
/* CodeWidget — Monaco editor for `type: 'code'` fields                       */
/* -------------------------------------------------------------------------- */

/**
 * Infer language from fieldSpec.language → schema.format → field name.
 */
function inferCodeLanguage(fieldSpec?: WidgetProps['fieldSpec'], schema?: Record<string, any>): string {
  if (fieldSpec?.language) return fieldSpec.language;
  if (typeof schema?.format === 'string') {
    const f = schema.format.toLowerCase();
    if (f === 'sql' || f === 'javascript' || f === 'typescript' || f === 'json' || f === 'yaml' || f === 'html' || f === 'css' || f === 'python') return f;
  }
  // Common hook/action field name heuristics
  const name = fieldSpec?.field?.toLowerCase() ?? '';
  if (name.includes('sql') || name === 'query') return 'sql';
  if (name === 'source' || name === 'body' || name === 'script' || name === 'handler') return 'javascript';
  if (name === 'expression' || name === 'predicate' || name === 'formula' || name === 'condition') return 'javascript';
  return 'javascript';
}

const LazyCodeEditor = React.lazy(() =>
  import('@object-ui/plugin-editor').then((m) => ({ default: m.CodeEditorRenderer })),
);

export function CodeWidget({
  schema,
  value,
  onChange,
  readOnly,
  fieldSpec,
  ariaLabelledBy,
}: WidgetProps) {
  const language = inferCodeLanguage(fieldSpec, schema);
  const stringValue = typeof value === 'string' ? value : (value == null ? '' : String(value));
  return (
    // The editor's own focusable is Monaco's internal textarea — this widget
    // never renders it and cannot put the host id on it, so a `<label for>` can
    // never reach the editing surface. Named by IDREF instead (objectui#4871).
    <div className="rounded-md border border-border/50 overflow-hidden" role="group" aria-labelledby={ariaLabelledBy}>
      <div className="flex items-center justify-between px-2 py-1 bg-muted/40 border-b border-border/30 text-[10px] font-mono text-muted-foreground">
        <span>{language}</span>
        {readOnly && <span>read-only</span>}
      </div>
      <React.Suspense
        fallback={
          <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
            Loading editor…
          </div>
        }
      >
        <LazyCodeEditor
          schema={{
            type: 'code',
            language,
            theme: 'vs-dark',
            height: '280px',
            readOnly,
          }}
          value={stringValue}
          onChange={(v) => onChange(v ?? '')}
        />
      </React.Suspense>
    </div>
  );
}
