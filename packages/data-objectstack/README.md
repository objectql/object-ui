# @object-ui/data-objectstack

Official ObjectStack data adapter for Object UI.

## Overview

This package provides the `ObjectStackAdapter` class, which connects Object UI's universal `DataSource` interface with the `@objectstack/client` SDK.

This enables strictly typed, metadata-driven UI components to communicate seamlessly with ObjectStack backends (Steedos, Salesforce, etc.).

## Installation

```bash
npm install @object-ui/data-objectstack
```

**Note:** `@objectstack/client` is a regular dependency of this package — it is installed and resolved along with it, so there is nothing to install separately.

## Usage

### Basic Setup

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

declare const mySchema: BaseSchema;

// 1. Create the adapter
const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-api-token' // Optional if effectively handling auth elsewhere
});

// 2. Pass to the Renderer
function App() {
  return (
    <SchemaRenderer 
      schema={mySchema} 
      dataSource={dataSource} 
    />
  );
}
```

### Advanced Configuration

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-api-token',
  // Configure metadata cache
  cache: {
    maxSize: 100,      // Maximum number of cached schemas (default: 100)
    ttl: 5 * 60 * 1000 // Time to live in ms (default: 5 minutes)
  },
  // Configure auto-reconnect
  autoReconnect: true,           // Enable auto-reconnect (default: true)
  maxReconnectAttempts: 5,       // Max reconnection attempts (default: 3)
  reconnectDelay: 2000           // Initial delay between reconnects in ms (default: 1000)
});
```

## Features

- ✅ **CRUD Operations**: Implements `find`, `findOne`, `create`, `update`, `delete`.
- ✅ **Metadata Caching**: Automatic LRU caching of schema metadata with TTL expiration.
- ✅ **Metadata Fetching**: Implements `getObjectSchema` to power auto-generated forms and grids.
- ✅ **Query Translation**: Converts Object UI's OData-like query parameters to ObjectStack's native query format.
- ✅ **Bulk Operations**: Supports optimized batch create/update/delete with detailed error reporting.
- ✅ **Error Handling**: Comprehensive error hierarchy with unique error codes and debugging details.
- ✅ **Connection Monitoring**: Real-time connection state tracking with event listeners.
- ✅ **Auto-Reconnect**: Automatic reconnection with exponential backoff on connection failures.
- ✅ **Batch Progress**: Progress events for tracking bulk operation status.

## Query Translation

`find()` accepts Object UI's OData-style `QueryParams` and translates them into
ObjectStack's native query format, so a schema never has to be written in the
protocol's own shape:

```typescript
import type { ObjectStackAdapter } from '@object-ui/data-objectstack';

declare const dataSource: ObjectStackAdapter;

// Query with filters (MongoDB-like operators)
const result = await dataSource.find('tasks', {
  $filter: {
    status: 'active',
    priority: { $gte: 2 },
  },
  $orderby: { createdAt: 'desc' },
  $top: 20,
  $skip: 0,
});

// Escape hatch: reach the underlying ObjectStack client for anything
// the DataSource interface does not cover
const client = dataSource.getClient();
const metadata = await client.meta.getItem('object', 'task');
```

### Query Parameter Mapping

| Object UI (`$`) | ObjectStack | Description |
|--------------|-------------|-------------|
| `$select` | `select` | Field selection |
| `$filter` | `filters` (AST) | Filter conditions (converted to FilterNode AST) |
| `$orderby` | `sort` | Sort order |
| `$skip` | `skip` | Pagination offset |
| `$top` | `top` | Limit records |

### Filter Conversion

The adapter converts MongoDB-like filter operators into **ObjectStack FilterNode
AST format**. This is what keeps it compatible with the ObjectStack Protocol
(v0.1.2+).

#### Supported Filter Operators

| MongoDB Operator | ObjectStack Operator | Example |
|------------------|---------------------|---------|
| `$eq` or simple value | `=` | `{ status: 'active' }` → `['status', '=', 'active']` |
| `$ne` | `!=` | `{ status: { $ne: 'archived' } }` → `['status', '!=', 'archived']` |
| `$gt` | `>` | `{ age: { $gt: 18 } }` → `['age', '>', 18]` |
| `$gte` | `>=` | `{ age: { $gte: 18 } }` → `['age', '>=', 18]` |
| `$lt` | `<` | `{ age: { $lt: 65 } }` → `['age', '<', 65]` |
| `$lte` | `<=` | `{ age: { $lte: 65 } }` → `['age', '<=', 65]` |
| `$in` | `in` | `{ status: { $in: ['active', 'pending'] } }` → `['status', 'in', ['active', 'pending']]` |
| `$nin` / `$notin` | `notin` | `{ status: { $nin: ['archived'] } }` → `['status', 'notin', ['archived']]` |
| `$contains` / `$regex` | `contains` | `{ name: { $contains: 'John' } }` → `['name', 'contains', 'John']` |
| `$startswith` | `startswith` | `{ email: { $startswith: 'admin' } }` → `['email', 'startswith', 'admin']` |
| `$between` | `between` | `{ age: { $between: [18, 65] } }` → `['age', 'between', [18, 65]]` |

#### Complex Filter Examples

**Multiple conditions** are combined with `'and'`:

```typescript
// Input
const $filter = {
  age: { $gte: 18, $lte: 65 },
  status: 'active',
};

// Converted to AST
const ast = [
  'and',
  ['age', '>=', 18],
  ['age', '<=', 65],
  ['status', '=', 'active'],
];
```

#### Rule-shaped arrays, on `find()` **and** `aggregate()`

Server-driven view configs store their conditions as an array of rules
(`ViewFilterRule[]`), not as a MongoDB-style object:

```typescript
const filter = [{ field: 'stage', operator: 'equals', value: 'won' }];
```

Both read paths lower that array to the same AST before it reaches the wire —
`find()` via `$filter`, and `aggregate()` via the analytics `where`. They share
one translator, so a stored filter cannot mean one thing on a list and another
on a KPI:

```typescript
// find():      filter=["stage","=","won"]
// aggregate(): { ..., where: ["stage", "=", "won"] }
```

Operator aliases (`equals`, `greater_than_or_equal`, `not_in`, `before`, ...)
map to the canonical AST symbols, and rules spread into a logical node
(`['and', ...rules, ...tuples]`) are lowered at depth. A rule that cannot be
translated raises `MalformedFilterError` rather than being dropped — dropping
one condition of an `and` would widen the result set and report success.

Non-array filters are passed through unchanged on the aggregate path: a
MongoDB-style object is already what `/analytics/query` accepts.

#### `aggregate({ where })` does NOT lower — it refuses

The lowering above is the `filter` parameter, on the analytics path.
`aggregate()` has a second, spec-shape branch — entered when the params carry
an array `groupBy`, an array `aggregations`, or **any** `where` key — which
posts `where` to `POST /data/:object/query` verbatim. That `where` is the spec
Query DSL's `where`, so it must ALREADY be lowered, and since objectui#6825 an
array that the spec's own `isFilterAST` gate rejects is refused here rather
than shipped:

```typescript
import type { ObjectStackAdapter } from '@object-ui/data-objectstack';

declare const dataSource: ObjectStackAdapter;

// ✅ lowered — reaches the wire unchanged
await dataSource.aggregate('opportunity', {
  groupBy: ['stage'],
  aggregations: [{ function: 'count', field: 'id', alias: 'n' }],
  where: ['stage', '=', 'won'],
});

// ⛔ throws UnloweredAggregateWhereError — authoring sugar, not a filter
await dataSource.aggregate('opportunity', {
  groupBy: ['stage'],
  aggregations: [{ function: 'count', field: 'id', alias: 'n' }],
  where: [{ field: 'stage', operator: 'equals', value: 'won' }],
});
```

This is a producer-side refusal of a value the server already refused (`is not
a filter`, `400 INVALID_FILTER`): the point is that you now find out at the call
site, with the offending value named, instead of on the wire — or not at all,
with a chart quietly rendering unfiltered numbers. Lower the rules in whatever
built the params, or use the analytics branch (`filter` + the legacy `field` /
`function` / `groupBy` params), which lowers for you.

Two shapes are deliberately NOT refused, because the receiving door accepts
them: a `FilterCondition` object (`{ stage: 'won' }` — what `QuerySchema.where`
declares), and an empty array (`[]` means "no filter").

### Sorting

```typescript
import type { ObjectStackAdapter } from '@object-ui/data-objectstack';

declare const dataSource: ObjectStackAdapter;

// OData-style
await dataSource.find('users', {
  $orderby: {
    createdAt: 'desc',
    name: 'asc',
  },
});

// Converted to ObjectStack: ['-createdAt', 'name']
```

## Metadata Caching

The adapter includes built-in metadata caching to improve performance when fetching schemas:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({ baseUrl: 'https://api.example.com' });

// Get cache statistics
const stats = dataSource.getCacheStats();
console.log(`Cache hit rate: ${stats.hitRate * 100}%`);
console.log(`Cache size: ${stats.size}/${stats.maxSize}`);

// Manually invalidate cache entries
dataSource.invalidateCache('users'); // Invalidate specific schema
dataSource.invalidateCache();        // Invalidate all cached schemas

// Clear cache and statistics
dataSource.clearCache();
```

### Cache Configuration

- **LRU Eviction**: Automatically evicts least recently used entries when cache is full
- **TTL Expiration**: Entries expire after the configured time-to-live from creation (default: 5 minutes)
  - Note: TTL is fixed from creation time, not sliding based on access
- **Memory Limits**: Configurable maximum cache size (default: 100 entries)
- **Concurrent Access**: Handles async operations safely. Note that concurrent requests for the same uncached key may result in multiple fetcher calls.

## Connection State Monitoring

The adapter provides real-time connection state monitoring with automatic reconnection:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({ baseUrl: 'https://api.example.com' });

// Monitor connection state changes
const unsubscribe = dataSource.onConnectionStateChange((event) => {
  console.log('Connection state:', event.state);
  console.log('Timestamp:', new Date(event.timestamp));
  
  if (event.error) {
    console.error('Connection error:', event.error);
  }
});

// Check current connection state
console.log(dataSource.getConnectionState()); // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

// Check if connected
if (dataSource.isConnected()) {
  console.log('Adapter is connected');
}

// Unsubscribe from events when done
unsubscribe();
```

### Connection States

- `disconnected` - Not connected to server
- `connecting` - Attempting initial connection
- `connected` - Successfully connected
- `reconnecting` - Attempting to reconnect after failure
- `error` - Connection failed (check event.error for details)

### Auto-Reconnect

The adapter automatically attempts to reconnect on connection failures:

- **Exponential Backoff**: Delay increases with each attempt (delay × 2^(attempts-1))
- **Configurable Attempts**: Set `maxReconnectAttempts` (default: 3)
- **Configurable Delay**: Set `reconnectDelay` for initial delay (default: 1000ms)
- **Automatic**: Enabled by default, disable with `autoReconnect: false`

## Batch Operation Progress

Track progress of bulk operations in real-time:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({ baseUrl: 'https://api.example.com' });

declare const largeDataset: Array<Record<string, unknown>>;

// Monitor batch operation progress
const unsubscribe = dataSource.onBatchProgress((event) => {
  console.log(`${event.operation}: ${event.percentage.toFixed(1)}%`);
  console.log(`Completed: ${event.completed}/${event.total}`);
  console.log(`Failed: ${event.failed}`);
});

// Perform bulk operation
const users = await dataSource.bulk('users', 'create', largeDataset);

// Unsubscribe when done
unsubscribe();
```

### Progress Event Properties

- `operation` - Operation type ('create' | 'update' | 'delete')
- `total` - Total number of items
- `completed` - Number of successfully completed items
- `failed` - Number of failed items
- `percentage` - Completion percentage (0-100)

## Error Handling

The adapter provides a comprehensive error hierarchy for better error handling:

### Error Types

```typescript
import {
  ObjectStackError,        // Base error class
  MetadataNotFoundError,   // Schema/metadata not found (404)
  BulkOperationError,      // Bulk operation failures with partial results
  ConnectionError,         // Network/connection errors (503/504)
  AuthenticationError,     // Authentication failures (401/403)
  DataApiValidationError,  // Data validation errors (400). Its runtime `name` is
                           // still 'ValidationError' — that string is the wire
                           // discriminator shared with @objectstack/client. The
                           // SYMBOL is prefixed because @objectstack/spec/kernel
                           // owns `ValidationError` for a { field, message, code? }
                           // record (objectui#3160).
  MalformedFilterError,    // A filter rule that cannot be translated (400
                           // INVALID_FILTER) — thrown rather than dropped,
                           // because dropping one condition of an `and` widens
                           // the result set and reports success.
  UnloweredAggregateWhereError, // aggregate()'s spec-shape `where` was an array
                           // the spec's filter-AST gate rejects (400
                           // INVALID_FILTER). See "aggregate({ where }) does
                           // NOT lower" above.
  isMalformedFilterError,  // Recognises BOTH of the two above, and the server's
                           // own version of the same refusal.
} from '@object-ui/data-objectstack';
```

### Error Handling Example

```typescript
import {
  ObjectStackError,
  MetadataNotFoundError,
  ConnectionError,
  AuthenticationError,
  type ObjectStackAdapter,
} from '@object-ui/data-objectstack';

declare const dataSource: ObjectStackAdapter;

try {
  const schema = await dataSource.getObjectSchema('users');
} catch (error) {
  if (error instanceof MetadataNotFoundError) {
    console.error(`Schema not found: ${error.details?.objectName}`);
  } else if (error instanceof ConnectionError) {
    console.error(`Connection failed to: ${error.url}`);
  } else if (error instanceof AuthenticationError) {
    console.error('Authentication required');
  }

  // Every error this adapter throws carries the same shape
  if (error instanceof ObjectStackError) {
    console.error({
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    });
  }
}
```

### Bulk Operation Errors

Bulk operations provide detailed error reporting with partial success information:

```typescript
import { BulkOperationError, type ObjectStackAdapter } from '@object-ui/data-objectstack';

declare const dataSource: ObjectStackAdapter;

declare const records: Array<Record<string, unknown>>;

try {
  await dataSource.bulk('users', 'update', records);
} catch (error) {
  if (error instanceof BulkOperationError) {
    const summary = error.getSummary();
    console.log(`${summary.successful} succeeded, ${summary.failed} failed`);
    console.log(`Failure rate: ${summary.failureRate * 100}%`);
    
    // Inspect individual failures
    summary.errors.forEach(({ index, error }) => {
      console.error(`Record ${index} failed:`, error);
    });
  }
}
```

### Error Codes

All errors include unique error codes for programmatic handling:

- `METADATA_NOT_FOUND` - Schema/metadata not found
- `BULK_OPERATION_ERROR` - Bulk operation failure
- `CONNECTION_ERROR` - Connection/network error
- `AUTHENTICATION_ERROR` - Authentication failure
- `VALIDATION_ERROR` - Data validation error
- `INVALID_FILTER` - A filter the adapter refuses to send (`MalformedFilterError`,
  `UnloweredAggregateWhereError`); matches the data API's own code for the same refusal
- `UNSUPPORTED_OPERATION` - Unsupported operation
- `NOT_FOUND` - Resource not found
- `UNKNOWN_ERROR` - Unknown error

## Batch Operations

The adapter supports optimized batch operations with automatic fallback:

```typescript
import type { ObjectStackAdapter } from '@object-ui/data-objectstack';

declare const dataSource: ObjectStackAdapter;

// Batch create
const newUsers = await dataSource.bulk('users', 'create', [
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]);

// Batch update (uses updateMany if available, falls back to individual updates)
const updated = await dataSource.bulk('users', 'update', [
  { id: '1', name: 'Alice Smith' },
  { id: '2', name: 'Bob Jones' },
]);

// Batch delete
await dataSource.bulk('users', 'delete', [
  { id: '1' },
  { id: '2' },
]);
```

### Performance Optimizations

- Automatically uses `createMany`, `updateMany`, `deleteMany` when available
- Falls back to individual operations with detailed error tracking
- Provides partial success reporting for resilient error handling
- Atomic operations where supported by the backend

## Cross-Object Atomic Batch (`batchTransaction`)

`bulk()` above operates on **one** object. To persist a set of **cross-object**
writes as a single all-or-nothing unit — the master-detail case, where a parent
and its children must commit or roll back together — use `batchTransaction`:

```typescript
import type { ObjectStackAdapter } from '@object-ui/data-objectstack';

declare const dataSource: ObjectStackAdapter;

// Create a parent and a child that references it, atomically.
// `{ $ref: 0 }` resolves to the id minted by operation 0 (the parent).
await dataSource.batchTransaction([
  { object: 'invoice',      action: 'create', data: { no: 'INV-1' } },
  { object: 'invoice_line', action: 'create', data: { invoice: { $ref: 0 }, amount: 10 } },
]);
```

On a supporting backend this is one `POST /api/v1/batch` that commits or rolls
back the whole set in a single server transaction — no orphaned parent if a
child write fails.

### Declarative capability negotiation (`transactionalBatch`)

Whether the adapter can rely on server atomicity is decided **at connect time**,
not by firing a batch and reading the failure. `connect()` reads the
`capabilities.transactionalBatch` flag from `GET /api/v1/discovery`
([framework #3298](https://github.com/objectstack-ai/objectstack/issues/3298)),
which the server sets to `true` only when the `/batch` route is mounted **and**
the runtime engine can honour a transaction (`declared === enforced`):

| Discovery `capabilities.transactionalBatch` | `batchTransaction` behaviour |
| --- | --- |
| `true` | **Trusts server atomicity.** Calls `/batch`; any failure — including `404`/`405`/`501` — surfaces as a real error. No non-atomic client-side fallback. |
| `false` | Backend can't do an atomic batch (route absent, or a runtime without transactions) → falls back to the non-atomic client-side emulation below. |
| *absent* | Backend predates #3298 and advertises nothing → the legacy runtime probe stays: try `/batch`, and on `404`/`405`/`501` fall back to emulation. |

The hierarchical wire shape (`{ transactionalBatch: { enabled: true } }`) and the
flat form the client SDK normalizes to (`{ transactionalBatch: true }`) are both
accepted.

### Non-atomic fallback

When the capability is `false` or absent, the adapter degrades to a client-side
emulation (`@object-ui/core`'s `emulateBatchTransaction`): the operations run in
order and, on failure, it best-effort deletes the records it created (children
before parent) before rethrowing. This is **not** a transaction — a create's
side effects (hooks, rollups, webhooks) are not undone by a later delete, and a
mid-batch network drop leaves no chance to compensate. It exists only so a save
is still possible against a backend that lacks server atomicity; removing it
would turn "saves, less safe" into "no save path" on older backends
([objectui #2679](https://github.com/objectstack-ai/objectui/issues/2679)).

### Minimum supported backend

Atomic cross-object saves are **guaranteed only against ObjectStack backends on
the 16.x line that advertise `capabilities.transactionalBatch: true`** — the
endpoint landed in [framework #1604](https://github.com/objectstack-ai/objectstack/issues/1604)
and its discovery capability in
[framework #3298](https://github.com/objectstack-ai/objectstack/issues/3298).
ObjectUI does not hard-require it: against an older backend a master-detail save
still succeeds, but non-atomically via the fallback above. Treat the advertised
capability as the floor for the atomicity guarantee, not as a connection
prerequisite.

## User-Scoped State Adapter

In addition to the main `DataSource` adapter, this package ships
`createObjectStackUserStateAdapter` — a small factory that lets Object UI
persist per-user UI state (favorites, recent items) into ObjectStack.

```typescript
import { createObjectStackUserStateAdapter, type ObjectStackAdapter } from '@object-ui/data-objectstack';
import { useAttachUserStateAdapters } from '@object-ui/app-shell';

declare const dataSource: ObjectStackAdapter;
declare const user: { id: string };

const favoritesAdapter = createObjectStackUserStateAdapter({
  dataSource,             // the ObjectStack DataSource
  userId: user.id,
  key: 'ui.favorites',    // or 'ui.recent', 'ui.grid.account.state', ...
  // resource: 'sys_user_preference',  // default — the unified per-user KV store
  // onError: (op, err) => console.warn(`[user-state] ${op} failed`, err),
});

const attach = useAttachUserStateAdapters();

attach('favorites', favoritesAdapter);
```

### Backend contract

The adapter writes to the platform's unified per-user KV store —
`sys_user_preference` — shipped by every `@objectstack/plugin-auth`
environment. One row per `(user_id, key)` pair:

```yaml
object: sys_user_preference
fields:
  - { name: user_id,    type: lookup(sys_user), indexed: true }
  - { name: key,        type: string,           indexed: true }
  - { name: value,      type: json }
  - { name: updated_at, type: datetime }
unique: [user_id, key]
```

By convention, namespace UI-trace keys under `ui.*` (e.g. `ui.favorites`,
`ui.recent`, `ui.grid.<object>.state`, `ui.sidebar.collapsed`) so they
stay easy to tell apart from user-facing preferences (`theme`, `locale`).

If the backend doesn't yet expose `sys_user_preference`, every call
404s and the UI silently degrades to localStorage-only persistence. See
[User-Scoped State Persistence](../../content/docs/guide/user-state-persistence.md)
for the full design.

## API Reference

### ObjectStackAdapter

#### Constructor

<!-- doc-snippet: fragment — the constructor SIGNATURE in prose notation, not a statement: `new ObjectStackAdapter(config: { ... })` names the parameter type where a call would carry a value. Measured TS1005x10. -->

```typescript
new ObjectStackAdapter(config: {
  baseUrl: string;
  token?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  cache?: {
    maxSize?: number;
    ttl?: number;
  };
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
})
```

#### Methods

- `connect()` - Establish connection to ObjectStack server
- `find(resource, params?)` - Query multiple records
- `findOne(resource, id, params?)` - Get a single record by ID
- `create(resource, data)` - Create a new record
- `update(resource, id, data)` - Update an existing record
- `delete(resource, id)` - Delete a record
- `bulk(resource, operation, data)` - Batch operations (create/update/delete)
- `batchTransaction(operations)` - Cross-object atomic batch (master-detail); atomic when the backend advertises `transactionalBatch`, else non-atomic client-side fallback
- `getObjectSchema(objectName)` - Get schema metadata (cached)
- `getCacheStats()` - Get cache statistics
- `invalidateCache(key?)` - Invalidate cache entries
- `clearCache()` - Clear all cache entries
- `getClient()` - Access underlying ObjectStack client
- `getConnectionState()` - Get current connection state
- `isConnected()` - Check if adapter is connected
- `onConnectionStateChange(listener)` - Subscribe to connection state changes (returns unsubscribe function)
- `onBatchProgress(listener)` - Subscribe to batch operation progress (returns unsubscribe function)

## Best Practices

1. **Enable Caching**: Use default cache settings for optimal performance
2. **Handle Errors**: Use typed error handling for better user experience
3. **Batch Operations**: Use bulk methods for large datasets
4. **Monitor Cache**: Check cache hit rates in production
5. **Invalidate Wisely**: Clear cache after schema changes
6. **Connection Monitoring**: Subscribe to connection state changes for better UX
7. **Auto-Reconnect**: Use default auto-reconnect settings for resilient applications
8. **Batch Progress**: Monitor progress for long-running bulk operations

## Troubleshooting

### Common Issues

#### Schema Not Found

```typescript
import type { ObjectStackAdapter } from '@object-ui/data-objectstack';

declare const dataSource: ObjectStackAdapter;

// Error: MetadataNotFoundError
// Solution: Verify object name and ensure schema exists on server
const schema = await dataSource.getObjectSchema('correct_object_name');
```

#### Connection Errors

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

// Error: ConnectionError
// Solution: Check baseUrl and network connectivity
const dataSource = createObjectStackAdapter({
  baseUrl: 'https://correct-url.example.com',
  token: 'valid-token'
});
```

#### Cache Issues

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({ baseUrl: 'https://api.example.com' });

// Clear cache if stale data is being returned
dataSource.clearCache();

// Or invalidate specific entries
dataSource.invalidateCache('users');
```

## Links

- 📚 [Documentation](https://www.objectui.org/docs/guide/data-source)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/data-objectstack)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
