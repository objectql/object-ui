---
"@object-ui/data-objectstack": patch
---

refactor(data-objectstack): route `batchTransaction` through the client SDK only, drop the raw-fetch branch

`@objectstack/client@^16` (framework #3271, the current ObjectUI dependency
floor) ships `data.batchTransaction`, so `ObjectStackAdapter.batchTransaction`
now calls the typed SDK method directly. The transitional hand-rolled
`fetch('/api/v1/batch')` branch — a feature-detect shim kept while the SDK
method was unreleased — is removed (#2694). Per AGENTS.md §7, adapter data
always flows through `@objectstack/client`, never a raw `fetch`.

No behavior change: the SDK still drives the server's atomic `POST /api/v1/batch`,
one `MutationEvent` is emitted per committed op (no double-fire), and the adapter
still degrades to the non-atomic `emulateBatchTransaction` when this backend lacks
the endpoint (404/405) or its runtime can't do transactions (501). Every other
status still surfaces to the caller.
