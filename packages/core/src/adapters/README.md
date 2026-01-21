# Data Source Adapters

This directory contains data source adapters that bridge various backend protocols with the ObjectUI DataSource interface.

## ObjectStack Adapter

The `ObjectStackAdapter` provides seamless integration with ObjectStack Protocol servers.

### Features

- ✅ Full CRUD operations (find, findOne, create, update, delete)
- ✅ Bulk operations (createMany, updateMany, deleteMany)
- ✅ Auto-discovery of server capabilities
- ✅ Query parameter translation (OData-style → ObjectStack)
- ✅ Proper error handling
- ✅ TypeScript types

### Usage

```typescript
import { createObjectStackAdapter } from '@object-ui/core';

// Create the adapter
const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token', // Optional
});

// Use it with ObjectUI components
const schema = {
  type: 'data-table',
  dataSource,
  resource: 'users',
  columns: [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' },
  ]
};
```

### Advanced Usage

```typescript
import { ObjectStackAdapter } from '@object-ui/core';

const adapter = new ObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: process.env.API_TOKEN,
  fetch: customFetch // Optional: use custom fetch (e.g., Next.js fetch)
});

// Manually connect (optional, auto-connects on first request)
await adapter.connect();

// Query with filters (MongoDB-like operators)
const result = await adapter.find('tasks', {
  $filter: { 
    status: 'active',
    priority: { $gte: 2 }
  },
  $orderby: { createdAt: 'desc' },
  $top: 20,
  $skip: 0
});

// Access the underlying client for advanced operations
const client = adapter.getClient();
const metadata = await client.meta.getObject('task');
```

### Filter Conversion

The adapter automatically converts MongoDB-like filter operators to **ObjectStack FilterNode AST format**. This ensures compatibility with the latest ObjectStack Protocol (v0.1.2+).

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
$filter: {
  age: { $gte: 18, $lte: 65 },
  status: 'active'
}

// Converted to AST
['and', 
  ['age', '>=', 18],
  ['age', '<=', 65],
  ['status', '=', 'active']
]
```

### Query Parameter Mapping

The adapter automatically converts ObjectUI query parameters (OData-style) to ObjectStack protocol:

| ObjectUI ($) | ObjectStack | Description |
|--------------|-------------|-------------|
| `$select` | `select` | Field selection |
| `$filter` | `filters` (AST) | Filter conditions (converted to FilterNode AST) |
| `$orderby` | `sort` | Sort order |
| `$skip` | `skip` | Pagination offset |
| `$top` | `top` | Limit records |

### Example with Sorting

```typescript
// OData-style
await dataSource.find('users', {
  $orderby: { 
    createdAt: 'desc',
    name: 'asc'
  }
});

// Converted to ObjectStack: ['-createdAt', 'name']
```

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

## Available Adapters

- **ObjectStackAdapter** - For ObjectStack Protocol servers
- More adapters coming soon (REST, GraphQL, Supabase, Firebase, etc.)

## Related Packages

- `@objectstack/client` - ObjectStack Client SDK
- `@objectstack/spec` - ObjectStack Protocol Specification
- `@object-ui/types` - ObjectUI Type Definitions
