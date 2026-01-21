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

// Query with filters
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

### Query Parameter Mapping

The adapter automatically converts ObjectUI query parameters (OData-style) to ObjectStack protocol:

| ObjectUI ($) | ObjectStack | Description |
|--------------|-------------|-------------|
| `$select` | `select` | Field selection |
| `$filter` | `filters` | Filter conditions |
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
