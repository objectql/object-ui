---
---

Internal only — one new test file in `plugin-designer`, no source change, so no release.

`MetadataFieldsPage` reads an object through `MetadataClient.get()` and writes it
straight back with `client.save('object', name, { ...state.raw, fields })`, so
whatever shape `get()` hands back is the shape that lands in the database. Before
objectui#4271 / PR #4545 that was the response envelope
(`{ type, name, item, …ADR-0010 protection carriers }`), which made a routine field
edit persist the envelope OVER the object body — the highest-severity consumer in
#4545's census, and silent data corruption rather than an empty render.

#4545 repaired the contract at the producer, so this page was healed without being
edited — and therefore nothing pinned the save path's WIRE SHAPE. This adds that pin:
five cases driving the page's real read/merge/save chain through a REAL
`MetadataClient` over a fetch double answering the real server envelope, asserting on
the captured PUT body. Nothing mocks `get()` or `save()`; the only double besides the
transport is the presentational `FieldDesigner` leaf, recording its props. Written the
way #4545's suite is, because a double written against the docblock instead of the
wire is exactly what let this defect hide inside 3,628 green tests.

The pin was proven to DISCRIMINATE rather than merely pass: against
`metadata-client.ts` reverted to its pre-#4545 commit, four of the five cases go red
with the envelope-shaped body captured verbatim, and the fifth — a control asserting
only that one PUT fires at the object's own route — stays green in both directions,
which is what shows the red is about the payload and not about a save that never
fired.
