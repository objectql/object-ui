/**
 * resolveActionParams — Resolves field-backed action parameters against
 * runtime object metadata.
 *
 * Action params (`packages/spec/src/ui/action.zod.ts ActionParamSchema`) may
 * either be declared inline (`{ name, label, type, ... }`) or reference an
 * existing object field via `{ field, objectOverride? }`. Field-backed
 * params inherit label (i18n via `fieldLabel()`), type, options, validation,
 * placeholder, and help text from the object's field definition. Inline
 * properties on a field-backed param act as overrides.
 *
 * The resolver flattens each param to the runtime `ActionParamDef` shape
 * expected by `ActionParamDialog`, so the dialog itself stays agnostic to
 * field references.
 */
import type { ActionParamDef } from '@object-ui/core';

/**
 * Resolved params keep raw `FieldType` values (`text` / `email` / `select` /
 * `file` / …), matching the `FieldType` enum in `@objectstack/spec`. **Do
 * not** translate into the FormField widget vocabulary (`field:select`, …)
 * here — `ActionParamDialog` owns that translation via its `paramToField()`
 * adapter (ADR-0059).
 */

/** Raw param as authored on a schema action (post-zod). */
export interface RawActionParam {
  name?: string;
  field?: string;
  objectOverride?: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
  helpText?: string;
  defaultValue?: unknown;
  /** When true, seed defaultValue from the row record using the field name. */
  defaultFromRow?: boolean;
  /** Allow multiple values (file/image/lookup/user params → array value). */
  multiple?: boolean;
  /** Accepted upload types (MIME types / extensions) for `file`/`image` params. */
  accept?: string[];
  /** Max upload size in bytes for `file`/`image` params. */
  maxSize?: number;
  /**
   * Visibility predicate (CEL) — mirrors the spec `ActionParamSchema.visible`.
   * The server serialises it through `ExpressionInputSchema` as an
   * `{ dialect, source }` envelope, so accept both the raw string and the
   * envelope. Propagated to `ActionParamDef.visible` so `ActionParamDialog`
   * can gate the param (e.g. hide `phoneNumber` unless `features.phoneNumber`).
   * Absent = always visible.
   */
  visible?: string | { dialect?: string; source?: string };
}

/** Field metadata as exposed by `useMetadata().objects[].fields`. */
interface RuntimeField {
  type?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  description?: string;
  options?: Array<{ label: string; value: string } | string>;
  multiple?: boolean;
  defaultValue?: unknown;
  // ── Upload widget config (file/image fields) ──
  accept?: string[];
  maxSize?: number;
  // ── Lookup-specific metadata (preserved when resolving lookup params) ──
  reference_to?: string;
  reference?: string;
  display_field?: string;
  reference_field?: string;
  id_field?: string;
  description_field?: string;
  title_format?: string;
  lookup_columns?: unknown[];
  lookup_filters?: unknown[];
  lookup_page_size?: number;
  depends_on?: unknown[];
}

interface RuntimeObject {
  name?: string;
  fields?: Record<string, RuntimeField>;
}

export interface ResolveActionParamsContext {
  /** Default object name when a param's `objectOverride` is absent. */
  objectName: string;
  /** All known runtime objects (`useMetadata().objects`). */
  objects: RuntimeObject[];
  /** i18n resolver — `useObjectLabel().fieldLabel`. */
  fieldLabel: (objectName: string, fieldName: string, fallback: string) => string;
  /** Optional option-label translator — `useObjectLabel().fieldOptionLabel`. */
  fieldOptionLabel?: (
    objectName: string,
    fieldName: string,
    optionValue: string,
    fallback: string,
  ) => string;
  /**
   * Row record providing default values for params with `defaultFromRow` set.
   * Used by list_item actions (edit/delete dialogs) so the dialog opens with
   * the row's current values pre-filled.
   */
  row?: Record<string, unknown>;
}

/** Normalise an options entry (allowing bare strings) into label/value pairs. */
function normaliseOptions(
  options: Array<{ label: string; value: string } | string> | undefined,
  objectName: string,
  fieldName: string,
  optionLabel?: ResolveActionParamsContext['fieldOptionLabel'],
): Array<{ label: string; value: string }> | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined;
  return options.map((o) => {
    const raw = typeof o === 'string' ? { label: o, value: o } : o;
    const label = optionLabel
      ? optionLabel(objectName, fieldName, raw.value, raw.label)
      : raw.label;
    return { label, value: raw.value };
  });
}

/**
 * Flatten a param `visible` predicate to a plain CEL string. The spec's
 * `ExpressionInputSchema` normalises the authored string into an
 * `{ dialect, source }` envelope, so unwrap `.source`; a raw string passes
 * through untouched. Empty / absent → `undefined` (always visible).
 */
function normaliseVisible(visible: RawActionParam['visible']): string | undefined {
  if (typeof visible === 'string') return visible || undefined;
  if (visible && typeof visible === 'object' && typeof visible.source === 'string') {
    return visible.source || undefined;
  }
  return undefined;
}

/**
 * Resolve a single raw param against object metadata. Inline params pass
 * through (with safe defaults); field-backed params inherit from the
 * referenced field and accept inline overrides on top.
 */
export function resolveActionParam(
  param: RawActionParam,
  ctx: ResolveActionParamsContext,
): ActionParamDef {
  /** Row-context default: when `defaultFromRow` and a row is present, the
   *  param's defaultValue is the row's value at the field key (or `name`). */
  const rowKey = param.field ?? param.name;
  const rowDefault =
    param.defaultFromRow && ctx.row && rowKey != null && Object.prototype.hasOwnProperty.call(ctx.row, rowKey)
      ? ctx.row[rowKey]
      : undefined;

  // Inline param — no field reference, just normalise.
  if (!param.field) {
    return {
      name: param.name ?? '',
      label: param.label ?? param.name ?? '',
      type: param.type ?? 'text',
      required: param.required ?? false,
      options: param.options,
      placeholder: param.placeholder,
      helpText: param.helpText,
      defaultValue: rowDefault ?? param.defaultValue,
      visible: normaliseVisible(param.visible),
      multiple: param.multiple,
      accept: param.accept,
      maxSize: param.maxSize,
    };
  }

  const ownerName = param.objectOverride ?? ctx.objectName;
  const owner = ctx.objects.find((o) => o?.name === ownerName);
  const field: RuntimeField | undefined = owner?.fields?.[param.field];

  if (!field) {
    // Reference target missing — fall back to a plain text input so the
    // action remains usable in environments where the metadata cache is
    // partial (e.g. tests).
    return {
      name: param.name ?? param.field,
      label: param.label ?? ctx.fieldLabel(ownerName, param.field, param.field),
      type: param.type ?? 'text',
      required: param.required ?? false,
      options: param.options,
      placeholder: param.placeholder,
      helpText: param.helpText,
      defaultValue: rowDefault ?? param.defaultValue,
      visible: normaliseVisible(param.visible),
      multiple: param.multiple,
      accept: param.accept,
      maxSize: param.maxSize,
    };
  }

  const resolvedType = param.type ?? field.type ?? 'text';
  const resolvedOptions = param.options
    ?? normaliseOptions(field.options, ownerName, param.field, ctx.fieldOptionLabel);
  const resolvedLabel = param.label
    ?? ctx.fieldLabel(ownerName, param.field, field.label ?? param.field);

  /** Lookup/reference params carry extra picker config that the dialog
   *  forwards to `<LookupField>`. Without these the picker would fall back
   *  to a plain text input. */
  const isLookupResolvedType = resolvedType === 'lookup' || resolvedType === 'reference';
  const lookupExtras: Partial<ActionParamDef> = isLookupResolvedType
    ? {
        referenceTo: field.reference_to ?? field.reference,
        displayField: field.display_field ?? field.reference_field,
        idField: field.id_field,
        descriptionField: field.description_field,
        titleFormat: field.title_format,
        lookupColumns: field.lookup_columns,
        lookupFilters: field.lookup_filters,
        lookupPageSize: field.lookup_page_size,
        dependsOn: field.depends_on,
      }
    : {};

  return {
    name: param.name ?? param.field,
    label: resolvedLabel,
    type: resolvedType,
    required: param.required ?? field.required ?? false,
    options: resolvedOptions,
    placeholder: param.placeholder ?? field.placeholder,
    helpText: param.helpText ?? field.help ?? field.description,
    defaultValue: rowDefault ?? param.defaultValue ?? field.defaultValue,
    visible: normaliseVisible(param.visible),
    // Widget config inherited from the field for every type (not just
    // lookup): multi-value shape and upload constraints (ADR-0059).
    multiple: param.multiple ?? field.multiple,
    accept: param.accept ?? field.accept,
    maxSize: param.maxSize ?? field.maxSize,
    ...lookupExtras,
  };
}

/** Resolve an array of raw action params. */
export function resolveActionParams(
  params: RawActionParam[] | undefined,
  ctx: ResolveActionParamsContext,
): ActionParamDef[] {
  if (!Array.isArray(params)) return [];
  return params.map((p) => resolveActionParam(p, ctx));
}
