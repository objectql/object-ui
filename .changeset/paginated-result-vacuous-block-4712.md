---
---

Test-only: `data-objectstack`'s `v3-compat.test.ts` `PaginatedResult API` block asserted
only on an inline object literal it constructed itself, with no import from `./index` or
anywhere else — it could not fail in a way that signalled anything about production code
(objectui#4712). Measured: no interface or export named `PaginatedResult` exists anywhere
in `packages/`; the real production shape it meant to describe is `QueryResult<T>`
(`packages/types/src/data.ts`), returned by `ObjectStackAdapter.find()` via the private
`normalizeQueryResult()`, whose `total`/`hasMore`/`page`/`pageSize` computation had zero
coverage anywhere else in this package. The block now drives `ObjectStackAdapter.find()`
through a mocked transport and asserts on its real returned `QueryResult`, including the
`hasMore` fallback (`records.length === $top`) and the `page` calculation from
`$skip`/`$top` — both previously unexercised. No published behaviour changes.
