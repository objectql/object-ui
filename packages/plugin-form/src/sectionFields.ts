/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Shared section-field normalizer for the sectioned form variants
 * (Tabbed / Wizard / Split / Drawer / Modal).
 *
 * A form-view section lists its fields in one of three shapes:
 *
 *   1. a plain string — the field name:                 `'account_number'`
 *   2. a spec FormFieldSchema object (canonical) —      `{ field: 'name', required: true, colSpan: 2 }`
 *   3. an already-built runtime FormField object —       `{ name: 'x', type: 'text', ... }`
 *
 * Shape (2) is what `@objectstack/spec` emits — see FormFieldSchema, where the
 * key is `field`, NOT `name`. The variants used to read `fieldDef.name` and push
 * the raw object straight through, so a spec entry reached react-hook-form with
 * `name === undefined` and crashed the whole form on `name.split('.')`. This
 * helper normalizes all three shapes into a runtime FormField with a real
 * `name`, merging object-schema metadata (type/options/validation) with the
 * spec-level overrides.
 */

import type { FormField } from '@object-ui/types';
import { mapFieldTypeToFormType, buildValidationRules } from '@object-ui/fields';

export interface SectionFieldsContext {
  /** Resolved object schema (`{ fields: { [name]: fieldDef } }`) or null. */
  objectSchema: any;
  /** Object name, for label translation. */
  objectName: string;
  /** Whole-form read-only flag. */
  readOnly?: boolean;
  /** Form mode — `view` forces every field disabled. */
  mode?: 'create' | 'edit' | 'view';
  /** Translation-aware label resolver (from `useSafeFieldLabel`). */
  fieldLabel: (objectName: string, fieldName: string, fallback?: string) => string;
}

/**
 * Carry a `visibleOn` predicate through to the runtime FormField so the form
 * renderer evaluates it with the canonical CEL engine (`evalFieldPredicate`,
 * same record scope as `visibleWhen`). Accepts both wire shapes — a bare CEL
 * string and the spec Expression object `{ dialect, source }` (#2212).
 *
 * The previous implementation attached a `visible(formData)` closure backed
 * by `evaluateCondition`, which is a legacy `{field, operator, value}`
 * matcher, not a CEL evaluator — and nothing in the form render chain ever
 * called the closure, so `visibleOn` silently did nothing.
 */
function attachVisibility(formField: FormField, expr: any): FormField {
  const isExpression =
    (typeof expr === 'string' && expr.trim()) ||
    (expr != null && typeof expr === 'object' && typeof expr.source === 'string' && expr.source.trim());
  if (isExpression) {
    return { ...formField, visibleOn: expr } as FormField;
  }
  return formField;
}

/** Build a runtime FormField from object-schema metadata for `fieldName`. */
function fromObjectSchema(fieldName: string, ctx: SectionFieldsContext): FormField {
  const field = ctx.objectSchema?.fields?.[fieldName];
  if (!field) {
    return { name: fieldName, label: fieldName, type: 'input' } as FormField;
  }
  return {
    name: fieldName,
    label: ctx.fieldLabel(ctx.objectName, fieldName, field.label || fieldName),
    type: mapFieldTypeToFormType(field.type),
    required: field.required || false,
    disabled: ctx.readOnly || ctx.mode === 'view' || field.readonly,
    placeholder: field.placeholder,
    description: field.help || field.description,
    validation: buildValidationRules(field),
    field,
    options: field.options,
    multiple: field.multiple,
    // Field-level conditional rules (ADR-0036) — the form renderer resolves
    // them via `resolveFieldRuleState`; without this copy a sectioned form
    // silently dropped rules that the flat (schema-order) form honors.
    visibleWhen: field.visibleWhen,
    readonlyWhen: field.readonlyWhen,
    requiredWhen: field.requiredWhen,
    conditionalRequired: field.conditionalRequired,
  } as FormField;
}

/**
 * Normalize one section field definition (string | spec object | runtime
 * FormField) into a runtime FormField with a guaranteed `name`.
 */
export function normalizeSectionField(
  fieldDef: string | Record<string, any>,
  ctx: SectionFieldsContext,
): FormField {
  // (1) string shorthand → build entirely from the object schema.
  if (typeof fieldDef === 'string') {
    const meta = ctx.objectSchema?.fields?.[fieldDef] as any;
    return attachVisibility(fromObjectSchema(fieldDef, ctx), meta?.visible_on ?? meta?.visibleOn);
  }

  const fd = fieldDef as Record<string, any>;

  // (3) already a runtime FormField (inline customFields): it carries its own
  // `name` (and usually `type`). NOTE: in the spec shape `field` is a *string*
  // (the field name); in a runtime FormField `field` is the *metadata object*.
  // So a string `field` is the disambiguator for the spec shape below.
  if (typeof fd.field !== 'string') {
    return attachVisibility(fd as FormField, fd.visibleOn);
  }

  // (2) spec FormFieldSchema object — merge object-schema base + spec overrides.
  const fieldName = fd.field;
  const base = fromObjectSchema(fieldName, ctx) as any;

  if (fd.type != null) base.type = mapFieldTypeToFormType(fd.type);
  if (fd.widget != null) base.widget = fd.widget;
  if (fd.label != null) base.label = fd.label;
  if (fd.placeholder != null) base.placeholder = fd.placeholder;
  if (fd.helpText != null) base.description = fd.helpText;
  if (fd.required != null) base.required = fd.required;
  if (fd.readonly != null) base.disabled = fd.readonly || base.disabled;
  if (fd.immutable != null) base.immutable = fd.immutable;
  if (fd.hidden != null) base.hidden = fd.hidden;
  if (fd.colSpan != null) base.colSpan = fd.colSpan;
  if (fd.span != null) base.span = fd.span;
  if (fd.options != null) base.options = fd.options;
  if (fd.multiple != null) base.multiple = fd.multiple;
  // Spec canon for the lookup target is `reference_to` (views.zod.ts); accept
  // both spellings and stamp both keys so dual-key readers see the override.
  const refOverride = fd.reference ?? fd.reference_to;
  if (refOverride != null) {
    base.reference = refOverride;
    base.reference_to = refOverride;
  }
  if (fd.maxLength != null) base.maxLength = fd.maxLength;
  if (fd.minLength != null) base.minLength = fd.minLength;
  if (fd.min != null) base.min = fd.min;
  if (fd.max != null) base.max = fd.max;
  if (fd.precision != null) base.precision = fd.precision;
  if (fd.scale != null) base.scale = fd.scale;
  if (fd.language != null) base.language = fd.language;
  if (Array.isArray(fd.fields)) base.fields = fd.fields;

  return attachVisibility(base as FormField, fd.visibleOn);
}

/** Normalize every field def in a section. */
export function buildSectionFields(
  section: { fields: Array<string | Record<string, any>> },
  ctx: SectionFieldsContext,
): FormField[] {
  return (section.fields ?? []).map((fieldDef) => normalizeSectionField(fieldDef, ctx));
}
