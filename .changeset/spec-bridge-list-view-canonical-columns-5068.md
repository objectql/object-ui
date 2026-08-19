---
"@object-ui/react": minor
---

fix(react): `bridgeListView` emits the column spelling the spec declares

`mapColumn` took a spec-canonical `ListColumn` — whose columns are **already**
spelled `field` / `label` — and down-translated every one of them to
`{ accessorKey, header }` before emitting the `object-grid` node, which
`ObjectGrid` then translated back. A round trip through a spelling
`ListColumnSchema` refuses by name, on a value that arrived canonical. The
bridge now forwards the declared shape, and the tolerance branch on the other
side retires in the same release (see `@object-ui/plugin-grid`).

**Output shape.** `bridgeListView` / `SpecBridge.transformListView` emit
`columns: [{ field, label?, … }]`. Code reading `node.columns[i].accessorKey`
off a bridged node reads `field` instead; `header` becomes `label`. The bare
string shorthand `columns: ['name']` now maps to `{ field: 'name' }`.

**No label is invented any more.** `header: col.label ?? col.field` turned "the
author declared no label" into "the author declared the machine name", and that
synthesized value pre-empted `ObjectGrid`'s own header chain — the column's
label, then the **object field's** label, then the prettified machine name —
whose middle step exists so a localized field label wins on a non-English app.
A bridged view therefore rendered raw machine names where a directly authored
`object-grid` rendered the field's real label. A bare `{ field }` column now
reaches that chain intact.

Speaking the declared spelling also routes bridged views through the renderer's
full ListColumn path rather than its type-inference-only one: object-schema
field enrichment, `hidden` filtering, primary-field auto-linking, and per-column
`link` / `action` handling now apply to a bridged `ListView` exactly as they do
to an authored grid.
