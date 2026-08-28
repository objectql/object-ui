---
'@object-ui/plugin-timeline': patch
---

The bare `timeline` component key is now owned by DECLARATION rather than by
module-evaluation order (objectui#6353).

`packages/plugin-timeline` registers the same short name twice —
`plugin-timeline:timeline` (`src/renderer.tsx`, the presentational renderer) and
`view:timeline` (`src/index.tsx`, the object-bound `ObjectTimelineRenderer`). Neither
passed `skipFallback`, so under `Registry.register` both also claimed the **bare**
`timeline` key and the last module to evaluate won it. `src/index.tsx` re-exports
`./renderer` (line 300) before its own `import` (line 307), so the presentational one
registered first and the object-bound one overwrote it.

The resolved outcome was the intended one and **does not change here**: `type:
'timeline'` still renders `ObjectTimelineRenderer`, which delegates inward to the
presentational renderer. What changes is that it is now decided rather than inherited.
Reordering those two lines would previously have handed `type: 'timeline'` to the
presentational renderer, which reads none of the object-bound keys (`object`, `filter`,
`sort`, `limit`) — an authored timeline would have stopped fetching, with no error and
no failing test. The registry's own collision guard names this remedy in its warning
text; this applies it.

`src/renderer.tsx` now registers with `skipFallback: true`, so only `view:timeline`
claims the bare key, in any evaluation order. The presentational renderer stays
reachable under its explicit `plugin-timeline:timeline` key, which is the lookup a
presentational host already uses — no consumer-visible resolution changes.

`src/__tests__/timeline-bare-key-ownership.test.ts` is the half that outlives the fix:
it fails if the declaration is dropped, if a third registration starts claiming the bare
key, or if resolution becomes order-dependent again. It reads both registrations' real
declared metadata back out of the registry and replays them into a fresh `Registry` in
**both** orders, so order-independence is a property under test rather than a property
of the file the test happens to import.
