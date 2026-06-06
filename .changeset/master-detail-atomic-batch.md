---
"@object-ui/data-objectstack": minor
"@object-ui/plugin-form": minor
"@object-ui/types": minor
---

Atomic master-detail create via the cross-object transactional batch endpoint (ObjectStack #1604).

When the server exposes the transactional batch endpoint, a NEW parent record and its child line items are now persisted in ONE server transaction — commit all or roll back all — instead of the previous client-orchestrated "create parent → create children → best-effort cleanup on failure" sequence.

**`@object-ui/data-objectstack` — `ObjectStackAdapter.batchTransaction(operations)`**

- New method posting `{ operations }` to `POST /api/v1/batch`. Operations run in one server transaction. A field value of `{ $ref: <earlier op index> }` resolves to that op's generated id, so a child can reference its parent created earlier in the same batch (master-detail FK). Throws `ObjectStackError('BATCH_ERROR')` on a non-2xx response.

**`@object-ui/plugin-form`**

- `MasterDetailForm` now detects `dataSource.batchTransaction` and, on a NEW parent, builds one atomic batch (parent at index 0, each child FK set to `{ $ref: 0 }`) via the new pure helper `buildMasterDetailBatch`. Client-side total rollups are merged into the parent payload before the batch. Edit mode and adapters without `batchTransaction` keep the existing client-orchestrated path.
- `ObjectForm` gained a `submitHandler` hook: when supplied, the form validates and hands the collected values to the host instead of calling `dataSource.create` / `dataSource.update`. `MasterDetailForm` uses it to own the atomic parent+children write while the parent fields are still rendered by `ObjectForm`.

**`@object-ui/types`**

- `ObjectFormSchema.submitHandler?: (values) => any | Promise<any>` — typed override for host-owned persistence.

Pairs with the framework-side ambient-transaction fix (ObjectQL `AsyncLocalStorage` transaction propagation) and the `/api/v1/batch` endpoint added in `@objectstack/rest`.
