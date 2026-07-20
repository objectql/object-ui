---
"@object-ui/data-objectstack": minor
---

feat(data-objectstack): gate the non-atomic batch fallback on the discovery `transactionalBatch` capability (#2693)

`ObjectStackAdapter.batchTransaction` now negotiates atomic cross-object batch
**declaratively** instead of only probing at runtime. At `connect()` the adapter
reads `capabilities.transactionalBatch` from `GET /api/v1/discovery`
(framework #3298 — `declared === enforced`; the server advertises `true` only
when the `/batch` route is mounted *and* the runtime engine can honour a
transaction):

- **Declared `true`** — the adapter TRUSTS server atomicity: it calls `/batch`
  and surfaces any failure (including `404`/`405`/`501`) as a real error. No
  runtime probe, no non-atomic client-side compensation.
- **Declared `false`, or absent** (backend predates #3298) — the legacy path is
  unchanged: probe `/batch` and, on `404`/`405`/`501`, fall back to the
  non-atomic `emulateBatchTransaction`. Keeping this avoids regressing older
  backends from "saves, less safe" to "no save path" (#2679 compat constraint).

Both the hierarchical wire shape (`{ transactionalBatch: { enabled: true } }`)
and the flat form the client SDK normalizes to (`{ transactionalBatch: true }`)
are accepted. `@object-ui/core`'s generic `emulateBatchTransaction` /
`runBatchTransaction` are untouched and remain the fallback for adapters with no
server-side transaction (`ValueDataSource`, `MockDataSource`, …).

Docs: the adapter README and the data-source guide now document the capability
table and the minimum-backend note — atomic cross-object saves are guaranteed
only against backends advertising the capability (framework #3298 / #1604).

Picks up #2679 acceptance item 4; unblocked by framework#3298 (merged).
