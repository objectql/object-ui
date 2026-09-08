---
'@object-ui/core': patch
---

`viewFilterRuleToNode` now refuses an ARRAY on a single-value operator instead
of passing it through verbatim (objectui#8557).

A stored view rule never had its `value` inspected, so
`{ field: 'tags', operator: 'equals', value: ['a'] }` lowered to
`['tags', 'equals', ['a']]` — and the spec's own doors accept that node unjudged
(`isFilterAST` is `true`, `parseFilterAST` hands back `{ tags: ['a'] }`, measured
against spec 17.3.0). The refusal therefore arrived two layers away, as
`@objectstack/driver-sql`'s `400 INVALID_FILTER` or as an empty list from an
in-memory matcher, with nothing to attribute it to. It is the same
array-in-a-scalar-slot shape objectui#8530 refused in `convertFiltersToAST`'s
object arm, which deliberately did not reach this door — so a hand-authored
`{ tags: ['a'] }` failed fast with a message naming `$in` while the same mistake
saved into a view stayed silent. That asymmetry is closed.

The guard keys on the operator's ARITY, never on `Array.isArray(value)`: `in`,
`not_in` and `between` legitimately carry arrays through this same function and
are untouched. The arity comes from the spec's own
`VIEW_FILTER_LIST_VALUE_OPERATORS` and `VIEW_FILTER_PAIR_VALUE_OPERATORS` rather
than a local list — the docblock on the first of them names a hard-coded
`["in", "notIn"]` as the mistake it exists to prevent — and the check runs after
`normalizeFilterOperator`, so an alias is judged by what it means (`nin` is
`not_in`, and keeps its array). Two classes are deliberately left alone: an
operator the spec does not know is still passed through verbatim, because the
misspelling is already the loud failure and refusing here would report the wrong
problem; and the valueless operators (`is_null`, `is_empty`, …) are not refused,
because the spec discards their value anyway
(`parseFilterAST(['tags', 'is_null', ['a']])` is `{ tags: { $null: true } }`), so
a stray array there cannot select the wrong rows. A pin holds the four arity
classes to an exact partition of `VIEW_FILTER_OPERATORS`, so a new spec operator
reddens rather than silently inheriting a verdict.

The refusal is a `FilterOperatorError` (`INVALID_FILTER` / 400), which means a
saved view with one bad rule now fails at render rather than returning a
narrower result. That is not a new blast radius: both sinks already catch this
error class from this same file — `plugin-list`'s `buildEffectiveFilter` and
`plugin-view`'s `ObjectView` each call it inside their load `try` — and
`classifyLoadError` reads the code and status, so what a user sees is the
"filter is malformed" panel rather than a network fault or a crashed page. The
alternatives are both silent: dropping the rule widens the result set, and
rewriting `equals` into `in` changes what the saved view means.
