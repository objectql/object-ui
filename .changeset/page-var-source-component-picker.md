---
"@object-ui/app-shell": minor
---

feat(metadata-admin): page variable `source` is a component picker, not free text (#2328)

When editing a Page in Studio, a variable's **`source`** under Data Context now
renders as a dropdown of the component `id`s placed on the page, instead of a
plain text input the author had to type an id into by hand. This mirrors the
sibling `object` field's `ref:object` picker.

- New `ref:component` widget in `widgets.tsx` + a `collectPageComponentIds()`
  helper that walks the draft's `regions[].components[]` tree (including nested
  containers), de-duped in document order. Falls back to a free-text input when
  the page has no components yet, and preserves stale/renamed ids.
- `WidgetContext` gains `componentIds`; `ResourceEditPage` derives it from the
  live page draft so newly-placed components appear immediately.

Pairs with the framework form-spec change (`@objectstack/spec`) that pins
`widget: 'ref:component'` on the page `variables.source` sub-field.
