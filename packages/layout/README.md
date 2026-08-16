# @object-ui/layout

Layout components for Object UI - provides application shell components for building structured layouts with React Router integration.

## Features

- **Application Shell** - Complete app layout structure with header, sidebar, and content areas
- **Page Components** - Standard page layouts with headers and content sections
- **Navigation** - Sidebar navigation with React Router integration
- **Responsive** - Mobile-friendly layouts with collapsible sidebars
- **Tailwind Native** - Built with Tailwind CSS for easy customization

## Installation

```bash
pnpm add @object-ui/layout
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0
- `react-router-dom` ^6.0.0 || ^7.0.0

## Registration

Importing this package registers its component keys (`page-header`, `page:card`,
`app-shell`, `responsive-grid`, `navigation-renderer`, `app-schema-renderer`) on
the `ComponentRegistry` as a module load side effect, so the side-effect-only
import is enough:

```typescript
import '@object-ui/layout';
```

That is a supported entry point, not an accident of the build: `package.json`
declares the registering modules in `sideEffects`, which is what stops a bundler
from tree-shaking a side-effect-only import away (objectui#3899 — the manifest
used to say `"sideEffects": false`, and a bundler honouring it dropped the
registration silently). `registerLayout()` is also exported for hosts that
prefer to register explicitly.

## Components

### AppShell

Complete application shell with header, sidebar, and main content area.

```typescript
import { AppShell } from '@object-ui/layout';

<AppShell
  header={<div>Header Content</div>}
  sidebar={<div>Sidebar Content</div>}
>
  <div>Main Content</div>
</AppShell>
```

### PageHeader

Page title block with an optional subtitle, used at the top of a page's
content area.

```typescript
import { PageHeader } from '@object-ui/layout';

<PageHeader title="Dashboard" subtitle="View your metrics" />
```

`subtitle` is the only spelling for the secondary line — it is the key
`@objectstack/spec/ui`'s `PageHeaderProps` declares. The legacy `description`
alias this component used to read as well was retired in objectui#3789; stored
metadata still carrying it is rewritten to `subtitle` at load time by the
ADR-0087 D2 conversion `page-header-subtitle-alias`.

> **Rendering a whole `page` node?** That belongs to `PageRenderer` in
> `@object-ui/components`, which is what the `page` component key resolves to —
> it handles page types (record/home/app/utility), named regions and page
> variables. This package deliberately does not register or export a second
> renderer for that key (objectui#3223).

### SidebarNav

Navigation sidebar component with React Router integration.

```typescript
import { SidebarNav } from '@object-ui/layout';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: 'home' },
  { label: 'Users', path: '/users', icon: 'users' },
  { label: 'Settings', path: '/settings', icon: 'settings' }
];

<SidebarNav items={navItems} />
```

## Usage with React Router

The layout components are designed to work seamlessly with React Router:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell, SidebarNav } from '@object-ui/layout';

function App() {
  return (
    <BrowserRouter>
      <AppShell
        header={<div className="p-4">My App</div>}
        sidebar={
          <SidebarNav
            items={[
              { label: 'Dashboard', path: '/', icon: 'home' },
              { label: 'Users', path: '/users', icon: 'users' }
            ]}
          />
        }
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
```

## Customization

All components accept `className` prop for Tailwind customization:

```typescript
<AppShell
  className="bg-gray-50"
  headerClassName="border-b"
  sidebarClassName="bg-white shadow-lg"
>
  {children}
</AppShell>
```

## API Reference

For detailed API documentation, visit the [Object UI Documentation](https://www.objectui.org/docs/layout/app-shell).

## Links

- 📚 [Documentation](https://www.objectui.org/docs/guide/layout)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/layout)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
