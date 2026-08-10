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
import { isCreateFormMode, isRequiredInForm } from './schemaDefaults';

export interface SectionFieldsContext {
  /** Resolved object schema (`{ fields: { [name]: fieldDef } }`) or null. */
  objectSchema: any;
  /** Object name, for label translation. */
  objectName: string;
  /** Whole-form read-only flag. */
  readOnly?: boolean;
  /** Form mode — `view` forces every field disabled. */
  mode?: 'create' | 'edit' | 'view';
  /**
   * The record this form is editing, if any. Together with `mode` it answers
   * "is there a persisted record behind this form", which decides whether a
   * runtime `defaultValue` excuses the field from `required` (#4069) — see
   * `isCreateFormMode`. Passed rather than derived from `mode` alone because
   * the containers' own create branch is `mode === 'create' || !recordId`, and
   * a form that omits `mode` entirely is still a create form to them.
   */
  recordId?: unknown;
  /**
   * Translation-aware label resolver (from `useSafeFieldLabel`).
   *
   * `fallback` is required, matching the producer in `@object-ui/i18n`: the
   * resolver returns the fallback when no translation exists, so an omitted
   * one could not satisfy the `=> string` return. Every call site already
   * passes it.
   */
  fieldLabel: (objectName: string, fieldName: string, fallback: string) => string;
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

/**
 * Mixed-vocabulary lint (#3090): an authored section field carrying BOTH the
 * spec identity key (`field`, a string) and the runtime one (`name`) is
 * ambiguous — the spec branch below derives the runtime name from `field`, so
 * an authored `name` is silently overwritten. Say so once per site (this runs
 * inside render loops, hence the dedupe).
 */
const warnedMixedVocabulary = new Set<string>();
function warnOnMixedVocabulary(fd: Record<string, any>, objectName: string): void {
  if (typeof fd.name !== 'string' || fd.name === fd.field) return;
  const key = `${objectName}:${fd.field}:${fd.name}`;
  if (warnedMixedVocabulary.has(key)) return;
  warnedMixedVocabulary.add(key);
  console.warn(
    `[object-ui] section field { field: '${fd.field}' } also carries name: '${fd.name}' — mixed form-field ` +
      `vocabularies. The spec key wins (the runtime name becomes '${fd.field}'); drop \`name\` from authored ` +
      `form views.`,
  );
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
    // The widget id is a function of the (type, multiple) PAIR, not of the type
    // alone: a `select` declared `multiple: true` renders the multi-value chip
    // picker, and the label-association declaration is keyed on the widget that
    // actually renders (objectui#3986).
    type: mapFieldTypeToFormType(field.type, { multiple: field.multiple }),
    // Mode-aware: a CREATE form does not enforce `required` on a field whose
    // `defaultValue` is a runtime instruction the server resolves at insert
    // (#4069) — the control is deliberately left empty for exactly that
    // resolution, so refusing the submit would leave nothing to type.
    required: isRequiredInForm(field, isCreateFormMode(ctx)),
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
  warnOnMixedVocabulary(fd, ctx.objectName);
  const fieldName = fd.field;
  const base = fromObjectSchema(fieldName, ctx) as any;

  if (fd.widget != null) base.widget = fd.widget;
  if (fd.label != null) base.label = fd.label;
  if (fd.placeholder != null) base.placeholder = fd.placeholder;
  if (fd.helpText != null) base.description = fd.helpText;
  // A view may restate `required` over the object field. Re-run the create-mode
  // test on the EFFECTIVE value (#4069): what excuses the field is the runtime
  // `defaultValue` on the object field, not which layer asserted `required` —
  // a form view saying `required: true` over `defaultValue: 'NOW()'` makes the
  // same claim the object schema does, and hits the same wall.
  if (fd.required != null) {
    base.required = isRequiredInForm(
      { required: fd.required, defaultValue: ctx.objectSchema?.fields?.[fieldName]?.defaultValue },
      isCreateFormMode(ctx),
    );
  }
  if (fd.readonly != null) base.disabled = fd.readonly || base.disabled;
  if (fd.immutable != null) base.immutable = fd.immutable;
  if (fd.hidden != null) base.hidden = fd.hidden;
  if (fd.colSpan != null) base.colSpan = fd.colSpan;
  if (fd.span != null) base.span = fd.span;
  if (fd.options != null) base.options = fd.options;
  if (fd.multiple != null) base.multiple = fd.multiple;
  // The widget id is decided ONCE, here, from the EFFECTIVE (type, multiple)
  // pair — because both halves are overridable at the view level and either one
  // alone moves the widget (objectui#3986). A view restating only `multiple:
  // true` over an object-schema `select` must land on the multi-value picker
  // just as a view restating `type: 'select'` alongside it does; resolving from
  // `fd.type` before `multiple` had been merged could see only one half.
  //
  // `rawType` is the PRE-alias spelling, kept because `base.type` is already the
  // mapped id (`field:…`) and re-deciding from it would need an inverse mapping.
  // Absent on both sides (a spec field naming nothing in the object schema and
  // declaring no type) it stays untouched — `fromObjectSchema`'s `input`.
  const rawType = fd.type ?? ctx.objectSchema?.fields?.[fieldName]?.type;
  if (rawType != null) base.type = mapFieldTypeToFormType(rawType, { multiple: base.multiple });
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
  // View-level cascading declaration (spec FormField.dependsOn, a bare parent
  // name). The form renderer gates + recomputes options off the runtime
  // field's top-level `dependsOn`; without this copy the declaration vanished.
  if (fd.dependsOn != null) base.dependsOn = fd.dependsOn;
  // Record/composite widget config (ADR-0007). Pass-through: no widget reads
  // them from the runtime field yet, but dropping them here would make that
  // support impossible to ship metadata-first.
  if (fd.keyField != null) base.keyField = fd.keyField;
  if (fd.disclosure != null) base.disclosure = fd.disclosure;

  // View-level visibility predicate. ADR-0089 renamed it to `visibleWhen` —
  // which collides with the runtime slot holding the OBJECT-level rule (copied
  // from the object schema in `fromObjectSchema`). Route the view predicate
  // into the view-level slot (`visibleOn`) instead: the renderer evaluates the
  // two slots independently and ANDs them, so layering is preserved and the
  // object rule is never clobbered. Canonical spelling wins over the
  // deprecated one when both are authored (`saveMeta` persists verbatim, so
  // served metadata can carry either).
  return attachVisibility(base as FormField, fd.visibleWhen ?? fd.visibleOn);
}

/** Normalize every field def in a section. */
export function buildSectionFields(
  section: { fields: Array<string | Record<string, any>> },
  ctx: SectionFieldsContext,
): FormField[] {
  return (section.fields ?? []).map((fieldDef) => normalizeSectionField(fieldDef, ctx));
}
