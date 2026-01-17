# @object-ui/data-object

ObjectQL-specific components for Object UI, providing seamless integration with ObjectQL backends.

## Features

- **ObjectTable**: A specialized table component that automatically fetches and displays data from ObjectQL objects
- **ObjectForm**: A smart form component that generates forms from ObjectQL object schemas

## Installation

```bash
npm install @object-ui/data-object @object-ui/data-objectql
```

## Usage

### ObjectTable

```tsx
import { ObjectTable } from '@object-ui/data-object';
import { ObjectQLDataSource } from '@object-ui/data-objectql';

const dataSource = new ObjectQLDataSource({
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
import { ObjectForm } from '@object-ui/data-object';
import { ObjectQLDataSource } from '@object-ui/data-objectql';

const dataSource = new ObjectQLDataSource({
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

## Schema Integration

Both components automatically integrate with ObjectQL's schema system to:
- Display appropriate field types
- Apply field-level permissions
- Validate data according to schema rules
- Handle relationships between objects

## License

MIT
