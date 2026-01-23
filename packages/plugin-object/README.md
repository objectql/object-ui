# @object-ui/plugin-object

ObjectStack plugin for Object UI, providing seamless integration with ObjectStack backends through auto-generated components.

## Features

- **ObjectTable**: A specialized table component that automatically fetches and displays data from ObjectStack objects
- **ObjectForm**: A smart form component that generates forms from ObjectStack object schemas
- **ObjectView**: A complete object management interface combining table and form components

## Installation

```bash
npm install @object-ui/plugin-object @object-ui/core
```

## Usage

### ObjectTable

```tsx
import { ObjectTable } from '@object-ui/plugin-object';
import { createObjectStackAdapter } from '@object-ui/core';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

function UsersTable() {
  return (
    <ObjectTable 
      schema={{
        type: 'object-table',
        objectName: 'users'
      }}
      dataSource={dataSource}
    />
  );
}
```

### ObjectForm

```tsx
import { ObjectForm } from '@object-ui/plugin-object';
import { createObjectStackAdapter } from '@object-ui/core';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

function UserForm() {
  return (
    <ObjectForm 
      schema={{
        type: 'object-form',
        objectName: 'users',
        mode: 'create',
        onSuccess: (data) => console.log('Created:', data)
      }}
      dataSource={dataSource}
    />
  );
}
```

### ObjectView

```tsx
import { ObjectView } from '@object-ui/plugin-object';
import { createObjectStackAdapter } from '@object-ui/core';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

function UsersView() {
  return (
    <ObjectView 
      schema={{
        type: 'object-view',
        objectName: 'users',
        showSearch: true,
        showFilters: true
      }}
      dataSource={dataSource}
    />
  );
}
```

## Schema Integration

All components automatically integrate with ObjectStack's schema system to:
- Display appropriate field types
- Apply field-level permissions
- Validate data according to schema rules
- Handle relationships between objects

## License

MIT
