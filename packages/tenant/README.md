# @object-ui/tenant

Multi-tenancy support for Object UI — tenant isolation, scoped queries, and per-tenant branding.

## Features

- 🏢 **TenantProvider** - Context provider for tenant-aware applications
- 🔒 **Tenant Isolation** - Row-level and schema-level isolation strategies
- 🎨 **Custom Branding** - Per-tenant logos, colors, and themes via `useTenantBranding`
- 🛡️ **TenantGuard** - Protect components based on tenant status and plan
- 🔍 **Scoped Queries** - Automatically scope data queries to the current tenant
- 🔗 **Tenant Resolver** - Pluggable resolution via subdomain, path, or header
- 🎯 **Type-Safe** - Full TypeScript support with exported types

## Installation

```bash
npm install @object-ui/tenant
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Quick Start

```tsx
import { TenantProvider, useTenant, useTenantBranding } from '@object-ui/tenant';

function App() {
  return (
    <TenantProvider
      config={{
        resolutionStrategy: 'subdomain',
        isolationStrategy: 'row',
      }}
    >
      <TenantApp />
    </TenantProvider>
  );
}

function TenantApp() {
  const { tenant } = useTenant();
  const { logo, primaryColor } = useTenantBranding();

  return (
    <div style={{ borderColor: primaryColor }}>
      <img src={logo} alt={tenant?.name} />
      <h1>Welcome to {tenant?.name}</h1>
    </div>
  );
}
```

## API

### TenantProvider

Wraps your application with tenant context:

```tsx
<TenantProvider config={{ resolutionStrategy: 'subdomain', isolationStrategy: 'row' }}>
  <App />
</TenantProvider>
```

### useTenant

Hook for accessing the current tenant:

```tsx
const { tenant, isLoading, error } = useTenant();
```

### useTenantBranding

Hook for accessing tenant-specific branding:

```tsx
const { logo, primaryColor, theme } = useTenantBranding();
```

### TenantGuard

Protects components based on tenant status or plan:

```tsx
<TenantGuard requiredPlan="enterprise" fallback={<UpgradePrompt />}>
  <EnterpriseFeature />
</TenantGuard>
```

### TenantScopedQuery

Automatically scopes data queries to the current tenant:

```tsx
<TenantScopedQuery objectName="orders">
  {({ data }) => <OrderList orders={data} />}
</TenantScopedQuery>
```

### createTenantResolver

Factory for custom tenant resolution logic:

```tsx
const resolver = createTenantResolver({
  strategy: 'subdomain',
  fetchTenant: async (id) => api.getTenant(id),
});
```

## License

MIT
