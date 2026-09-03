---
---

Removes the shared-`lastItems` race in
`packages/plugin-timeline/src/ObjectTimeline.colorFieldLadder-7243.test.tsx`. No
runtime, type, schema or exported-symbol change — the diff is one test file, so
this declares "not published" rather than a version bump.

The test helper `colorsFor` left every render mounted and waited on
`lastItems.length` alone. React Testing Library's auto-cleanup runs in
`afterEach`, never between two renders inside one `it`, so the two `it`s that
call `colorsFor` twice had two `ObjectTimeline`s alive writing one module-level
`lastItems` — and a length-only predicate cannot say which of them wrote it.

The late write was structural rather than incidental: `ObjectTimeline`'s data
effect lists `objectDef` in its dependencies and a separate metadata fetch sets
`objectDef`, so every mount issues two `find()` calls. The second is still in
flight when the predicate goes green, which left each `colorsFor` returning with
a write queued against a component nothing ever unmounted. Under load that write
landed after the next call had reset `lastItems`, and rung 2 read the previous
rung's colour back out.

Because the failure was load-dependent it could kick any PR that happened to be
in the merge queue, not just changes to `plugin-timeline`.
