---
'@object-ui/plugin-grid': minor
'@object-ui/components': minor
'@object-ui/plugin-detail': minor
'@object-ui/plugin-form': patch
'@object-ui/app-shell': minor
'@object-ui/types': minor
---

feat(grid): built-in row Edit/Delete honor per-record CEL predicates (#2614)

The object's `userActions.edit` / `userActions.delete` now also accept an
object form `{ enabled?, visibleWhen?, disabledWhen? }`. The predicates are
evaluated per row on the canonical CEL engine (`useRowPredicate`, the same
machinery custom row actions use): `visibleWhen` false → the built-in
Edit/Delete item is not rendered for that row (fail-closed); `disabledWhen`
true → rendered disabled (fail-soft). Wired through ObjectGrid's
RowActionMenu and the data-table's row overflow menu (the related-list
path), with the app-shell `crudAffordances` mirror kept in lockstep.
Omitting the predicates (or using plain booleans) keeps today's behavior
bit-for-bit; declared predicates evaluate only when a row's menu opens, so
grid rendering cost is unchanged.
