/**
 * resolveActionParams — Resolves field-backed action parameters against
 * runtime object metadata.
 *
 * Action params (`packages/spec/src/ui/action.zod.ts ActionParamSchema`) may
 * either be declared inline (`{ name, label, type, ... }`) or reference an
 * existing object field via `{ field, objectOverride? }`. Field-backed
 * params inherit label (i18n via `fieldLabel()`), type, options, placeholder,
 * and help text from the object's field definition. Inline properties on a
 * field-backed param act as overrides.
 *
 * NOT validation: this comment used to claim it, but no `validation` was ever
 * inherited — `RuntimeField` below has no such key to read one from, and the
 * `ActionParamDef` it would have landed on no longer declares one either
 * (objectui#3201). A param's constraints reach the widgets through
 * `paramToField()` as `required` / `minLength` / `maxLength` / `pattern`.
 *
 * The resolver flattens each param to the runtime `ActionParamDef` shape
 * expected by `ActionParamDialog`, so the dialog itself stays agnostic to
 * field references.
 *
 * AUTHORING vs RESOLVED is the load-bearing distinction here, and the two
 * vocabularies are not interchangeable (objectui#3174). What an author may
 * write is exactly the spec's `ActionParamSchema` key set — mirrored by
 * `@object-ui/types`' `ActionParam` and by {@link RawActionParam} below. What
 * this function EMITS is `@object-ui/core`'s `ActionParamDef`, whose picker
 * group (`referenceTo`, `displayField`, …) exists only after resolution.
 * Authoring a resolved-side key is a mistake in every direction — `tsc`
 * rejects it, the server's `.strict()` parse rejects it, and this resolver
 * names it via {@link RESOLVED_ONLY_PARAM_KEYS} rather than reading it.
 */
import type { ActionParamDef, ActionParamOption } from '@object-ui/core';

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
  /**
   * Option list authored inline on the param. Speaks the same vocabulary as the
   * resolved side ({@link ActionParamOption}): the two keys this resolver reads
   * plus a catch-all for whatever else an option declares (`visibleWhen`,
   * `color`, `icon`, `disabled`) — objectui#3559.
   */
  options?: ActionParamOption[];
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
   * Reference target for an INLINE `lookup`/`master_detail` param (#3405) —
   * the object whose records the picker searches. Field-backed params inherit
   * it from the referenced field instead (see `lookupExtras` below). Spelled
   * `reference` to match `FieldSchema.reference` / `ActionParamSchema.reference`.
   */
  reference?: string;
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

/**
 * The param's handle in the action payload — `name` wins, defaulting to the
 * field it binds.
 *
 * One of the two identity reads this module makes, and the reason both are
 * named functions rather than open-coded alternations: they are two LAYERS, not
 * two spellings of one (objectui#3104's inventory says so for this exact file).
 * Reading them through a single reader each is what keeps that distinction
 * legible — and keeps a third, accidental precedence from appearing the next
 * time someone needs a param's identity.
 *
 * NOT `columnIdentity()` from `@object-ui/core`: that reader is canonical-first
 * (`field` beats `name`) because a list COLUMN's identity is the object field it
 * shows. A param is the opposite — it is a slot in the payload that may bind a
 * field — so borrowing the column reader here would silently invert the
 * precedence and rename every field-backed param that also names itself.
 */
function paramName(param: RawActionParam): string | undefined {
  return param.name ?? param.field;
}

/**
 * The key a `defaultFromRow` param reads off the row record — `field` wins here,
 * because row data is keyed by OBJECT FIELD. The mirror image of
 * {@link paramName}, deliberately: same two keys, opposite question.
 */
function rowValueKey(param: RawActionParam): string | undefined {
  return param.field ?? param.name;
}

/**
 * Keys of the RESOLVED `ActionParamDef` that are not authorable on a raw param,
 * mapped to the prescription an author needs (objectui#3174).
 *
 * They are deliberately ABSENT from `RawActionParam` above rather than declared
 * and ignored: the whole defect this table exists for is that
 * `@object-ui/types`' public `ActionParam` declared them "for parity with the
 * resolved shape", so `{ name: 'account_id', type: 'lookup', referenceTo:
 * 'account' }` type-checked, lost its picker target here, and rendered as a
 * plain record-id text box. `ActionParamSchema` in `@objectstack/spec` is
 * `.strict()` and rejects every one of them at parse time — `referenceTo` by
 * name, with `reference` as the suggestion — so resolving them here would make
 * objectui accept metadata the platform itself refuses to store. That is a
 * second de-facto contract, not a kindness (AGENTS.md "contract-first"): such a
 * param would work in a locally-authored TS action and fail at publish.
 *
 * So the disposition is: recognise, name, and refuse — never silently drop, and
 * never quietly honour.
 */
export const RESOLVED_ONLY_PARAM_KEYS: Readonly<Record<string, string>> = (() => {
  const fromField =
    'It is inherited from the referenced field — make the param field-backed '
    + "(`{ field: '<lookup_field>' }`) to pick it up.";
  return {
    referenceTo:
      "Use `reference` instead — `reference: '<object>'` is the spec's spelling for an inline "
      + 'picker target, and the only one this resolver reads.',
    displayField: fromField,
    idField: fromField,
    descriptionField: fromField,
    titleFormat: fromField,
    lookupColumns: fromField,
    lookupFilters: fromField,
    lookupPageSize: fromField,
    dependsOn: fromField,
  };
})();

/**
 * Dev-mode guard: name any resolved-only key an author put on a raw param.
 *
 * `tsc` already rejects these against `@object-ui/types`' `ActionParam`, and the
 * server rejects them at parse. This covers the gap between the two — params
 * authored in plain JS, loaded from JSON, or synthesised at runtime — so the
 * mistake is loud wherever it enters, instead of surfacing downstream as
 * `paramToField()`'s "no reference target" warning naming a key the author never
 * wrote (which is how objectui#3174 read from the author's seat).
 */
function warnResolvedOnlyKeys(param: RawActionParam): void {
  if (process.env.NODE_ENV === 'production') return;
  const raw = param as unknown as Record<string, unknown>;
  for (const key of Object.keys(RESOLVED_ONLY_PARAM_KEYS)) {
    if (raw[key] === undefined) continue;
    console.warn(
      `[resolveActionParams] Param "${paramName(param) ?? '(unnamed)'}" declares \`${key}\`, `
        + 'which is not an authorable action-param key: it belongs to the RESOLVED `ActionParamDef`, '
        + "`@objectstack/spec`'s `ActionParamSchema` rejects it at parse time, and this resolver ignores it. "
        + RESOLVED_ONLY_PARAM_KEYS[key],
    );
  }
}

/** Field metadata as exposed by `useMetadata().objects[].fields`. */
interface RuntimeField {
  type?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  description?: string;
  /**
   * The field's own option list — `select` / `radio` / `checkboxes` metadata as
   * `@objectstack/spec`'s `SelectOptionSchema` declares it, so entries may carry
   * `visibleWhen` / `color` / `icon` / `disabled` alongside label and value. A
   * bare string is shorthand for `{ label: s, value: s }`.
   */
  options?: Array<ActionParamOption | string>;
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

/**
 * Normalise a field's option list for a param: expand bare strings into
 * `{ label, value }` and translate each label through `fieldOptionLabel`.
 *
 * Those are the only two jobs. Everything else the option declares is
 * PRESERVED, not rebuilt (objectui#3559): this used to return a fresh
 * `{ label, value }` per entry, which silently dropped a field's per-option
 * `visibleWhen` — so a select field whose options narrow by predicate in the
 * object form (`resolveVisibleOptions()` in `@object-ui/core`, ADR-0058 /
 * #2284) offered the FULL list, predicate-hidden entries included, the moment
 * an action param inherited that field via `{ field: '<name>' }`. Same field
 * metadata, two surfaces, two behaviours, no diagnostic anywhere. `color` /
 * `icon` / `disabled` were lost the same way.
 *
 * Only the field-inherited branch ever came through here; options authored
 * inline on the param always passed through verbatim (see `resolvedOptions`
 * below), which is precisely the asymmetry this restores.
 */
function normaliseOptions(
  options: Array<ActionParamOption | string> | undefined,
  objectName: string,
  fieldName: string,
  optionLabel?: ResolveActionParamsContext['fieldOptionLabel'],
): ActionParamOption[] | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined;
  return options.map((o) => {
    const raw: ActionParamOption = typeof o === 'string' ? { label: o, value: o } : o;
    const label = optionLabel
      ? optionLabel(objectName, fieldName, raw.value, raw.label)
      : raw.label;
    return { ...raw, label, value: raw.value };
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
  // Off-spec resolved-side keys are named here, at the authoring boundary,
  // before anything downstream can mistake the resulting gap for partial
  // metadata (objectui#3174).
  warnResolvedOnlyKeys(param);

  /** Row-context default: when `defaultFromRow` and a row is present, the
   *  param's defaultValue is the row's value at {@link rowValueKey}. */
  const rowKey = rowValueKey(param);
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
      // Inline picker target (#3405). Without this an inline `lookup` param
      // could never reach `<LookupField>` — `paramToField()` degrades a
      // targetless picker to a raw record-id text input.
      referenceTo: param.reference,
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
      name: paramName(param) ?? param.field,
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
      // The field is unresolvable, so an inline `reference` is the only picker
      // target available — keep it rather than dropping to a text input.
      referenceTo: param.reference,
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
        // Inline `reference` wins, matching how every other inline value
        // overrides the resolved field (#3405).
        referenceTo: param.reference ?? field.reference_to ?? field.reference,
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
    name: paramName(param) ?? param.field,
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
