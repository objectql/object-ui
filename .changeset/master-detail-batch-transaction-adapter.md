---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/data-objectstack": minor
"@object-ui/plugin-form": minor
"@object-ui/runner": minor
---

feat(data): unify master-detail saves behind `DataSource.batchTransaction`, isolate the non-atomic fallback in the adapter (#2679)

Master-detail saves (`MasterDetailForm`, `LineItemsPanel`) now always persist
through `dataSource.batchTransaction(operations)` — one ordered cross-object
operation list, with `{ $ref: <op index> }` linking a child to a parent created
in the same batch. The form no longer contains any client-side orchestration or
best-effort compensation-delete; that atomicity anti-pattern is gone from the UI
layer (framework #1604 / framework ADR-0034 item 4).

- **`@object-ui/types`** — `batchTransaction?` is now a first-class (optional)
  method on the `DataSource` contract, typed via `BatchTransactionOperation` /
  `BatchRef`. Replaces the previous `(dataSource as any).batchTransaction`
  method-sniffing.
- **`@object-ui/core`** — new `emulateBatchTransaction(dataSource, operations)`
  (sequential writes, `$ref` resolution, best-effort reverse-order compensation)
  and `runBatchTransaction(dataSource, operations)` (prefers the adapter's method,
  emulates otherwise). `ApiDataSource` / `ValueDataSource` implement
  `batchTransaction` via the emulation.
- **`@object-ui/data-objectstack`** — `ObjectStackAdapter.batchTransaction` uses
  the server's atomic `POST /api/v1/batch`, prefers the typed
  `client.data.batchTransaction` SDK method when the installed client exposes it,
  and degrades to the client-side emulation ONLY when the endpoint is missing
  (404/405) or the runtime can't do transactions (501). Real errors (400/401/403/
  409/500) still surface. This is the isolated, tested home of the non-atomic
  fallback.
- **`@object-ui/plugin-form`** — removed `applyDetail` / `createMany` /
  `ApplyDetailResult` from `masterDetailTx.ts`; `MasterDetailForm` and
  `LineItemsPanel` build ops and call `runBatchTransaction`. `LineItemsPanel`
  saves are now atomic on a capable backend, with the rollup folded into the same
  batch.

No behavior change on a current ObjectStack backend (it has `/api/v1/batch`);
older/limited backends keep a working — now clearly non-atomic — save path.
