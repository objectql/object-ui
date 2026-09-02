---
'@object-ui/core': patch
---

fix(core): `ValueDataSource` applies the filters it is given instead of returning every row

`matchesASTFilter` recognised only two node shapes — a logical `and` / `or` head
and a three-element comparison — and answered `true` for everything else. Three
consequences, all silent: a legacy flat implicit-AND array (`[[…], […]]`) applied
no filter at all, at top level and as a nested child of `and` / `or` alike; the
null-ness operators had no arm, so `is_null` / `is_not_null` selected every row;
and 16 of the spec's 20 canonical view operators — `equals`, `greater_than`,
`starts_with` among them, the spellings `toFilterNode` lowers a stored view's
rules into — fell through the same way.

The matcher now canonicalises operators through the spec's own
`canonicalAstOperator` and reads all four shapes `FilterArraySchema` declares, so
an in-memory `provider: 'value'` list applies the same filter the wire would. An
operator or shape it cannot execute now excludes the row and logs once per
`find()`, rather than passing every row with no signal anywhere.
