---
"@object-ui/fields": patch
"@object-ui/plugin-form": patch
---

fix(fields): grid columns are keyed by the declared `name`, so spec-compliant grid metadata renders populated cells

`GridField` declared its own column interface keyed by `field` and read
`c.field` at every site (`key=`, `row[…]`, the blank row, cell writes, the
column chooser, the running-total lookup), while the published
`GridColumnDefinition` in `@object-ui/types` — and the grid documentation, and
the `fields-grid` catalog examples — declare the key as `name`. Metadata
authored against the published type therefore rendered a grid with the correct
row count and every cell empty, plus a React "unique key" warning per column.

The renderer now reads the declared `name`, and the master-detail derivation
(`deriveColumns` / `hydrateColumns` / `pickAmountField`) produces and consumes
the same key. There is deliberately **no** `col.field ?? col.name` alias: one
spelling at the producer (AGENTS.md #0.1).

**Breaking for `field`-keyed columns.** Grid / line-item / master-detail
subform columns spelled `{ field: 'amount' }` must be re-spelled
`{ name: 'amount' }`. This affects author-supplied `columns` on the `grid`
field, `record:line_items`, `object-master-detail-form` details and a
relationship field's `inlineColumns`. Auto-derived columns (no explicit
`columns` block) need no change. List-view and `object-grid` columns are a
different contract (`ListColumn`) and keep their own `field` key.
