# Console Streamlining - Architecture Guide

## Overview

This document describes the refactored architecture that enables third-party systems to use ObjectUI components without inheriting the full console infrastructure.

## New Packages

### @object-ui/app-shell

**Purpose**: Minimal application rendering engine

**Exports**:
- `AppShell` - Basic layout container
- `ObjectView` - Renders object views; it reads `objectName` from the router
  (`useParams()`) and takes an `objects` metadata array. For a router-free embed,
  use `ObjectView` from `@object-ui/plugin-view` instead - see the examples below.
- `DashboardView` - Renders a dashboard by name. The dashboard renderer itself,
  `DashboardRenderer`, is not an app-shell export - it ships from
  `@object-ui/plugin-dashboard`, and `DashboardView` renders through it.
- `PageView` - Renders a custom page by name. No package exports a
  `PageRenderer`: a page body is dispatched through the component registry on
  the schema node's `type` (`page`, `app`, `utility`, `home`, `record`).
- `RecordFormPage` - Renders a full-screen create/edit page. No package exports
  a `FormRenderer`; the exported form renderer is `ObjectForm` from
  `@object-ui/plugin-form`, which this page delegates to.

**Dependencies**: `@object-ui/react`, `@object-ui/components`, `@object-ui/fields`, `@object-ui/layout`

**Bundle Size**: ~50KB

### @object-ui/providers

**Purpose**: Reusable context providers

**Exports**:
- `DataSourceProvider` - Generic data source context
- `MetadataProvider` - Schema/metadata management
- `ThemeProvider` - Theme management

**Dependencies**: `@object-ui/types`

**Bundle Size**: ~10KB

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│  Third-Party Application                │
│  (Your Custom Console)                  │
└────────────────┬────────────────────────┘
                 │
                 ├── Custom Routing (React Router, Next.js, etc.)
                 ├── Custom Auth (Your implementation)
                 ├── Custom API (REST, GraphQL, etc.)
                 │
┌────────────────┴────────────────────────┐
│  @object-ui/app-shell                   │
│  - AppShell                             │
│  - ObjectView                           │
│  - DashboardView                        │
│  - PageView                             │
│  - RecordFormPage                       │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│  @object-ui/providers                   │
│  - DataSourceProvider                   │
│  - MetadataProvider                     │
│  - ThemeProvider                        │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│  @object-ui/react                       │
│  - SchemaRenderer                       │
│  - useActionRunner                      │
│  - Component Registry                   │
└────────────────┬────────────────────────┘
                 │
                 ├──────────────┬──────────────┬──────────────┐
                 │              │              │              │
┌────────────────┴──┐  ┌────────┴────┐  ┌──────┴────┐  ┌─────┴──────┐
│ @object-ui/       │  │ @object-ui/ │  │@object-ui/│  │ Plugins    │
│ components        │  │ fields      │  │ layout    │  │ (optional) │
│ (Shadcn UI)       │  │ (Inputs)    │  │ (Layouts) │  │            │
└───────────────────┘  └─────────────┘  └───────────┘  └────────────┘
```

## Comparison: Before vs After

### Before (Monolithic Console)

```
apps/console (500KB+)
├── Routing (hardcoded)
├── Auth (ObjectStack only)
├── Data Source (ObjectStack only)
├── Admin Pages (forced)
├── App Management (forced)
└── Object Rendering
```

**Problems**:
- Cannot use without full console
- Tied to ObjectStack backend
- No customization of routing/auth
- Large bundle size

### After (Modular Architecture)

```
@object-ui/app-shell (50KB)
├── Object Rendering
├── Dashboard Rendering
├── Page Rendering
└── Form Rendering

@object-ui/providers (10KB)
├── Generic DataSource
├── Metadata Management
└── Theme System

Third-Party App
├── Custom Routing
├── Custom Auth
├── Custom API
└── Cherry-picked Components
```

**Benefits**:
- Use components independently
- Bring your own backend
- Full customization
- Small bundle size

## Migration Path

### Phase 1: New Packages (Current)

1. Create `@object-ui/app-shell`
2. Create `@object-ui/providers`
3. Create `examples/byo-backend-console`
4. No breaking changes to console

### Phase 2: Extract More Components (Future)

1. Create `@object-ui/console-components`
2. Create `@object-ui/routing`
3. More examples (Next.js, Embedded)

### Phase 3: Refactor Console (Future)

1. Console uses new packages internally
2. Reduce console to ~150 lines
3. Console becomes reference implementation

## Usage Examples

### Example 1: Minimal Custom Console

```tsx
import { AppShell } from '@object-ui/app-shell';
import type { AppShellProps } from '@object-ui/app-shell';
import { ObjectView } from '@object-ui/plugin-view';
import { DataSourceProvider, useDataSource } from '@object-ui/providers';
import type { DataSourceProviderProps } from '@object-ui/providers';

// The two things you bring. Both are typed from the surface these packages
// ship, so this snippet compiles on its own: `myAPI` is your backend adapter
// (the "Custom Data Source Interface" section below is the shape it needs at
// runtime — `DataSourceProvider` declares the prop `any`, so the annotation
// records where the value goes rather than checking it), and `MySidebar` is
// your own component, returning whatever `AppShell` accepts for `sidebar`.
declare const myAPI: DataSourceProviderProps['dataSource'];
declare function MySidebar(): AppShellProps['sidebar'];

function MyConsole() {
  return (
    <DataSourceProvider dataSource={myAPI}>
      <AppShell sidebar={<MySidebar />}>
        <ContactList />
      </AppShell>
    </DataSourceProvider>
  );
}

function ContactList() {
  const dataSource = useDataSource();
  return (
    <ObjectView schema={{ type: 'object-view', objectName: 'contact' }} dataSource={dataSource} />
  );
}
```

### Example 2: Next.js Integration

`app/layout.tsx`:

```tsx
import { AppShell } from '@object-ui/app-shell';
import type { AppShellProps } from '@object-ui/app-shell';
import { ThemeProvider } from '@object-ui/providers';

export default function RootLayout({ children }: { children: AppShellProps['children'] }) {
  return (
    <ThemeProvider>
      <AppShell>{children}</AppShell>
    </ThemeProvider>
  );
}
```

`app/[object]/page.tsx`:

```tsx
import { ObjectView } from '@object-ui/plugin-view';
import { useDataSource } from '@object-ui/providers';

export default function Page({ params }: { params: { object: string } }) {
  const dataSource = useDataSource();
  return <ObjectView schema={{ type: 'object-view', objectName: params.object }} dataSource={dataSource} />;
}
```

### Example 3: Embedded Widget

```tsx
import { ObjectView } from '@object-ui/plugin-view';
import { DataSourceProvider, useDataSource } from '@object-ui/providers';
import type { DataSourceProviderProps } from '@object-ui/providers';

// Your backend adapter, as in Example 1 — declared here because every block on
// this page compiles on its own.
declare const myAPI: DataSourceProviderProps['dataSource'];

function MyExistingApp() {
  return (
    <div className="my-app">
      <header>My App Header</header>

      {/* Embed ObjectUI widget */}
      <DataSourceProvider dataSource={myAPI}>
        <ContactWidget />
      </DataSourceProvider>

      <footer>My App Footer</footer>
    </div>
  );
}

function ContactWidget() {
  const dataSource = useDataSource();
  return <ObjectView schema={{ type: 'object-view', objectName: 'contact' }} dataSource={dataSource} />;
}
```

## Custom Data Source Interface

Third-party systems implement this interface:

```tsx
interface DataSource {
  find(objectName: string, params?: any): Promise<any>;
  findOne(objectName: string, id: string): Promise<any>;
  create(objectName: string, data: any): Promise<any>;
  update(objectName: string, id: string, data: any): Promise<any>;
  delete(objectName: string, id: string): Promise<void>;
  getMetadata?(): Promise<any>;
}
```

Example implementation:

```tsx
const myDataSource = {
  // The parameter types are the ones the interface above declares; spelling
  // them out is what lets this block be compiled rather than read.
  async find(objectName: string, params?: any) {
    return fetch(`/api/${objectName}`, {
      method: 'POST',
      body: JSON.stringify(params),
    }).then(r => r.json());
  },
  // ... implement other methods
};
```

## Testing Strategy

### Unit Tests

- Each package has its own test suite
- No cross-package dependencies in tests
- Mock data sources for testing

### Integration Tests

- Test byo-backend-console example end-to-end
- Verify custom data source integration
- Test routing scenarios

### E2E Tests

- Separate E2E tests for byo-backend-console
- Verify it works independently of full console

## Documentation

### Package READMEs

Each package has comprehensive documentation:
- Installation
- Usage examples
- API reference
- Migration guide

### Examples

- `examples/byo-backend-console` - Basic integration (~100 lines)
- `examples/nextjs-console` - Next.js integration (TODO)
- `examples/embedded-widget` - Embedded usage (TODO)

### Guides

- Architecture Guide (this document)
- Integration Guide
- Migration Guide for console users
- Cookbook for common patterns

## Success Metrics

- ✅ Third-party developer can build console in < 1 hour
- ✅ Minimal bundle size < 200KB (vs current 500KB+)
- ✅ Zero ObjectStack dependencies for core rendering
- ⏳ 100% test coverage for extracted packages
- ✅ At least 1 working integration example

## License

MIT
