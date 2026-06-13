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
} from '@object-ui/components';
import { Plus, Trash2 } from 'lucide-react';
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
interface UFValue { element?: UFElement; fields?: UFField[]; tabs?: unknown[]; showAllRecords?: boolean; [k: string]: unknown }

const FILTER_MODES: Array<{ key: 'none' | UFMode; label: string }> = [
  { key: 'none', label: 'None' },
  { key: 'tabs', label: 'Tabs' },
  { key: 'dropdown', label: 'Dropdown' },
];

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

      {mode === 'tabs' && (
        <p className="text-xs text-muted-foreground" data-testid="filter-mode-tabs-hint">
          Tab presets (name + filter rules) are edited in the source / JSON view.
        </p>
      )}
    </div>
  );
}

export const WIDGETS: Record<string, WidgetRenderer> = {
  'ref:object': RefObjectWidget,
  'filter-mode': FilterModeWidget,
  'object-selector': ObjectSelectorWidget,
  'field-selector': FieldSelectorWidget,
  'field-ref': FieldRefWidget,
  'field-multi': FieldRefMultiWidget,
  'master-detail': MasterDetailWidget,
  'string-tags': StringTagsWidget,
  'code': CodeWidget,
  // Reasonable fallbacks until dedicated builders ship:
  'filter-builder': MasterDetailWidget,
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
