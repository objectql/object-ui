# Migration Guide: ObjectStack Integration

This guide helps you migrate to the new ObjectStack-integrated version of ObjectUI.

## What Changed

### 1. New Dependencies

The following packages now have ObjectStack dependencies:

- `@object-ui/types` → depends on `@objectstack/spec@^0.3.0`
- `@object-ui/core` → depends on `@objectstack/client@^0.3.0` and `@objectstack/spec@^0.3.0`

### 2. ObjectStack Adapter

The `ObjectStackAdapter` in `@object-ui/core` provides seamless integration with ObjectStack Protocol servers.

## For Users

### Using the ObjectStack Adapter

To connect to an ObjectStack backend:

```typescript
import { createObjectStackAdapter } from '@object-ui/core';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://your-objectstack-server.com',
  token: 'your-auth-token', // optional
});

// Use it in your components
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

### Migrating from Other Data Sources

The `ObjectStackAdapter` implements the standard `DataSource` interface, so it's a drop-in replacement:

```typescript
// Before
const dataSource = createRESTDataSource({ baseUrl: '...' });

// After
const dataSource = createObjectStackAdapter({ baseUrl: '...' });

// Everything else stays the same!
```

## For Package Maintainers

### Installation

After pulling the latest changes, run:

```bash
pnpm install
```

This will install the new `@objectstack/spec` and `@objectstack/client` dependencies.

### Building

The build process remains the same:

```bash
pnpm build
```

### Testing

All existing tests should pass:

```bash
pnpm test
```

## Breaking Changes

**None!** This is a backward-compatible addition.

- Existing code continues to work unchanged
- The ObjectStack adapter is an optional feature
- No changes to public APIs or type definitions
- All tests pass without modification

## New Features

### 1. ObjectStack Adapter

- Full CRUD operations (find, findOne, create, update, delete)
- Bulk operations (createMany, updateMany, deleteMany)
- Auto-discovery of server capabilities
- Query parameter translation (OData-style → ObjectStack)

### 2. Type Safety

- Full TypeScript support with the `@objectstack/spec` protocol
- Type inference for query results
- Proper error handling with typed errors

### 3. Documentation

- New adapter README with usage examples
- Comprehensive JSDoc comments
- Integration examples

## For Contributors

### Where to Find Code

- **Adapter Implementation**: `packages/core/src/adapters/objectstack-adapter.ts`
- **Adapter Documentation**: `packages/core/src/adapters/README.md`
- **Type Definitions**: `@objectstack/spec` (external package)
- **Client SDK**: `@objectstack/client` (external package)

### Architecture

The integration follows this hierarchy:

```
@objectstack/spec (protocol specification)
    ↓
@object-ui/types (ObjectUI type extensions)
    ↓
@object-ui/core (engine + adapters)
    ↓
@object-ui/react (React bindings)
    ↓
@object-ui/components (Shadcn/Tailwind UI)
```

## Support

If you encounter any issues:

1. Check the [adapter README](packages/core/src/adapters/README.md)
2. Review the [ObjectStack spec](https://github.com/objectstack-ai/spec)
3. Open an issue on GitHub

## Version Compatibility

| Package | Version | ObjectStack Spec | ObjectStack Client |
|---------|---------|------------------|-------------------|
| @object-ui/types | 0.3.0+ | ^0.3.0 | - |
| @object-ui/core | 0.3.0+ | ^0.3.0 | ^0.3.0 |

## Next Steps

- Explore the [ObjectStack Protocol](https://github.com/objectstack-ai/spec)
- Try the adapter in your application
- Provide feedback on the integration
