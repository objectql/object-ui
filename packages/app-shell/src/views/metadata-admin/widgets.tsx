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
} from '@object-ui/components';
import { ChevronDown, ChevronsUpDown, ChevronUp, Plus, Search, Trash2 } from 'lucide-react';
// @ts-ignore - lucide-react has no `exports` field; subpath types live alongside dynamic.mjs
import { iconNames } from 'lucide-react/dynamic.mjs';
import { detectLocale, t } from './i18n';

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
}

export interface WidgetProps {
  id?: string;
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
  const locale = detectLocale();
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
  const locale = detectLocale();
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
          <SelectValue placeholder={multiple ? t('engine.form.addObjects', locale) : t('engine.form.selectObjectDots', locale)} />
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
  const locale = detectLocale();
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
          <SelectValue placeholder={multiple ? t('engine.form.addFields', locale) : t('engine.form.selectFieldDots', locale)} />
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
}: WidgetProps) {
  const locale = detectLocale();
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
      <div className="rounded border border-dashed border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
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
    <div className="space-y-2">
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
  const locale = detectLocale();
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
function MultiSelectWidget({ value, onChange, readOnly, schema, fieldSpec }: WidgetProps) {
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
    return <StringTagsWidget value={value} onChange={onChange} readOnly={readOnly} schema={schema} fieldSpec={fieldSpec} />;
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="group">
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
  const locale = detectLocale();
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
  const locale = detectLocale();
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
function FieldRefMultiWidget({ id, value, onChange, readOnly, context }: WidgetProps) {
  const locale = detectLocale();
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
    <div className="space-y-2">
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
          <SelectTrigger id={id}>
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
const ICON_RESULT_LIMIT = 60;

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
  const locale = detectLocale();
  const current = value == null ? '' : String(value);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement>(null);

  const currentKebab = current ? toKebabIconName(current) : '';
  const inCatalog = !current || LUCIDE_ICON_SET.has(currentKebab);

  // Close when focus/click leaves the widget.
  React.useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [open]);

  const results = React.useMemo(() => {
    const q = toKebabIconName(query.trim());
    const matches = q
      ? LUCIDE_ICON_NAMES.filter((n) => n.includes(q))
      : LUCIDE_ICON_NAMES;
    return matches.slice(0, ICON_RESULT_LIMIT);
  }, [query]);

  const select = (name: string) => {
    onChange(name || undefined);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left disabled:opacity-60 disabled:cursor-not-allowed"
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

      {open && !readOnly && (
        <div
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-md"
        >
          <div className="flex items-center gap-2 border-b border-border/50 px-2 pb-1.5">
            <Search aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={query}
              aria-label={t('engine.form.searchIcons', locale)}
              placeholder={t('engine.form.searchIcons', locale)}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent py-1 text-sm outline-none"
            />
          </div>
          <div className="mt-1 grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
            {/* Keep an unknown value reachable so re-opening never drops it. */}
            {!inCatalog && current && (
              <button
                type="button"
                role="option"
                aria-selected
                title={current}
                onClick={() => select(current)}
                className="col-span-6 flex items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
              >
                <LazyIcon name={undefined} className="h-4 w-4 shrink-0" />
                <span className="font-mono">{current}</span>
                <span className="ml-auto text-muted-foreground">{t('engine.form.keep', locale)}</span>
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
                  <LazyIcon name={name} className="h-4 w-4" />
                  <span className="w-full truncate text-center text-[9px] leading-tight">{name}</span>
                </button>
              );
            })}
            {results.length === 0 && (
              <p className="col-span-6 px-2 py-3 text-center text-xs text-muted-foreground">
                {t('engine.form.noMatchingIcons', locale)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
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

function FilterModeWidget({ value, onChange, readOnly, context }: WidgetProps) {
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
    <div className="space-y-3">
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
function ActionMultiWidget({ id, value, onChange, readOnly, context }: WidgetProps) {
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
    <div className="space-y-2" data-testid="action-multi">
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
          <SelectTrigger id={id} data-testid="action-multi-add">
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
/* reused in Studio for tab presets and the page base filter (unified UX).     */
/* Stored format stays spec ViewFilterRule[] ({field,operator,value}); the     */
/* builder's camelCase operators are mapped at the boundary so the runtime     */
/* (specOperatorToAst) keeps working unchanged.                                */
/* -------------------------------------------------------------------------- */
const FB_TO_SPEC: Record<string, string> = {
  equals: 'equals', notEquals: 'not_equals', contains: 'contains', notContains: 'not_contains',
  isEmpty: 'is_empty', isNotEmpty: 'is_not_empty', greaterThan: 'gt', lessThan: 'lt',
  greaterOrEqual: 'gte', lessOrEqual: 'lte', before: 'lt', after: 'gt', between: 'between',
  in: 'in', notIn: 'not_in',
};
const SPEC_TO_FB: Record<string, string> = {
  equals: 'equals', eq: 'equals', not_equals: 'notEquals', ne: 'notEquals', neq: 'notEquals',
  contains: 'contains', not_contains: 'notContains', is_empty: 'isEmpty', is_not_empty: 'isNotEmpty',
  gt: 'greaterThan', greater_than: 'greaterThan', lt: 'lessThan', less_than: 'lessThan',
  gte: 'greaterOrEqual', lte: 'lessOrEqual', in: 'in', not_in: 'notIn', nin: 'notIn',
};

interface FilterRuleLite { field: string; operator: string; value?: unknown }

function FilterBuilderField({ value, onChange, fields, readOnly }: {
  value?: FilterRuleLite[];
  onChange: (rules: FilterRuleLite[]) => void;
  fields: Array<{ name: string; label?: string; type?: string }>;
  readOnly?: boolean;
}) {
  const rules = Array.isArray(value) ? value : [];
  const group = {
    id: 'g',
    logic: 'and' as const,
    conditions: rules.map((r, i) => ({
      id: `c${i}`,
      field: r.field,
      operator: SPEC_TO_FB[r.operator] ?? r.operator ?? 'equals',
      value: (r.value as any) ?? '',
    })),
  };
  const fbFields = fields.map((f) => ({ value: f.name, label: f.label || f.name, type: f.type }));
  const summary = rules.length
    ? rules.map((r) => `${fields.find((f) => f.name === r.field)?.label || r.field}`).filter(Boolean).join(', ')
    : '';
  const handle = (g: any) => {
    const next = (g?.conditions ?? [])
      .filter((c: any) => c?.field)
      .map((c: any) => ({ field: c.field, operator: FB_TO_SPEC[c.operator] ?? c.operator, value: c.value }));
    onChange(next);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={readOnly}
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

function FilterBuilderWidget({ value, onChange, readOnly, context }: WidgetProps) {
  return (
    <FilterBuilderField
      value={value as FilterRuleLite[] | undefined}
      onChange={(rules) => onChange(rules.length ? rules : undefined)}
      fields={context?.objectFields ?? []}
      readOnly={readOnly}
    />
  );
}

export const WIDGETS: Record<string, WidgetRenderer> = {
  'ref:object': RefObjectWidget,
  'filter-mode': FilterModeWidget,
  'object-selector': ObjectSelectorWidget,
  'field-selector': FieldSelectorWidget,
  'field-ref': FieldRefWidget,
  'field-multi': FieldRefMultiWidget,
  'action-multi': ActionMultiWidget,
  'filter-builder': FilterBuilderWidget,
  'view-ref': ViewRefWidget,
  'icon': IconPickerWidget,
  'master-detail': MasterDetailWidget,
  'string-tags': StringTagsWidget,
  'multiselect': MultiSelectWidget,
  'code': CodeWidget,
};

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
}: WidgetProps) {
  const language = inferCodeLanguage(fieldSpec, schema);
  const stringValue = typeof value === 'string' ? value : (value == null ? '' : String(value));
  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
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
