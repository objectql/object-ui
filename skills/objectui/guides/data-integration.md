---
name: objectui-data-integration
description: Connect Object UI to data backends using DataSource adapters, MSW mocking, and query APIs. Use this skill when the user asks to fetch data for Object UI components, wire a REST/GraphQL/ObjectQL API to SchemaRenderer, set up mock data with MSW for frontend-first development, implement DataSource interface methods (find, create, update, delete), configure SchemaRendererProvider with a dataSource, debug data loading issues, or build offline-capable data flows. Also applies when the user mentions CRUD operations, pagination, filtering, sorting, aggregate queries, real-time subscriptions, or data binding issues with Object UI.
---

# ObjectUI Data Integration

Use this skill to connect Object UI's schema-driven rendering to real or mock data backends. The DataSource interface is the universal adapter between the UI layer and any API protocol.

## Architecture

```
┌─────────────────────────────┐
│  Schema-Driven UI Layer     │
│  (SchemaRenderer, Plugins)  │
├─────────────────────────────┤
│  SchemaRendererProvider     │  ← dataSource prop
├─────────────────────────────┤
│  DataSource Interface       │  ← universal API contract
├─────────────────────────────┤
│  Adapter Implementation     │
│  (ObjectStack, REST, Mock)  │
└─────────────────────────────┘
```

Components never import fetch libraries directly. They access data through `useDataScope(path)` or the DataSource methods from context.

## DataSource interface

Defined in `packages/types/src/data.ts`:

```typescript
interface DataSource<T = any> {
  // Core CRUD (required)
  find(resource: string, params?: QueryParams): Promise<QueryResult<T>>;
  findOne(resource: string, id: string | number, params?: QueryParams): Promise<T | null>;
  create(resource: string, data: Partial<T>): Promise<T>;
  update(resource: string, id: string | number, data: Partial<T>): Promise<T>;
  delete(resource: string, id: string | number): Promise<boolean>;

  // Schema introspection (required)
  getObjectSchema(objectName: string): Promise<any>;

  // Bulk operations (optional)
  bulk?(resource: string, op: 'create' | 'update' | 'delete', data: Partial<T>[]): Promise<T[]>;

  // View support (optional)
  getView?(objectName: string, viewId: string): Promise<any | null>;
  saveView?(objectName: string, viewId: string, config: any): Promise<any>;

  // Analytics (optional)
  aggregate?(resource: string, params: AggregateParams): Promise<AggregateResult>;

  // Custom actions (optional)
  execute?(resource: string, action: string, params?: any): Promise<any>;

  // Real-time (optional)
  onMutation?(callback: (event: MutationEvent) => void): () => void;
}
```

### QueryParams

```typescript
interface QueryParams {
  filter?: Record<string, any>;   // WHERE conditions
  sort?: SortConfig[];            // ORDER BY [{field, direction}]
  limit?: number;                 // LIMIT (page size)
  offset?: number;                // OFFSET (for pagination)
  fields?: string[];              // SELECT specific fields
  expand?: string[];              // JOIN/expand related objects
}
```

### QueryResult

```typescript
interface QueryResult<T = any> {
  records?: T[];                  // Returned data array
  pageSize?: number;              // Items per page
  pageNumber?: number;            // Current page (1-indexed)
  total?: number;                 // Total count for pagination
  hasMore?: boolean;              // Cursor-based pagination flag
  cursor?: string;                // Next page cursor
}
```

## Wiring DataSource to SchemaRenderer

### Basic setup

```typescript
import { SchemaRendererProvider, SchemaRenderer } from '@object-ui/react';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = new ObjectStackAdapter({
  baseUrl: '/api/v1',
});

function App() {
  return (
    <SchemaRendererProvider dataSource={dataSource}>
      <SchemaRenderer schema={pageSchema} />
    </SchemaRendererProvider>
  );
}
```

### With authentication

```typescript
import { createAuthenticatedFetch } from '@object-ui/auth';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

const authClient = createAuthClient({ baseURL: '/api/v1/auth' });
const authenticatedFetch = createAuthenticatedFetch(authClient);

const dataSource = new ObjectStackAdapter({
  baseUrl: '/api/v1',
  fetch: authenticatedFetch,  // Injects Bearer token automatically
});
```

### Static data (no backend)

For prototypes or static pages, pass a plain object as dataSource:

```typescript
const staticData = {
  customers: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ],
  metrics: { total: 2, active: 1 },
  userRole: 'admin',
};

<SchemaRendererProvider dataSource={staticData}>
  <SchemaRenderer schema={schema} />
</SchemaRendererProvider>
```

Components that read `bind` (see "Via `bind` + `useDataScope`" below) will then
access `staticData.customers` when given `bind: "customers"`.

## ObjectStackAdapter

The built-in adapter for ObjectStack backends (`packages/data-objectstack`).

### Constructor options

```typescript
new ObjectStackAdapter({
  baseUrl: string;               // API base URL
  token?: string;                // Static API token
  autoReconnect?: boolean;       // Auto-reconnect on disconnect (default: true)
  maxReconnectAttempts?: number;  // Max retry count (default: 5)
  fetch?: typeof fetch;          // Custom fetch (for auth token injection)
});
```

### Connection management

```typescript
const adapter = new ObjectStackAdapter({ baseUrl: '/api/v1' });

// Listen for connection state changes
adapter.onConnectionStateChange((event) => {
  console.log(event.state); // 'connected' | 'disconnected' | 'error'
});

// Listen for batch progress
adapter.onBatchProgress((event) => {
  console.log(`${event.percentage}% complete`);
});
```

## How components access data

### Via `bind` + `useDataScope`

A component reads the `bind` field only if it calls `useDataScope`:

```json
{
  "type": "list",
  "bind": "customerNames"
}
```

Inside the component: `const data = useDataScope("customerNames")` resolves to
the `customerNames` array from the dataSource.

`useDataScope` is called by `list` and `tree-view` in `@object-ui/components`,
and by the `object-*` widgets the plugin packages register (`object-grid`,
`object-kanban`, `object-chart`, `object-data-table`, `object-gallery`,
`object-timeline`, `object-pivot`). Every other component ignores `bind`
completely — no error, no warning, nothing in the console.

`data-table` is not among them, which is the trap worth knowing by name: it
takes its rows from an inline `data` array on the node, so a bound `data-table`
renders a correct-looking header over an empty body, with nothing thrown and
nothing logged.

```json
{
  "type": "data-table",
  "data": [
    { "name": "Ada Lovelace", "email": "ada@example.com" },
    { "name": "Grace Hopper", "email": "grace@example.com" }
  ],
  "columns": [
    { "name": "name", "label": "Name" },
    { "name": "email", "label": "Email" }
  ]
}
```

### Via expressions on the node

Computed values go through the expression system. `content` is the text key that
is both expression-evaluated and read back by the renderer, and the provider's
`dataSource` is reachable under the `data` root:

```json
{
  "type": "card",
  "title": "Total Customers",
  "children": [
    { "type": "text", "content": "${data.metrics.total} customers" }
  ]
}
```

A `statistic`'s `label` / `value` / `description` are read off the node but are
**not** expression-evaluated, so give them values the host already resolved:

```json
{
  "type": "statistic",
  "label": "Total Customers",
  "value": "128",
  "description": "+12 this week",
  "trend": "up"
}
```

Do not reach for a `props` envelope to get an expression evaluated — values
inside it are evaluated and then handed over as React props, which these
renderers never read, so the component paints an empty frame.

### Via DataSource methods (in plugin code)

Plugin components that need CRUD operations access the DataSource from context:

```typescript
import { useSchemaContext } from '@object-ui/react';

function MyPlugin() {
  const { dataSource } = useSchemaContext();

  const loadData = async () => {
    const result = await dataSource.find('contacts', {
      filter: { active: true },
      sort: [{ field: 'name', direction: 'asc' }],
      limit: 20,
    });
    return result.records;
  };
}
```

## MSW mock setup (frontend-first development)

For developing the UI without a running backend, use Mock Service Worker with ObjectStack's in-browser kernel.

### Browser mock server

```typescript
// src/mocks/browser.ts
import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';

export async function startMockServer(appConfig: any) {
  const kernel = new ObjectKernel({ skipSystemValidation: true });

  await kernel.use(new ObjectQLPlugin());

  const driver = new InMemoryDriver();
  await kernel.use(new DriverPlugin(driver, 'memory'));
  await kernel.use(new AppPlugin(appConfig));
  await kernel.use(new MSWPlugin({
    enableBrowser: true,
    baseUrl: '/api/v1',
    logRequests: true,
  }));

  await kernel.bootstrap();

  // Seed initial data
  if (appConfig.manifest?.data) {
    for (const dataset of appConfig.manifest.data) {
      for (const record of dataset.records) {
        await driver.create(dataset.object, record);
      }
    }
  }
}
```

### App entry with MSW

```typescript
// src/main.tsx
import { startMockServer } from './mocks/browser';
import appConfig from '../objectstack.config';

async function bootstrap() {
  if (import.meta.env.DEV) {
    await startMockServer(appConfig);
  }

  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(<App />);
}

bootstrap();
```

### Test DataSource helper

```typescript
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

export function createTestDataSource() {
  return new ObjectStackAdapter({ baseUrl: '/' });
}
```

## Building a custom DataSource adapter

If your backend isn't ObjectStack-compatible, implement the DataSource interface:

```typescript
import type { DataSource, QueryParams, QueryResult } from '@object-ui/types';

export class RestApiAdapter implements DataSource {
  constructor(private baseUrl: string) {}

  async find(resource: string, params?: QueryParams): Promise<QueryResult> {
    const url = new URL(`${this.baseUrl}/${resource}`);
    if (params?.filter) url.searchParams.set('filter', JSON.stringify(params.filter));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    if (params?.offset) url.searchParams.set('offset', String(params.offset));
    if (params?.sort) url.searchParams.set('sort', JSON.stringify(params.sort));

    const res = await fetch(url.toString());
    const data = await res.json();

    return {
      records: data.items,
      total: data.totalCount,
      pageSize: params?.limit,
    };
  }

  async findOne(resource: string, id: string | number): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${resource}/${id}`);
    return res.json();
  }

  async create(resource: string, data: Partial<any>): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${resource}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async update(resource: string, id: string | number, data: Partial<any>): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${resource}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async delete(resource: string, id: string | number): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/${resource}/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
  }

  async getObjectSchema(objectName: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/schema/${objectName}`);
    return res.json();
  }
}
```

## Mutation event subscription

For real-time UI updates when data changes:

```typescript
const adapter = new ObjectStackAdapter({ baseUrl: '/api/v1' });

// Subscribe to mutations
const unsubscribe = adapter.onMutation?.((event) => {
  console.log(`${event.type} on ${event.resource}:`, event.record);
  // Trigger re-fetch in the affected component
});

// Clean up
unsubscribe?.();
```

## Common data integration mistakes

- Importing `fetch` directly in components instead of using DataSource from context.
- Forgetting to await `startMockServer()` before rendering — MSW intercepts aren't ready.
- Mismatched `baseUrl` between MSW plugin and ObjectStackAdapter — requests bypass mocks.
- Not providing `getObjectSchema()` — plugins that need field metadata will fail.
- Passing a DataSource adapter instance where a static object is expected (or vice versa).
- Not handling loading/error states in components that fetch data.
