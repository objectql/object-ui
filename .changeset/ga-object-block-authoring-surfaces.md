---
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-form': patch
'@object-ui/plugin-grid': patch
---

Publish the authoring surfaces of the four GA `object-*` blocks

`object-form`, `object-grid`, `object-master-detail-form` and `object-metric`
each honoured far more keys than they declared as registry `inputs`. An author —
very often an AI author — who wrote one of the undeclared keys got an
`unknown-prop` report from `sdui-parser` on a key that works, while the designer
panel and the generated `sdui-intrinsics.d.ts` denied it existed.

68 keys are now declared with descriptions written to teach correct authoring:
`object-form` +20 (record binding, button labels, post-submit behaviour, mobile
overrides), `object-grid` +21 (sorting, pagination, grouping, selection, row and
bulk actions, navigation, export), `object-master-detail-form` +10, and
`object-metric` +14 (formatting, comparison, drill-down). No renderer behaviour
changes — this documents what already shipped, so the manifest, the generated
`.d.ts`, the designer panel and the renderers finally agree.

Ten of `object-grid`'s spec-declared keys are deliberately NOT published:
its own `@deprecated` legacy spellings (`fields`, `staticData`, `selectable`,
`pageSize`, `showSearch`, `showPagination`, `defaultSort`, `defaultFilters`,
`resizableColumns`, `title`). The renderer keeps reading them so existing
documents render, but recommending a deprecated alias as new authoring surface
would harden it into a second dialect. Each canonical replacement — `columns`,
`data`, `selection`, `pagination`, `searchableFields`, `sort`, `filter`,
`resizable`, `label` — is declared, and each carries a description naming the
legacy spelling it supersedes.
