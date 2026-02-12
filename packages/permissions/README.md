# @object-ui/permissions

Role-Based Access Control (RBAC) for Object UI — permission guards, field-level access, and policy evaluation.

## Features

- 🔐 **PermissionProvider** - Context provider for permission-aware applications
- 🛡️ **PermissionGuard** - Conditionally render components based on user permissions
- 🎣 **usePermissions** - Hook for checking access to actions and resources
- 📝 **Field-Level Permissions** - Control visibility and editability per field with `useFieldPermissions`
- 🔍 **Row-Level Security** - Filter data based on permission conditions
- ⚡ **Permission Evaluator** - Programmatic permission checking engine
- 🎯 **Type-Safe** - Full TypeScript support with exported types

## Installation

```bash
npm install @object-ui/permissions
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Quick Start

```tsx
import { PermissionProvider, usePermissions, PermissionGuard } from '@object-ui/permissions';

function App() {
  return (
    <PermissionProvider
      roles={['admin', 'editor']}
      permissions={{
        orders: { read: true, create: true, update: true, delete: false },
      }}
    >
      <Dashboard />
    </PermissionProvider>
  );
}

function Dashboard() {
  const { can } = usePermissions();

  return (
    <div>
      <h1>Orders</h1>
      <PermissionGuard action="create" resource="orders" fallback={<p>No access</p>}>
        <button>Create Order</button>
      </PermissionGuard>
      {can('delete', 'orders') && <button>Delete</button>}
    </div>
  );
}
```

## API

### PermissionProvider

Wraps your application with permission context:

```tsx
<PermissionProvider roles={['editor']} permissions={permissionMap}>
  <App />
</PermissionProvider>
```

### usePermissions

Hook for checking permissions programmatically:

```tsx
const { can, cannot, roles } = usePermissions();

if (can('update', 'orders')) {
  // allow editing
}
```

### useFieldPermissions

Hook for field-level permission checks:

```tsx
const { isVisible, isEditable } = useFieldPermissions('orders', 'discount');
```

### PermissionGuard

Conditionally renders children based on permissions:

```tsx
<PermissionGuard action="delete" resource="orders" fallback={<span>Read only</span>}>
  <DeleteButton />
</PermissionGuard>
```

### evaluatePermission

Programmatic permission evaluation:

```tsx
import { evaluatePermission } from '@object-ui/permissions';

const result = evaluatePermission({
  action: 'update',
  resource: 'orders',
  roles: ['editor'],
  permissions: permissionConfig,
});
```

### createPermissionStore

Creates a permission store for advanced use cases:

```tsx
const store = createPermissionStore(permissionConfig);
store.check('read', 'orders'); // true | false
```

## License

MIT
