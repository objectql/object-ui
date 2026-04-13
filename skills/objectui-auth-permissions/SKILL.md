---
name: objectui-auth-permissions
description: Implement authentication, authorization, and role-based access control in Object UI apps. Use this skill when the user asks to add login/signup flows, protect routes with auth guards, implement RBAC (role-based access control), configure field-level or row-level permissions, set up multi-tenancy with tenant branding, integrate auth tokens with data fetching, or debug permission evaluation. Also applies when the user mentions AuthProvider, PermissionProvider, TenantProvider, user roles, access control, or "only admins should see this".
---

# ObjectUI Auth & Permissions

Use this skill to implement authentication, authorization, and multi-tenancy in Object UI applications. The auth system is built on three independent but composable packages: `@object-ui/auth`, `@object-ui/permissions`, and `@object-ui/tenant`.

## Architecture

```
┌────────────────────────────────┐
│  TenantProvider                │  ← Multi-tenancy context
│  ├── AuthProvider              │  ← Authentication state
│  │   ├── PermissionProvider    │  ← RBAC evaluation
│  │   │   └── App Content       │
│  │   │       └── AuthGuard     │  ← Route protection
│  │   │           └── Pages     │
```

Each provider is optional. Use only what you need.

## Authentication (`@object-ui/auth`)

### AuthProvider setup

```typescript
import { AuthProvider, createAuthClient } from '@object-ui/auth';

const authClient = createAuthClient({ baseURL: '/api/v1/auth' });

function App() {
  return (
    <AuthProvider authClient={authClient}>
      <AppContent />
    </AuthProvider>
  );
}
```

### useAuth hook

```typescript
import { useAuth } from '@object-ui/auth';

function UserBadge() {
  const { user, isAuthenticated, isLoading, error, signOut } = useAuth();

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <LoginButton />;

  return (
    <div>
      <span>Hello {user.name}</span>
      <Button onClick={signOut}>Log out</Button>
    </div>
  );
}
```

### AuthUser type

```typescript
interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  role?: string;
  roles?: string[];
  emailVerified?: boolean;
  [key: string]: unknown;
}
```

### AuthGuard (route protection)

```typescript
import { AuthGuard } from '@object-ui/auth';

function ProtectedRoutes() {
  return (
    <AuthGuard fallback={<LoginPage />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </AuthGuard>
  );
}
```

### Pre-built UI components

```typescript
import { LoginForm, RegisterForm, ForgotPasswordForm, UserMenu } from '@object-ui/auth';

// LoginForm includes email/password fields, social login buttons, forgot password link
<LoginForm onSuccess={() => navigate('/dashboard')} />

// UserMenu shows user avatar, name, role with dropdown for profile/settings/logout
<UserMenu />
```

### Authenticated data fetching

Connect auth tokens to the DataSource layer:

```typescript
import { createAuthenticatedFetch, createAuthClient } from '@object-ui/auth';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

const authClient = createAuthClient({ baseURL: '/api/v1/auth' });
const authenticatedFetch = createAuthenticatedFetch(authClient);

const dataSource = new ObjectStackAdapter({
  baseUrl: '/api/v1',
  fetch: authenticatedFetch,  // Bearer token injected on every request
});
```

## Permissions (`@object-ui/permissions`)

### PermissionProvider setup

```typescript
import { PermissionProvider } from '@object-ui/permissions';

const roles = [
  {
    name: 'admin',
    label: 'Administrator',
    permissions: {
      contacts: { actions: ['create', 'read', 'update', 'delete', 'export'] },
      orders: { actions: ['create', 'read', 'update', 'delete'] },
    },
  },
  {
    name: 'viewer',
    label: 'Viewer',
    inherits: ['base'],  // Role inheritance
    permissions: {
      contacts: { actions: ['read'] },
      orders: { actions: ['read'] },
    },
  },
];

const permissions = [
  {
    object: 'contacts',
    publicAccess: ['read'],  // Public actions (no auth needed)
    fieldPermissions: [
      { field: 'salary', roles: ['admin'] },  // Only admin sees salary
    ],
    rowPermissions: [
      { roles: ['owner'], filter: { ownerId: '${user.id}' }, actions: ['update', 'delete'] },
    ],
  },
];

function App() {
  const { user } = useAuth();
  return (
    <PermissionProvider
      roles={roles}
      permissions={permissions}
      userRoles={user?.roles || ['viewer']}
      user={user}
    >
      <AppContent />
    </PermissionProvider>
  );
}
```

### usePermissions hook

```typescript
import { usePermissions } from '@object-ui/permissions';

function ContactActions({ contact }) {
  const { check, checkField, getFieldPermissions, getRowFilter } = usePermissions();

  const canEdit = check('contacts', 'update', contact);
  const canDelete = check('contacts', 'delete', contact);
  const canSeeSalary = checkField('contacts', 'salary', 'read');

  return (
    <div>
      {canEdit && <Button>Edit</Button>}
      {canDelete && <Button variant="destructive">Delete</Button>}
      {canSeeSalary && <span>Salary: {contact.salary}</span>}
    </div>
  );
}
```

### Permission evaluation pipeline

When `check(object, action, record?)` is called:

1. Check `publicAccess` — if action is public, allow immediately
2. Resolve effective roles (with inheritance chain)
3. Check role-based action permissions
4. If record provided + row permissions exist: evaluate row-level filter
5. Return `{ allowed, fieldRestrictions?, rowFilter?, reason? }`

### PermissionGuard component

```typescript
import { PermissionGuard } from '@object-ui/permissions';

function AdminPanel() {
  return (
    <PermissionGuard object="contacts" action="delete" fallback={<AccessDenied />}>
      <BulkDeleteButton />
    </PermissionGuard>
  );
}
```

### Schema-level visibility with expressions

Combine permissions with expression-based visibility:

```json
{
  "type": "button",
  "props": { "label": "Delete Selected" },
  "hidden": "${data.userRole !== 'admin'}"
}
```

For more complex permission checks, derive permission flags in the dataSource object:

```typescript
const permissions = usePermissions();
const dataSource = {
  ...data,
  canEditContacts: permissions.check('contacts', 'update'),
  canDeleteContacts: permissions.check('contacts', 'delete'),
};

<SchemaRendererProvider dataSource={dataSource}>
  <SchemaRenderer schema={schema} />
</SchemaRendererProvider>
```

Then in schema:
```json
{
  "type": "button",
  "props": { "label": "Delete" },
  "hidden": "${!canDeleteContacts}"
}
```

## Multi-tenancy (`@object-ui/tenant`)

### TenantProvider setup

```typescript
import { TenantProvider } from '@object-ui/tenant';

function App() {
  return (
    <TenantProvider
      tenant={{
        id: 'acme-corp',
        name: 'ACME Corporation',
        branding: {
          companyName: 'ACME Corp',
          primaryColor: '#2563eb',
          logo: '/logos/acme.svg',
        },
      }}
      fetchTenant={async (tenantId) => {
        const res = await fetch(`/api/tenants/${tenantId}`);
        return res.json();
      }}
    >
      <AppContent />
    </TenantProvider>
  );
}
```

### useTenant hook

```typescript
import { useTenant, useTenantBranding } from '@object-ui/tenant';

function Header() {
  const { tenant, switchTenant } = useTenant();
  const branding = useTenantBranding();

  return (
    <header style={{ backgroundColor: branding.primaryColor }}>
      <img src={branding.logo} alt={branding.companyName} />
      <h1>{branding.companyName}</h1>
    </header>
  );
}
```

### TenantBranding defaults

```typescript
interface TenantBranding {
  companyName: string;      // default: 'ObjectUI'
  primaryColor: string;     // default: '#3b82f6'
  secondaryColor: string;   // default: '#64748b'
  logo?: string;
  favicon?: string;
  // ... additional theme overrides
}
```

### Tenant-scoped data queries

```typescript
import { TenantScopedQuery } from '@object-ui/tenant';

// Automatically adds tenant filter to all queries
<TenantScopedQuery>
  <SchemaRendererProvider dataSource={dataSource}>
    <SchemaRenderer schema={schema} />
  </SchemaRendererProvider>
</TenantScopedQuery>
```

## Provider composition pattern

Here's the typical nesting order for a full-featured app:

```typescript
<BrowserRouter>
  <TenantProvider tenant={tenantConfig}>
    <AuthProvider authClient={authClient}>
      <PermissionProvider roles={roles} permissions={perms} userRoles={userRoles}>
        <SchemaRendererProvider dataSource={authenticatedDataSource}>
          <AuthGuard fallback={<LoginPage />}>
            <AppShell>
              <Routes>...</Routes>
            </AppShell>
          </AuthGuard>
        </SchemaRendererProvider>
      </PermissionProvider>
    </AuthProvider>
  </TenantProvider>
</BrowserRouter>
```

## Common mistakes

- Nesting PermissionProvider outside AuthProvider — userRoles can't be resolved from auth state.
- Using `hidden` expressions for security — they only hide UI elements. Always enforce permissions server-side.
- Forgetting `createAuthenticatedFetch` — API calls go without Bearer token, getting 401 errors.
- Hardcoding role checks in JSX instead of using PermissionGuard or usePermissions.
- Not providing fallback UI for AuthGuard/PermissionGuard — users see blank screens.
