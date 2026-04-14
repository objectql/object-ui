# Minimal Console Example

**Building a Custom Console with ObjectUI in ~100 Lines**

This example demonstrates how third-party systems can integrate ObjectUI components to build their own console without inheriting the full console infrastructure.

## What This Example Shows

- ✅ Custom routing with React Router
- ✅ Custom data adapter (mock REST API, not ObjectStack)
- ✅ Using `@object-ui/app-shell` for rendering
- ✅ Using `@object-ui/providers` for context
- ✅ No console dependencies
- ✅ ~100 lines of integration code

## Key Differences from Full Console

| Feature | Minimal Console | Full Console |
|---------|----------------|--------------|
| Lines of Code | ~100 | ~5000+ |
| Bundle Size | ~150KB | ~500KB+ |
| Auth | Mock/Custom | ObjectStack Auth |
| Routing | React Router (custom) | React Router (built-in) |
| Data Source | Mock REST API | ObjectStack API |
| Admin Pages | None | Users, Roles, Audit, etc. |
| App Management | None | Create/Edit Apps |

## Running This Example

```bash
# From monorepo root
pnpm install
pnpm build

# Run the example
cd examples/minimal-console
pnpm dev

# Open http://localhost:5174
```

## Code Walkthrough

### 1. Custom Data Adapter (`src/mockDataSource.ts`)

Implements the `DataSource` interface to connect to your backend:

```tsx
const mockDataSource = {
  async find(objectName: string) {
    // Call your API
    return fetch(`/api/${objectName}`).then(r => r.json());
  },
  // ... other methods
};
```

### 2. App Shell (`src/App.tsx`)

Uses `@object-ui/app-shell` components:

```tsx
import { AppShell, ObjectRenderer } from '@object-ui/app-shell';
import { ThemeProvider, DataSourceProvider } from '@object-ui/providers';

function App() {
  return (
    <ThemeProvider>
      <DataSourceProvider dataSource={mockDataSource}>
        <AppShell sidebar={<MySidebar />}>
          <Routes>
            <Route path="/:object" element={<ObjectRenderer />} />
          </Routes>
        </AppShell>
      </DataSourceProvider>
    </ThemeProvider>
  );
}
```

### 3. Custom Routing (`src/router.tsx`)

Full control over routes - no predefined structure:

```tsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/contacts" element={<ObjectRenderer objectName="contact" />} />
  <Route path="/accounts" element={<ObjectRenderer objectName="account" />} />
  {/* Your custom routes */}
</Routes>
```

## Customization Examples

### Use Next.js Instead of React Router

```tsx
// app/layout.tsx
import { AppShell } from '@object-ui/app-shell';

export default function RootLayout({ children }) {
  return <AppShell sidebar={<Sidebar />}>{children}</AppShell>;
}

// app/[object]/page.tsx
import { ObjectRenderer } from '@object-ui/app-shell';

export default function ObjectPage({ params }) {
  return <ObjectRenderer objectName={params.object} />;
}
```

### Connect to Your Own API

```tsx
const myDataSource = {
  async find(objectName, params) {
    return axios.get(`https://my-api.com/${objectName}`, { params });
  },
  async create(objectName, data) {
    return axios.post(`https://my-api.com/${objectName}`, data);
  },
  // ... implement other methods
};
```

### Add Custom Authentication

```tsx
function App() {
  const { user, login, logout } = useMyAuth();

  if (!user) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <DataSourceProvider dataSource={myDataSource}>
      <AppShell sidebar={<Sidebar onLogout={logout} />}>
        {/* ... */}
      </AppShell>
    </DataSourceProvider>
  );
}
```

## What You Get

- **Full ObjectUI Rendering**: All view types (Grid, Kanban, List, Calendar, etc.)
- **All Field Types**: Text, Number, Select, Date, Lookup, etc.
- **Form Handling**: Modal and inline forms
- **Dashboard Support**: Widget-based dashboards
- **Custom Pages**: JSON-driven page layouts
- **Zero Console Bloat**: No admin pages, no app management

## What You Don't Get

- App management UI (create/edit apps)
- User/role/permission management pages
- Audit log viewer
- ObjectStack-specific features
- Pre-built authentication

## When to Use This

✅ **Use minimal console when:**
- You have your own backend API
- You want full control over routing and layout
- You need custom authentication
- You want to embed ObjectUI in an existing app
- Bundle size matters

❌ **Use full console when:**
- You're using ObjectStack backend
- You need complete admin functionality
- You want everything pre-configured
- You prefer convention over configuration

## Next Steps

1. Customize the data adapter for your API
2. Add your own authentication
3. Customize the sidebar and navigation
4. Add custom pages and routes
5. Deploy to your infrastructure

## License

MIT
