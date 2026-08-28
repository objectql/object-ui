---
'@object-ui/app-shell': patch
---

`sanitizeViewOverride` now strips a half-filled `between` from a stored view
overlay, instead of handing it back to the merge (objectui#5025,
objectstack#8815).

The overlay recovery pass asked "is this filter row filled in?" with the
shape-blind predicate objectstack#8815 retired — `value == null || value === ''
|| (Array.isArray(value) && value.length === 0)`. That is correct for `scalar`
and `list` and blind to `pair`: a `between` carrying one bound is
`['2024-01-01', '']`, an array of length 2, so the pass read it as a real
condition and kept it. The two write paths (`plugin-list`'s `ListView` and
app-shell's `viewFilterFold`) were converted to the builder's arity-aware
`isFilterValueComplete`; this read path was the third verbatim copy, and the one
whose job was to clean up exactly the rows the other two used to write. Until
now a stored half-range survived the pass, reached the query, and the server
refused the whole view (`400 INVALID_FILTER`) for every user on every later
read.

The pass now delegates to the same `isFilterValueComplete` the write paths use,
on both of the at-rest shapes it handles (the spec `ViewFilterRule` object and
the legacy runtime triple). A complete range — bounds of `0` and `false`
included — is untouched, and the `scalar` and `list` families read exactly as
before, since the retired predicate was already right for them. One shape is
newly stripped beyond the half-filled array: a `between` whose value is a bare
scalar, which `ViewFilterRuleSchema` itself refuses.

Which operators want no value at all is unchanged and still answered by
app-shell's `VALUELESS_FILTER_OPERATORS` — that set is already derived from the
builder's `VALUELESS_FILTER_BUILDER_OPERATORS` rather than being a private copy,
and its parity is pinned.
