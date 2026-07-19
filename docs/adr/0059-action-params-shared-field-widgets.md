# ADR-0059: Action params render through the shared form field-widget renderer

**Status**: Accepted — implemented (2026-07-19)
**Author**: ObjectUI renderer team
**Consumers**: `@object-ui/app-shell` (`ActionParamDialog`, `resolveActionParams`), `@object-ui/fields` (`resolveFormWidgetType` / `getLazyFieldWidget`), `@object-ui/core` (`ActionParamDef`), `@objectstack/spec` (`ActionParamSchema`), every host of declared object actions (ObjectView / RecordDetailView / DeclaredActionsBar / approvals inbox)
**Companion to**: the `FieldEditWidget` ↔ `FORM_FIELD_TYPES` drift guard (inline-editor parity) — this applies the same "one widget surface, pinned by a drift test" philosophy to action params. Resolves objectui#2700; generalizes the single-type ask in objectui#2698.

---

## TL;DR

`ActionParamDialog` was a **bespoke, hand-rolled form**: a manual ternary chain
over `param.type` with five branches (`select`, `lookup`, `textarea`, `number`,
boolean) and a plain text `Input` fallback for **everything else**. Every rich
type a designer might declare on an action param — `file`, `image`, `richtext`,
`markdown`, `color`, `address`, `code`, … — silently collapsed to a text box,
and each fix (e.g. the `file` branch proposed by #2698) would have been another
one-off branch trailing the form surface forever.

Meanwhile the object **form** already renders every one of these through
`fieldWidgetMap` (`@object-ui/fields`, keys frozen as `FORM_FIELD_TYPES`),
lazy-loaded and registered via `ComponentRegistry`.

**Decision: the dialog now renders every param through that same widget map.**
A pure `paramToField()` adapter translates the resolved `ActionParamDef` into
the `{ name, type, ...config }` field shape `FieldWidgetProps.field` expects,
and the dialog mounts the widget returned by `getLazyFieldWidget(type)` behind
`<Suspense>`. A drift test pins **param support ⊇ form support**, so the two
surfaces can never silently diverge again.

## Decision

1. **`@object-ui/fields` exports the resolution + lazy loading**
   - `resolveFormWidgetType(type)` — widget-map keys resolve to themselves;
     spec aliases (`toggle`, `json`, `secret`, `tree`, `repeater`, …) resolve
     through `mapFieldTypeToFormType`; unknown types fall back to `text` (the
     form's own fallback).
   - `getLazyFieldWidget(type)` — the widget wrapped in `React.lazy`, cached
     per type. Shares the exact loaders `registerField()` uses for forms, so
     the dialog adds **zero** eager widget weight to the bundle.

2. **`paramToField()` (app-shell) is the whole translation layer** — pure and
   unit-tested, mirroring `filterVisibleParams`' style. It carries options,
   `multiple`, upload `accept`/`maxSize`, and the full lookup picker config
   (`referenceTo` → `reference_to`, …) that `resolveActionParams()` copies from
   the underlying object field. `resolveActionParams()` now inherits
   `multiple`/`accept`/`maxSize` from the referenced field for **every** type,
   not just lookup; `ActionParamSchema` in `@objectstack/spec` gained the
   matching optional keys for inline params.

3. **Param semantics stay in the dialog, not the widgets**: `required`
   validation (`isMissingValue`), `visible` CEL gating (`usePredicateScope` +
   `ExpressionEvaluator`), label/error/help chrome, and i18n option-label
   localization are unchanged. Widgets receive `{ value, onChange, field }`
   and nothing else.

4. **Ambient context, no adapter threading** — `UploadProvider` (file/image)
   and `SchemaRendererContext` (dataSource for lookup/user pickers) come from
   the host view, exactly as the dialog's previous `LookupField` reuse relied
   on.

5. **Param-only fallbacks are explicit and few**:
   - `checkbox` / `reference` / `datetime-local` / `autonumber` — legacy param
     spellings folded onto canonical widget keys (`PARAM_TYPE_ALIASES`).
   - a `lookup`/`reference` param with **no `referenceTo`** target renders a
     text input with the "paste an ID" hint (a picker cannot query without a
     target object) — the dialog's long-standing partial-metadata behavior.
   - boolean params render the shared `BooleanField` with `widget: 'checkbox'`
     in the dialog's inline label row (params opt into confirm-style checkbox
     UX, not the form's switch).

## Why not the inline-edit path

`FieldEditWidget` (grid inline editing) deliberately excludes heavy/binary
types (`INLINE_EXCLUDED_FIELD_TYPES`: `file`, `image`, `richtext`, …) because a
grid cell can't host them. A dialog can — so the **form** widget surface is the
right one to reuse, and the param dialog intentionally supports the full
`FORM_FIELD_TYPES` set.

## The drift guard

`packages/app-shell/src/utils/paramToField.test.ts` asserts that every type in
`FORM_FIELD_TYPES` resolves to **its own widget** through
`resolveParamWidgetType` (identity — never the text fallback). Adding a new
widget type to `fieldWidgetMap` automatically extends the param dialog; removing
or special-casing one fails CI. This mirrors the `FieldEditWidget` ↔
`FORM_FIELD_TYPES` drift test that caught `lookup` falling back to a text box
inline.

## Value shapes

Widgets emit their own value shapes and the dialog passes them through
untouched to the action runner (`resolve(values)`), exactly as before for the
previously-supported types (`select` → string, `number` → number, `boolean` →
boolean, `date` → `YYYY-MM-DD`, lookup → id / id[]). New types follow their
widget's contract — e.g. `file` → uploaded-file descriptor(s)
(`{ name, url, … }`, array when `multiple`). Endpoint authors declare params
with the shape their route expects, same as record forms.

## Consequences

- A declared action param of **any** form-supported field type renders its real
  widget for free; "param type X falls through to a text box" is no longer a
  reachable bug class.
- objectui#2698's `file` param need is subsumed: `type: 'file'` params render
  the real `FileField` upload control (ambient `UploadProvider`), honoring
  `multiple`/`accept`/`maxSize` — unblocking attachment-carrying declared
  actions and the approvals composer retirement.
- The dialog's per-type branches are deleted; future field types cost zero
  dialog work.
- Bundle stays lazy: opening a param dialog loads only the widget chunks its
  params actually use.

## Follow-ups (post-merge)

- **Upload-in-progress guard.** A `file`/`image` param's value only becomes its
  fileId once the presigned upload settles, so submitting mid-upload would
  send an empty/stale value. The upload widgets now surface their in-progress
  state via an optional `onUploadingChange` prop (shared
  `useUploadingSignal` hook, ignored by non-upload widgets); the dialog wires
  it for `file`/`image` params only and disables Confirm (label → "Uploading…")
  and blocks submit while any upload is in flight.
- **`autonumber` spelling.** `@objectstack/spec` spells the type `autonumber`
  while the widget-map key is `auto_number`; `mapFieldTypeToFormType` now folds
  both so a spec-typed `autonumber` field/param resolves to the AutoNumber
  widget instead of the text fallback (fixes the form path too, not just params).
