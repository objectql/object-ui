---
"@object-ui/plugin-grid": patch
"@object-ui/i18n": patch
---

fix(grid): a bulk action's `visible` is evaluated per selected record — objectui#3067

The selection bar evaluated a def's `visible` against the ambient scope with no
record bound. That does not fail open, it answers wrongly: with no `record` in
scope the lenient evaluator returned `true` for **every** row-scoped predicate,
including the ones that should be false — `${record.done}` and
`${record.owner == user.id}` both came back `true`. An authored gate was not
weakened, it was inverted for half its inputs, and nothing distinguished that
from a real verdict.

`visible` is now evaluated **once per selected record, with that record in
scope**, fail-closed per record and warning once on a fault — the same contract
the row kebab uses. One evaluation answers both questions:

- **Is the button offered?** When at least one selected record passes. A
  record-free predicate (`features.x`, `current_user.y`) returns the same
  verdict for every row, so it still behaves as a plain button-level gate — no
  syntactic sniffing for `record` references is involved.
- **Which records does it run on?** The ones that passed. The confirm step
  states how many were skipped, so a run over fewer records than the user
  ticked says so instead of quietly shrinking the selection.

Eligibility is re-applied to the EXPANDED set after "select all N matching",
not just the page selection the button could see.

The mechanism predates objectui#3002, but only inline-authored
`bulkActionDefs[].visible` used to reach it — written by authors who knew there
was no record. #3031 began promoting object actions into the bar, and their
`visible` is typically written for a row/record surface, which is what put
row-scoped predicates in front of a record-free evaluation.
