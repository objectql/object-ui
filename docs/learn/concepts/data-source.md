---
title: "Data Connectivity"
---

Object UI follows the **Universal Adapter Pattern**. We never hardcode `fetch` or `axios` calls inside UI components.

Instead, the core engine communicates with your backend via a standardized `DataSource` interface.

## The Interface

All data fetching logic is abstracted into this interface defined in `@object-ui/core`:

```typescript
export interface DataSource {
  /**
   * Universal fetch method.
   * @param resource - The entity name (e.g. "users", "orders")
   * @param params - Query parameters (filters, sorting, pagination)
   */
  find(resource: string, params?: any): Promise<any[]>;
  
  findOne(resource: string, id: string): Promise<any>;
  create(resource: string, data: any): Promise<any>;
  update(resource: string, id: string, data: any): Promise<any>;
  delete(resource: string, id: string): Promise<any>;
}
```

## Usage

You inject the data source implementation at the root of your application via the `<SchemaRenderer>` or a provider.

```tsx
import { RestDataSource } from '@object-ui/data-rest';
import { SchemaRenderer } from '@object-ui/react';

// 1. Initialize your adapter
const myApi = new RestDataSource('https://api.example.com/v1');

function App() {
  return (
    // 2. Inject it into the engine
    <SchemaRenderer 
      schema={mySchema} 
      dataSource={myApi} 
    />
  );
}
```

## Creating a Custom Adapter

If you have a proprietary backend, simply implement the interface:

```typescript
import type { DataSource } from '@object-ui/core';

class MyCustomDataSource implements DataSource {
  async find(resource, params) {
    // Your custom logic here
    const response = await fetch(`/my-legacy-api/${resource}`);
    return response.json();
  }
  
  // ... implement other methods
}
```
