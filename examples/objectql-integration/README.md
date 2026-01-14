# ObjectQL Integration Example

This example demonstrates how to integrate Object UI with ObjectQL API backend.

## Setup

```bash
npm install @object-ui/react @object-ui/components @object-ui/data-objectql
```

## Basic Usage

```tsx
import React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { registerDefaultRenderers } from '@object-ui/components';
import { ObjectQLDataSource } from '@object-ui/data-objectql';

// Register components
registerDefaultRenderers();

// Create data source
const dataSource = new ObjectQLDataSource({
  baseUrl: 'https://api.example.com',
  token: localStorage.getItem('auth_token'),
});

// Define schema
const schema = {
  type: 'page',
  title: 'Contacts',
  body: {
    type: 'data-table',
    api: 'contacts',
    columns: [
      { name: 'name', label: 'Name' },
      { name: 'email', label: 'Email' },
      { name: 'status', label: 'Status' }
    ]
  }
};

function App() {
  return <SchemaRenderer schema={schema} dataSource={dataSource} />;
}

export default App;
```

## With React Hooks

```tsx
import { useObjectQL, useObjectQLQuery } from '@object-ui/data-objectql';

function ContactList() {
  const dataSource = useObjectQL({
    config: {
      baseUrl: 'https://api.example.com',
      token: localStorage.getItem('auth_token')
    }
  });
  
  const { data, loading, error, refetch } = useObjectQLQuery(
    dataSource,
    'contacts',
    {
      $filter: { status: 'active' },
      $orderby: { created: 'desc' },
      $top: 20
    }
  );
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      <ul>
        {data?.map(contact => (
          <li key={contact._id}>{contact.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## See Also

- [ObjectQL Integration Documentation](../../docs/integration/objectql.md)
- [Package README](../../packages/data-objectql/README.md)
