// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * SchemaForm — minimal JSONSchema-driven form (Phase 3c).
 *
 * The framework's `/meta/types` endpoint returns a `schema` field per
 * type, generated from Zod via `zod-to-json-schema`. We render that
 * schema as a form so admins can edit *any* metadata type without
 * the platform having to write a bespoke editor for each.
 *
 * Scope (MVP):
 *   • string  → Input (or Textarea if `format: 'multiline'`)
 *   • number  → Input type="number"
 *   • boolean → Switch
 *   • enum    → Select
 *   • array of strings → tag editor (comma-separated for MVP)
 *   • object  → recursive collapsed section
 *   • anyOf / oneOf / unknown → JSON textarea fallback
 *
 * NOT covered (yet) — those types use bespoke editors registered via
 * `registerMetadataResource()`:
 *   • Permission matrix (rows × columns × actions)
 *   • Object/Field designers
 *   • View / dashboard / page canvas designers
 *
 * Error display:
 *   • Pass `issues` in the shape `[{ path: 'a.b', message: '...' }, ...]`
 *     to render inline error chips next to the offending fields.
 *   • Matches the framework's `error.issues` envelope from `sendError`.
 */

import * as React from 'react';
import { Input } from '@object-ui/components';
import { Textarea } from '@object-ui/components';
import { Label } from '@object-ui/components';
import { Switch } from '@object-ui/components';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import { Button } from '@object-ui/components';
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@object-ui/components';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@object-ui/components';
import { evaluatePredicate } from './predicate';
import { WIDGETS, type WidgetContext } from './widgets';
import { detectLocale, t, tFormat, translateValidationMessage } from './i18n';

type JsonSchema = Record<string, any>;

/** Widgets that don't need a custom renderer — they overlay on the
 * existing default control (textarea/input/etc) and just act as a hint. */
const KNOWN_PASSTHROUGH_WIDGETS = new Set<string>([
  'text',
  'textarea',
  'number',
  'switch',
  'select',
  'json',
]);

/**
 * Pick the best-matching branch of a JSON Schema `oneOf` / `anyOf`
 * union for the given value. Scores each branch by how many of its
 * `required` keys are present in the value (and same `type`); falls
 * back to the first branch when nothing matches (so create-mode forms
 * with empty values still render *something* structured).
 *
 * Returns the original schema unchanged when there's no union to
 * resolve. Used by the recursive renderer so View `data` (provider
 * discriminator), `columns`, `sort`, etc. produce real labelled
 * inputs instead of a raw JSON blob.
 */
function resolveUnionBranch(
  schema: JsonSchema | undefined,
  value: unknown,
): JsonSchema | undefined {
  if (!schema) return schema;
  const branches = (schema.oneOf ?? schema.anyOf) as JsonSchema[] | undefined;
  if (!Array.isArray(branches) || branches.length === 0) return schema;

  const isPlainObj = value != null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const valKeys = isPlainObj ? new Set(Object.keys(value as Record<string, unknown>)) : null;

  let best: { branch: JsonSchema; score: number } | null = null;
  const firstItem = isArray && (value as unknown[]).length ? (value as unknown[])[0] : undefined;
  const firstItemIsObj = firstItem != null && typeof firstItem === 'object' && !Array.isArray(firstItem);
  for (const b of branches) {
    let score = 0;
    if (b.type === 'array' && isArray) {
      score += 5;
      // Tiebreaker for `anyOf [array<string>, array<object>]` etc — match the
      // branch's items.type against the actual element type.
      const itemType = (b.items as JsonSchema | undefined)?.type;
      if (itemType === 'object' && firstItemIsObj) score += 3;
      else if (
        (itemType === 'string' && typeof firstItem === 'string') ||
        (itemType === 'number' && typeof firstItem === 'number') ||
        (itemType === 'integer' && typeof firstItem === 'number')
      ) score += 3;
    }
    if (b.type === 'object' && isPlainObj) score += 5;
    if (b.type === 'string' && typeof value === 'string') score += 5;
    if (b.type === 'number' && typeof value === 'number') score += 5;
    if (b.type === 'boolean' && typeof value === 'boolean') score += 5;
    if (valKeys && Array.isArray(b.required)) {
      for (const r of b.required as string[]) {
        if (valKeys.has(r)) score += 1;
      }
    }
    if (!best || score > best.score) best = { branch: b, score };
  }
  // Merge the branch's shape on top of any parent metadata (title /
  // description) so the recursive renderer still sees the field's
  // documentation.
  const picked = best?.branch ?? branches[0];
  return {
    ...schema,
    ...picked,
    oneOf: undefined,
    anyOf: undefined,
  } as JsonSchema;
}

/**
 * Infer widget name from FormFieldSpec.type (Data.FieldType) and schema.
 * Priority: explicit widget > type-based inference > schema-based inference > default.
 */
function inferWidget(
  fieldSpec: FormFieldSpec | undefined,
  schema: JsonSchema | undefined,
): string | undefined {
  // 1. Explicit widget always wins
  if (fieldSpec?.widget) return fieldSpec.widget;

  // 2. Infer from Data.FieldType
  if (fieldSpec?.type) {
    const t = fieldSpec.type;
    // Text types
    if (t === 'text' || t === 'email' || t === 'url' || t === 'phone' || t === 'password') return 'text';
    if (t === 'textarea' || t === 'markdown' || t === 'html' || t === 'richtext') return 'textarea';
    
    // Number types
    if (t === 'number' || t === 'currency' || t === 'percent') return 'number';
    
    // Date/time
    if (t === 'date' || t === 'datetime' || t === 'time') return 'date-picker';
    
    // Boolean
    if (t === 'boolean' || t === 'toggle') return 'switch';
    
    // Selection
    if (t === 'select' || t === 'radio') return fieldSpec.multiple ? 'multiselect' : 'select';
    if (t === 'multiselect' || t === 'checkboxes' || t === 'tags') return 'string-tags';

    // Embedded structured (composite/repeater handled natively in FieldControl
    // BEFORE the WIDGETS registry — return the type name so the badge is
    // accurate; FieldControl short-circuits before widget lookup).
    if (t === 'composite') return 'composite';
    if (t === 'repeater') return 'repeater';
    if (t === 'record') return 'record';

    // Relational
    if (t === 'lookup' || t === 'master_detail') return 'ref-object';
    if (t === 'tree') return 'ref-object';
    
    // Media
    if (t === 'image' || t === 'file' || t === 'avatar' || t === 'video' || t === 'audio') return 'file-upload';
    
    // Code/JSON
    if (t === 'code') return 'code';
    if (t === 'json') return 'json';
    
    // Enhanced
    if (t === 'location' || t === 'address') return 'json';
    if (t === 'color') return 'color-picker';
    if (t === 'rating') return 'number';
    if (t === 'slider') return 'slider';
    if (t === 'signature') return 'signature';
    if (t === 'qrcode') return 'qrcode';
    if (t === 'progress') return 'number';
    
    // Calculated
    if (t === 'formula' || t === 'summary' || t === 'autonumber') return 'text';
    
    // Vector
    if (t === 'vector') return 'json';
  }

  // 3. Infer from JSON Schema
  if (schema) {
    const type = schema.type;
    
    // Array of enum → multi-select of the allowed values (picker, not free
    // text). Checked before the generic string-array case because a Zod
    // `z.enum` serialises as `items: { type: 'string', enum: [...] }`.
    if (type === 'array' && Array.isArray(schema.items?.enum)) return 'multiselect';

    // Array of strings → string-tags
    if (type === 'array' && schema.items?.type === 'string') return 'string-tags';
    
    // Array of objects → master-detail
    if (type === 'array' && schema.items?.type === 'object') return 'master-detail';
    
    // Object → object-fields
    if (type === 'object') return 'object-fields';
    
    // Boolean → switch
    if (type === 'boolean') return 'switch';
    
    // Number → number
    if (type === 'number' || type === 'integer') return 'number';
    
    // Enum → select
    if (Array.isArray(schema.enum)) return 'select';
    
    // String with format
    if (type === 'string') {
      if (schema.format === 'date' || schema.format === 'date-time') return 'date-picker';
      if (schema.format === 'email' || schema.format === 'uri' || schema.format === 'uri-reference') return 'text';
      if (schema.format === 'multiline') return 'textarea';
    }
  }

  // 4. Default fallback
  return undefined;
}

/**
 * Detect a field-reference widget by NAME CONVENTION, gated on having an
 * object field catalog in `widgetContext`. This is what makes every view
 * type's field-reference config (titleField, groupByField, startDateField,
 * xAxisField, visibleFields, yAxisFields, …) render as an object-field
 * picker instead of free text — without hardcoding per-type knowledge.
 *
 * Convention (spec props carry no `format:'field'` marker, so name + shape
 * is the pragmatic signal):
 *   • SINGLE (`field-ref`): a string prop named `*Field` (or bare `field`),
 *     excluding enum props (those are real selects).
 *   • MULTI  (`field-multi`): an array-of-strings prop named `*Fields`
 *     (or `columns` / `fieldOrder`).
 */
function detectFieldRefWidget(
  name: string,
  schema: JsonSchema | undefined,
  widgetContext?: WidgetContext,
): string | undefined {
  if (!widgetContext?.objectFields) return undefined;
  if (Array.isArray(schema?.enum)) return undefined;

  const isStringArray =
    schema?.type === 'array' &&
    (schema.items as JsonSchema | undefined)?.type === 'string';
  if (isStringArray && (/Fields$/.test(name) || name === 'columns' || name === 'fieldOrder')) {
    return 'field-multi';
  }

  const isString =
    schema?.type === 'string' ||
    (Array.isArray(schema?.anyOf) &&
      (schema!.anyOf as JsonSchema[]).some((b) => b?.type === 'string'));
  if (isString && (/.Field$/.test(name) || name === 'field')) {
    return 'field-ref';
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* FormView spec (subset)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Lightweight shape of the spec `FormView` we consume. We deliberately
 * accept `any` for forward compatibility — the spec evolves faster than
 * we want this admin engine to break.
 */
export interface FormViewSpec {
  type?: 'simple' | 'tabbed' | 'wizard' | 'split' | 'drawer' | 'modal';
  sections?: FormSectionSpec[];
}

export interface FormSectionSpec {
  label?: string;
  description?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  columns?: 1 | 2 | 3 | 4;
  visibleOn?: string | { dialect?: string; source: string };
  fields: Array<string | FormFieldSpec>;
}

export interface FormFieldSpec {
  field: string;
  
  // 🆕 Field type from Data.FieldType (auto-infers widget)
  type?: string;
  
  // 🆕 Field config from Data.Field
  options?: Array<{ label: string; value: string; color?: string }>;
  reference?: string;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
  precision?: number;
  scale?: number;
  multiple?: boolean;
  
  // UI overrides
  label?: string;
  placeholder?: string;
  helpText?: string;
  readonly?: boolean;
  /**
   * When true, the field is editable on create but locked once the
   * record exists (e.g. immutable `name` machine identifiers). Combined
   * with `SchemaFormProps.createMode` at render time.
   */
  immutable?: boolean;
  required?: boolean;
  hidden?: boolean;
  colSpan?: 1 | 2 | 3 | 4;
  widget?: string;
  /** For `type: 'code'` — syntax highlighting language (e.g. 'javascript', 'sql', 'json'). */
  language?: string;
  visibleOn?: string | { dialect?: string; source: string };
  /** Sub-fields for `composite` (single embedded object) and `repeater`
   * (array of embedded objects) types. Recursive. */
  fields?: Array<string | FormFieldSpec>;
}

export interface SchemaFormIssue {
  path: string;
  message: string;
}

export interface SchemaFormProps {
  /** JSONSchema for the root object. */
  schema: JsonSchema | undefined;
  /**
   * Optional FormView layout (sections, tabs, widget hints, visibleOn)
   * shipped by the framework alongside `schema`. When present, fields
   * are grouped into sections and visibility predicates are honoured.
   */
  form?: FormViewSpec;
  /** Current form value. */
  value: Record<string, unknown> | undefined;
  /** Called with the next full value on every change. */
  onChange: (next: Record<string, unknown>) => void;
  /** Inline validation errors, keyed by JSON path. */
  issues?: SchemaFormIssue[];
  /** Field keys to hide (still preserved on save). */
  hiddenFields?: string[];
  /** Preferred top-level field order. */
  fieldOrder?: string[];
  /** Disable all inputs (e.g. when env-var write lock is off). */
  readOnly?: boolean;
  /**
   * True when rendering the "new record" form (no existing item).
   * Used by per-field `immutable: true` flag to allow editing on
   * create but lock the value once the record exists.
   */
  createMode?: boolean;
  /** Out-of-band data widgets need (object list, etc). */
  widgetContext?: WidgetContext;
}

export function SchemaForm({
  schema,
  form,
  value,
  onChange,
  issues = [],
  hiddenFields = [],
  fieldOrder = [],
  readOnly = false,
  createMode = false,
  widgetContext,
}: SchemaFormProps) {
  // No schema → synthesize one from the value's top-level keys so the
  // form renderer can still produce a structured, labelled view (with
  // proper read-only semantics) instead of falling back to a raw JSON
  // dump. This handles metadata types the framework hasn't yet shipped
  // a Zod schema for (`hook`, `trigger`, `validation`, etc.).
  //
  // Editable + truly unknown shape → keep the raw JSON editor as a
  // last resort, since we can't safely guess primitive types for
  // fields the user might add.
  let effectiveSchema: JsonSchema | undefined = schema;
  if (!effectiveSchema || typeof effectiveSchema !== 'object') {
    if (value && typeof value === 'object') {
      effectiveSchema = inferSchemaFromValue(value as Record<string, unknown>);
    } else {
      return (
        <RawJsonEditor value={value} onChange={onChange} readOnly={readOnly} />
      );
    }
  }

  // Resolve top-level object properties.
  const props = (effectiveSchema.properties ?? {}) as Record<string, JsonSchema>;
  const required: string[] = Array.isArray(effectiveSchema.required) ? effectiveSchema.required : [];
  const keys = orderKeys(Object.keys(props), fieldOrder).filter(
    (k) => !hiddenFields.includes(k),
  );

  const issuesByPath = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    const locale = detectLocale();
    for (const i of issues) {
      (map[i.path] ??= []).push(translateValidationMessage(i.message, locale));
    }
    return map;
  }, [issues]);

  const v = value ?? {};

  function setField(key: string, fieldValue: unknown) {
    const next = { ...v, [key]: fieldValue };
    if (fieldValue === undefined || fieldValue === '') {
      delete (next as Record<string, unknown>)[key];
    }
    onChange(next);
  }

  // If the framework provided a FormView layout, render sections (tabbed
  // or simple). Otherwise fall through to the flat property list.
  //
  // Guard: when none of the fields declared by the layout actually exist
  // in the JSON schema (typically because the schema was reshaped under
  // a nested wrapper, e.g. `view` now bundles its props under
  // `list/form/listViews/formViews`), the layout would render a wall of
  // amber "missing from schema" warnings and nothing else. Detect that
  // total mismatch and fall through to the flat schema-driven
  // rendering so the user still gets a usable form.
  if (form?.sections?.length) {
    const declaredFields: string[] = [];
    for (const s of form.sections) {
      for (const f of s.fields) {
        declaredFields.push(typeof f === 'string' ? f : f.field);
      }
    }
    const matched = declaredFields.filter((f) => props[f]).length;
    const usable = declaredFields.length === 0 || matched > 0;
    if (usable) {
      return (
        <SectionedSchemaForm
          form={form}
          props={props}
          required={required}
          hiddenFields={hiddenFields}
          issuesByPath={issuesByPath}
          value={v as Record<string, unknown>}
          readOnly={readOnly}
          createMode={createMode}
          widgetContext={widgetContext}
          onChange={setField}
        />
      );
    }
    if (typeof console !== 'undefined') {
      console.warn(
        '[SchemaForm] form layout declares no fields that exist in the schema; ' +
          'falling back to flat schema-driven rendering. Declared:',
        declaredFields,
        'Available:',
        Object.keys(props),
      );
    }
  }

  return (
    <div className="space-y-4">
      {keys.map((key) => (
        <FieldRow
          key={key}
          name={key}
          schema={props[key]}
          value={(v as Record<string, unknown>)[key]}
          required={required.includes(key)}
          issues={issuesByPath[key]}
          readOnly={readOnly}
          widgetContext={widgetContext}
          formData={v as Record<string, unknown>}
          onChange={(val) => setField(key, val)}
        />
      ))}
    </div>
  );
}

/* ----- sectioned layout (FormView spec) ---------------------------------- */

function normaliseField(f: string | FormFieldSpec): FormFieldSpec {
  return typeof f === 'string' ? { field: f } : f;
}

function SectionedSchemaForm({
  form,
  props,
  required,
  hiddenFields,
  issuesByPath,
  value,
  readOnly,
  createMode,
  widgetContext,
  onChange,
}: {
  form: FormViewSpec;
  props: Record<string, JsonSchema>;
  required: string[];
  hiddenFields: string[];
  issuesByPath: Record<string, string[]>;
  value: Record<string, unknown>;
  readOnly?: boolean;
  createMode?: boolean;
  widgetContext?: WidgetContext;
  onChange: (key: string, val: unknown) => void;
}) {
  const sections = (form.sections ?? []).filter(
    (s) => !s.visibleOn || evaluatePredicate(s.visibleOn, { data: value }),
  );

  // Decide whether to render as tabs or stacked sections.
  const isTabbed = form.type === 'tabbed' && sections.length > 1;

  const renderSection = (s: FormSectionSpec, idx: number) => {
    const fields = s.fields
      .map(normaliseField)
      .filter((f) => {
        if (f.hidden) return false;
        if (hiddenFields.includes(f.field)) return false;
        if (f.visibleOn && !evaluatePredicate(f.visibleOn, { data: value })) {
          return false;
        }
        return true;
      });
    if (fields.length === 0) return null;
    const cols = s.columns ?? 1;
    const fieldsGrid = (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {fields.map((f) => {
            const propSchema = props[f.field];
            if (!propSchema) {
              return (
                <div
                  key={f.field}
                  className="rounded border border-dashed border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300"
                  style={{ gridColumn: `span ${f.colSpan ?? 1}` }}
                >
                  {tFormat('engine.form.missingField', detectLocale(), { field: f.field })}
                </div>
              );
            }
            return (
              <div
                key={f.field}
                style={{ gridColumn: `span ${f.colSpan ?? 1}` }}
              >
                <FieldRow
                  name={f.field}
                  schema={{
                    ...propSchema,
                    ...(f.label ? { title: f.label } : {}),
                    ...(f.helpText ? { description: f.helpText } : {}),
                    ...(f.placeholder ? { placeholder: f.placeholder } : {}),
                  }}
                  value={value[f.field]}
                  required={f.required ?? required.includes(f.field)}
                  issues={issuesByPath[f.field]}
                  readOnly={readOnly || f.readonly || (f.immutable && !createMode)}
                  fieldSpec={f}
                  widgetContext={widgetContext}
                  formData={value}
                  onChange={(val) => onChange(f.field, val)}
                />
              </div>
            );
          })}
        </div>
    );

    // Collapsible section (FormSectionSpec.collapsible) — the spec marks
    // rarely-used groups (Advanced, type-specific options) collapsible and
    // often `collapsed: true`. Honour both so the panel opens lean and the
    // author expands only what they need. Non-collapsible sections render
    // as a plain bordered block (unchanged).
    if (s.collapsible && s.label) {
      return (
        <Collapsible
          key={idx}
          defaultOpen={!s.collapsed}
          className="rounded-md border border-border/40 bg-card/30"
        >
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 p-4 text-left">
            <span>
              <span className="block text-sm font-semibold text-foreground/90">
                {s.label}
              </span>
              {s.description && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {s.description}
                </span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-4 pb-4">
            {fieldsGrid}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <section
        key={idx}
        className="space-y-3 rounded-md border border-border/40 bg-card/30 p-4"
      >
        {s.label && (
          <header>
            <h3 className="text-sm font-semibold text-foreground/90">
              {s.label}
            </h3>
            {s.description && (
              <p className="text-xs text-muted-foreground">{s.description}</p>
            )}
          </header>
        )}
        {fieldsGrid}
      </section>
    );
  };

  if (isTabbed) {
    const tabSections = sections.filter(
      (s) =>
        s.fields
          .map(normaliseField)
          .some(
            (f) =>
              !f.hidden &&
              !hiddenFields.includes(f.field) &&
              (!f.visibleOn ||
                evaluatePredicate(f.visibleOn, { data: value })),
          ),
    );
    if (tabSections.length === 0) return null;
    const defaultTab = (tabSections[0].label ?? 'section-0').toLowerCase();
    return (
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="flex flex-wrap gap-1">
          {tabSections.map((s, i) => (
            <TabsTrigger
              key={i}
              value={(s.label ?? `section-${i}`).toLowerCase()}
            >
              {s.label ?? `Section ${i + 1}`}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabSections.map((s, i) => (
          <TabsContent
            key={i}
            value={(s.label ?? `section-${i}`).toLowerCase()}
            className="mt-4"
          >
            {renderSection(s, i)}
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  return <div className="space-y-4">{sections.map(renderSection)}</div>;
}

/* ----- inner field row ---------------------------------------------------- */

function FieldRow({
  name,
  schema,
  value,
  required,
  issues,
  readOnly,
  fieldSpec,
  widgetContext,
  formData,
  onChange,
}: {
  name: string;
  schema: JsonSchema;
  value: unknown;
  required: boolean;
  issues?: string[];
  readOnly?: boolean;
  fieldSpec?: FormFieldSpec;
  widgetContext?: WidgetContext;
  formData?: Record<string, unknown>;
  onChange: (v: unknown) => void;
}) {
  const label = (fieldSpec?.label as string | undefined) || (schema?.title as string) || prettify(name);
  const description = (fieldSpec?.helpText as string | undefined) || (schema?.description as string | undefined);
  const id = `mdf-${name}`;

  // Auto-infer widget from fieldSpec.type or schema
  let widget = inferWidget(fieldSpec, schema);
  // Field-reference props become object-field pickers when a field catalog
  // is available and the spec didn't pin an explicit widget.
  if (!fieldSpec?.widget) {
    const refWidget = detectFieldRefWidget(name, schema, widgetContext);
    if (refWidget) widget = refWidget;
  }

  // Booleans with a schema default are never *missing* — don't show the
  // required asterisk (which would otherwise lie about user obligation).
  const isBoolean = schema?.type === 'boolean' || widget === 'switch';
  const hasDefault = schema?.default !== undefined;
  const showRequiredStar = required && !(isBoolean && hasDefault);

  // Only show the machine name when it materially differs from the
  // prettified label (e.g. `is_active` → "Is Active" matches, hide it;
  // `rls` → "Rls" doesn't, show it). Cuts ~50% of the visual noise.
  const labelMatchesName = prettify(name).toLowerCase() === label.toLowerCase();

  // Booleans render inline (label · description · switch) on one row to
  // save vertical space and feel like a real settings panel.
  if (isBoolean) {
    return (
      <div className="flex items-start justify-between gap-3 py-1.5">
        <div className="min-w-0 flex-1">
          <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
            {label}
            {showRequiredStar && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          {description && (
            <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
          )}
          {issues?.map((m, i) => (
            <div key={i} className="text-xs text-destructive mt-0.5">{m}</div>
          ))}
        </div>
        <FieldControl
          id={id}
          schema={schema}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          widget={widget}
          fieldSpec={fieldSpec}
          widgetContext={widgetContext}
          formData={formData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {showRequiredStar && <span className="text-destructive ml-0.5">*</span>}
          {!labelMatchesName && (
            <code
              className="ml-2 text-[10px] font-mono text-muted-foreground/70"
              title="Machine name"
            >
              {name}
            </code>
          )}
        </Label>
      </div>
      <FieldControl
        id={id}
        schema={schema}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        widget={widget}
        fieldSpec={fieldSpec}
        widgetContext={widgetContext}
        formData={formData}
      />
      {description && (
        <div className="text-xs text-muted-foreground">{description}</div>
      )}
      {issues?.map((m, i) => (
        <div key={i} className="text-xs text-destructive">
          {m}
        </div>
      ))}
    </div>
  );
}

function FieldControl({
  id,
  schema,
  value,
  onChange,
  readOnly,
  widget,
  fieldSpec,
  widgetContext,
  formData,
}: {
  id: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
  widget?: string;
  fieldSpec?: FormFieldSpec;
  widgetContext?: WidgetContext;
  formData?: Record<string, unknown>;
}) {
  const locale = detectLocale();
  // Composite/repeater are first-class structured types — render natively
  // with recursive FieldRow calls so all UI features (widgets, options,
  // visibility, readonly) work uniformly at every nesting level.
  // When `fields` is omitted, fall back to schema-derived sub-fields
  // (all schema.properties / items.properties) so authors don't have to
  // enumerate every sub-property by hand.
  if (fieldSpec?.type === 'composite') {
    const fields =
      fieldSpec.fields?.length
        ? fieldSpec.fields
        : derivePropertyNames(schema);
    return (
      <CompositeField
        value={value}
        fields={fields}
        schema={schema}
        readOnly={readOnly}
        widgetContext={widgetContext}
        onChange={onChange}
      />
    );
  }
  if (fieldSpec?.type === 'repeater') {
    const itemSchema = (schema?.items as JsonSchema | undefined) ?? {};
    const fields =
      fieldSpec.fields?.length
        ? fieldSpec.fields
        : derivePropertyNames(itemSchema);
    return (
      <RepeaterField
        value={value}
        fields={fields}
        schema={schema}
        readOnly={readOnly}
        widgetContext={widgetContext}
        widget={fieldSpec.widget}
        onChange={onChange}
      />
    );
  }
  if (fieldSpec?.type === 'record') {
    // Record<string, item> — name-keyed map. Insertion order is display
    // order. JSON Schema shape: { type:'object', additionalProperties: itemSchema }.
    const itemSchema = (schema?.additionalProperties as JsonSchema | undefined) ?? {};
    const fields =
      fieldSpec.fields?.length
        ? fieldSpec.fields
        : derivePropertyNames(itemSchema);
    return (
      <RecordField
        value={value}
        fields={fields}
        schema={schema}
        readOnly={readOnly}
        widgetContext={widgetContext}
        widget={fieldSpec.widget}
        keyField={(fieldSpec as any).keyField}
        formData={formData}
        onChange={onChange}
      />
    );
  }

  // Widget hint takes precedence: try the registry first, then the
  // passthrough hint list, then fall back to JSON with an inline hint.
  if (widget) {
    const Renderer = WIDGETS[widget];
    if (Renderer) {
      return (
        <Renderer
          id={id}
          schema={schema}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          context={widgetContext}
          fieldSpec={fieldSpec}
          formData={formData}
        />
      );
    }
    // Resolve discriminated unions (oneOf / anyOf) against the current
    // value so the recursive renderer below works on a concrete branch.
    // Without this, every union field (View `data`, `columns`, `sort`,
    // ...) falls through to a raw JSON editor.
    const effective = resolveUnionBranch(schema, value);

    // Nested object schema with a `properties` map: recurse into a
    // nested SchemaForm so the user gets real labelled inputs instead
    // of raw JSON. Covers the auto-inferred `object-fields` widget that
    // SchemaForm picks for every `type: 'object'` schema, and any custom
    // widget name that wasn't registered but still describes structured
    // data.
    if (
      effective?.type === 'object' &&
      effective.properties &&
      typeof effective.properties === 'object'
    ) {
      return (
        <div className="rounded-md border border-border/40 bg-card/30 p-3">
          <SchemaForm
            schema={effective}
            value={(value as Record<string, unknown>) ?? {}}
            onChange={(v) => onChange(v)}
            readOnly={readOnly}
            widgetContext={widgetContext}
          />
        </div>
      );
    }
    // Array-of-object schemas: route through RepeaterField so the user
    // gets per-row inputs rather than a JSON blob. Derive sub-field
    // names from items.properties (after union resolution).
    if (
      effective?.type === 'array' &&
      effective.items &&
      typeof effective.items === 'object'
    ) {
      const itemSchema = resolveUnionBranch(
        effective.items as JsonSchema,
        Array.isArray(value) && value.length ? value[0] : undefined,
      );
      if (
        itemSchema?.type === 'object' &&
        itemSchema.properties &&
        typeof itemSchema.properties === 'object'
      ) {
        return (
          <RepeaterField
            value={value}
            fields={derivePropertyNames(itemSchema)}
            schema={{ ...effective, items: itemSchema }}
            readOnly={readOnly}
            widgetContext={widgetContext}
            widget={fieldSpec?.widget}
            onChange={onChange}
          />
        );
      }
    }
    if (!KNOWN_PASSTHROUGH_WIDGETS.has(widget)) {
      return (
        <div className="space-y-1">
          <RawJsonEditor
            value={value as any}
            onChange={(v) => onChange(v)}
            readOnly={readOnly}
          />
          <div className="text-[10px] text-muted-foreground">
            {tFormat('engine.form.fallbackJson', locale, { widget })}
          </div>
        </div>
      );
    }
  }
  // For schemas authored as `anyOf` / `oneOf` (e.g. `width: anyOf[string,
  // number]`, `sort: anyOf[string, array<obj>]`), the outer schema's
  // `type` / `enum` are undefined and every primitive branch below would
  // miss, dropping us straight to RawJsonEditor. Resolve the union against
  // the current value once and use the resolved branch for type/enum
  // checks so primitive unions render as real inputs.
  const effective = resolveUnionBranch(schema, value) ?? schema;
  const effectiveType = effective?.type as string | undefined;
  // Enum / Select — fieldSpec.options takes precedence over schema.enum.
  const options = fieldSpec?.options;
  const enumValues = (effective?.enum as unknown[] | undefined) ?? undefined;
  
  if (Array.isArray(options) && options.length > 0) {
    // Render from fieldSpec.options (Data.SelectOption[])
    return (
      <Select
        value={value == null ? '' : String(value)}
        onValueChange={(v) => onChange(v)}
        disabled={readOnly}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={t('engine.form.selectEllipsis', locale)} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
              {opt.color && (
                <span
                  className="ml-2 inline-block h-3 w-3 rounded"
                  style={{ backgroundColor: opt.color }}
                />
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    // Fallback to schema.enum
    return (
      <Select
        value={value == null ? '' : String(value)}
        onValueChange={(v) => onChange(v)}
        disabled={readOnly}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={t('engine.form.selectEllipsis', locale)} />
        </SelectTrigger>
        <SelectContent>
          {enumValues.map((opt) => (
            <SelectItem key={String(opt)} value={String(opt)}>
              {String(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Boolean → Switch (no redundant "true/false" text; the toggle state
  // already conveys the value).
  //
  // We must also honor `widget === 'switch'` (resolved by inferWidget from
  // `fieldSpec.type === 'boolean'` / `'toggle'`), because for composite
  // sub-fields the JSON schema fragment is often `{}` — the parent declares
  // `additionalProperties: true` and no per-property `properties`, so
  // `schema?.type` is undefined even though the form spec clearly marks
  // the sub-field as boolean. Without this, capability toggles inside the
  // Object editor's "Capabilities" section fell through to RawJsonEditor
  // and rendered as empty textareas.
  if (effectiveType === 'boolean' || widget === 'switch' || fieldSpec?.type === 'boolean' || fieldSpec?.type === 'toggle') {
    return (
      <Switch
        id={id}
        checked={!!value}
        onCheckedChange={(c) => onChange(c)}
        disabled={readOnly}
      />
    );
  }

  // Number / integer → numeric input with min/max from fieldSpec.
  if (effectiveType === 'number' || effectiveType === 'integer') {
    const min = fieldSpec?.min;
    const max = fieldSpec?.max;
    return (
      <Input
        id={id}
        type="number"
        value={value == null ? '' : String(value)}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          const n = effectiveType === 'integer' ? parseInt(raw, 10) : Number(raw);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        readOnly={readOnly}
      />
    );
  }

  // String → Input (or Textarea if it looks long), with maxLength from fieldSpec.
  if (effectiveType === 'string') {
    const maxLength = fieldSpec?.maxLength;
    const long =
      effective?.format === 'multiline' ||
      effective?.contentMediaType === 'text/markdown' ||
      (typeof value === 'string' && value.length > 80);
    if (long) {
      return (
        <Textarea
          id={id}
          rows={4}
          value={(value as string | undefined) ?? ''}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value || undefined)}
          readOnly={readOnly}
        />
      );
    }
    return (
      <Input
        id={id}
        value={(value as string | undefined) ?? ''}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value || undefined)}
        readOnly={readOnly}
      />
    );
  }

  // Array of primitives → comma-separated tag editor (MVP).
  if (effectiveType === 'array') {
    const itemsSchema = (effective?.items as JsonSchema | undefined) ?? {};
    const isPrimitive =
      itemsSchema.type === 'string' ||
      itemsSchema.type === 'number' ||
      itemsSchema.type === 'integer';
    if (isPrimitive) {
      const arr = Array.isArray(value) ? (value as unknown[]) : [];
      return (
        <Input
          id={id}
          value={arr.map(String).join(', ')}
          placeholder={t('engine.form.arrayPlaceholder', locale)}
          onChange={(e) => {
            const raw = e.target.value;
            const parts = raw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            if (itemsSchema.type === 'number' || itemsSchema.type === 'integer') {
              onChange(parts.map((p) => Number(p)).filter((n) => Number.isFinite(n)));
            } else {
              onChange(parts);
            }
          }}
          readOnly={readOnly}
        />
      );
    }
  }

  // Structured fallback — try to recurse into a real nested form before
  // dropping to a raw JSON editor. Order matters:
  //   1. Resolve oneOf / anyOf against the value (discriminated unions
  //      like View `data.provider` or anyOf [array<string>, array<obj>]).
  //   2. type:'object' with properties → nested SchemaForm.
  //   3. type:'array' of objects → RepeaterField with per-row inputs.
  //   4. Last resort → JSON editor.
  {
    if (
      effective?.type === 'object' &&
      effective.properties &&
      typeof effective.properties === 'object'
    ) {
      return (
        <div className="rounded-md border border-border/40 bg-card/30 p-3">
          <SchemaForm
            schema={effective}
            value={(value as Record<string, unknown>) ?? {}}
            onChange={(v) => onChange(v)}
            readOnly={readOnly}
            widgetContext={widgetContext}
          />
        </div>
      );
    }
    if (
      effective?.type === 'array' &&
      effective.items &&
      typeof effective.items === 'object'
    ) {
      const itemSchema = resolveUnionBranch(
        effective.items as JsonSchema,
        Array.isArray(value) && value.length ? value[0] : undefined,
      );
      if (
        itemSchema?.type === 'object' &&
        itemSchema.properties &&
        typeof itemSchema.properties === 'object'
      ) {
        return (
          <RepeaterField
            value={value}
            fields={derivePropertyNames(itemSchema)}
            schema={{ ...effective, items: itemSchema }}
            readOnly={readOnly}
            widgetContext={widgetContext}
            widget={fieldSpec?.widget}
            onChange={onChange}
          />
        );
      }
    }
  }

  // Object / complex → JSON fallback so admins can still edit.
  return <RawJsonEditor value={value} onChange={onChange} readOnly={readOnly} small />;
}

/* ----- composite / repeater (embedded structured values) ----------------- */

/**
 * Resolve the JSONSchema fragment for a sub-field of a composite/repeater.
 * Looks under parent `schema.properties[subName]` (composite) or
 * `schema.items.properties[subName]` (repeater). Falls back to `{}`.
 */
function pickSubSchema(parent: JsonSchema | undefined, kind: 'composite' | 'repeater' | 'record', subName: string): JsonSchema {
  if (!parent) return {};
  let props: Record<string, JsonSchema> | undefined;
  if (kind === 'composite') {
    props = parent.properties as Record<string, JsonSchema> | undefined;
  } else if (kind === 'repeater') {
    props = (parent.items as JsonSchema | undefined)?.properties as Record<string, JsonSchema> | undefined;
  } else {
    // record: items live under additionalProperties.properties
    props = (parent.additionalProperties as JsonSchema | undefined)?.properties as Record<string, JsonSchema> | undefined;
  }
  return (props?.[subName] as JsonSchema) ?? {};
}

function CompositeField({
  value,
  fields,
  schema,
  readOnly,
  widgetContext,
  onChange,
}: {
  value: unknown;
  fields: Array<string | FormFieldSpec>;
  schema: JsonSchema;
  readOnly?: boolean;
  widgetContext?: WidgetContext;
  onChange: (v: unknown) => void;
}) {
  const obj = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : {};
  const specs = fields.map(normaliseField);
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-3">
      {specs.map((spec) => {
        const subSchema = pickSubSchema(schema, 'composite', spec.field);
        return (
          <FieldRow
            key={spec.field}
            name={spec.field}
            schema={subSchema}
            value={obj[spec.field]}
            required={Boolean(spec.required)}
            readOnly={readOnly || spec.readonly}
            fieldSpec={spec}
            widgetContext={widgetContext}
            formData={obj}
            onChange={(v) => onChange({ ...obj, [spec.field]: v })}
          />
        );
      })}
    </div>
  );
}

function RepeaterField({
  value,
  fields,
  schema,
  readOnly,
  widgetContext,
  widget,
  onChange,
}: {
  value: unknown;
  fields: Array<string | FormFieldSpec>;
  schema: JsonSchema;
  readOnly?: boolean;
  widgetContext?: WidgetContext;
  widget?: string;
  onChange: (v: unknown) => void;
}) {
  const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  const specs = fields.map(normaliseField);
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);

  // Default to card layout (one fieldset per row). `widget: 'grid'` opts
  // into compact inline-table layout for short, atomic sub-fields.
  const useGrid = widget === 'grid' || widget === 'table';

  const update = (i: number, patch: Record<string, unknown>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => {
    const blank: Record<string, unknown> = {};
    specs.forEach((s) => { blank[s.field] = undefined; });
    onChange([...rows, blank]);
    setOpenIdx(rows.length);
  };

  if (useGrid) {
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-md border border-border/50">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {specs.map((s) => (
                  <th key={s.field} className="px-2 py-1.5 text-left text-xs font-medium">
                    {s.label || prettify(s.field)}
                    {s.required && <span className="text-destructive ml-0.5">*</span>}
                  </th>
                ))}
                {!readOnly && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={specs.length + 1} className="px-2 py-3 text-center text-xs text-muted-foreground">
                  {t('engine.repeater.empty', detectLocale())}
                </td></tr>
              )}
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-border/30 align-top">
                  {specs.map((s) => {
                    const sub = pickSubSchema(schema, 'repeater', s.field);
                    return (
                      <td key={s.field} className="p-1.5">
                        <FieldControl
                          id={`rep-${idx}-${s.field}`}
                          schema={sub}
                          value={row?.[s.field]}
                          readOnly={readOnly || s.readonly}
                          widget={inferWidget(s, sub)}
                          fieldSpec={s}
                          widgetContext={widgetContext}
                          formData={row}
                          onChange={(v) => update(idx, { [s.field]: v })}
                        />
                      </td>
                    );
                  })}
                  {!readOnly && (
                    <td className="p-1.5 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)}
                        className="h-7 w-7 p-0" aria-label={t('engine.form.remove', detectLocale())}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('engine.form.add', detectLocale())}
          </Button>
        )}
      </div>
    );
  }

  // Card layout — one collapsible fieldset per row.
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="rounded-md border border-dashed border-border/50 px-3 py-4 text-center text-xs text-muted-foreground">
          {t('engine.list.empty', detectLocale())}
        </div>
      )}
      {rows.map((row, idx) => {
        const isOpen = openIdx === idx;
        const summary = specs
          .map((s) => row?.[s.field])
          .find((v) => v != null && v !== '');
        return (
          <div key={idx} className="rounded-md border border-border/50 bg-muted/10">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/30">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="flex items-center gap-1.5 text-sm font-medium text-left flex-1 min-w-0"
              >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span className="truncate">#{idx + 1}{summary != null ? ` — ${String(summary)}` : ''}</span>
              </button>
              {!readOnly && (
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)}
                  className="h-7 w-7 p-0" aria-label={t('engine.form.remove', detectLocale())}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {isOpen && (
              <div className="p-3 space-y-3">
                {specs.map((s) => {
                  const sub = pickSubSchema(schema, 'repeater', s.field);
                  return (
                    <FieldRow
                      key={s.field}
                      name={s.field}
                      schema={sub}
                      value={row?.[s.field]}
                      required={Boolean(s.required)}
                      readOnly={readOnly || s.readonly}
                      fieldSpec={s}
                      widgetContext={widgetContext}
                      formData={row}
                      onChange={(v) => update(idx, { [s.field]: v })}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {t('engine.form.addItem', detectLocale())}
        </Button>
      )}
    </div>
  );
}

/* ----- RecordField — Record<string, item> editor -------------------------- */

/**
 * Editor for `type: 'record'` form fields. The value is a name-keyed map
 * (`Record<string, item>`) where insertion order is display order.
 *
 * Layout:
 *  - If `widget` matches a renderer in WIDGETS, delegate to it (e.g.
 *    `widget: 'airtable'` → AirtableTableWidget). The widget receives the
 *    Record value directly and is responsible for emitting a Record back.
 *  - Otherwise, fall back to an inline card list with a key column +
 *    per-row sub-fields, similar to RepeaterField's card layout.
 *
 * The key is mirrored into the item as a property (default name: 'name')
 * so downstream consumers can treat each item as self-describing.
 *
 * See ADR-0007.
 */
function RecordField({
  value,
  fields,
  schema,
  readOnly,
  widgetContext,
  widget,
  keyField,
  formData,
  onChange,
}: {
  value: unknown;
  fields: Array<string | FormFieldSpec>;
  schema: JsonSchema;
  readOnly?: boolean;
  widgetContext?: WidgetContext;
  widget?: string;
  keyField?: {
    field?: string;
    label?: string;
    placeholder?: string;
    helpText?: string;
    regex?: string;
    immutable?: boolean;
  };
  formData?: Record<string, unknown>;
  onChange: (v: unknown) => void;
}) {
  const locale = detectLocale();
  // Delegate to a registered widget if the form spec asked for one
  // explicitly (e.g. `widget: 'airtable'`). The widget owns the entire UI.
  if (widget) {
    const Renderer = WIDGETS[widget];
    if (Renderer) {
      return (
        <Renderer
          schema={schema}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          context={widgetContext}
          fieldSpec={{ field: '', type: 'record', fields, widget } as any}
          formData={formData}
        />
      );
    }
  }

  // Inline fallback — card list with a key column + sub-fields.
  const keyProp = keyField?.field ?? 'name';
  const keyLabel = keyField?.label ?? prettify(keyProp);
  const keyRegex = keyField?.regex ? new RegExp(keyField.regex) : null;
  const keyImmutable = keyField?.immutable !== false; // default true
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, Record<string, unknown>>)
      : {};
  const entries = Object.entries(record);
  const specs = fields.map(normaliseField).filter((s) => s.field !== keyProp);
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [pendingKey, setPendingKey] = React.useState('');
  const [keyError, setKeyError] = React.useState<string | null>(null);

  const emit = (next: Record<string, Record<string, unknown>>) => onChange(next);

  const updateItem = (key: string, patch: Record<string, unknown>) => {
    const next: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of entries) {
      next[k] = k === key ? { ...v, ...patch } : v;
    }
    emit(next);
  };
  const removeItem = (key: string) => {
    const next: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of entries) {
      if (k !== key) next[k] = v;
    }
    emit(next);
  };
  const renameItem = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;
    if (record[newKey]) {
      setKeyError(tFormat('engine.form.keyExists', locale, { key: newKey }));
      return;
    }
    if (keyRegex && !keyRegex.test(newKey)) {
      setKeyError(tFormat('engine.form.keyPattern', locale, { pattern: String(keyRegex) }));
      return;
    }
    const next: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of entries) {
      if (k === oldKey) {
        next[newKey] = { ...v, [keyProp]: newKey };
      } else {
        next[k] = v;
      }
    }
    setKeyError(null);
    emit(next);
  };
  const addItem = () => {
    const trimmed = pendingKey.trim();
    if (!trimmed) {
      setKeyError(t('engine.form.keyRequired', locale));
      return;
    }
    if (record[trimmed]) {
      setKeyError(tFormat('engine.form.keyExists', locale, { key: trimmed }));
      return;
    }
    if (keyRegex && !keyRegex.test(trimmed)) {
      setKeyError(tFormat('engine.form.keyPattern', locale, { pattern: String(keyRegex) }));
      return;
    }
    const blank: Record<string, unknown> = { [keyProp]: trimmed };
    specs.forEach((s) => { blank[s.field] = undefined; });
    emit({ ...record, [trimmed]: blank });
    setPendingKey('');
    setKeyError(null);
    setOpenKey(trimmed);
  };

  // Drag-to-reorder. We rebuild the Record with the new key order, since
  // insertion order = display order for `type: 'record'`.
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const reorder = (sourceKey: string, targetKey: string) => {
    if (sourceKey === targetKey) return;
    const keys = entries.map(([k]) => k);
    const from = keys.indexOf(sourceKey);
    const to = keys.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    keys.splice(from, 1);
    keys.splice(to, 0, sourceKey);
    const next: Record<string, Record<string, unknown>> = {};
    for (const k of keys) next[k] = record[k];
    emit(next);
  };

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <div className="rounded-md border border-dashed border-border/50 px-3 py-4 text-center text-xs text-muted-foreground">
          {t('engine.list.empty', locale)}
        </div>
      )}
      {entries.map(([key, row]) => {
        const isOpen = openKey === key;
        const summary = specs
          .map((s) => row?.[s.field])
          .find((v) => v != null && v !== '');
        const isDropTarget = dropTarget === key && dragKey && dragKey !== key;
        return (
          <div
            key={key}
            className={`rounded-md border bg-muted/10 ${isDropTarget ? 'border-primary border-2' : 'border-border/50'}`}
            onDragOver={(e) => {
              if (!dragKey || readOnly) return;
              e.preventDefault();
              if (dropTarget !== key) setDropTarget(key);
            }}
            onDragLeave={() => {
              if (dropTarget === key) setDropTarget(null);
            }}
            onDrop={(e) => {
              if (!dragKey || readOnly) return;
              e.preventDefault();
              reorder(dragKey, key);
              setDragKey(null);
              setDropTarget(null);
            }}
          >
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/30">
              {!readOnly && (
                <span
                  draggable
                  onDragStart={(e) => {
                    setDragKey(key);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', key);
                  }}
                  onDragEnd={() => { setDragKey(null); setDropTarget(null); }}
                  className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                  aria-label={t('engine.form.dragToReorder', locale)}
                  title={t('engine.form.dragToReorder', locale)}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                className="flex items-center gap-1.5 text-sm font-medium text-left flex-1 min-w-0"
              >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted/60">{key}</span>
                {summary != null && <span className="truncate text-muted-foreground">— {String(summary)}</span>}
              </button>
              {!readOnly && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(key)}
                  className="h-7 w-7 p-0" aria-label={t('engine.form.remove', locale)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {isOpen && (
              <div className="p-3 space-y-3">
                <FieldRow
                  name={keyProp}
                  schema={{ type: 'string' }}
                  value={key}
                  required
                  readOnly={readOnly || keyImmutable}
                  fieldSpec={{ field: keyProp, type: 'text', label: keyLabel, helpText: keyField?.helpText }}
                  widgetContext={widgetContext}
                  formData={row}
                  onChange={(v) => renameItem(key, String(v ?? '').trim())}
                />
                {specs.map((s) => {
                  if (s.visibleOn && !evaluatePredicate(s.visibleOn, { data: row })) return null;
                  const sub = pickSubSchema(schema, 'record', s.field);
                  return (
                    <FieldRow
                      key={s.field}
                      name={s.field}
                      schema={sub}
                      value={row?.[s.field]}
                      required={Boolean(s.required)}
                      readOnly={readOnly || s.readonly}
                      fieldSpec={s}
                      widgetContext={widgetContext}
                      formData={row}
                      onChange={(v) => updateItem(key, { [s.field]: v })}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            value={pendingKey}
            onChange={(e) => { setPendingKey(e.target.value); if (keyError) setKeyError(null); }}
            placeholder={keyField?.placeholder ?? keyLabel}
            className="h-8 text-xs font-mono max-w-[220px]"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('engine.form.add', locale)}
          </Button>
          {keyError && <span className="text-xs text-destructive">{keyError}</span>}
        </div>
      )}
    </div>
  );
}


/* ----- raw JSON fallback -------------------------------------------------- */

function RawJsonEditor({
  value,
  onChange,
  readOnly,
  small,
}: {
  value: unknown;
  onChange: (v: any) => void;
  readOnly?: boolean;
  small?: boolean;
}) {
  const locale = detectLocale();
  const [text, setText] = React.useState<string>(() =>
    safeStringify(value),
  );
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync when external value changes (e.g. Reset Overlay).
  React.useEffect(() => {
    setText(safeStringify(value));
    setError(null);
  }, [JSON.stringify(value)]); // intentional: stringify-deep-equal

  return (
    <div className="space-y-1">
      <Textarea
        rows={small ? 4 : 12}
        className="font-mono text-xs"
        value={text}
        readOnly={readOnly}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (!next.trim()) {
            setError(null);
            onChange(undefined);
            return;
          }
          try {
            const parsed = JSON.parse(next);
            setError(null);
            onChange(parsed);
          } catch (err: any) {
            setError(err?.message ?? t('engine.form.invalidJson', locale));
          }
        }}
      />
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

/**
 * Synthesize a minimal JSON Schema by introspecting a runtime value.
 *
 * Used as the fallback when the framework hasn't shipped a Zod schema
 * for a metadata type (e.g. `hook`, `trigger`, `validation`). The
 * resulting schema lets `SchemaForm` render a real labelled form
 * (respecting `readOnly`) instead of bailing out to a raw JSON dump.
 *
 * Types are guessed conservatively from the value: scalars become
 * `string` / `number` / `boolean`; arrays of strings become string
 * tags; arrays of objects become master-detail tables; objects become
 * nested JSON regions. Anything indeterminate falls back to `string`
 * so the field still renders.
 */
function inferSchemaFromValue(value: Record<string, unknown>): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('_')) continue;
    if (v === null || v === undefined) {
      properties[k] = { type: 'string' };
    } else if (typeof v === 'string') {
      properties[k] = v.length > 80 || v.includes('\n')
        ? { type: 'string', format: 'multiline' }
        : { type: 'string' };
    } else if (typeof v === 'number') {
      properties[k] = { type: Number.isInteger(v) ? 'integer' : 'number' };
    } else if (typeof v === 'boolean') {
      properties[k] = { type: 'boolean' };
    } else if (Array.isArray(v)) {
      if (v.length > 0 && typeof v[0] === 'string') {
        properties[k] = { type: 'array', items: { type: 'string' } };
      } else if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
        const sample = v[0] as Record<string, unknown>;
        const itemProps: Record<string, JsonSchema> = {};
        for (const key of Object.keys(sample)) {
          itemProps[key] = { type: 'string' };
        }
        properties[k] = {
          type: 'array',
          items: { type: 'object', properties: itemProps },
        };
      } else {
        properties[k] = { type: 'array', items: { type: 'string' } };
      }
    } else if (typeof v === 'object') {
      properties[k] = { type: 'object', additionalProperties: true };
    } else {
      properties[k] = { type: 'string' };
    }
  }
  return { type: 'object', properties, additionalProperties: true };
}

/* ----- helpers ------------------------------------------------------------ */

function safeStringify(v: unknown): string {
  if (v === undefined) return '';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function prettify(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function orderKeys(keys: string[], preferred: string[]): string[] {
  if (!preferred.length) return keys;
  const set = new Set(keys);
  const head = preferred.filter((k) => set.has(k));
  const tail = keys.filter((k) => !preferred.includes(k));
  return [...head, ...tail];
}

/**
 * Derive a fields[] list for `composite` / `repeater` from a JSON schema.
 * Used when the form author hasn't explicitly enumerated sub-fields.
 */
function derivePropertyNames(schema: JsonSchema | undefined): string[] {
  const props = (schema?.properties ?? {}) as Record<string, unknown>;
  return Object.keys(props);
}
