---
'@object-ui/app-shell': patch
'@object-ui/core': patch
---

Resolve a relationship target from `reference` only — the spec spelling
(objectui#6528).

`resolveReferenceTo` (dataset designer) and its sibling
`resolveRelationshipTarget` (`chart-series.ts`) each read a relationship field's
target through a four-spelling tolerant chain — `reference ?? reference_to ??
referenceTo ?? reference_to_object`. Measured against every producer that can
reach them, three of the four are unfounded, so the chain is narrowed to
`reference` in BOTH places in one pass (they must not diverge — a fix leaving
them disagreeing recreates the defect one file over).

The census, with `reference` itself as the positive control every zero is
measured against:

| spelling | `ObjectSchema.safeParse` (spec 17.2.0) | producers on the object-metadata surface |
|---|---|---|
| `reference` | ACCEPTED | live — both designer writers emit it; 445 of 565 lookup/master_detail defs in the framework tree |
| `reference_to` | REFUSED BY NAME | 0 (live only on ObjectUI's own view/field schema — a different contract) |
| `referenceTo` | REFUSED BY NAME | 0 (producers retired by objectui#6041; stripped by the read door since objectui#6519) |
| `reference_to_object` | REFUSED (not even an alias) | 0 anywhere in either tree, outside the chain and its own test |

Behaviour change, and it is deliberate: `chart-series.ts` reads
`GET /meta/object/:name` directly, with no read door stripping retired keys, so
a stored pre-objectui#6041 row spelling the target `referenceTo` no longer
resolves there. The walk is best-effort by construction — no entry is yielded
and the caller keeps the raw value — so such a row degrades visibly instead of
being silently absorbed. Per AGENTS.md #0.1 that row is a producer-side defect,
and a lenient consumer is where it would have stayed hidden. `reference` was
already head of the old chain, so any document carrying both is unaffected.

The string / array / `{ object }` carriers are untouched: the carrier is a
separate axis from the spelling and narrowing it needs its own census.
