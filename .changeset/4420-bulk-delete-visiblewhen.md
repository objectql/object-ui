---
'@object-ui/core': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-list': patch
---

The selection bar's built-in **Delete** now honours `userActions.delete.visibleWhen`
per selected record (objectui#4420). It used to read that key as a bare boolean — the
object-level verdict only — so ticking a record the author's predicate excludes still
offered the red Delete, and pressing it deleted the record the predicate was written to
protect. The row kebab on the same screen hid its Delete correctly, so one declared key
meant two different things on two surfaces.

Ruled by the maintainer on 2026-08-17 (behaviour 1 of the card's three): **filter the
operation and report the skipped**. The bar evaluates the predicate once per selected
record, the delete runs over the allowed subset, and the excluded records are reported
rather than silently dropped. The button itself is never hidden or disabled by the
predicate — a mixed selection is not punished for one stray tick — and a selection where
every row is excluded is a legible refusal rather than an unexplained absence.

- `@object-ui/core` gains `partitionRowsByPredicate`, the set-shaped counterpart of
  `evalRowPredicate`: the fail-closed per-record fold a bulk gate needs, written once.
  A bulk gate evaluates N records in a loop, which is why it can never be a hook.
- `@object-ui/plugin-grid`'s bulk bar routes an excluded selection through
  `BulkActionDialog`, whose existing `bulk-skipped-notice` slot reports the skipped
  count; a selection with nothing excluded keeps the consumer's own delete flow
  untouched. `resolveRowCrudAffordances` now also returns `objectDeletePredicates` —
  the bulk half of the same predicates, gated on the object verdict rather than on the
  row `onDelete` wiring. The dialog declines to run over zero records.
- `@object-ui/plugin-list`'s non-grid bulk bar (kanban / calendar / gallery / …) filters
  the built-in `delete` to the eligible subset and states the skipped count inline.

Custom bulk action ids are untouched: they route through the action runner carrying
their own gates. This is a UI affordance — server enforcement was never the leak.
