---
'@object-ui/app-shell': patch
'@object-ui/core': patch
---

Resolve a relationship target from a `reference` STRING only — the carrier axis
(objectui#6648).

objectui#6528 narrowed both relationship-target resolvers to the single spec
SPELLING `reference` and left the CARRIER — the shape the value may take —
explicitly for its own census. That census is done, and it says the same thing:
`resolveReferenceTo` (dataset designer) and its sibling
`resolveRelationshipTarget` (`chart-series.ts`) each accepted three carriers on
the canonical key, two of which `FieldSchema` never declared. Both are removed
in BOTH files in one pass (they must not diverge — a fix leaving them
disagreeing recreates the defect one file over).

The measurement, with the bare string as the positive control every zero is
measured against:

| carrier | `ObjectSchema.safeParse` (spec 17.2.0) | producers at the field-def key position |
|---|---|---|
| `reference: 'crm_account'` | ACCEPTED | live — 587 across both trees |
| `reference: ['crm_account']` | REFUSED — `expected string, received array` | 0 |
| `reference: { object: 'crm_account' }` | REFUSED — `expected string, received object` | 0 |

The census walked STRUCTURE, not text: JSON/YAML parsed and walked, TS/TSX read
through the TypeScript compiler API, each hit recorded with its ancestor
property chain and its enclosing object's sibling keys so a FIELD DEF is
separated from the other tiers that also spell `reference` (a form field
literally named `reference`, its translation entries, a JSON-Schema property
descriptor, a liveness-ledger row). Every dynamic initializer at the field-def
position resolved to a string-typed source, and every `reference` TYPE
declaration in either tree declares `string`. The detector is not blind to the
shape it hunted — it DID report array and `{ object }` carriers, and every one
was a test asserting this very tolerance plus one framework lint fixture whose
own rule already reads string-only.

The array branch was also a silent PRODUCT decision: handed a multi-target
value it returned element zero and DISCARDED the rest. Nothing declares such a
value. Polymorphic lookup is an open, unbuilt gap in the spec's own audit report
("Current `reference` only supports a single target", Tier 3), and the
platform's one polymorphic reference (ADR-0018 `xRef`) is a STRING with a
sibling discriminator, never a list. A multi-target lookup, if it lands, lands
as a declared spec shape — not as a carrier a consumer guesses at.

Behaviour change, and it is deliberate: a field def whose `reference` is not a
non-empty string now resolves to `undefined` in both helpers. Such a document is
already refused by `ObjectSchema`, so per AGENTS.md #0.1 it is a producer-side
defect, and a lenient consumer is exactly where it would have stayed hidden. The
two unit assertions that pinned the tolerant reads are converted to refusal
pins, so re-widening the carrier turns red.
