# Console Streamlining - Architecture Guide

## Overview

This document describes the refactored architecture that enables third-party systems to use ObjectUI components without inheriting the full console infrastructure.

## New Packages

### @object-ui/app-shell

**Purpose**: Minimal application rendering engine

**Exports**:
- `AppShell` - Basic layout container
- `ObjectRenderer` - Renders object views
- `DashboardRenderer` - Renders dashboard layouts
- `PageRenderer` - Renders custom pages
- `FormRenderer` - Renders forms

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
│  - ObjectRenderer                       │
│  - DashboardRenderer                    │
│  - PageRenderer                         │
│  - FormRenderer                         │
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
3. Create `examples/minimal-console`
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
import { AppShell, ObjectRenderer } from '@object-ui/app-shell';
import { DataSourceProvider } from '@object-ui/providers';

function MyConsole() {
  return (
    <DataSourceProvider dataSource={myAPI}>
      <AppShell sidebar={<MySidebar />}>
        <ObjectRenderer objectName="contact" />
      </AppShell>
    </DataSourceProvider>
  );
}
```

### Example 2: Next.js Integration

```tsx
// app/layout.tsx
import { AppShell } from '@object-ui/app-shell';
import { ThemeProvider } from '@object-ui/providers';

export default function RootLayout({ children }) {
  return (
    <ThemeProvider>
      <AppShell>{children}</AppShell>
    </ThemeProvider>
  );
}

// app/[object]/page.tsx
import { ObjectRenderer } from '@object-ui/app-shell';

export default function Page({ params }) {
  return <ObjectRenderer objectName={params.object} />;
}
```

### Example 3: Embedded Widget

```tsx
import { ObjectRenderer } from '@object-ui/app-shell';
import { DataSourceProvider } from '@object-ui/providers';

function MyExistingApp() {
  return (
    <div className="my-app">
      <header>My App Header</header>

      {/* Embed ObjectUI widget */}
      <DataSourceProvider dataSource={myAPI}>
        <ObjectRenderer objectName="contact" />
      </DataSourceProvider>

      <footer>My App Footer</footer>
    </div>
  );
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
  async find(objectName, params) {
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

- Test minimal-console example end-to-end
- Verify custom data source integration
- Test routing scenarios

### E2E Tests

- Separate E2E tests for minimal-console
- Verify it works independently of full console

## Documentation

### Package READMEs

Each package has comprehensive documentation:
- Installation
- Usage examples
- API reference
- Migration guide

### Examples

- `examples/minimal-console` - Basic integration (~100 lines)
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
- ⏳ Storybook documentation for all components
- ✅ At least 1 working integration example

## License

MIT
