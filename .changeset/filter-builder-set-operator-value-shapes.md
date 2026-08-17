---
'@object-ui/components': patch
'@object-ui/i18n': patch
---

`FilterBuilder` gives the set and range operators an input that matches the value shape the spec accepts, and stops minting the shape it refuses.

Three independent paths let one filter row end up with `operator: 'in'` and a
SCALAR `value` — the shape `ViewFilterRuleSchema` refuses at save time since
objectstack#6227, and the shape the query path answered `400 INVALID_FILTER` on
before that (objectstack#5869):

- Changing the operator dropdown wrote `{ operator }` alone, so the seed `''`
  (or whatever the previous family had produced) survived the switch into
  `in` / `not_in` / `between`. The operator and the shape of its value are one
  edit, so they are now made together: switching families re-shapes the value —
  a typed scalar becomes a one-element list, an empty one becomes `[]`, a range
  keeps its first bound and leaves the second open, and a list collapsing to a
  scalar keeps its first entry.
- A plain text or number column has no static `options`, so `in` fell through to
  the single-value input and the user could only ever type a scalar into it.
  Those columns now get a token input (type, Enter or comma commits, `×` or
  Backspace removes) that always emits an array; `between` gets its two bounds
  instead of one box. The lookup picker's no-DataSource fallback, which also
  handed back a scalar while `multiple`, emits a list too.
- The multi-value families were decided from a local `["in", "notIn"]` literal,
  already one spelling adrift: `notIn` is an alias and the canonical member is
  `not_in`, so a stored view read back in canonical form got the single-value
  input for a set operator. The families are now read from `@objectstack/spec`'s
  exported `VIEW_FILTER_LIST_VALUE_OPERATORS` / `VIEW_FILTER_PAIR_VALUE_OPERATORS`
  and folded through `normalizeFilterOperator`, so both spellings of one operator
  get one answer and a family the spec widens is picked up without an edit here.

`foldFilterGroupToSpecRules` is unchanged and needed no change: it normalizes the
operator and carries `value` through verbatim, so the shape that reaches storage
is the producer's to get right. An untouched `in` row arrives as `[]`, which the
fold's existing incomplete-row rule already drops.

Four locale keys are added to all ten packs for the new inputs
(`filterBuilder.addValue` / `.removeValue` / `.rangeStart` / `.rangeEnd`).
