# ObjectUI Auth & Permissions

Authentication and authorization for an ObjectUI app. The auth system is built on two independent but composable packages: `@object-ui/auth` and `@object-ui/permissions`.

## Architecture

```
┌────────────────────────────────┐
│  AuthProvider                  │  ← Authentication state
│  ├── PermissionProvider        │  ← RBAC evaluation
│  │   └── App Content           │
│  │       └── AuthGuard         │  ← Route protection
│  │           └── Pages         │
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
import type { ObjectPermissionConfig, RoleDefinition } from '@object-ui/types';

// A role definition carries identity and inheritance only. Its grants live in
// `ObjectPermissionConfig.roles` below, keyed by object — that is the single
// wired home for "what may this role do".
const roles: RoleDefinition[] = [
  { name: 'admin', label: 'Administrator' },
  { name: 'viewer', label: 'Viewer', inherits: ['base'] },  // Role inheritance
];

const permissions: ObjectPermissionConfig[] = [
  {
    object: 'contacts',
    publicAccess: ['read'],  // Public actions (no auth needed)
    // `roles` is required, and it is the level that decides *who* a rule
    // applies to. Field and row rules nest under the role name; they carry
    // no `roles` member of their own.
    roles: {
      admin: {
        actions: ['create', 'read', 'update', 'delete', 'export'],
      },
      viewer: {
        actions: ['read'],
        // Only admin sees salary: the restriction is declared on the role
        // it restricts, and admin simply has no entry for the field.
        fieldPermissions: [{ field: 'salary', read: false, mask: '****' }],
      },
      owner: {
        actions: ['read', 'update', 'delete'],
        // `filter` is a string, and it is handed back to you verbatim.
        rowPermissions: [
          { filter: 'ownerId = ${user.id}', actions: ['update', 'delete'] },
        ],
      },
    },
  },
  {
    object: 'orders',
    roles: {
      admin: { actions: ['create', 'read', 'update', 'delete'] },
      viewer: { actions: ['read'] },
    },
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

The keys under `roles` are matched against the `userRoles` you pass to the
provider (after inheritance is expanded through the `roles` array), so a grant
key such as `owner` above works whether or not it also has a `RoleDefinition`
entry — the definitions array is read only to expand `inherits`.

### Row filters are returned verbatim — nothing interpolates them

`RowLevelPermission.filter` is a **string**, not a filter object, and
`@object-ui/permissions` performs no interpolation on it anywhere. `check()`
returns it as `rowFilter` and `getRowFilter()` returns it unchanged; the
package has no substitution step at all.

So a placeholder like `${user.id}` is **not** resolved for you. It arrives at
your code exactly as written, and it is the caller's job either to substitute
it — using whatever user scope that caller has — or to forward the string to a
backend that understands the placeholder itself. This is also not a
`SchemaRenderer` expression, so the expression scope described later in this
guide does not govern it; the two look alike and are unrelated.

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
  "label": "Delete Selected",
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

Then in schema — note the `data.` root:
```json
{
  "type": "button",
  "label": "Delete",
  "hidden": "${!data.canDeleteContacts}"
}
```

### Expression scope: which roots resolve

`SchemaRenderer` evaluates every schema expression against a fixed scope:

| Root | Comes from | Example |
|---|---|---|
| `data` | the `dataSource` passed to `SchemaRendererProvider` | `${data.canDeleteContacts}` |
| `user` / `current_user` | the ambient host scope (app-shell's `ExpressionProvider`) | `${user.id}` |
| `app`, `features` | the ambient host scope | `${features.multiOrgEnabled}` |
| `page` | `PageSchema.variables`, inside a Page | `${page.selectedId}` |

The ambient roots exist only while a host scope is mounted — `ExpressionProvider`
supplies them (it also aliases the signed-in user as `ctx.user` and `os.user`).
With no host scope mounted, `data` and `page` are all you get.

**Keys of the `dataSource` object are reachable only under the `data.` root —
they are not also spread as bare names.** Writing `${!canDeleteContacts}`
instead of `${!data.canDeleteContacts}` does not fail loudly: the bare name
resolves to `undefined`, `!undefined` is always `true`, and the `hidden`
expression is therefore permanently true — the button disappears for *every*
user, including the ones who do have the permission. Because the result no
longer depends on the flag, flipping the user's permission to test it produces
no change at all, so the most natural way to debug it gives no signal. The same
trap applies to `visible`, `disabled` and any other expression-valued key.

## Multi-tenancy

There is no client-side tenancy layer. Tenant scoping is server-enforced
from the session, not from a header: `createAuthenticatedFetch`
(`@object-ui/auth`) does stamp the active organization as `X-Tenant-ID` on
requests, but that header is an edge routing hint, not identity — see
`packages/auth/README.md`, "The `X-Tenant-ID` edge contract", for what it may
and may not be trusted for. Per-tenant branding is a `ThemeSchema` concern
(see the theming guide), not an auth concern.

## Provider composition pattern

Here's the typical nesting order for a full-featured app:

```typescript
<BrowserRouter>
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
</BrowserRouter>
```

## Common mistakes

- Nesting PermissionProvider outside AuthProvider — userRoles can't be resolved from auth state.
- Using `hidden` expressions for security — they only hide UI elements. Always enforce permissions server-side.
- Forgetting `createAuthenticatedFetch` — API calls go without Bearer token, getting 401 errors.
- Hardcoding role checks in JSX instead of using PermissionGuard or usePermissions.
- Not providing fallback UI for AuthGuard/PermissionGuard — users see blank screens.
