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
import { EXPANDABLE_FIELD_TYPES, type ActionParamDef } from '@object-ui/core';
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

/**
 * Widget keys whose picker cannot query without an explicitly DECLARED target,
 * so a param of that type with no `referenceTo` degrades to a plain text input.
 *
 * Deliberately NOT the reference-bearing family (`EXPANDABLE_FIELD_TYPES`, read
 * below): `user` belongs to that family but defaults its target to `sys_user`,
 * so it must never degrade. Two rules over overlapping types, kept separate —
 * the same split the twin keeps between its own `LOOKUP_WIDGET_TYPES` and
 * `widgetNeedsDataSource` (plugin-grid's `bulkParamToField`). objectui#5312
 * converged the second rule only, on purpose.
 */
const LOOKUP_WIDGET_TYPES = new Set(['lookup', 'master_detail']);

/**
 * Does this param degrade to a plain text input for want of a declared target?
 *
 * The ONE answer to that question, exported so every surface that REACTS to the
 * degradation reads the same table that PERFORMS it. `ActionParamDialog` is the
 * caller that made exporting it necessary (objectui#5654): it decides whether to
 * show the #3405 "paste a record id" placeholder and help text, and it used to
 * answer with its own literal over RAW param spellings
 * (`param.type === 'lookup' || param.type === 'reference'`). That copy disagreed
 * with this one in BOTH directions, so neither set contained the other:
 *
 *   - `master_detail` degrades here but got no hints there — a targetless
 *     `master_detail` param really did render as an unexplained empty box asking
 *     for a bare UUID, which is exactly the state #3405 added the hints for.
 *   - `reference` was hand-copied out of `PARAM_TYPE_ALIASES`, a spelling this
 *     side never sees: it is folded to `lookup` before the membership test.
 *
 * Note the parameter: an `ActionParamDef`, not a widget key. Callers must not
 * resolve the widget key themselves to ask this — re-deriving the input is how
 * the fork happened. The predicate is exactly equivalent to "`paramToField()`
 * replaced this param's own widget with the text fallback", pinned as an
 * equivalence over every spelling in `paramToField.test.ts` — which is what lets
 * the dialog drop its `field.type === 'text'` proxy for that question.
 *
 * Deliberately NOT the reference-bearing family: see `LOOKUP_WIDGET_TYPES` above
 * for why `user` must never degrade.
 */
export function paramDegradesWithoutTarget(param: ActionParamDef): boolean {
  return LOOKUP_WIDGET_TYPES.has(resolveParamWidgetType(param.type)) && !param.referenceTo;
}

/**
 * Map an `ActionParamDef` to the field-metadata shape `FieldWidgetComponentProps.field`
 * expects. Lossless for the widget-relevant config: options, `multiple`,
 * upload `accept`/`maxSize`, and the full lookup picker config that
 * `resolveActionParams()` copies from the underlying object field.
 *
 * Param-only fallback: a `lookup`/`reference` param with no known
 * `referenceTo` target renders as a plain text input (the picker cannot query
 * without a target object) — preserving the dialog's long-standing behavior
 * for partially-resolved metadata.
 *
 * That fallback is now a last resort, not an expected path (#3405): inline
 * params declare `reference` and field-backed ones inherit it, and the spec
 * rejects a targetless inline picker at parse time. Reaching it means the
 * metadata is broken or partial, so say so in dev instead of silently handing
 * the user a box that wants a raw UUID.
 */
export function paramToField(param: ActionParamDef): Record<string, any> {
  let type = resolveParamWidgetType(param.type);
  if (paramDegradesWithoutTarget(param)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[ActionParamDialog] Param "${param.name}" is type "${param.type}" but has no reference target, ` +
          'so it degrades to a plain record-id text input. Declare `reference: \'<object>\'` on the param, ' +
          'or make it field-backed (`{ field: \'<lookup_field>\' }`) to inherit the target.',
      );
    }
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

  // Which widgets carry a reference target is NOT restated here: it is
  // `EXPANDABLE_FIELD_TYPES` from `@object-ui/core`, the one relational-field
  // family that `buildExpandFields`, the predicate-record projection, the object
  // form's `needsDataSourceWiring` and the grid's `bulkParamToField` already
  // read (objectui#4770 / #4790 / #4815). This face was the fourth CONVERSION
  // of it — the private copy `LOOKUP_WIDGET_TYPES.has(type) || type === 'user'`,
  // once with a fifth spelling `owner` that objectui#4814 retired (ruling A′).
  //
  // This comment used to add "and last". It was true as far as it had been
  // measured and is now known false, twice over: objectui#5692 found two older
  // copies in `plugin-dashboard`, and objectui#5874 four more (kanban, detail
  // ×2, `resolveActionParams`). No count is restated here on purpose — a
  // hand-kept census of this table is exactly what keeps going stale, and
  // writing a bigger integer would only re-create the defect. The census, its
  // falsification and the lineage of the conversions live in ONE place, the
  // family's canonical home: see the "One family, many consumers — and NO
  // reliable count of them" and "The LAST-private-copy claim was false"
  // sections of `packages/core/src/utils/expand-fields.ts`. The mechanical
  // fact, here and on every converted face, is the identity pin (objectui#5875).
  //
  // The comment that stood here claimed the disjunction "moves in lockstep with
  // plugin-grid's `bulkParamToField` twin — the two param faces are never
  // split". Measured on the tip before this change, that was false in BOTH
  // senses: mechanically, the twin had read core's Set since objectui#4815 while
  // this line read a private literal, so the two faces shared nothing and no
  // gate could report a split; and by membership they already differed, by
  // `tree`. Lockstep is true again — and for the first time it is mechanical,
  // not hand-kept: the identity pin in `paramToField.test.ts` fails on a
  // member-identical private copy, which is what a value check would not.
  //
  // `tree` is the member this face gains, and it is unreachable here: it is
  // absent from `fields`' widget map and `mapFieldTypeToFormType` sends it to
  // `field:lookup`, so every key tested here — always `resolveParamWidgetType`
  // output — arrives as `lookup`. Pinned, so registering a real `tree` widget
  // surfaces that behaviour change instead of shipping it silently.
  //
  // Extending this surface later: OR in a second, surface-local set, the way
  // `needsDataSourceWiring` does. Never `new Set([...EXPANDABLE_FIELD_TYPES, …])`
  // — a copy re-forks the table, which is the defect this change removed, and
  // the identity pin fails on it by design.
  if (EXPANDABLE_FIELD_TYPES.has(type)) {
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
