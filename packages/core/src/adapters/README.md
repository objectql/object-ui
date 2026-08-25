# Data Source Adapters

This directory holds the `DataSource` adapters that ship **inside
`@object-ui/core`** — the backend-agnostic ones, with no external SDK
dependency. They are what a schema's `viewData` block resolves to at runtime.

> **Looking for the ObjectStack adapter?** It is not in this directory.
> `ObjectStackAdapter` / `createObjectStackAdapter` ship as their own package,
> **[`@object-ui/data-objectstack`](../../../data-objectstack/README.md)**,
> whose README owns the ObjectStack material — connection handling, metadata
> caching, error hierarchy, and the filter-operator and query-parameter
> translation tables.

## Available Adapters

Every export below is re-exported from the package root, so consumers import
them from `@object-ui/core`.

| Export | Kind | Role |
| --- | --- | --- |
| `ApiDataSource` | class | `provider: 'api'` — raw HTTP against the `HttpRequest` configs carried in `ViewData` |
| `ValueDataSource` | class | `provider: 'value'` — an in-memory array; no network at all |
| `resolveDataSource` | function | builds the adapter a `ViewData` config asks for (`object` / `api` / `value`) |
| `runBatchTransaction` / `emulateBatchTransaction` | functions | ordered cross-object save — the adapter's own `batchTransaction` when it has one, a sequential non-atomic emulation when it does not |

Backend-specific adapters live in their own packages rather than here; today
that is `@object-ui/data-objectstack`.

### `ApiDataSource`

For `provider: 'api'`. The endpoint comes from the `HttpRequest` configs, not
from the `resource` argument — `find`/`findOne` use `read`, and
`create`/`update`/`delete` use `write` (falling back to `read` when `write` is
absent). `QueryParams` are flattened onto the query string.

```typescript
import { ApiDataSource } from '@object-ui/core';

const dataSource = new ApiDataSource({
  read: { url: 'https://api.example.com/users', method: 'GET' },
  write: { url: 'https://api.example.com/users' },
  defaultHeaders: { Authorization: 'Bearer …' },
  // fetch: customFetch,   // optional; defaults to globalThis.fetch
});

const { data, total } = await dataSource.find('users', { $top: 20 });
```

A generic HTTP endpoint exposes no metadata, so `getObjectSchema()` returns a
minimal stub (`{ name, fields: {} }`) and `getView()` / `getApp()` return
`null` — enough that schema-dependent components do not crash.

### `ValueDataSource`

For `provider: 'value'`. Everything runs against an in-memory array, which is
deep-cloned on construction so the caller's array is never mutated. Useful for
static content, fixtures, and previews.

```typescript
import { ValueDataSource } from '@object-ui/core';

const dataSource = new ValueDataSource({
  items: [
    { id: '1', name: 'Alice', age: 30 },
    { id: '2', name: 'Bob', age: 24 },
  ],
  // idField: 'id',   // optional; defaults to `id`, then `_id`
});

const { data, total } = await dataSource.find('people', {
  $filter: { age: { $gte: 25 } },
  $orderby: { name: 'asc' },
});
```

It implements `$filter` (both MongoDB-style objects and FilterNode AST arrays),
`$search`, `$orderby`, `$skip`, `$top` and `$select` locally, plus `bulk()`,
`aggregate()` and `onMutation()`. `getAll()` returns a cloned snapshot and
`count` the current length.

### `resolveDataSource`

Turns a `ViewData` config into a concrete adapter. This is the function a
renderer calls; components do not branch on `provider` themselves.

```typescript
import { resolveDataSource } from '@object-ui/core';

const dataSource = resolveDataSource(
  { provider: 'api', read: { url: '/api/users' } },
  contextDataSource, // used for `provider: 'object'`, and as the fallback
);
```

| `viewData.provider` | Result |
| --- | --- |
| `'object'` | the `fallback` — the `DataSource` from context, typically `ObjectStackAdapter` |
| `'api'` | a new `ApiDataSource` built from `read` / `write` |
| `'value'` | a new `ValueDataSource` over `items` |
| unknown, or no `viewData` | the `fallback`, else `null` |

### `runBatchTransaction` / `emulateBatchTransaction`

The single entry point for an ordered **cross-object** save (the master-detail
case). `runBatchTransaction` calls the adapter's native `batchTransaction` when
it implements one — `ObjectStackAdapter` does, and against a backend
advertising `capabilities.transactionalBatch` that is a real server
transaction — and otherwise falls back to `emulateBatchTransaction`. Callers
stay ignorant of which one ran.

```typescript
import { runBatchTransaction } from '@object-ui/core';

// `{ $ref: 0 }` resolves to the id minted by operation 0 (the parent).
await runBatchTransaction(dataSource, [
  { object: 'invoice',      action: 'create', data: { no: 'INV-1' } },
  { object: 'invoice_line', action: 'create', data: { invoice: { $ref: 0 }, amount: 10 } },
]);
```

⚠️ The emulation is **not** atomic. It runs the operations in order and, on
failure, best-effort deletes the records it created (children before parent)
before rethrowing; updates and deletes that already ran cannot be undone, and a
create's side effects (hooks, rollups, webhooks) are not undone by a later
delete. It exists so a save is still possible against a backend without server
atomicity — see
[`@object-ui/data-objectstack`](../../../data-objectstack/README.md#cross-object-atomic-batch-batchtransaction)
for the capability negotiation that decides which path is taken.

## Creating Custom Adapters

To create a custom adapter, implement the `DataSource<T>` interface:

```typescript
import type { DataSource, QueryParams, QueryResult } from '@object-ui/types';

export class MyCustomAdapter<T = any> implements DataSource<T> {
  async find(resource: string, params?: QueryParams): Promise<QueryResult<T>> {
    // Your implementation
  }
  
  async findOne(resource: string, id: string | number): Promise<T | null> {
    // Your implementation
  }
  
  async create(resource: string, data: Partial<T>): Promise<T> {
    // Your implementation
  }
  
  async update(resource: string, id: string | number, data: Partial<T>): Promise<T> {
    // Your implementation
  }
  
  async delete(resource: string, id: string | number): Promise<boolean> {
    // Your implementation
  }
  
  // Optional: bulk operations
  async bulk?(resource: string, operation: string, data: Partial<T>[]): Promise<T[]> {
    // Your implementation
  }
}
```

## Related Packages

- `@object-ui/types` — the `DataSource`, `QueryParams` and `ViewData` definitions these adapters implement
- `@object-ui/data-objectstack` — the ObjectStack Protocol adapter, and the owner of the ObjectStack documentation
- `@objectstack/client` — ObjectStack Client SDK (a dependency of `@object-ui/data-objectstack`, not of `@object-ui/core`)
- `@objectstack/spec` — ObjectStack Protocol Specification
