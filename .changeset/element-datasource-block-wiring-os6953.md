---
"@object-ui/react": minor
"@object-ui/components": patch
"@object-ui/plugin-grid": patch
"@object-ui/plugin-form": patch
"@object-ui/plugin-kanban": patch
"@object-ui/plugin-calendar": patch
"@object-ui/plugin-charts": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-detail": patch
---

`PageComponentSchema.dataSource` now reaches every object-bound block, not just
`list-view` — and `element:record_picker` stops discarding `view`
(objectstack#6953).

objectstack#5576 wired the spec's per-element data binding
(`dataSource: { object, view?, filter?, sort?, limit? }`) to `list-view` and left
the same declaration inert on every other page component. Two gaps remained, and
both were silent:

- **`element:record_picker` read four of the five keys and dropped `view`.** So
  `dataSource: { object: 'account', view: 'hot' }` — the spec's own example —
  built a picker over EVERY account instead of the rows the saved view selects.
  Nothing threw and nothing rendered an error; the option list was simply wider
  than what was authored, which also means a user could select a record the page
  said was out of scope.
- **`object-grid` / `object-form` / `object-kanban` / `object-calendar` /
  `object-chart` / `object-metric` / `record:related_list` read none of it.**
  Each gates its fetch on its own `objectName`, and nothing mapped
  `dataSource.object` onto it, so a page written the way the spec documents
  rendered an empty grid / a field-less form / a board with no cards / an empty
  month / an empty chart / a static metric number — with no request and no
  diagnostic anywhere. Spec-valid metadata rendering nothing is the
  objectstack#4413 shape.

Composition follows objectstack#5576's landed semantics unchanged on every block:
a named saved view supplies the baseline, a key written on the component itself
overrides it, an explicit binding key overrides both, `filter` AND-combines
("additional filter criteria" — a binding can narrow a view, never widen it), and
a `view` name that does not resolve renders a configuration error instead of
degrading to the object's full scope.

- `@object-ui/react` — new `useElementDataSourceSchema(schema, mapping, dataSource?)`
  and `ElementDataSourceGate` apply a resolved binding to the schema keys a given
  block reads, plus `ElementDataSourceErrorPanel` / `ElementDataSourceLoadingPanel`
  for the two non-final states. One precedence table for all blocks rather than
  one copy per block — that copy is how "additional filter criteria" would have
  become two dialects.
- A mapping names **only** keys its block genuinely reads. A composed value
  written onto a key the block ignores would be accepted and dropped, which is
  the defect being removed, one layer deeper — so a kanban's swimlane `columns`
  never receive a view's field list, and a block with no row cap leaves `limit`
  unmapped. The per-block coverage table, including two residual gaps that are
  named rather than papered over, is in `content/docs/guide/data-source.md`.

No behaviour changes for a block that carries no `dataSource`: the binding-free
path returns the schema by reference, so nothing remounts and nothing refetches.
