---
'@object-ui/components': patch
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

FilterConditionField can author the spec's `$icontains` — case-insensitive contains is reachable from the filter UI.

`@objectstack/spec`'s `FieldOperatorsSchema` gained `$icontains` between
`17.0.0-rc.2` and `rc.5`, and every driver and evaluation face the platform
ships now executes it. `FilterConditionField` had no builder operator that could
author it, so the capability was unreachable from the sharing-rule criteria
builder and sat in that widget's parity test as an explicit `KNOWN_UNREACHABLE`
entry.

The FilterBuilder gains a `containsCaseInsensitive` operator ("Contains (ignore
case)", translated in all ten locale packs). `condToMongo` emits
`{ field: { $icontains: value } }` and `kvToCondition` reads it back, so a saved
criteria reopens in the visual builder instead of falling into the raw-JSON
editor. Today's `contains` is unchanged and still emits the case-SENSITIVE
`$contains`; whether it should have been case-insensitive all along is a product
question that stays open, and stored filter views keep meaning what they meant.

The fold is ASCII-only by contract — `café` does not match `CAFÉ`.

The new operator is **opt-in per consumer**: `FilterBuilder` takes an
`extraOperators` prop, and only `FilterConditionField` passes it. The one
dropdown feeds three at-rest dialects and only the MongoDB-style criteria this
widget writes can carry the operator — the spec's `VIEW_FILTER_OPERATORS` (saved
views) and `VALID_AST_OPERATORS` (the live grid's filter AST) have no
case-insensitive contains, so offering it there would author a filter those
paths cannot execute. Every other FilterBuilder is unchanged.
