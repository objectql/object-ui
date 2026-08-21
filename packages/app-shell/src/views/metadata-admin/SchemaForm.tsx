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
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Settings2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@object-ui/components';
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
import { evaluatePredicate } from './predicate.js';
import {
  WIDGETS,
  widgetLabelling,
  resolveColorWidgetKey,
  type RegisteredWidgetKey,
  type WidgetContext,
  type WidgetLabelling,
  type WidgetRenderer,
} from './widgets.js';
import { useMetadataLocale, t, tFormat, translateValidationMessage, translateEnumOption, translateSchemaFieldLabel, translateSchemaFieldHelp } from './i18n.js';

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
 * Resolve the row (item) schema for a `repeater` field. The repeater derives
 * its per-row sub-fields from `items.properties`, but the field's JSONSchema
 * may wrap the canonical array form in a union (`anyOf` / `oneOf`) — e.g. a
 * View `sort` (`anyOf: [ "field desc" string, {field,order}[] ]`, kept as a
 * union so the legacy bare-string form still validates). Reading
 * `schema.items` at the top level then misses the array branch nested inside
 * the union, leaving the repeater with zero sub-fields — a blank row with no
 * field picker or order dropdown (objectui#3379).
 *
 * Resolve the union to its ARRAY branch first (forcing an array value so the
 * score lands on that branch even before any row exists), then return its
 * `items`, itself union-resolved against the first existing row. A plain
 * array schema (no union) passes straight through unchanged.
 */
function repeaterItemSchema(
  schema: JsonSchema | undefined,
  value: unknown,
): JsonSchema {
  if (!schema) return {};
  const arrayBranch = resolveUnionBranch(
    schema,
    Array.isArray(value) ? value : [],
  );
  const items = arrayBranch?.items as JsonSchema | undefined;
  if (!items || typeof items !== 'object') return {};
  const firstRow = Array.isArray(value) && value.length ? value[0] : undefined;
  return (resolveUnionBranch(items, firstRow) ?? {}) as JsonSchema;
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
  // Tests WIRING, not contents: is a field catalog plumbed to this form at all?
  // Deliberately NOT a read of the catalog — under objectui#5228's union every
  // arm (`idle` / `loading` / `loaded` / `error`) answers yes, and it must, or a
  // FAILED catalog would silently demote the picker back to the free-text input
  // whose typos the picker exists to prevent. The picker itself renders the
  // failure. (Before the union this line read the same way for a different
  // reason: the array was `[]` on failure, and `[]` is truthy.)
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

/**
 * Detect the icon picker by NAME CONVENTION: a string prop named `icon` (or
 * `*Icon`) with no enum. Mirrors {@link detectFieldRefWidget} so every metadata
 * type's icon field renders the searchable Lucide picker instead of a free-text
 * input, without each spec `*.form.ts` having to pin `widget: 'icon'`.
 */
function detectIconWidget(name: string, schema: JsonSchema | undefined): string | undefined {
  if (Array.isArray(schema?.enum)) return undefined;
  const isString =
    schema?.type === 'string' ||
    (Array.isArray(schema?.anyOf) && (schema!.anyOf as JsonSchema[]).some((b) => b?.type === 'string'));
  if (!isString) return undefined;
  if (name === 'icon' || /Icon$/.test(name)) return 'icon';
  return undefined;
}

/**
 * Detect the color swatch picker by NAME CONVENTION: a string field named
 * `color`, `colorVariant`, or `*Color`. An enum gets the semantic swatch row;
 * a free string gets the native hex picker. Mirrors the icon/field-ref
 * conventions so color fields are consistent across every metadata type.
 */
function detectColorWidget(name: string, schema: JsonSchema | undefined): string | undefined {
  const isString =
    schema?.type === 'string' ||
    Array.isArray(schema?.enum) ||
    (Array.isArray(schema?.anyOf) && (schema!.anyOf as JsonSchema[]).some((b) => b?.type === 'string'));
  if (!isString) return undefined;
  if (name === 'color' || name === 'colorVariant' || /Color$/.test(name)) return 'color-picker';
  return undefined;
}

/**
 * Resolve a CONDITIONAL widget name to the concrete registration that will
 * render (objectui#4871, maintainer ruling point 4).
 *
 * `color-picker` used to be one registry entry that chose between a swatch
 * `radiogroup` and a labelable `input[type="color"]` at RUNTIME, from
 * `schema`/`fieldSpec` — i.e. AFTER `FieldRow` had already written
 * `<Label htmlFor>`, which is exactly why the host could not know which naming
 * channel to emit. The two surfaces are two registrations now, and this
 * function is where the host picks between them: from the schema, BEFORE the
 * label. `resolveColorWidgetKey` lives beside the widgets and is what both of
 * them read their palette through, so host and widget cannot disagree.
 *
 * Runs on the AUTHORED name too, not only the inferred one: a spec that pins
 * `widget: 'color-picker'` on a free-colour field must still land on the
 * registration that actually renders, or the declaration would describe a
 * different surface than the one on screen.
 */
function resolveRegisteredWidget(
  widget: string | undefined,
  schema: JsonSchema | undefined,
  fieldSpec: FormFieldSpec | undefined,
): string | undefined {
  if (widget === 'color-picker' || widget === 'color-input') {
    return resolveColorWidgetKey(schema, fieldSpec);
  }
  return widget;
}

/* ----- which face renders, resolved BEFORE the label (objectui#5039) ------- */

/**
 * The face {@link FieldControl} will render for a field — a closed set, so the
 * host can name it without rendering it first.
 */
export type FieldFace =
  /** `fieldSpec.type: 'composite'` → {@link CompositeField}. */
  | { kind: 'composite' }
  /** `fieldSpec.type: 'repeater'` → {@link RepeaterField}. */
  | { kind: 'repeater'; itemSchema: JsonSchema }
  /** `fieldSpec.type: 'record'` → {@link RecordField}. */
  | { kind: 'record'; itemSchema: JsonSchema }
  /** A key of {@link WIDGETS} — the face objectui#4871's declaration covers. */
  | { kind: 'registered'; widget: RegisteredWidgetKey }
  /** Object-with-properties → a recursive {@link SchemaForm} in a bordered box. */
  | { kind: 'nested-form'; effective: JsonSchema }
  /** Array-of-object → {@link RepeaterField} with per-row inputs. */
  | { kind: 'object-rows'; effective: JsonSchema; itemSchema: JsonSchema }
  /**
   * {@link RawJsonEditor}. `hint` is the unregistered widget name whose
   * fallback we are announcing; absent for the last-resort (`small`) editor.
   */
  | { kind: 'raw-json'; hint?: string }
  /** Every builtin branch: select / switch / number / input / tag input. */
  | { kind: 'scalar'; effective: JsonSchema };

/**
 * Resolve which face a field renders, from exactly the inputs `FieldControl`
 * renders from — no DOM, no render (objectui#5039).
 *
 * `FieldRow` must decide how its visible label reaches the control BEFORE it
 * writes that label. For the twenty REGISTERED widgets objectui#4871 answered
 * that from the registry's `labelling` declaration. Six paths never reach the
 * registry, so they had no declaration and took the default `control` channel:
 * `composite` / `repeater` / `record` come from `fieldSpec.type`, and the three
 * structural fallbacks (recursive `SchemaForm` / `RepeaterField` /
 * `RawJsonEditor`) were picked INSIDE `FieldControl` from the union-resolved
 * `effective` schema — i.e. after the label had already been written. None of the
 * six consumed the id, so all six emitted a `<label for>` aimed at an id no
 * element in the document carried (`for=DANGLING hostIdEl=NONE`, both states).
 *
 * This function is that late decision lifted out whole. `FieldRow` calls it
 * before the label; `FieldControl` calls it instead of deciding again — one
 * resolution, so the naming channel and the rendered DOM cannot drift apart.
 * Same shape as `resolveRegisteredWidget()`, applied to the paths that have no
 * registry entry to declare anything.
 *
 * Branch order mirrors `FieldControl` exactly, asymmetry included: with a widget
 * hint present the structural checks run BEFORE the scalar chain, and an
 * unregistered non-passthrough hint short-circuits to the JSON editor; with no
 * hint (or a passthrough one that matched no structure) the scalar chain runs
 * first.
 */
export function resolveFieldFace({
  fieldSpec,
  widget,
  schema,
  value,
}: {
  fieldSpec?: FormFieldSpec;
  widget?: string;
  schema?: JsonSchema;
  value?: unknown;
}): FieldFace {
  // 1. Spec-declared structured types — known from `fieldSpec.type` alone, and
  // short-circuited in `FieldControl` ahead of the registry lookup.
  if (fieldSpec?.type === 'composite') return { kind: 'composite' };
  if (fieldSpec?.type === 'repeater') {
    return { kind: 'repeater', itemSchema: repeaterItemSchema(schema, value) };
  }
  if (fieldSpec?.type === 'record') {
    return {
      kind: 'record',
      itemSchema: (schema?.additionalProperties as JsonSchema | undefined) ?? {},
    };
  }

  const effective = resolveUnionBranch(schema, value) ?? schema ?? {};
  const isObjectForm = (s: JsonSchema | undefined) =>
    s?.type === 'object' && !!s.properties && typeof s.properties === 'object';
  /** The row schema of an array-of-object face, or undefined if it isn't one. */
  const objectRowSchema = (s: JsonSchema | undefined): JsonSchema | undefined => {
    if (s?.type !== 'array' || !s.items || typeof s.items !== 'object') return undefined;
    const itemSchema = resolveUnionBranch(
      s.items as JsonSchema,
      Array.isArray(value) && value.length ? value[0] : undefined,
    );
    return isObjectForm(itemSchema) ? itemSchema : undefined;
  };

  // 2. A widget hint: the registry first, then the structural fallbacks, then
  // the announced JSON editor — the order of `FieldControl`'s `if (widget)` block.
  if (widget) {
    if (WIDGETS[widget as RegisteredWidgetKey]) {
      return { kind: 'registered', widget: widget as RegisteredWidgetKey };
    }
    if (isObjectForm(effective)) return { kind: 'nested-form', effective };
    const rows = objectRowSchema(effective);
    if (rows) return { kind: 'object-rows', effective, itemSchema: rows };
    if (!KNOWN_PASSTHROUGH_WIDGETS.has(widget)) return { kind: 'raw-json', hint: widget };
  }

  // 3. The builtin scalar chain. Each of these branches spreads the host id onto
  // its own labelable control, so they are all one face as far as naming goes.
  const effectiveType = effective?.type as string | undefined;
  const hasOptions = Array.isArray(fieldSpec?.options) && fieldSpec.options.length > 0;
  const hasEnum = Array.isArray(effective?.enum) && (effective.enum as unknown[]).length > 0;
  if (
    hasOptions ||
    hasEnum ||
    effectiveType === 'boolean' ||
    widget === 'switch' ||
    fieldSpec?.type === 'boolean' ||
    fieldSpec?.type === 'toggle' ||
    effectiveType === 'number' ||
    effectiveType === 'integer' ||
    effectiveType === 'string'
  ) {
    return { kind: 'scalar', effective };
  }
  if (effectiveType === 'array') {
    const itemsSchema = (effective?.items as JsonSchema | undefined) ?? {};
    if (
      itemsSchema.type === 'string' ||
      itemsSchema.type === 'number' ||
      itemsSchema.type === 'integer'
    ) {
      return { kind: 'scalar', effective };
    }
  }

  // 4. Structured fallback, then the last-resort JSON editor.
  if (isObjectForm(effective)) return { kind: 'nested-form', effective };
  const rows = objectRowSchema(effective);
  if (rows) return { kind: 'object-rows', effective, itemSchema: rows };
  return { kind: 'raw-json' };
}

/**
 * The naming channel each face needs — what `WIDGET_LABELLING` does for the
 * registry, for the paths that have no registry entry. Decided on the same
 * MEASURED basis (objectui#5039's ledger: real `SchemaForm` renders, both
 * states, does the `for` resolve and to a labelable element / what does the face
 * actually own).
 *
 * `'group'` — five of the six. `composite` and the recursive `nested-form` are
 * containers of independently labelled sub-rows: every labelable element inside
 * them is addressed by a SUB-field's own label, so the outer `for` had nothing of
 * its own to point at. `repeater` / `object-rows` / `record` own nothing but
 * auxiliary buttons — collapse, add, remove — in the editable state, and just the
 * collapse toggles when read-only. All five take the objectui#4788 container
 * shape: the label publishes its id, the container answers `aria-labelledby` on
 * a `role="group"`, and the `for` is dropped rather than left pointing at a
 * container it can neither activate nor name (objectui#3978/#4010).
 *
 * `'control'` — `raw-json`, MEASURED rather than assumed (objectui#5039 named
 * this the reading to confirm). `RawJsonEditor`'s face is exactly ONE labelable
 * element, a `<textarea>` no other label addresses, in every branch and both
 * states — `readOnly` only sets the attribute. Its `hostIdEl=NONE` reading was
 * the id never being PLUMBED to it, not a face that cannot hold one. Naming a
 * wrapper `role="group"` around a lone textarea instead would name the container
 * and leave the control the user actually types in anonymous, which is
 * objectui#4010's ruling in reverse. So the id reaches the textarea and the plain
 * `<label for>` channel is what this face gets.
 *
 * `'registered'` defers to the widget's own declaration — this function must not
 * second-guess objectui#4871's reviewed table. `'scalar'` is every builtin
 * branch, each of which already spreads the host id onto its own control.
 */
export function faceLabelling(face: FieldFace): WidgetLabelling {
  switch (face.kind) {
    case 'registered':
      return widgetLabelling(face.widget);
    case 'composite':
    case 'repeater':
    case 'record':
    case 'nested-form':
    case 'object-rows':
      return 'group';
    case 'raw-json':
    case 'scalar':
      return 'control';
  }
}

const CONDITION_FIELD_NAMES = new Set(['visible', 'hidden', 'disabled', 'visibleOn', 'condition', 'predicate']);
/**
 * Detect a CEL predicate field by NAME CONVENTION (`visible` / `hidden` /
 * `disabled` / `visibleOn` / `condition` / `*When`) so it renders the no-code
 * condition builder instead of a raw expression text box. String-only, no enum.
 */
function detectConditionWidget(name: string, schema: JsonSchema | undefined): string | undefined {
  if (Array.isArray(schema?.enum)) return undefined;
  const isString =
    schema?.type === 'string' ||
    (Array.isArray(schema?.anyOf) && (schema!.anyOf as JsonSchema[]).some((b) => b?.type === 'string'));
  if (!isString) return undefined;
  if (CONDITION_FIELD_NAMES.has(name) || /When$/.test(name)) return 'condition';
  return undefined;
}

const SECRET_FIELD_NAME_RE = /(^|_)(secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|credential|private[_-]?key|passphrase)$/i;
/**
 * Detect a write-only credential field → the masked `secret` widget. The
 * reliable signals are `format: 'password'` (driver configSchemas use this) and
 * JSON-Schema `writeOnly: true`; a conservative NAME CONVENTION (secret / token
 * / apiKey / accessKey / clientSecret / credential / privateKey / passphrase)
 * is the secondary cue. So credential fields render masked + write-only on every
 * metadata type, without each spec pinning `widget: 'secret'`. Bare `password`
 * is intentionally NOT matched here (auth owns that field, one-way hashed).
 */
function detectSecretWidget(name: string, schema: JsonSchema | undefined): string | undefined {
  if (schema?.format === 'password' || (schema as { writeOnly?: boolean } | undefined)?.writeOnly === true) return 'secret';
  if (Array.isArray(schema?.enum)) return undefined;
  const isString =
    schema?.type === 'string' ||
    (Array.isArray(schema?.anyOf) && (schema!.anyOf as JsonSchema[]).some((b) => b?.type === 'string'));
  if (!isString) return undefined;
  if (SECRET_FIELD_NAME_RE.test(name)) return 'secret';
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

/** Wire shapes a visibility predicate arrives in: bare CEL, or `{dialect, source}`. */
export type VisibilityPredicate = string | { dialect?: string; source: string };

/**
 * Read a visibility predicate off a spec node — **canonical key first**.
 *
 * ADR-0089 renamed the FormView predicate `visibleOn` → `visibleWhen`, and the
 * spec's normaliser REWRITES the alias instead of keeping both: a parsed
 * `FormView` carries `visibleWhen` and no `visibleOn` at all
 * (`@objectstack/spec` `shared/visibility.ts`). Reading only `visibleOn` — what
 * this admin engine did until objectstack#6331 — therefore found `undefined` on
 * every spec-served form and short-circuited each predicate to "always
 * visible", so conditional fields/sections rendered unconditionally.
 *
 * Spelling and precedence mirror the runtime record-form adapter
 * (`@object-ui/plugin-form` `sectionFields.ts`: `fd.visibleWhen ?? fd.visibleOn`)
 * so metadata-admin and the runtime form speak ONE dialect. The deprecated
 * alias stays honoured because it still has live producers: hand-written
 * layouts, and this app's own create schemas, which set `visibleOn` directly on
 * raw JSONSchema properties (`view-create-body.ts`) — those never pass through
 * the spec normaliser.
 */
function readVisibility(
  node: { visibleWhen?: VisibilityPredicate; visibleOn?: VisibilityPredicate } | undefined | null,
): VisibilityPredicate | undefined {
  return node?.visibleWhen ?? node?.visibleOn;
}

export interface FormSectionSpec {
  label?: string;
  description?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  columns?: 1 | 2 | 3 | 4;
  /** Canonical section visibility predicate (ADR-0089). */
  visibleWhen?: VisibilityPredicate;
  /** @deprecated ADR-0089 alias of `visibleWhen`; still read for legacy layouts. */
  visibleOn?: VisibilityPredicate;
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
  /** Composite rendering: 'inline' (default, bordered box) or 'popover'
   * (summary line + gear that opens the sub-fields in a popover — Airtable
   * progressive disclosure, keeps the panel lean). */
  disclosure?: 'inline' | 'popover';
  /** For `type: 'code'` — syntax highlighting language (e.g. 'javascript', 'sql', 'json'). */
  language?: string;
  /** Canonical field visibility predicate (ADR-0089). */
  visibleWhen?: VisibilityPredicate;
  /** @deprecated ADR-0089 alias of `visibleWhen`; still read for legacy layouts. */
  visibleOn?: VisibilityPredicate;
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
   * Ancestor id path this form is nested under. Two kinds of caller set it:
   *
   *  - the recursive render inside {@link FieldControl}, which passes the path
   *    of the field hosting this form (objectui#5062);
   *  - a host that mounts a SECOND form into a document that already has one,
   *    which passes an artificial ancestor SEGMENT to scope the whole instance
   *    (objectui#5092 — see {@link DRAWER_METADATA_ID_SCOPE}). The semantics
   *    are unchanged: it is still just an ancestor path.
   *
   * The PAGE-level form leaves it undefined, which is what keeps top-level ids
   * spelled `mdf-{field}`.
   */
  idPath?: string;
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

function SchemaFormBody({
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
  idPath,
}: SchemaFormProps) {
  // Live app locale (follows the i18next language, not just the browser) —
  // hoisted above the no-schema early return so the hook order is stable.
  const locale = useMetadataLocale();
  // No schema → synthesize one from the value's top-level keys so the
  // form renderer can still produce a structured, labelled view (with
  // proper read-only semantics) instead of falling back to a raw JSON
  // dump. This handles metadata types the framework hasn't yet shipped
  // a Zod schema for (`hook`, `trigger`, `validation`, etc.).
  //
  // Editable + truly unknown shape → keep the raw JSON editor as a
  // last resort, since we can't safely guess primitive types for
  // fields the user might add.
  // Hoisted above the schema-synthesis guard below so this hook runs on every
  // render (the guard can early-return a <RawJsonEditor/>).
  const issuesByPath = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const i of issues) {
      (map[i.path] ??= []).push(translateValidationMessage(i.message, locale));
    }
    return map;
  }, [issues, locale]);

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
  // Per-property visibility predicate context — the current draft under
  // `data`, mirroring the sectioned form's field-level filtering. Lets a flat
  // (create) schema gate a field on a sibling value (e.g. show the list layout
  // picker only when `data.viewKind == 'list'`). No predicate → always shown.
  const predicateData = (value ?? {}) as Record<string, unknown>;
  const keys = orderKeys(Object.keys(props), fieldOrder)
    .filter((k) => !hiddenFields.includes(k))
    .filter((k) => {
      const visibility = readVisibility(props[k] as any);
      return !visibility || evaluatePredicate(visibility, { data: predicateData });
    });

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
          idPath={idPath}
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
          idPath={idPath}
          schema={props[key]}
          value={(v as Record<string, unknown>)[key]}
          required={required.includes(key)}
          issues={issuesByPath[key]}
          readOnly={readOnly}
          widgetContext={widgetContext}
          // Honor an explicit `widget` declared on a raw JSON-schema property
          // (e.g. createSchema's `object: { widget: 'ref:object' }`) so the
          // flat auto-form can use rich pickers, not just type inference.
          fieldSpec={(props[key] as any)?.widget ? { field: key, widget: (props[key] as any).widget } : undefined}
          formData={v as Record<string, unknown>}
          onChange={(val) => setField(key, val)}
        />
      ))}
    </div>
  );
}

/* ----- instance scoping (objectui#5092) ----------------------------------- */

/**
 * Scope segments for the SECOND `SchemaForm` a metadata-admin document can
 * host (objectui#5092).
 *
 * `MetadataDetailDrawer` is a Radix `Sheet`: when it opens, the page's own
 * form STAYS IN THE DOM behind it. Both forms render top-level fields, and
 * top-level ids are `mdf-{field}` with no instance dimension — so a field
 * name both forms have (`name`, `label`, `description` — nearly always) is
 * one id twice, and a `label[for]` resolves to the FIRST match in document
 * order, i.e. the PAGE form. The drawer's labels then name and focus the
 * controls of the form hidden behind the drawer.
 *
 * The fix is the ancestor path {@link joinIdPath} already threads: each
 * drawer-side mount point passes a scope segment as its form's `idPath`, so
 * its top-level fields become `mdf-{scope}.{field}`. The PAGE form passes
 * nothing and its ids are byte-for-byte what they always were — the selector
 * surface the metadata-admin tests read does not move (the same additive
 * contract objectui#5062 kept for nested rows).
 *
 * Requirements on a segment, and why these two satisfy them:
 *
 *  - **Distinct per mount point** — two scoped forms must not collide with
 *    each other either. Pinned by `SchemaForm.instanceIdScope.test.tsx`.
 *  - **Whitespace-free** — these ids are consumed as `aria-labelledby` IDREFs,
 *    which tokenize on whitespace (objectui#5062, `joinIdPath`).
 *  - **Cannot be spelled by a real field** — a segment equal to some top-level
 *    field name would let `mdf-{scope}.{field}` be reached from two different
 *    paths. Both segments contain `-`, which is outside the metadata
 *    machine-name grammar (`^[a-z][a-z0-9_]*$`) and outside the camelCase
 *    property names the metadata JSON-Schemas use.
 */
export const DRAWER_METADATA_ID_SCOPE = 'drawer-metadata';

/** @see DRAWER_METADATA_ID_SCOPE — the drawer's embedded-item editor. */
export const DRAWER_EMBEDDED_ITEM_ID_SCOPE = 'drawer-embedded-item';

/**
 * True inside any `SchemaForm`, so the OUTERMOST form of a subtree runs the
 * duplicate-id scan and the nested ones (a composite/repeater page mounts
 * dozens) do not repeat it.
 *
 * Per SUBTREE, not per document: the page form and the drawer's form are
 * siblings, so both are outermost and both scan. That is intended — the scan
 * is precisely what tells the two of them apart.
 */
const SchemaFormNestingContext = React.createContext(false);

/**
 * Defer validation DISPLAY until the author has touched the field
 * (objectui#5416).
 *
 * A CREATE form opens on an empty draft, so every required field already
 * fails `safeParse` before a single keystroke: `新建软件包` used to open with
 * two red `输入无效` lines the author did not cause, and then jumped a line
 * height per field as each one cleared — enough to make a click land on the
 * wrong control while filling the form top to bottom.
 *
 * What is deferred is the RED LINE, never the rule: `issues` still flows to
 * the host unchanged, so the submit button stays gated on exactly the same
 * validation it was gated on before. This is the mount→blur move the card
 * asks for, not a relaxation.
 *
 * Off for edit/view forms on purpose: there the issues describe values that
 * came out of storage, not something the author is mid-way through typing, so
 * hiding them until touched would hide a real diagnostic. Carried in context
 * rather than as a prop so a nested sub-form inside a create form inherits it
 * without `createMode` (which also drives `immutable` locking) leaking down.
 */
const DeferIssueDisplayContext = React.createContext(false);

const isDevBuild = (): boolean =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.NODE_ENV !== 'production';

/**
 * Dev-only: say out loud that two field host ids collide in this document.
 *
 * Scoping by mount point (above) relies on every host that mounts a SECOND
 * form remembering to pass a segment — a new mount point that forgets brings
 * the cross-wiring back SILENTLY, because a duplicate id is not an error to
 * the DOM and the association still resolves, just to the wrong element.
 * This is the half that makes that failure loud. Production is untouched:
 * the whole body is behind the dev gate, so the effect does no work.
 */
function useDuplicateFieldHostIdCheck(enabled: boolean): void {
  // Report a given collision set once per form instance instead of on every
  // keystroke; a fresh mount reports again, which is what makes it visible.
  const lastReported = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!enabled || !isDevBuild() || typeof document === 'undefined') return;
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const el of Array.from(document.querySelectorAll('[id^="mdf-"]'))) {
      const id = el.id;
      if (!seen.has(id)) seen.add(id);
      else if (!duplicates.includes(id)) duplicates.push(id);
    }
    const signature = duplicates.join(',');
    if (signature === lastReported.current) return;
    lastReported.current = signature;
    if (duplicates.length === 0) return;
    console.error(
      `[SchemaForm] duplicate field host id(s) in this document: ${duplicates.join(', ')}. ` +
        'Two SchemaForm instances are mounted at once — the metadata detail drawer sits on ' +
        'top of the page form, which stays in the DOM — and at least one of them renders ' +
        'unscoped top-level ids. A `label[for]` resolves to the FIRST match in the document, ' +
        "so the later form's labels name and focus the earlier form's controls " +
        '(objectui#5092). Give the secondary form a distinct `idPath` scope segment — see ' +
        'DRAWER_METADATA_ID_SCOPE / DRAWER_EMBEDDED_ITEM_ID_SCOPE in SchemaForm.tsx.',
    );
  });
}

/**
 * Renders a metadata form for `schema` (see {@link SchemaFormProps}).
 *
 * The wrapper exists for the two document-level concerns above: it marks the
 * subtree as "inside a SchemaForm" so nested forms know they are not the
 * outermost one, and it runs the dev-only duplicate-host-id check.
 */
export function SchemaForm(props: SchemaFormProps) {
  const nested = React.useContext(SchemaFormNestingContext);
  const inheritedDefer = React.useContext(DeferIssueDisplayContext);
  useDuplicateFieldHostIdCheck(!nested);
  // objectui#5416 — a create form defers issue DISPLAY to first touch; a
  // nested form inherits whatever the form hosting it decided.
  const deferIssues = props.createMode === true || inheritedDefer;
  return (
    <SchemaFormNestingContext.Provider value={true}>
      <DeferIssueDisplayContext.Provider value={deferIssues}>
        <SchemaFormBody {...props} />
      </DeferIssueDisplayContext.Provider>
    </SchemaFormNestingContext.Provider>
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
  idPath,
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
  /** Ancestor id path, forwarded from the hosting `SchemaForm` (#5062). */
  idPath?: string;
  onChange: (key: string, val: unknown) => void;
}) {
  const locale = useMetadataLocale();
  const sections = (form.sections ?? []).filter((s) => {
    const visibility = readVisibility(s);
    return !visibility || evaluatePredicate(visibility, { data: value });
  });

  // Decide whether to render as tabs or stacked sections.
  const isTabbed = form.type === 'tabbed' && sections.length > 1;

  const renderSection = (s: FormSectionSpec, idx: number) => {
    const fields = s.fields
      .map(normaliseField)
      .filter((f) => {
        if (f.hidden) return false;
        if (hiddenFields.includes(f.field)) return false;
        const visibility = readVisibility(f);
        if (visibility && !evaluatePredicate(visibility, { data: value })) {
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
                  {tFormat('engine.form.missingField', locale, { field: f.field })}
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
                  idPath={idPath}
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
          .some((f) => {
            if (f.hidden) return false;
            if (hiddenFields.includes(f.field)) return false;
            const visibility = readVisibility(f);
            return !visibility || evaluatePredicate(visibility, { data: value });
          }),
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

/* ----- id scoping (objectui#5062) ----------------------------------------- */

/**
 * Extend an ancestor id path with one more segment.
 *
 * DOM ids in this form are derived from the field's PATH, not from its local
 * name: `FieldRow` is called recursively (composite sub-rows, repeater card
 * rows, record items, the recursive `SchemaForm`), and two same-named
 * sub-fields under different parents used to build the same id
 * (`mdf-field` twice). A duplicate id is not a cosmetic problem here — a
 * `<label for>` resolves to the FIRST match in the document, so the second
 * field's label named and focused the first field's control: an association
 * that is present, closed-looking to tooling, and cross-wired (objectui#5062;
 * same failure class as the fixed-id collision objectui#3343 fixed in
 * `packages/fields`).
 *
 * A TOP-LEVEL field passes no parent and keeps its historical `mdf-{field}`
 * id — the selector surface the metadata-admin tests read stays exactly as it
 * was; only nested rows gain a prefix.
 *
 * Segments are machine names (schema property / form-spec field names) and
 * numeric row indices — the same class of input the flat `mdf-{field}` id
 * already carried, so the ids stay derivable from the data path and
 * whitespace-free for identifier-shaped names. Runtime user input is
 * deliberately NOT a segment: a `record` item contributes its INDEX, never its
 * author-typed key, which may contain spaces that an `aria-labelledby` IDREF
 * would tokenize into two references.
 */
function joinIdPath(parent: string | undefined, segment: string | number): string {
  return parent ? `${parent}.${segment}` : String(segment);
}

/** The host DOM id for a field at `path` — the `mdf-` namespace, path-scoped. */
function fieldHostId(path: string): string {
  return `mdf-${path}`;
}

/* ----- inner field row ---------------------------------------------------- */

function FieldRow({
  name,
  idPath,
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
  /**
   * The path of this row's ANCESTOR field, or undefined at the top level
   * (objectui#5062). Each recursion point knows its own segment: a composite
   * passes its own path, a repeater card row appends the row index, a record
   * item appends the item index, and the recursive `SchemaForm` forwards the
   * path of the field that hosts it.
   */
  idPath?: string;
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
  const locale = useMetadataLocale();
  // objectui#5416 — validation-display timing. `touched` flips on the first
  // focusout anywhere in this row (React's onBlur IS focusout, so it bubbles
  // out of every widget, including the composite ones that never emit a DOM
  // change event) and on this field's own first edit. While a create form is
  // still untouched here, the row renders no error line — see
  // {@link DeferIssueDisplayContext} for why edit forms opt out.
  const deferIssues = React.useContext(DeferIssueDisplayContext);
  const [touched, setTouched] = React.useState(false);
  const markTouched = React.useCallback(() => setTouched(true), []);
  const visibleIssues = !deferIssues || touched ? issues : undefined;
  const handleChange = React.useCallback(
    (v: unknown) => {
      setTouched(true);
      onChange(v);
    },
    [onChange],
  );
  // A curated client `fieldSpec.label` always wins; otherwise localize the raw
  // schema title/description for known generic field names (e.g. the flow
  // edge/node sub-forms), falling back to the schema's own English text.
  const label =
    (fieldSpec?.label as string | undefined) ||
    translateSchemaFieldLabel(name, schema?.title as string | undefined, locale) ||
    prettify(name);
  const description =
    (fieldSpec?.helpText as string | undefined) ||
    translateSchemaFieldHelp(name, schema?.description as string | undefined, locale);
  // This row's own path — its id, and the ancestor path every nested row this
  // field renders builds on (objectui#5062).
  const path = joinIdPath(idPath, name);
  const id = fieldHostId(path);

  // Auto-infer widget from fieldSpec.type or schema
  let widget = inferWidget(fieldSpec, schema);
  // Field-reference props become object-field pickers when a field catalog
  // is available and the spec didn't pin an explicit widget.
  if (!fieldSpec?.widget) {
    const refWidget = detectFieldRefWidget(name, schema, widgetContext);
    if (refWidget) widget = refWidget;
    else {
      const secretWidget = detectSecretWidget(name, schema);
      if (secretWidget) widget = secretWidget;
      else {
        const iconWidget = detectIconWidget(name, schema);
        if (iconWidget) widget = iconWidget;
        else {
          const colorWidget = detectColorWidget(name, schema);
          if (colorWidget) widget = colorWidget;
          else {
            const condWidget = detectConditionWidget(name, schema);
            if (condWidget) widget = condWidget;
          }
        }
      }
    }
  }

  // Which registration will actually render, decided BEFORE the label so the
  // declaration below describes the surface the user gets (objectui#4871).
  widget = resolveRegisteredWidget(widget, schema, fieldSpec);

  // Which face `FieldControl` will render — resolved HERE, before the label, from
  // the same inputs it renders from (objectui#5039). The six paths that never
  // reach the `WIDGETS` registry (`composite` / `repeater` / `record` and the
  // three structural fallbacks) used to be decided inside `FieldControl`, i.e.
  // after this label was written, which is why they all emitted a dangling `for`.
  const face = resolveFieldFace({ fieldSpec, widget, schema, value });

  // How this field's visible label must reach what that face renders — a
  // DECLARATION either way, never an inference from the DOM it happens to
  // produce (objectui#4871, the vocabulary of `ComponentMeta.labelling`): the
  // registry's `labelling` for a registered widget, `faceLabelling` for the
  // structural faces that have no registry entry (objectui#5039).
  //
  //  - `'control'` — the face puts this `id` on a labelable element, so the
  //    label associates the plain way, `<label for>` → id.
  //  - `'group'` — no `<label for>` can reach the surface. The label publishes
  //    its OWN id, the face answers `aria-labelledby`, and the `for` is
  //    DROPPED: aimed at a container it activates nothing and names nothing,
  //    and leaving it beside the working channel is one label with two
  //    associations, one of them broken (the `form.tsx` `labelling: 'group'`
  //    branch, objectui#3961/#3978, and objectui#4010's refusal to relocate
  //    the id onto the radiogroup instead).
  const labelling = faceLabelling(face);
  const groupLabelled = labelling === 'group';
  // Whitespace-free by construction (`mdf-` + a dotted path of field names and
  // row indices — see `joinIdPath`), and consumed as an `aria-labelledby`
  // IDREF: a space in it would silently resolve to two ids.
  const labelId = groupLabelled ? `${id}-label` : undefined;
  // Exactly one of these two reaches the widget, ever.
  const channel = groupLabelled
    ? { id: undefined, ariaLabelledBy: labelId }
    : { id, ariaLabelledBy: undefined };
  const labelAssociation = groupLabelled ? { id: labelId } : { htmlFor: id };

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
      <div className="flex items-start justify-between gap-3 py-1.5" onBlur={markTouched}>
        <div className="min-w-0 flex-1">
          <Label {...labelAssociation} className="text-sm font-medium cursor-pointer">
            {label}
            {showRequiredStar && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          {description && (
            <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
          )}
          {visibleIssues?.map((m, i) => (
            <div key={i} data-testid="schema-form-issue" className="text-xs text-destructive mt-0.5">{m}</div>
          ))}
        </div>
        <FieldControl
          id={channel.id}
          ariaLabelledBy={channel.ariaLabelledBy}
          fieldName={name}
          idPath={path}
          schema={schema}
          value={value}
          onChange={handleChange}
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
    <div className="space-y-1.5" onBlur={markTouched}>
      <div className="flex items-center justify-between gap-2">
        <Label {...labelAssociation} className="text-sm font-medium">
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
        id={channel.id}
        ariaLabelledBy={channel.ariaLabelledBy}
        fieldName={name}
        idPath={path}
        schema={schema}
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        widget={widget}
        fieldSpec={fieldSpec}
        widgetContext={widgetContext}
        formData={formData}
      />
      {description && (
        <div className="text-xs text-muted-foreground">{description}</div>
      )}
      {visibleIssues?.map((m, i) => (
        <div key={i} data-testid="schema-form-issue" className="text-xs text-destructive">
          {m}
        </div>
      ))}
    </div>
  );
}

function FieldControl({
  id,
  ariaLabelledBy,
  fieldName,
  idPath,
  schema,
  value,
  onChange,
  readOnly,
  widget,
  fieldSpec,
  widgetContext,
  formData,
}: {
  /**
   * The host field id. From `FieldRow` it is present only on the
   * `labelling: 'control'` channel and `undefined` on the `'group'` one
   * (objectui#4871): every builtin branch below renders a labelable element and
   * spreads it unconditionally, as does the JSON editor whose `<textarea>` is
   * exactly such an element (objectui#5039), while the `'group'` faces never
   * read it because `FieldRow` doesn't hand it to them.
   */
  id?: string;
  /**
   * An IDREF naming whatever this control renders.
   *
   * From `FieldRow` this is the host label's id on the `'group'` channel only,
   * and exactly one of `id` / `ariaLabelledBy` is ever defined — that mutual
   * exclusion is `FieldRow`'s rule about a LABEL, not a rule about this
   * component. A grid/table repeater cell has no `<label>` at all: its name is
   * the column header, reached by IDREF, while the id stays on the control as a
   * plain anchor. So a cell passes BOTH, and every branch below emits the IDREF
   * alongside the id rather than treating them as alternatives (objectui#5063).
   */
  ariaLabelledBy?: string;
  /** Machine field name — keys enum-option localization (e.g. flow `type`). */
  fieldName?: string;
  /**
   * The PATH of the field this control renders (objectui#5062) — the ancestor
   * path for every nested row the structured faces below render. Distinct from
   * `fieldName`, which is the local segment and keys localization only.
   */
  idPath?: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
  widget?: string;
  fieldSpec?: FormFieldSpec;
  widgetContext?: WidgetContext;
  formData?: Record<string, unknown>;
}) {
  const locale = useMetadataLocale();
  // WHICH face renders is not decided here — `resolveFieldFace` decides it, and
  // `FieldRow` already called it with these very inputs to pick the naming
  // channel (objectui#5039). Calling the same pure function again here, rather
  // than re-testing `fieldSpec.type` / the union-resolved schema inline, is what
  // makes the declaration and the DOM impossible to drift apart: there is one
  // set of branch predicates, not two that must be kept in step.
  const face = resolveFieldFace({ fieldSpec, widget, schema, value });

  // Composite/repeater are first-class structured types — render natively
  // with recursive FieldRow calls so all UI features (widgets, options,
  // visibility, readonly) work uniformly at every nesting level.
  // When `fields` is omitted, fall back to schema-derived sub-fields
  // (all schema.properties / items.properties) so authors don't have to
  // enumerate every sub-property by hand.
  if (face.kind === 'composite') {
    const fields =
      fieldSpec?.fields?.length
        ? fieldSpec.fields
        : derivePropertyNames(schema);
    return (
      <CompositeField
        value={value}
        fields={fields}
        schema={schema}
        readOnly={readOnly}
        widgetContext={widgetContext}
        fieldSpec={fieldSpec}
        ariaLabelledBy={ariaLabelledBy}
        idPath={idPath}
        onChange={onChange}
      />
    );
  }
  if (face.kind === 'repeater') {
    // The row schema may be nested inside a union (`anyOf` / `oneOf`) — e.g.
    // a View `sort` authored as `anyOf: [ string, {field,order}[] ]`. Reading
    // `schema.items` at the top level misses the array branch and renders a
    // blank row with no sub-fields (objectui#3379). `resolveFieldFace` resolved
    // to the array branch's items; hand RepeaterField a schema whose `items` is
    // that object schema, so both the derived field list and `pickSubSchema`
    // (per-row controls) see real sub-schemas.
    const itemSchema = face.itemSchema;
    const fields =
      fieldSpec?.fields?.length
        ? fieldSpec.fields
        : derivePropertyNames(itemSchema);
    return (
      <RepeaterField
        value={value}
        fields={fields}
        schema={{ ...schema, items: itemSchema }}
        readOnly={readOnly}
        widgetContext={widgetContext}
        widget={fieldSpec?.widget}
        ariaLabelledBy={ariaLabelledBy}
        idPath={idPath}
        onChange={onChange}
      />
    );
  }
  if (face.kind === 'record') {
    // Record<string, item> — name-keyed map. Insertion order is display
    // order. JSON Schema shape: { type:'object', additionalProperties: itemSchema }.
    const itemSchema = face.itemSchema;
    const fields =
      fieldSpec?.fields?.length
        ? fieldSpec.fields
        : derivePropertyNames(itemSchema);
    return (
      <RecordField
        value={value}
        fields={fields}
        schema={schema}
        readOnly={readOnly}
        widgetContext={widgetContext}
        widget={fieldSpec?.widget}
        keyField={(fieldSpec as any)?.keyField}
        formData={formData}
        ariaLabelledBy={ariaLabelledBy}
        idPath={idPath}
        onChange={onChange}
      />
    );
  }

  // Widget hint takes precedence: the registry first, then the structural
  // fallbacks, then JSON with an inline hint — all four already resolved.
  if (face.kind === 'registered') {
    const Renderer = WIDGETS[face.widget] as WidgetRenderer;
    return (
      <Renderer
        // Exactly one of these is defined, decided by the widget's own
        // `labelling` declaration in `FieldRow` (objectui#4871).
        id={id}
        ariaLabelledBy={ariaLabelledBy}
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

  // Nested object schema with a `properties` map: recurse into a nested
  // SchemaForm so the user gets real labelled inputs instead of raw JSON.
  // Covers the auto-inferred `object-fields` widget that SchemaForm picks for
  // every `type: 'object'` schema, any custom widget name that wasn't
  // registered but still describes structured data, and the same shape reached
  // with no widget hint at all (a union whose object branch won).
  if (face.kind === 'nested-form') {
    return (
      // A container of independently labelled sub-rows: the host label names it
      // by IDREF and dropped its `for`, because every labelable element in here
      // belongs to a SUB-field's own label (objectui#5039, #4788's shape). The
      // inner `SchemaForm` publishes its own per-field channels, untouched — this
      // name is the outer field's, not theirs.
      <div className="rounded-md border border-border/40 bg-card/30 p-3" role="group" aria-labelledby={ariaLabelledBy}>
        <SchemaForm
          schema={face.effective}
          value={(value as Record<string, unknown>) ?? {}}
          onChange={(v) => onChange(v)}
          readOnly={readOnly}
          widgetContext={widgetContext}
          idPath={idPath}
        />
      </div>
    );
  }
  // Array-of-object schemas: route through RepeaterField so the user gets
  // per-row inputs rather than a JSON blob. Sub-field names come from the
  // union-resolved `items.properties`.
  if (face.kind === 'object-rows') {
    return (
      <RepeaterField
        value={value}
        fields={derivePropertyNames(face.itemSchema)}
        schema={{ ...face.effective, items: face.itemSchema }}
        readOnly={readOnly}
        widgetContext={widgetContext}
        widget={fieldSpec?.widget}
        ariaLabelledBy={ariaLabelledBy}
        idPath={idPath}
        onChange={onChange}
      />
    );
  }
  // Raw JSON — the announced fallback for an unregistered widget name (`hint`),
  // or the last resort for a shape no branch could type. Its `<textarea>` IS a
  // labelable element and takes the host id: this face is `labelling: 'control'`
  // (objectui#5039), so `id` is defined here whenever the host has a label.
  if (face.kind === 'raw-json') {
    if (face.hint) {
      return (
        <div className="space-y-1">
          <RawJsonEditor
            id={id}
            ariaLabelledBy={ariaLabelledBy}
            value={value as any}
            onChange={(v) => onChange(v)}
            readOnly={readOnly}
          />
          <div className="text-[10px] text-muted-foreground">
            {tFormat('engine.form.fallbackJson', locale, { widget: face.hint })}
          </div>
        </div>
      );
    }
    return (
      <RawJsonEditor id={id} ariaLabelledBy={ariaLabelledBy} value={value} onChange={onChange} readOnly={readOnly} small />
    );
  }

  // The builtin scalar chain. For schemas authored as `anyOf` / `oneOf` (e.g.
  // `width: anyOf[string, number]`, `sort: anyOf[string, array<obj>]`), the
  // outer schema's `type` / `enum` are undefined and every primitive branch
  // below would miss; `resolveFieldFace` already resolved the union against the
  // current value, so these checks run on the concrete branch.
  const effective = face.effective;
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
        <SelectTrigger id={id} aria-labelledby={ariaLabelledBy}>
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
        <SelectTrigger id={id} aria-labelledby={ariaLabelledBy}>
          <SelectValue placeholder={t('engine.form.selectEllipsis', locale)} />
        </SelectTrigger>
        <SelectContent>
          {enumValues.map((opt) => (
            <SelectItem key={String(opt)} value={String(opt)}>
              {translateEnumOption(fieldName ?? '', String(opt), locale)}
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
        aria-labelledby={ariaLabelledBy}
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
        aria-labelledby={ariaLabelledBy}
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
          aria-labelledby={ariaLabelledBy}
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
        aria-labelledby={ariaLabelledBy}
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
          aria-labelledby={ariaLabelledBy}
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

  // The structured fallbacks that used to be re-tested here — object-with-
  // properties → nested SchemaForm, array-of-object → RepeaterField, and the
  // last-resort JSON editor — are the `nested-form` / `object-rows` / `raw-json`
  // faces, returned above. `resolveFieldFace` keeps their precedence relative to
  // this scalar chain (structural checks come after it when there is no widget
  // hint, before it when there is), so the rendering order is unchanged; what is
  // gone is the second copy of the predicates.
  //
  // Unreachable by construction: a `'scalar'` face is returned only when one of
  // the branches above matches, and every one of them returns. The compiler can't
  // prove that correspondence, so this terminal stays — spelled as the same
  // `'control'`-channel JSON editor the `raw-json` face renders, so that if a
  // future edit did make it reachable the label channel would still be right.
  return (
    <RawJsonEditor id={id} ariaLabelledBy={ariaLabelledBy} value={value} onChange={onChange} readOnly={readOnly} small />
  );
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

// Compact, human-readable summary of a composite value for the popover
// disclosure trigger — booleans show their field label when true, arrays show
// their entries, scalars show the value. Keeps the collapsed row informative.
function summariseComposite(obj: Record<string, unknown>, specs: FormFieldSpec[]): string {
  const parts: string[] = [];
  for (const spec of specs) {
    const v = obj[spec.field];
    if (v == null || v === '' || v === false) continue;
    const label = spec.label || spec.field;
    if (v === true) parts.push(label);
    else if (Array.isArray(v)) { if (v.length) parts.push(v.map((x) => (typeof x === 'object' && x ? ((x as any).field ?? (x as any).name ?? '') : String(x))).filter(Boolean).join(', ')); }
    else if (typeof v === 'object') parts.push(label);
    else parts.push(String(v));
  }
  return parts.join(' · ');
}

function CompositeField({
  value,
  fields,
  schema,
  readOnly,
  widgetContext,
  fieldSpec,
  ariaLabelledBy,
  idPath,
  onChange,
}: {
  value: unknown;
  fields: Array<string | FormFieldSpec>;
  schema: JsonSchema;
  readOnly?: boolean;
  widgetContext?: WidgetContext;
  fieldSpec?: FormFieldSpec;
  /**
   * The host label's id — this face is `labelling: 'group'` (objectui#5039).
   * Answered on the box, not on any inner control: every labelable element in
   * here is addressed by a SUB-field's own label.
   */
  ariaLabelledBy?: string;
  /** This composite's own path — the ancestor path of its sub-rows (#5062). */
  idPath?: string;
  onChange: (v: unknown) => void;
}) {
  const obj = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : {};
  const specs = fields.map(normaliseField);

  const rows = specs.map((spec) => {
    const subSchema = pickSubSchema(schema, 'composite', spec.field);
    return (
      <FieldRow
        key={spec.field}
        name={spec.field}
        idPath={idPath}
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
  });

  // Progressive disclosure (Airtable parity): summary line + gear → popover.
  if (fieldSpec?.disclosure === 'popover') {
    const summary = summariseComposite(obj, specs);
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-1.5"
        role="group"
        aria-labelledby={ariaLabelledBy}
      >
        <span className="text-sm text-muted-foreground truncate" title={summary}>
          {summary || <span className="italic opacity-70">Not configured</span>}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" aria-label="Configure" data-testid={`composite-popover-${fieldSpec.field}`}>
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-3">
            {rows}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-3" role="group" aria-labelledby={ariaLabelledBy}>
      {rows}
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
  ariaLabelledBy,
  idPath,
  onChange,
}: {
  value: unknown;
  fields: Array<string | FormFieldSpec>;
  schema: JsonSchema;
  readOnly?: boolean;
  widgetContext?: WidgetContext;
  widget?: string;
  /**
   * The host label's id — this face is `labelling: 'group'` (objectui#5039).
   * Both layouts own only auxiliary buttons (collapse, add, remove) plus rows
   * that label themselves, so the name belongs on the list, not on a control.
   */
  ariaLabelledBy?: string;
  /**
   * This repeater's own path. Each ROW appends its index to it, so two rows —
   * and two repeaters carrying the same sub-field names — cannot build the same
   * id (objectui#5062).
   */
  idPath?: string;
  onChange: (v: unknown) => void;
}) {
  const locale = useMetadataLocale();
  const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  const specs = fields.map(normaliseField);
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);

  // Default to card layout (one fieldset per row). `widget: 'grid'` opts
  // into compact inline-table layout for short, atomic sub-fields.
  const useGrid = widget === 'grid' || widget === 'table';

  /**
   * Ids for the grid/table layout, path-scoped exactly like the card layout's
   * rows (objectui#5062), so the same data cell has the same id under either
   * layout and two repeaters carrying the same column names cannot collide.
   *
   * `cellId` replaces the flat `rep-{row}-{field}`, which was duplicated
   * verbatim by every other grid repeater in the form
   * (`DUPLICATES: ["rep-0-field"]`, measured).
   *
   * `columnHeaderId` names the `<th>` so the cells under it can point at it.
   * The `-col` suffix (rather than `FieldRow`'s `-label`) says what it is: one
   * header shared by a whole column, not one field's label — and it cannot be
   * confused with the label id of a row at the same path.
   */
  const cellId = (idx: number, field: string) => fieldHostId(joinIdPath(joinIdPath(idPath, idx), field));
  const columnHeaderId = (field: string) => `${fieldHostId(joinIdPath(idPath, field))}-col`;

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
      <div className="space-y-2" role="group" aria-labelledby={ariaLabelledBy}>
        <div className="overflow-x-auto rounded-md border border-border/50">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {/*
                  The column name is written ONCE, here, and every cell below
                  points at it by IDREF (objectui#5063). Before, the name existed
                  only as this header's visible text: no `label`, no `id` to
                  reference, no `scope` — so each cell control had `label[for]`,
                  `aria-label` and `aria-labelledby` all absent and read out as an
                  unnamed edit box. Per-cell `aria-label` was the rejected
                  alternative: it copies the column name into every row and drifts
                  the moment a column is renamed.
                */}
                {specs.map((s) => (
                  <th
                    key={s.field}
                    id={columnHeaderId(s.field)}
                    scope="col"
                    className="px-2 py-1.5 text-left text-xs font-medium"
                  >
                    {s.label || prettify(s.field)}
                    {s.required && <span className="text-destructive ml-0.5">*</span>}
                  </th>
                ))}
                {/* Row actions: no name to publish, but still a column header. */}
                {!readOnly && <th scope="col" className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={specs.length + 1} className="px-2 py-3 text-center text-xs text-muted-foreground">
                  {t('engine.repeater.empty', locale)}
                </td></tr>
              )}
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-border/30 align-top">
                  {specs.map((s) => {
                    const sub = pickSubSchema(schema, 'repeater', s.field);
                    return (
                      <td key={s.field} className="p-1.5">
                        <FieldControl
                          id={cellId(idx, s.field)}
                          // This cell's only naming channel — there is no
                          // `<label>` in a grid row (objectui#5063).
                          ariaLabelledBy={columnHeaderId(s.field)}
                          fieldName={s.field}
                          idPath={joinIdPath(joinIdPath(idPath, idx), s.field)}
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
                        className="h-7 w-7 p-0" aria-label={t('engine.form.remove', locale)}>
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
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('engine.form.add', locale)}
          </Button>
        )}
      </div>
    );
  }

  // Card layout — one collapsible fieldset per row.
  return (
    <div className="space-y-2" role="group" aria-labelledby={ariaLabelledBy}>
      {rows.length === 0 && (
        <div className="rounded-md border border-dashed border-border/50 px-3 py-4 text-center text-xs text-muted-foreground">
          {t('engine.list.empty', locale)}
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
                  className="h-7 w-7 p-0" aria-label={t('engine.form.remove', locale)}>
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
                      idPath={joinIdPath(idPath, idx)}
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
          <Plus className="h-3.5 w-3.5 mr-1" /> {t('engine.form.addItem', locale)}
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
  ariaLabelledBy,
  idPath,
  onChange,
}: {
  value: unknown;
  fields: Array<string | FormFieldSpec>;
  schema: JsonSchema;
  readOnly?: boolean;
  widgetContext?: WidgetContext;
  widget?: string;
  /**
   * The host label's id — this face is `labelling: 'group'` (objectui#5039).
   * Answered on the card list, and forwarded to a delegated widget so the
   * declaration holds in BOTH of this face's shapes.
   */
  ariaLabelledBy?: string;
  /**
   * This record field's own path. Each item appends its INDEX in display order
   * — never its author-typed key, which is runtime user input and may contain
   * whitespace an IDREF would tokenize (objectui#5062, `joinIdPath`).
   */
  idPath?: string;
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
  const locale = useMetadataLocale();
  // State hoisted above every early return below (the widget delegation and the
  // specialized-editor branches) so hook order stays stable across renders.
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [pendingKey, setPendingKey] = React.useState('');
  const [keyError, setKeyError] = React.useState<string | null>(null);
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  // Delegate to a registered widget if the form spec asked for one
  // explicitly (e.g. `widget: 'airtable'`). The widget owns the entire UI.
  if (widget) {
    const Renderer = WIDGETS[widget as RegisteredWidgetKey] as WidgetRenderer | undefined;
    if (Renderer) {
      return (
        // The `id` channel is deliberately NOT handed down: a `record` field is
        // declared `labelling: 'group'`, so the host published its label's id and
        // dropped the `for` (objectui#5039). The IDREF is forwarded, because this
        // delegated widget IS what the record field renders — leaving it out is
        // what left this shape unnamed while objectui#4871 measured it and left
        // it alone.
        <Renderer
          ariaLabelledBy={ariaLabelledBy}
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
  // insertion order = display order for `type: 'record'`. (dragKey/dropTarget
  // state is declared at the top of the component with the other hooks.)
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
    <div className="space-y-2" role="group" aria-labelledby={ariaLabelledBy}>
      {entries.length === 0 && (
        <div className="rounded-md border border-dashed border-border/50 px-3 py-4 text-center text-xs text-muted-foreground">
          {t('engine.list.empty', locale)}
        </div>
      )}
      {entries.map(([key, row], idx) => {
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
                  idPath={joinIdPath(idPath, idx)}
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
                  const visibility = readVisibility(s);
                  if (visibility && !evaluatePredicate(visibility, { data: row })) return null;
                  const sub = pickSubSchema(schema, 'record', s.field);
                  return (
                    <FieldRow
                      key={s.field}
                      name={s.field}
                      idPath={joinIdPath(idPath, idx)}
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
  id,
  ariaLabelledBy,
  value,
  onChange,
  readOnly,
  small,
}: {
  /**
   * The host field id, when this editor is a field's control. It goes on the
   * `<textarea>` — the one labelable element this face renders, in every branch
   * and both states — which is why the face is declared `labelling: 'control'`
   * rather than wrapped in a named group (objectui#5039). Absent when
   * `SchemaForm` renders this as the whole-form fallback, where there is no host
   * label to associate.
   */
  id?: string;
  /**
   * An IDREF that names the `<textarea>` when the host has no `<label for>` to
   * give it — a grid/table repeater cell, named by its column header
   * (objectui#5063).
   */
  ariaLabelledBy?: string;
  value: unknown;
  onChange: (v: any) => void;
  readOnly?: boolean;
  small?: boolean;
}) {
  const locale = useMetadataLocale();
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
        id={id}
        aria-labelledby={ariaLabelledBy}
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
