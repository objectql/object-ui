---
---

Internal only, no behaviour change: `@object-ui/data-objectstack`'s
`normaliseClientError` carried two stacked `CONCURRENT_UPDATE` guards whose
first could never decide an outcome — its condition
(`code !== 'CONCURRENT_UPDATE' && httpStatus !== 409`) is strictly stronger
than the line below it, so every input it would have returned was returned
one line later anyway. Its `httpStatus !== 409` half advertised a second
acceptance path (a bare 409 still being re-wrapped) that never existed, on the
one function whose whole job is deciding which errors get re-wrapped. Deleted,
with the effective rule — the wire `code` is the sole discriminator — written
where the dead line used to be.

Also aligned the doc comment above the exported `isConcurrentUpdateError` with
the predicate underneath it: the doc named only the wire shape while the code
accepts `name === 'ConcurrentUpdateError'` as well. The `name` limb is kept —
it is the deliberate cross-realm discriminator that
`isViewConfigPermissionDeniedError`'s doc already cites this function as its
precedent for — and the doc now says so.

Both accepted sets (the re-wrap's and the predicate's) are now pinned as an
explicit truth table in `packages/data-objectstack/src/occ.test.ts`.
