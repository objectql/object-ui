---
"@object-ui/react": patch
---

`useMetadataItem` no longer spins forever outside a `<MetadataProvider>` — the "graceful fallback" was the thing that made those consumers impossible to mount.

`useMetadata()` built its no-provider fallback **inline on every call**, so outside a provider
every render produced a new `getItem`. `useMetadataItem` lists `getItem` in its effect deps and,
on the no-name path, called `setState({ item: null, loading: false, error: null })` with a fresh
object each run. New identity → effect re-runs → new state object → re-render → new identity:
an unbreakable loop, synchronous enough to hang inside `render()` rather than fail.

So the fallback documented as the graceful path for consumers mounted outside a provider —
"common in unit tests that only need to assert on rendering" — was precisely what made them
unmountable. `record:alert` and `record:quick_actions` both call `useMetadataItem`
unconditionally; each pinned a core and grew unbounded (8.6 GB before the first kill) on a
`render()` that never returned.

Two changes, at the cause and one layer in:

- The fallback is a frozen module-level singleton, so its identity is stable across renders.
- The clear-state path bails out when the state is already cleared, instead of installing an
  equal-but-new object. That covers the same loop arriving by another route — any caller whose
  context value is rebuilt per render, which this interface explicitly invites ("hand-rolled
  context values in tests keep working").

Found by `apps/console/src/__tests__/record-block-record-reach.test.tsx` (objectui#3149), which
could not mount either block until this was fixed.
