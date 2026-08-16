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
import { SidebarNav, type NavItem } from '@object-ui/layout';
import { Home, Settings, Users } from 'lucide-react';

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'Users', href: '/users', icon: Users },
  { title: 'Settings', href: '/settings', icon: Settings },
];

<SidebarNav items={navItems} />
```

An item's label is `title` and its target is `href` — and `icon` is a **component**,
not an icon name: it is rendered as `<item.icon />` (`src/SidebarNav.tsx:60`, `:109`),
so pass the imported Lucide component itself. This example used to be written with
`label` / `path` / `icon: 'home'`, none of which `NavItem` declares (objectui#3999);
copied as-is it produced rows with no label at all, a `NavLink` whose `to` was
`undefined`, and the string `'home'` handed to React as an unknown lowercase tag.
Annotating the array as `NavItem[]` is what turns that whole class of typo back into
a compile error where it is written, instead of a blank sidebar at runtime.

#### `SidebarNavProps`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `NavItem[] \| NavGroup[]` | — (required) | Flat item list, or grouped sections. The array must be homogeneous: only the **first** element is probed to decide which of the two it is. |
| `title` | `string` | `'Application'` | Section label shown above a flat `NavItem[]`. Ignored when `items` is a `NavGroup[]` — each group prints its own `label`. |
| `className` | `string` | — | Tailwind overrides, forwarded to the root `Sidebar`. |
| `collapsible` | `'offcanvas' \| 'icon' \| 'none'` | `'icon'` | Collapse behaviour of the underlying Shadcn `Sidebar`. |
| `searchEnabled` | `boolean` | `false` | Renders a search box that filters items by `title` (an item also survives when one of its `children` matches). |
| `searchPlaceholder` | `string` | `'Search…'` | Placeholder for that search box. |

#### `NavItem`

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | — (required) | The visible label, and what search matches against. |
| `href` | `string` | — (required) | `NavLink` target; also the React key, so keep it unique within its list. Active state is `pathname === href`. |
| `icon` | `React.ComponentType<{ className?: string }>` | — | The icon **component** (e.g. `Home` from `lucide-react`), not its name. |
| `badge` | `string \| number` | — | Trailing badge content. Rendered whenever it is not `null`/`undefined`, so `0` shows. |
| `badgeVariant` | `'default' \| 'destructive' \| 'outline'` | `'default'` | Badge styling. |
| `children` | `NavItem[]` | — | Nested sub-items. A non-empty list turns the row into a collapsible group: the parent's own `href` is then no longer a link, only the children are. |

#### `NavGroup`

| Key | Type | Description |
| --- | --- | --- |
| `label` | `string` | Section heading printed above the group. |
| `items` | `NavItem[]` | The group's items — same `NavItem` shape as above, nesting included. |

```typescript
import { SidebarNav, type NavGroup } from '@object-ui/layout';
import { FolderOpen, Home, Settings } from 'lucide-react';

const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      {
        title: 'Projects',
        href: '/projects',
        icon: FolderOpen,
        badge: 3,
        children: [
          { title: 'Active', href: '/projects/active' },
          { title: 'Archived', href: '/projects/archived', badge: 'WIP', badgeVariant: 'outline' },
        ],
      },
    ],
  },
  {
    label: 'System',
    items: [{ title: 'Settings', href: '/settings', icon: Settings }],
  },
];

<SidebarNav items={navGroups} searchEnabled />
```

Note that `SidebarNav` is a plain React component: unlike the keys listed under
[Registration](#registration) it is **not** on the `ComponentRegistry`, so it is
composed in JSX rather than authored as a JSON node. Full guide:
[SidebarNav docs](https://www.objectui.org/docs/layout/sidebar-nav).

## Usage with React Router

The layout components are designed to work seamlessly with React Router:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell, SidebarNav } from '@object-ui/layout';
import { Home, Users } from 'lucide-react';

function App() {
  return (
    <BrowserRouter>
      <AppShell
        header={<div className="p-4">My App</div>}
        sidebar={
          <SidebarNav
            items={[
              { title: 'Dashboard', href: '/', icon: Home },
              { title: 'Users', href: '/users', icon: Users },
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
