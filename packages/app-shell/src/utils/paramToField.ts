/**
 * paramToField — pure adapter from a resolved `ActionParamDef` to the
 * `{ name, type, ...config }` field shape the shared form field widgets
 * (`@object-ui/fields`) consume.
 *
 * `ActionParamDialog` renders every param through the same field-widget
 * renderer the object form uses (`fieldWidgetMap` / `FORM_FIELD_TYPES`), so a
 * declared action param of ANY form-supported field type — `file`, `image`,
 * `richtext`, `color`, `address`, … — gets its real widget instead of
 * collapsing to a text input (ADR-0059). This module is the whole translation
 * layer: pure and exported so the mapping is unit-testable without the dialog
 * render tree (mirrors `filterVisibleParams`' style), with a drift test
 * asserting param support ⊇ form support.
 */
import type { ActionParamDef } from '@object-ui/core';
import { resolveFormWidgetType } from '@object-ui/fields';

/**
 * Param-only type spellings the dialog historically accepted, folded onto the
 * canonical form widget vocabulary. These are legacy dialect entries kept for
 * params already authored with them — new params should use spec `FieldType`
 * values directly.
 */
const PARAM_TYPE_ALIASES: Record<string, string> = {
  checkbox: 'boolean',
  reference: 'lookup',
  'datetime-local': 'datetime',
  // NOTE: spec's `autonumber` (vs the widget-map key `auto_number`) is folded
  // in the shared `mapFieldTypeToFormType`, so `resolveFormWidgetType` already
  // handles it — no param-only alias needed here.
};

/**
 * Resolve a param `type` to the form widget key that renders it. Any type in
 * `FORM_FIELD_TYPES` resolves to itself (identity — asserted by the drift
 * test); aliases and unknown types resolve through the same fallback chain the
 * form applies (unknown → `text`).
 */
export function resolveParamWidgetType(paramType: string): string {
  return resolveFormWidgetType(PARAM_TYPE_ALIASES[paramType] ?? paramType);
}

/** Widget keys that render the record-picker family and need a reference target. */
const LOOKUP_WIDGET_TYPES = new Set(['lookup', 'master_detail']);

/**
 * Map an `ActionParamDef` to the field-metadata shape `FieldWidgetProps.field`
 * expects. Lossless for the widget-relevant config: options, `multiple`,
 * upload `accept`/`maxSize`, and the full lookup picker config that
 * `resolveActionParams()` copies from the underlying object field.
 *
 * Param-only fallback: a `lookup`/`reference` param with no known
 * `referenceTo` target renders as a plain text input (the picker cannot query
 * without a target object) — preserving the dialog's long-standing behavior
 * for partially-resolved metadata.
 */
export function paramToField(param: ActionParamDef): Record<string, any> {
  let type = resolveParamWidgetType(param.type);
  if (LOOKUP_WIDGET_TYPES.has(type) && !param.referenceTo) {
    type = 'text';
  }

  const field: Record<string, any> = {
    name: param.name,
    label: param.label,
    type,
    required: param.required,
    placeholder: param.placeholder,
    options: param.options,
    multiple: param.multiple,
    accept: param.accept,
    maxSize: param.maxSize,
  };

  // The dialog's boolean params render as an inline checkbox row (label beside
  // the control), matching the pre-ADR-0059 dialog UX — not the form's switch.
  if (type === 'boolean') {
    field.widget = 'checkbox';
  }

  if (LOOKUP_WIDGET_TYPES.has(type) || type === 'user' || type === 'owner') {
    Object.assign(field, {
      reference_to: param.referenceTo,
      display_field: param.displayField,
      id_field: param.idField,
      description_field: param.descriptionField,
      title_format: param.titleFormat,
      lookup_columns: param.lookupColumns,
      lookup_filters: param.lookupFilters,
      lookup_page_size: param.lookupPageSize,
      depends_on: param.dependsOn,
    });
  }

  return field;
}
