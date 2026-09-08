---
'@object-ui/core': patch
---

`convertFiltersToAST` now lowers a `Date` comparand instead of silently dropping
the field it sits on (objectui#8555).

The operator-object arm opened on `typeof value === 'object' &&
!Array.isArray(value)`, and a `Date` passes both tests. `Object.entries` of a
Date is `[]`, so the operator loop body never ran and NO condition was pushed:
`{ status: 'a', created: someDate }` lowered to `['status', '=', 'a']`. Nothing
threw and nothing warned — the result set simply got WIDER than the author asked
for, which is the one failure direction this file exists to avoid. The defect
also depended on the field's siblings: with the Date alone, `conditions` ended
empty and the original object came back untouched, so it only became visible
once a second field was present.

It is LOWERED, not refused, and `@objectstack/spec` is what decides that —
the opposite answer to objectui#8514, which was a refusal precisely because the
spec declined to rule on that shape. Here it rules twice over (measured against
spec 17.3.0): `ACCEPTED_FILTER_COMPARAND_TYPES` is
`['string','number','bigint','boolean','null','Date']`, and
`$gt` / `$gte` / `$lt` / `$lte` / `$between` declare `z.ZodDate` in comparand
position.

The AST leaf carries the `Date` INSTANCE. The wire form is deliberately not this
adapter's question to answer: `parseFilterAST(['created', '=', d])` hands back
`{ created: d }` with the Date intact, and the operator arm has always emitted
`{ created: { $gte: d } }` as `['created', '>=', d]` — so converting to an ISO
string or an epoch here would make the shorthand and the operator form emit two
different comparand types for one author intent. The gate is the spec's own
`isAcceptedFilterComparand` rather than a local `instanceof Date`, the same
reason this file already routes operators through the spec's
`normalizeFilterOperator` instead of a second map.

Operator objects are untouched: `{ age: { $gt: 26 } }`, `$in` / `$nin` /
`$between` members, `$null` / `$exists`, the `$regex` / `$not` / bare-array
refusals, and an empty `{}` operator object (still the TRUE identity, still
constraining nothing) all behave exactly as before.
