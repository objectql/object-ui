---
'@object-ui/core': minor
'@object-ui/data-objectstack': patch
'@object-ui/plugin-grid': patch
---

Grid headers offer a sort click only on columns the PLATFORM says it will order by
(objectui#5729 — the consumer leg of objectstack#10235, maintainer ruling A, 2026-08-23:
the platform serves an explicit per-column sortability signal and the grid reads it,
rather than re-deriving "virtual ⇒ unsortable" from field type).

`GET /api/v1/meta/object/:name` now answers with a `sortability` projection on its
ENVELOPE — `{ fields: { [name]: { sortable, reason?, caveat? } } }`, computed at serve
time from the platform's own storage predicates, deliberately beside `item` rather than
inside it so the key stays un-authorable. The signal was reaching the browser and being
discarded one line before its only consumer: `ObjectStackAdapter.getObjectSchema` unwraps
the envelope to `item`, so every UI reader saw a document with no signal on it. It now
survives that unwrap, carried on the schema under a symbol key — invisible to
`JSON.stringify`, to `Object.keys` and to a spread, so a schema handed back at a metadata
write endpoint can never take it into a body the server parses strictly.

`@object-ui/core` gains the one spelling of the consumer contract:
`isPlatformSortableField(projection, name)` is `true` iff an entry EXISTS for the name and
says `sortable: true`. Absence is a refusal — it is how the platform encodes an unknown
name, a dotted path and an unprovisioned audit column, all three of which the runtime
doors reject — so the `!== false` spelling every other optional flag in this repo uses
would get exactly that family backwards. A projection that is absent ALTOGETHER is a
different question with a different answer (`undefined`: no signal was served) and is
typed apart from an empty one, so a deployment older than the upstream change keeps the
behaviour it had rather than being told, falsely, that nothing on the object is sortable.

Three things follow in the grid. The header click on a refused column ceases to exist, so
neither the old silent-unordered result nor the `400 INVALID_SORT` that replaced it is
reachable from it. A sort PERSISTED before the signal existed is filtered out of both what
the grid renders and what it emits, so a restored personalization cannot ride back into
the next `persistViewPatch({ sort })` — the half-fix where the affordance is gone and the
PUT still fires. And the relational carve-out is untouched and deliberately not delegated
to this signal: the platform answers `sortable: true` for a `lookup` (it has a stored
foreign key and both runtime doors accept ordering by it), while the grid withholds that
header for a different reason — a column of names ordered by an invisible id.

Columns carrying `caveat: 'unprovisioned-anchor'` keep their click. The runtime accepts
those sorts; refusing what the platform does not refuse would recreate declared-≠-enforced
drift in mirror image.
