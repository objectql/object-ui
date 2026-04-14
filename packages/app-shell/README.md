# @object-ui/app-shell

**Minimal Application Shell for ObjectUI**

A lightweight, framework-agnostic rendering engine that enables third-party systems to integrate ObjectUI components without inheriting the full console infrastructure.

## Purpose

This package provides the essential building blocks for rendering ObjectUI schemas:
- Basic layout components (AppShell, Sidebar, Main)
- Renderer components for objects, dashboards, pages, and forms
- Zero console-specific dependencies
- Bring-your-own-router design

## Installation

```bash
pnpm add @object-ui/app-shell
```

## Usage

### Basic Setup

```tsx
import { AppShell, ObjectRenderer } from '@object-ui/app-shell';

function MyCustomConsole() {
  return (
    <AppShell sidebar={<MySidebar />}>
      <ObjectRenderer
        objectName="contact"
        dataSource={myDataSource}
      />
    </AppShell>
  );
}
```

### With Dashboard

```tsx
import { DashboardRenderer } from '@object-ui/app-shell';

function MyDashboard() {
  return (
    <DashboardRenderer
      schema={dashboardSchema}
      dataSource={myDataSource}
    />
  );
}
```

### With Custom Form

```tsx
import { FormRenderer } from '@object-ui/app-shell';

function MyForm() {
  return (
    <FormRenderer
      schema={formSchema}
      dataSource={myDataSource}
      onSuccess={() => console.log('Saved!')}
    />
  );
}
```

## Key Features

- **Zero Dependencies on Console**: No routing, no auth, no app management
- **Framework Agnostic**: Works with React Router, Next.js, Remix, or any router
- **Lightweight**: ~50KB vs 500KB+ for full console
- **Composable**: Mix and match components as needed
- **Type-Safe**: Full TypeScript support

## Components

### AppShell

Basic layout container with sidebar support.

```tsx
<AppShell
  sidebar={<YourSidebar />}
  header={<YourHeader />}
>
  {children}
</AppShell>
```

### ObjectRenderer

Renders object views (Grid, Kanban, List, etc.).

```tsx
<ObjectRenderer
  objectName="contact"
  viewId="grid-view"
  dataSource={dataSource}
  onRecordClick={(record) => navigate(`/detail/${record.id}`)}
/>
```

### DashboardRenderer

Renders dashboard layouts from schema.

```tsx
<DashboardRenderer
  schema={dashboardSchema}
  dataSource={dataSource}
/>
```

### PageRenderer

Renders custom page schemas.

```tsx
<PageRenderer
  schema={pageSchema}
/>
```

### FormRenderer

Renders forms (modal or inline).

```tsx
<FormRenderer
  schema={formSchema}
  dataSource={dataSource}
  mode="create" // or "edit"
  recordId={recordId}
  onSuccess={handleSuccess}
  onCancel={handleCancel}
/>
```

## Architecture

This package sits between the low-level `@object-ui/react` (SchemaRenderer) and the high-level `apps/console` (full application):

```
Third-Party App
    ↓
@object-ui/app-shell ← You are here
    ↓
@object-ui/react (SchemaRenderer)
    ↓
@object-ui/components + @object-ui/fields + plugins
```

## Comparison with Console

| Feature | @object-ui/app-shell | apps/console |
|---------|---------------------|--------------|
| Bundle Size | ~50KB | ~500KB+ |
| Routing | BYO | Built-in React Router |
| Auth | BYO | Built-in ObjectStack Auth |
| Admin Pages | No | Users, Roles, Audit, etc. |
| App Management | No | Create/Edit Apps |
| Data Source | Any | ObjectStack |
| Customization | Full control | Limited |

## Examples

See `examples/minimal-console` for a complete working example that demonstrates:
- Custom routing with React Router
- Custom data adapter (not ObjectStack)
- Custom authentication
- Cherry-picking only needed components
- Building a console in ~100 lines of code

## License

MIT
