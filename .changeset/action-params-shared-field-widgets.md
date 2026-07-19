---
"@object-ui/fields": minor
"@object-ui/core": minor
"@object-ui/app-shell": minor
---

feat(app-shell): render ActionParamDialog params through the shared form field-widget renderer (ADR-0059, #2700)

`ActionParamDialog` no longer hand-rolls a per-type ternary chain (select /
lookup / textarea / number / boolean, everything else → text input). Every
declared action param now renders through the same `fieldWidgetMap` the object
form uses, so a param of ANY form-supported field type — `file`, `image`,
`richtext`, `markdown`, `color`, `address`, `code`, `date`, … — gets its real
widget, lazily loaded behind `Suspense`. Subsumes the single `file` branch ask
in #2698: `type: 'file'` params render the real `FileField` upload control via
the ambient `UploadProvider`, honoring `multiple`/`accept`/`maxSize`.

- `@object-ui/fields`: new exports `resolveFormWidgetType(type)` (widget-key
  resolution incl. spec aliases, text fallback) and `getLazyFieldWidget(type)`
  (per-type-cached `React.lazy` over the form's own widget loaders).
- `@object-ui/core`: `ActionParamDef` gains `accept`/`maxSize`; `multiple` is
  now general widget config (was lookup-only).
- `@object-ui/app-shell`: new pure `paramToField()` adapter (param → field
  shape) with a drift test pinning param support ⊇ form support (`FORM_FIELD_TYPES`),
  mirroring the FieldEditWidget parity guard; `resolveActionParams()` inherits
  `multiple`/`accept`/`maxSize` from the referenced field for every type.
  `required` validation, `visible` CEL gating, helpText, error styling, and
  value shapes for previously-supported types are unchanged.
