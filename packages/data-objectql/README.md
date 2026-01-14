# @object-ui/data-objectql

ObjectQL Data Source Adapter for Object UI - Seamlessly connect your Object UI components with ObjectQL API backends.

## Features

- ✅ **Universal DataSource Interface** - Implements the standard Object UI data source protocol
- ✅ **Full TypeScript Support** - Complete type definitions and IntelliSense
- ✅ **React Hooks** - Easy-to-use hooks for data fetching and mutations
- ✅ **Automatic Query Conversion** - Converts universal query params to ObjectQL format
- ✅ **Error Handling** - Robust error handling with typed error responses
- ✅ **Authentication** - Built-in support for token-based authentication
- ✅ **Multi-tenant** - Space ID support for multi-tenant environments

## Installation

```bash
# Using npm
npm install @object-ui/data-objectql

# Using yarn
yarn add @object-ui/data-objectql

# Using pnpm
pnpm add @object-ui/data-objectql
```

## Quick Start

### Basic Usage

```typescript
import { ObjectQLDataSource } from '@object-ui/data-objectql';

// Create a data source instance
const dataSource = new ObjectQLDataSource({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

// Fetch data
const result = await dataSource.find('contacts', {
  $filter: { status: 'active' },
  $orderby: { created: 'desc' },
  $top: 10
});

console.log(result.data); // Array of contacts
```

### With React Components

```tsx
import { SchemaRenderer } from '@object-ui/react';
import { ObjectQLDataSource } from '@object-ui/data-objectql';

const dataSource = new ObjectQLDataSource({
  baseUrl: 'https://api.example.com',
  token: authToken
});

const schema = {
  type: 'data-table',
  api: 'contacts',
  columns: [
    { name: 'name', label: 'Name' },
    { name: 'email', label: 'Email' },
    { name: 'status', label: 'Status' }
  ]
};

function App() {
  return <SchemaRenderer schema={schema} dataSource={dataSource} />;
}
```

### Using React Hooks

```tsx
import { useObjectQL, useObjectQLQuery, useObjectQLMutation } from '@object-ui/data-objectql';

function ContactList() {
  // Create data source
  const dataSource = useObjectQL({
    config: {
      baseUrl: 'https://api.example.com',
      token: authToken
    }
  });
  
  // Query data
  const { data, loading, error, refetch } = useObjectQLQuery(
    dataSource,
    'contacts',
    {
      $filter: { status: 'active' },
      $orderby: { created: 'desc' },
      $top: 20
    }
  );
  
  // Mutations
  const { create, update, remove } = useObjectQLMutation(
    dataSource,
    'contacts'
  );
  
  const handleCreate = async () => {
    await create({
      name: 'John Doe',
      email: 'john@example.com'
    });
    refetch(); // Refresh the list
  };
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <button onClick={handleCreate}>Add Contact</button>
      <ul>
        {data?.map(contact => (
          <li key={contact._id}>{contact.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## API Reference

### ObjectQLDataSource

#### Constructor

```typescript
new ObjectQLDataSource(config: ObjectQLConfig)
```

#### Configuration Options

```typescript
interface ObjectQLConfig {
  baseUrl: string;           // ObjectQL API base URL
  version?: string;          // API version (default: 'v1')
  token?: string;            // Authentication token
  spaceId?: string;          // Space ID for multi-tenant
  headers?: Record<string, string>;  // Additional headers
  timeout?: number;          // Request timeout (default: 30000ms)
  withCredentials?: boolean; // Include credentials (default: true)
}
```

#### Methods

##### find(resource, params)

Fetch multiple records.

```typescript
await dataSource.find('contacts', {
  $select: ['name', 'email', 'account.name'],
  $filter: { status: 'active' },
  $orderby: { created: 'desc' },
  $skip: 0,
  $top: 10,
  $count: true
});
```

##### findOne(resource, id, params)

Fetch a single record by ID.

```typescript
const contact = await dataSource.findOne('contacts', '123', {
  $select: ['name', 'email', 'phone']
});
```

##### create(resource, data)

Create a new record.

```typescript
const newContact = await dataSource.create('contacts', {
  name: 'John Doe',
  email: 'john@example.com',
  status: 'active'
});
```

##### update(resource, id, data)

Update an existing record.

```typescript
const updated = await dataSource.update('contacts', '123', {
  status: 'inactive'
});
```

##### delete(resource, id)

Delete a record.

```typescript
await dataSource.delete('contacts', '123');
```

##### bulk(resource, operation, data)

Execute bulk operations.

```typescript
const results = await dataSource.bulk('contacts', 'create', [
  { name: 'Contact 1', email: 'contact1@example.com' },
  { name: 'Contact 2', email: 'contact2@example.com' }
]);
```

### React Hooks

#### useObjectQL(options)

Create and manage an ObjectQL data source instance.

```typescript
const dataSource = useObjectQL({
  config: {
    baseUrl: 'https://api.example.com',
    token: authToken
  }
});
```

#### useObjectQLQuery(dataSource, resource, options)

Fetch data with automatic loading and error states.

```typescript
const { data, loading, error, refetch, result } = useObjectQLQuery(
  dataSource,
  'contacts',
  {
    $filter: { status: 'active' },
    enabled: true,              // Auto-fetch on mount (default: true)
    refetchInterval: 5000,      // Refetch every 5 seconds
    onSuccess: (data) => console.log('Data loaded:', data),
    onError: (error) => console.error('Error:', error)
  }
);
```

#### useObjectQLMutation(dataSource, resource, options)

Perform create, update, delete operations.

```typescript
const { create, update, remove, loading, error } = useObjectQLMutation(
  dataSource,
  'contacts',
  {
    onSuccess: (data) => console.log('Success:', data),
    onError: (error) => console.error('Error:', error)
  }
);

// Use the mutation functions
await create({ name: 'New Contact' });
await update('123', { name: 'Updated Name' });
await remove('123');
```

## Query Parameter Mapping

Object UI uses universal query parameters that are automatically converted to ObjectQL format:

| Universal Param | ObjectQL Param | Example |
|----------------|----------------|---------|
| `$select` | `fields` | `['name', 'email']` |
| `$filter` | `filters` | `{ status: 'active' }` |
| `$orderby` | `sort` | `{ created: -1 }` |
| `$skip` | `skip` | `0` |
| `$top` | `limit` | `10` |
| `$count` | `count` | `true` |

## Advanced Usage

### Custom Headers

```typescript
const dataSource = new ObjectQLDataSource({
  baseUrl: 'https://api.example.com',
  token: authToken,
  headers: {
    'X-Custom-Header': 'value',
    'X-Tenant-ID': 'tenant123'
  }
});
```

### Multi-tenant Support

```typescript
const dataSource = new ObjectQLDataSource({
  baseUrl: 'https://api.example.com',
  token: authToken,
  spaceId: 'workspace123' // Automatically added to requests
});
```

### Complex Filters

```typescript
const result = await dataSource.find('contacts', {
  $filter: {
    name: { $regex: '^John' },
    age: { $gte: 18, $lte: 65 },
    status: { $in: ['active', 'pending'] },
    'account.type': 'enterprise'
  }
});
```

### Field Selection with Relations

```typescript
const result = await dataSource.find('contacts', {
  $select: [
    'name',
    'email',
    'account.name',           // Related object field
    'account.industry',       // Related object field
    'tasks.name',            // Related list field
    'tasks.status'           // Related list field
  ]
});
```

## Error Handling

```typescript
import type { APIError } from '@object-ui/types/data';

try {
  const result = await dataSource.find('contacts', params);
} catch (err) {
  const error = err as APIError;
  console.error('Error:', error.message);
  console.error('Status:', error.status);
  console.error('Code:', error.code);
  console.error('Validation errors:', error.errors);
}
```

## TypeScript Support

Full TypeScript support with generics:

```typescript
interface Contact {
  _id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  created: Date;
}

const dataSource = new ObjectQLDataSource<Contact>({
  baseUrl: 'https://api.example.com'
});

// Fully typed results
const result = await dataSource.find('contacts');
const contact: Contact = result.data[0]; // Typed!
```

## License

MIT

## Links

- [Object UI Documentation](https://www.objectui.org)
- [GitHub Repository](https://github.com/objectstack-ai/objectui)
- [ObjectQL Documentation](https://www.objectql.com)
