# @object-ui/data-objectql

ObjectQL Data Source Adapter for Object UI - Seamlessly connect your Object UI components with ObjectQL API backends using the official **@objectstack/client**.

## Features

- ✅ **Official SDK Integration** - Built on top of @objectstack/client for reliable API communication
- ✅ **Universal DataSource Interface** - Implements the standard Object UI data source protocol
- ✅ **Full TypeScript Support** - Complete type definitions and IntelliSense
- ✅ **React Hooks** - Easy-to-use hooks for data fetching and mutations
- ✅ **Automatic Query Conversion** - Converts universal query params to ObjectStack format
- ✅ **Error Handling** - Robust error handling with typed error responses
- ✅ **Authentication** - Built-in support for token-based authentication
- ✅ **Universal Runtime** - Works in browsers, Node.js, and edge runtimes

## Installation

```bash
# Using npm
npm install @object-ui/data-objectql @objectstack/client

# Using yarn
yarn add @object-ui/data-objectql @objectstack/client

# Using pnpm
pnpm add @object-ui/data-objectql @objectstack/client
```

**Note**: The package now depends on `@objectstack/client`, which provides the underlying HTTP client and ObjectStack Protocol support.

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
}
```

**Note**: This configuration is compatible with `@objectstack/client`'s `ClientConfig`. Additional options supported by the SDK can also be passed.

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

The adapter automatically converts MongoDB-like filter operators to **ObjectStack FilterNode AST format** for compatibility with ObjectStack Protocol v0.1.2+.

```typescript
const result = await dataSource.find('contacts', {
  $filter: {
    name: { $regex: '^John' },           // → ['name', 'contains', '^John']
    age: { $gte: 18, $lte: 65 },        // → ['and', ['age', '>=', 18], ['age', '<=', 65]]
    status: { $in: ['active', 'pending'] }, // → ['status', 'in', ['active', 'pending']]
    'account.type': 'enterprise'        // → ['account.type', '=', 'enterprise']
  }
});
```

#### Supported Filter Operators

| MongoDB Operator | ObjectStack AST | Description |
|------------------|-----------------|-------------|
| Simple value | `['field', '=', value]` | Equality |
| `$eq` | `['field', '=', value]` | Equals |
| `$ne` | `['field', '!=', value]` | Not equals |
| `$gt` | `['field', '>', value]` | Greater than |
| `$gte` | `['field', '>=', value]` | Greater or equal |
| `$lt` | `['field', '<', value]` | Less than |
| `$lte` | `['field', '<=', value]` | Less or equal |
| `$in` | `['field', 'in', array]` | In array |
| `$nin` / `$notin` | `['field', 'notin', array]` | Not in array |
| `$contains` / `$regex` | `['field', 'contains', value]` | Contains substring |
| `$startswith` | `['field', 'startswith', value]` | Starts with |
| `$between` | `['field', 'between', [min, max]]` | Between values |

**Note:** All complex filters are automatically converted to ObjectStack FilterNode AST format and JSON-stringified when sent to the server.

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

## Architecture

This adapter is built on top of the official ObjectStack client:

```
Object UI Components
        ↓
@object-ui/data-objectql (this package)
        ↓
@objectstack/client (ObjectStackClient)
        ↓
ObjectStack Protocol Server API
```

### Benefits of Using the Official SDK

- **Reliability**: Uses the official, well-tested ObjectStack HTTP client
- **Compatibility**: Always compatible with the latest ObjectStack Protocol server versions
- **Type Safety**: Leverages @objectstack/spec for consistent type definitions
- **Universal Runtime**: Works in browsers, Node.js, Deno, and edge runtimes
- **Automatic Updates**: SDK improvements automatically benefit this adapter

## Migration from Previous Versions

If you're upgrading from a previous version that used `@objectql/sdk`:

1. Update your dependencies to use `@objectstack/client`:
   ```bash
   pnpm remove @objectql/sdk @objectql/types
   pnpm add @objectstack/client
   ```

2. The configuration interface remains compatible - no code changes required!
   The adapter now uses the ObjectStack Protocol client under the hood.

3. **Filter conversion to AST format (ObjectStack Protocol v0.1.2+):**
   - All filters are now automatically converted to FilterNode AST format
   - Simple filters: `{ status: 'active' }` → `['status', '=', 'active']`
   - Complex filters: `{ age: { $gte: 18 } }` → `['age', '>=', 18]`
   - Multiple conditions are combined with `'and'` logic
   - This ensures compatibility with the latest ObjectStack Protocol requirements
   
   ```typescript
   // Your existing filter code continues to work
   $filter: { status: 'active', age: 18 }
   
   // Complex filters with operators are also supported
   $filter: { 
     age: { $gte: 18, $lte: 65 },
     status: { $in: ['active', 'pending'] }
   }
   ```

## License

MIT

## Links

- [Object UI Documentation](https://www.objectui.org)
- [GitHub Repository](https://github.com/objectstack-ai/objectui)
- [ObjectStack Protocol](https://github.com/objectstack-ai/spec)
- [ObjectStack Client](https://github.com/objectstack-ai/client)
