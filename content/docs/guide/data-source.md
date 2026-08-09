---
title: "Data Connectivity"
---

ObjectUI follows the **Universal Adapter Pattern**. UI components do not hardcode transport details. They receive a `DataSource` implementation from `SchemaRendererProvider` and call a stable CRUD/query contract.

This keeps the renderer backend-agnostic: ObjectStack, REST, GraphQL, and proprietary backends can all be adapted behind the same interface.

## The Interface

The canonical interface lives in `@object-ui/types`:

```typescript
import type { QueryParams, QueryResult } from '@object-ui/types';

export interface DataSource<T = unknown> {
  find(resource: string, params?: QueryParams): Promise<QueryResult<T>>;
  findOne(resource: string, id: string | number, params?: QueryParams): Promise<T | null>;
  create(resource: string, data: Partial<T>): Promise<T>;
  update(
    resource: string,
    id: string | number,
    data: Partial<T>,
    opts?: { ifMatch?: string },
  ): Promise<T>;
  delete(
    resource: string,
    id: string | number,
    opts?: { ifMatch?: string },
  ): Promise<boolean>;

  // Optional: atomically persist an ordered set of cross-object operations
  // (master-detail save). `{ $ref: <op index> }` links a child to a parent
  // created earlier in the same batch. Adapters without server-side atomicity
  // may emulate it — see below.
  batchTransaction?(
    operations: BatchTransactionOperation[],
  ): Promise<{ results: any[] }>;

  getObjectSchema(objectName: string): Promise<unknown>;
}
```

`find()` returns a `QueryResult<T>` so components can receive both rows and pagination metadata:

```typescript
interface QueryResult<T = unknown> {
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  cursor?: string;
  metadata?: Record<string, unknown>;
}
```

## Available Adapters

### ObjectStack Adapter (Official)

Use `@object-ui/data-objectstack` for ObjectStack-compatible backends.

```bash
pnpm add @object-ui/data-objectstack
```

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.your-instance.com'
});
```

## Usage

Inject the data source at the renderer boundary:

```tsx
import '@object-ui/components';
import '@object-ui/fields';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com'
});

function App() {
  return (
    <SchemaRendererProvider dataSource={dataSource}>
      <SchemaRenderer schema={mySchema} />
    </SchemaRendererProvider>
  );
}
```

## Creating a Custom Adapter

If you have a proprietary backend, wrap its SDK or client in a `DataSource` implementation. Keep transport details in the adapter, not in renderers.

```typescript
import type { DataSource, QueryParams, QueryResult } from '@object-ui/types';

type User = {
  id: string;
  name: string;
  email: string;
};

type BackendClient = {
  listUsers(params?: QueryParams): Promise<{ rows: User[]; total?: number }>;
  getUser(id: string | number): Promise<User | null>;
  createUser(data: Partial<User>): Promise<User>;
  updateUser(id: string | number, data: Partial<User>): Promise<User>;
  deleteUser(id: string | number): Promise<boolean>;
  describeObject(name: string): Promise<unknown>;
};

class UserDataSource implements DataSource<User> {
  constructor(private readonly client: BackendClient) {}

  async find(resource: string, params?: QueryParams): Promise<QueryResult<User>> {
    if (resource !== 'users') {
      return { data: [], total: 0 };
    }

    const result = await this.client.listUsers(params);
    return {
      data: result.rows,
      total: result.total,
    };
  }

  findOne(_resource: string, id: string | number): Promise<User | null> {
    return this.client.getUser(id);
  }

  create(_resource: string, data: Partial<User>): Promise<User> {
    return this.client.createUser(data);
  }

  update(_resource: string, id: string | number, data: Partial<User>): Promise<User> {
    return this.client.updateUser(id, data);
  }

  delete(_resource: string, id: string | number): Promise<boolean> {
    return this.client.deleteUser(id);
  }

  getObjectSchema(objectName: string): Promise<unknown> {
    return this.client.describeObject(objectName);
  }
}
```

## Query Parameters

ObjectUI uses OData-style query keys for broad compatibility:

```typescript
await dataSource.find('users', {
  $select: ['id', 'name', 'email'],
  $filter: { status: 'active' },
  $orderby: { name: 'asc' },
  $skip: 0,
  $top: 25,
  $count: true,
});
```

Data-aware plugins may also use optional methods such as `batchTransaction`, `bulkUpdate`, `bulkDelete`, `getView`, or `listViewOverrides` when an adapter supports them. Keep the required CRUD methods implemented first, then add optional capabilities as your UI needs them.

### Cross-object atomic writes (`batchTransaction`)

Master-detail saves (a parent record plus its child line items) go through
`dataSource.batchTransaction(operations)` — one ordered list of cross-object
create/update/delete operations, where a child's foreign key can be
`{ $ref: <parent op index> }` to point at a parent created in the same batch.
The `@object-ui/data-objectstack` adapter maps this to the published
`@objectstack/client` `data.batchTransaction` SDK method, which drives the
server's atomic `POST /api/v1/batch` endpoint (commit-all-or-roll-back-all).
Adapters without a
transactional endpoint don't need to hand-write orchestration: call
`emulateBatchTransaction(dataSource, operations)` from `@object-ui/core`, which
executes the operations sequentially (resolving `$ref`s) with best-effort
compensation on failure. UI components never branch on atomicity — they call
`runBatchTransaction(dataSource, operations)` (also from `@object-ui/core`),
which uses the adapter's method when present and emulates otherwise.

The `@object-ui/data-objectstack` adapter decides whether it can trust server
atomicity **declaratively**, at connect time: it reads the
`capabilities.transactionalBatch` flag from `GET /api/v1/discovery`
(framework #3298). When the backend advertises `true`, the adapter treats any
`/batch` failure as a real error — no non-atomic client-side compensation. When
the flag is `false` or absent (a backend predating #3298), it keeps the legacy
behaviour: probe `/batch` and fall back to the non-atomic emulation on
`404`/`405`/`501`. Atomic cross-object saves are therefore guaranteed only
against backends that advertise the capability; older ones still save, but
best-effort. See the
[adapter README](https://github.com/objectstack-ai/objectui/blob/main/packages/data-objectstack/README.md#cross-object-atomic-batch-batchtransaction)
for the full capability table and minimum-backend note.

## Per-element data binding on a page (`dataSource`)

A metadata page component carries its own data binding —
`PageComponentSchema.dataSource`, the spec's `ElementDataSourceSchema` — so one
page can show several objects without a page-level object context:

```json
{
  "type": "list-view",
  "dataSource": { "object": "account", "view": "hot", "limit": 10 }
}
```

This is metadata, **not** the data-source adapter. The two share a name and are
different things: the adapter is injected by the host (`SchemaRendererProvider`),
while `dataSource` on a schema node is JSON describing *what to query*. A
renderer therefore reads the binding off `schema.dataSource` and gets its adapter
from context — never from a prop the schema could occupy. `SchemaRenderer` strips
the binding from the props it spreads for exactly this reason.

`view` names a **saved view** of that object; its columns, filter, sort and page
size are applied to the render, so a page never has to keep a second copy of a
view's configuration. `filter` is *additional* criteria — it AND-combines with the
view's filter rather than replacing it — while `sort` and `limit` override the
view's. A `view` name that does not resolve is reported as a configuration error;
it never degrades into an unfiltered query for the object.

`@object-ui/react` exposes `useElementDataSource(schema, dataSource?)` for
renderers that need the same resolution, and `@object-ui/core` exposes the pure
parts (`isElementDataSourceConfig`, `resolveSavedView`,
`composeElementDataSource`).

### Which blocks consume it, and which keys each one honours

The binding is declared on every page component, but a component can only honour
the keys it has a read site for — a calendar has no page to cap, a metric is one
aggregated number, a form edits one record. Each block therefore maps the keys it
reads and leaves the rest alone; a key written onto a schema slot the block
ignores would be accepted and dropped, which is the defect this binding removes.

| block | `object` | `view` | `filter` | `sort` | `limit` |
|---|---|---|---|---|---|
| `list-view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `object-grid` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `element:record_picker` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `record:related_list` | ✅ | columns / sort / limit | — (see below) | ✅ | ✅ |
| `object-calendar` | ✅ | filter / sort | ✅ | ✅ | — no row cap |
| `object-kanban` | ✅ | filter | ✅ | — no ordering | — fixed window |
| `object-chart` | ✅ | filter | ✅ | — engine orders | — no page |
| `object-metric` | ✅ | filter | ✅ | — single value | — single value |
| `object-form` | ✅ | error-checked only | — no collection query | — | — |

Reading the `view` column: it lists what a named saved view actually contributes
on that block. A view name that does not resolve is reported as a configuration
error on **every** block in the table, including the ones that take nothing else
from the view — so a typo never passes silently, whatever the block.

Two current gaps, recorded rather than papered over:

- `record:related_list` declares a flat `filter` its renderer does not read (the
  list scopes itself by the parent relationship alone), so a view named there
  contributes columns / sort / limit and its filter is dropped — the list can be
  wider than the view it names.
- `object-form` resolves `view` only to report an unresolvable name; a view that
  does resolve contributes nothing, because a list view's columns are not a form
  layout.

Blocks not in the table (`object-gantt`, `object-timeline`, `object-map`,
`object-pivot`, `dashboard`, the other `record:*` panels) do not consume the
binding yet.
