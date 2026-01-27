# @object-ui/plugin-view

Object View plugin for Object UI - Unified component for displaying and managing ObjectQL data with automatic form and grid generation.

## Features

- **Automatic Views** - Generate views from ObjectQL schemas
- **Form Generation** - Auto-generate forms from object definitions
- **Grid Generation** - Auto-generate data grids
- **CRUD Operations** - Built-in create, read, update, delete
- **Field Mapping** - Automatic field type detection
- **Validation** - Schema-based validation
- **ObjectQL Integration** - Native ObjectStack support

## Installation

```bash
pnpm add @object-ui/plugin-view
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-view';

// Now you can use view types in your schemas
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'grid'
};
```

### Manual Registration

```typescript
import { viewComponents } from '@object-ui/plugin-view';
import { ComponentRegistry } from '@object-ui/core';

// Register view components
Object.entries(viewComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

## Schema API

### ObjectView

Unified view component for ObjectQL objects:

```typescript
{
  type: 'object-view',
  object: string,                 // ObjectQL object name
  viewMode?: 'grid' | 'form' | 'detail',
  fields?: string[],              // Fields to display
  dataSource?: DataSource,
  onCreate?: (data) => void,
  onUpdate?: (id, data) => void,
  onDelete?: (id) => void,
  className?: string
}
```

## Examples

### Grid View

Display objects in a data grid:

```typescript
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'grid',
  fields: ['name', 'email', 'role', 'created_at'],
  dataSource: myDataSource
};
```

### Form View

Create or edit objects with a form:

```typescript
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'form',
  mode: 'create',
  fields: ['name', 'email', 'role'],
  onSubmit: (data) => {
    console.log('Form submitted:', data);
  }
};
```

### Detail View

Display a single object's details:

```typescript
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'detail',
  recordId: '123',
  fields: ['name', 'email', 'role', 'bio', 'created_at']
};
```

## CRUD Operations

### Create

```typescript
const schema = {
  type: 'object-view',
  object: 'products',
  viewMode: 'form',
  mode: 'create',
  onCreate: async (data) => {
    const newProduct = await dataSource.create('products', data);
    console.log('Created:', newProduct);
  }
};
```

### Read/List

```typescript
const schema = {
  type: 'object-view',
  object: 'products',
  viewMode: 'grid',
  pagination: true,
  searchable: true,
  filters: {
    category: 'electronics'
  }
};
```

### Update

```typescript
const schema = {
  type: 'object-view',
  object: 'products',
  viewMode: 'form',
  mode: 'edit',
  recordId: '123',
  onUpdate: async (id, data) => {
    await dataSource.update('products', id, data);
    console.log('Updated product:', id);
  }
};
```

### Delete

```typescript
const schema = {
  type: 'object-view',
  object: 'products',
  viewMode: 'grid',
  enableDelete: true,
  onDelete: async (id) => {
    await dataSource.delete('products', id);
    console.log('Deleted product:', id);
  }
};
```

## Integration with ObjectQL

The plugin works seamlessly with ObjectStack:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

const schema = {
  type: 'object-view',
  object: 'contacts',
  viewMode: 'grid',
  dataSource,
  fields: ['first_name', 'last_name', 'email', 'company'],
  searchable: true,
  sortable: true,
  pagination: {
    pageSize: 25
  }
};
```

## Field Configuration

Customize field display and behavior:

```typescript
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'form',
  fieldConfig: {
    name: {
      label: 'Full Name',
      required: true,
      placeholder: 'Enter name'
    },
    email: {
      label: 'Email Address',
      type: 'email',
      required: true,
      validation: [
        { type: 'email', message: 'Invalid email format' }
      ]
    },
    role: {
      label: 'User Role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
        { label: 'Guest', value: 'guest' }
      ]
    }
  }
};
```

## Advanced Features

### Nested Objects

```typescript
const schema = {
  type: 'object-view',
  object: 'orders',
  viewMode: 'detail',
  fields: ['order_number', 'customer.name', 'items', 'total'],
  nestedFields: {
    items: {
      type: 'object-grid',
      object: 'order_items',
      fields: ['product.name', 'quantity', 'price']
    }
  }
};
```

### Tabs View

```typescript
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'tabs',
  tabs: [
    { label: 'Details', fields: ['name', 'email', 'bio'] },
    { label: 'Settings', fields: ['theme', 'notifications', 'timezone'] },
    { label: 'Activity', type: 'object-grid', object: 'user_activities' }
  ]
};
```

## TypeScript Support

```typescript
import type { ObjectViewSchema } from '@object-ui/plugin-view';

const userView: ObjectViewSchema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'grid',
  fields: ['name', 'email', 'role']
};
```

## License

MIT
