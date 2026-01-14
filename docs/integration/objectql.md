# ObjectQL Integration Guide

This guide explains how to integrate Object UI with ObjectQL API backends to create data-driven applications.

## Overview

ObjectQL is a metadata-driven backend platform that provides automatic CRUD APIs based on object definitions. The `@object-ui/data-objectql` package provides a seamless bridge between Object UI components and ObjectQL APIs.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Object UI Components                     │
│  (Forms, Tables, Cards, Dashboards, etc.)                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Uses DataSource Interface
                   │
┌──────────────────▼──────────────────────────────────────────┐
│            @object-ui/data-objectql                         │
│                                                              │
│  • ObjectQLDataSource (API Adapter)                         │
│  • React Hooks (useObjectQL, useObjectQLQuery, etc.)        │
│  • Query Parameter Conversion                               │
│  • Error Handling & Type Safety                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTP/REST Calls
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                    ObjectQL API Server                       │
│                                                              │
│  • Object Definitions (Metadata)                            │
│  • Automatic CRUD Endpoints                                 │
│  • Business Logic & Validation                              │
│  • Database Abstraction                                     │
└──────────────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
npm install @object-ui/react @object-ui/components @object-ui/data-objectql
```

### Basic Setup

```tsx
import React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { registerDefaultRenderers } from '@object-ui/components';
import { ObjectQLDataSource } from '@object-ui/data-objectql';

// Register Object UI components
registerDefaultRenderers();

// Create ObjectQL data source
const dataSource = new ObjectQLDataSource({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token',  // Optional
  spaceId: 'workspace123',   // Optional for multi-tenant
});

// Define your schema
const schema = {
  type: 'page',
  title: 'Contacts',
  body: {
    type: 'data-table',
    api: 'contacts',  // ObjectQL object name
    columns: [
      { name: 'name', label: 'Name' },
      { name: 'email', label: 'Email' },
      { name: 'phone', label: 'Phone' },
      { name: 'status', label: 'Status' }
    ]
  }
};

function App() {
  return <SchemaRenderer schema={schema} dataSource={dataSource} />;
}

export default App;
```

## Using React Hooks

### useObjectQLQuery Hook

Fetch data with automatic state management:

```tsx
import { useObjectQL, useObjectQLQuery } from '@object-ui/data-objectql';

function ContactList() {
  const dataSource = useObjectQL({
    config: { baseUrl: 'https://api.example.com' }
  });
  
  const { data, loading, error, refetch } = useObjectQLQuery(
    dataSource,
    'contacts',
    {
      $filter: { status: 'active' },
      $orderby: { created: 'desc' },
      $top: 20,
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

### useObjectQLMutation Hook

Perform create, update, and delete operations:

```tsx
import { useObjectQL, useObjectQLMutation } from '@object-ui/data-objectql';

function ContactForm() {
  const dataSource = useObjectQL({
    config: { baseUrl: 'https://api.example.com' }
  });
  
  const { create, update, remove, loading } = useObjectQLMutation(
    dataSource,
    'contacts'
  );
  
  const handleCreate = async () => {
    await create({
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active'
    });
  };
  
  return (
    <div>
      <button onClick={handleCreate} disabled={loading}>
        Create Contact
      </button>
    </div>
  );
}
```

## Query Parameters

Object UI uses universal query parameters that are automatically converted to ObjectQL format:

### Field Selection

```typescript
await dataSource.find('contacts', {
  $select: ['name', 'email', 'account.name']
});
```

### Filtering

```typescript
await dataSource.find('contacts', {
  $filter: {
    status: 'active',
    age: { $gte: 18 }
  }
});
```

### Sorting & Pagination

```typescript
await dataSource.find('contacts', {
  $orderby: { created: 'desc' },
  $skip: 20,
  $top: 10
});
```

## Configuration Options

```typescript
interface ObjectQLConfig {
  baseUrl: string;           // Required: ObjectQL server URL
  version?: string;          // API version (default: 'v1')
  token?: string;            // Authentication token
  spaceId?: string;          // Workspace/tenant ID
  headers?: Record<string, string>;
  timeout?: number;          // Request timeout (default: 30000ms)
  withCredentials?: boolean; // Include credentials (default: true)
}
```

## See Also

- [Package README](../../packages/data-objectql/README.md) - Detailed API reference
- [ObjectQL Documentation](https://www.objectql.com/docs)
- [Component Library](../api/components.md)
