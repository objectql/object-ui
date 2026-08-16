---
title: "Layout System"
description: "Understanding ObjectUI's layout components for building application shells and page structures"
---

# Layout System

ObjectUI provides a comprehensive layout system through the `@object-ui/layout` package. This guide explains how to use layout components to build professional application structures.

## Overview

The layout system provides:

- **AppShell** - Full application container with a top navbar, sidebar, and content areas
- **Page** - Individual page wrapper with header and body
- **PageHeader** - Consistent page headers with title, breadcrumbs, and actions
- **SidebarNav** - Navigation sidebar with menu items

## Installation

The layout package is included in the core ObjectUI installation:

```bash
npm install @object-ui/react
```

Layout components are automatically registered when you import ObjectUI.

## AppShell Component

The `AppShell` provides a complete application structure with a top navbar, a sidebar, and
a main content area.

**`AppShell` is a React component, not an authorable JSON node.** Four of its seven props
are `React.ReactNode` slots — `sidebar`, `navbar`, `children` and `rightRail` — and a JSON
document has no way to put a node into any of them. Compose the shell in React, and render
your JSON pages *inside* it. What a `{ "type": "app-shell" }` node does with each key is
spelled out under [In a JSON node](#in-a-json-node) below.

### Basic Usage

```tsx
import { AppShell, SidebarNav, type NavItem } from '@object-ui/layout';
import { SchemaRenderer } from '@object-ui/react';
import { LayoutDashboard, Settings, Users } from 'lucide-react';

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Users', href: '/users', icon: Users },
  { title: 'Settings', href: '/settings', icon: Settings },
];

<AppShell
  navbar={<span className="font-semibold">My Application</span>}
  sidebar={<SidebarNav items={navItems} />}
>
  <SchemaRenderer schema={pageSchema} />
</AppShell>
```

Top-bar content goes in `navbar`. `AppShell` renders the sticky `<header>` element itself
and `{navbar}` is the only thing that fills it — there is no `header` prop. Main content is
the component's `children`; there is no `body` prop either.

### Props

`AppShellProps` (`packages/layout/src/AppShell.tsx`) declares exactly these seven. The
component destructures that fixed key list with **no rest element**, so anything else you
pass is built and then dropped on the floor.

| Prop | Type | Required | In a JSON node | Description |
| --- | --- | --- | --- | --- |
| `sidebar` | `React.ReactNode` | no | no | Left sidebar node, a flex sibling of the content. Pass `SidebarNav`, or your own node. |
| `navbar` | `React.ReactNode` | no | no | Top-bar content. `AppShell` supplies the sticky `<header>` around it, so pass only what goes inside. |
| `children` | `React.ReactNode` | yes | no | Main content, rendered inside the `<main>` element. |
| `className` | `string` | no | yes | Tailwind overrides for the `<main>` content element — **not** for the outer container. |
| `defaultOpen` | `boolean` | no | yes | Initial open state of the underlying Shadcn `SidebarProvider`. Defaults to `true`. |
| `branding` | `AppShellBranding` | no | yes | App branding, applied by `useAppShellBranding`: `primaryColor` / `accentColor` become CSS custom properties on the document root, `favicon` sets the icon link's `href`, and `title` sets `document.title`. |
| `rightRail` | `React.ReactNode` | no | no | Optional right-side rail. It reflows the content beside it rather than overlaying it; absent → unchanged single-pane layout. |

### In a JSON node

`app-shell` is registered on the `ComponentRegistry` (`packages/layout/src/index.ts`), so
`{ "type": "app-shell" }` does resolve to this component. The registration declares no
`inputs`, which is why `sdui-parser`'s unknown-prop check has nothing to compare a node
against and stays silent whatever you write. Measured, key by key:

- **The three plain-data props work.** `className`, `defaultOpen` and `branding` are
  spread onto the component unchanged. `className` lands on the `<main>` element, and
  `branding`'s fields are applied by `useAppShellBranding` exactly as in React.
- **`children` is dropped, silently.** `SchemaRenderer` strips `children` (and `body`) out
  of a node before spreading the remaining keys as props, and `AppShell` reads its
  `children` **prop**, not `schema.children`. The `<main>` element renders empty and
  nothing is logged.
- **`sidebar` / `navbar` / `rightRail` cannot hold a schema.** They are `React.ReactNode`;
  a JSON value reaches the component as a plain object, and React refuses to render one.
  The node is replaced by the renderer's error box: `Component "app-shell" failed to
  render — Objects are not valid as a React child`.

So do not author an `app-shell` node in JSON. Build the shell in React as above — or, when
the whole shell should come from metadata, use `AppSchemaRenderer` (registered as
`app-schema-renderer`), which builds branding and sidebar navigation from an `AppSchema`
JSON document and takes the page content as its `children`.

### Features

- Responsive layout that adapts to mobile/tablet/desktop
- Collapsible sidebar with state management
- Sticky header
- Scroll management for content area
- Consistent spacing and structure

## Page Component

The `Page` component provides a consistent wrapper for individual pages with optional headers.

### Basic Usage

```json
{
  "type": "page",
  "title": "User Management",
  "description": "Manage users and permissions",
  "body": {
    "type": "container",
    "children": [
      { "type": "text", "value": "User list goes here" }
    ]
  }
}
```

### With Action Buttons

```json
{
  "type": "page",
  "title": "Products",
  "actions": [
    {
      "type": "button",
      "text": "Add Product",
      "variant": "default",
      "icon": "plus"
    },
    {
      "type": "button", 
      "text": "Export",
      "variant": "outline",
      "icon": "download"
    }
  ],
  "body": {
    "type": "object-grid",
    "object": "products"
  }
}
```

### Schema API

```typescript
{
  type: 'page',
  
  // Header
  title?: string,               // Page title
  description?: string,         // Page description/subtitle
  icon?: string,               // Optional icon
  breadcrumbs?: Array<{        // Breadcrumb navigation
    label: string,
    href?: string
  }>,
  actions?: ComponentSchema[], // Action buttons
  
  // Content
  body: ComponentSchema,       // Main page content
  
  // Layout options
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full',
  padding?: boolean,           // Add padding (default: true)
  
  // Styling
  className?: string,
  headerClassName?: string,
  bodyClassName?: string
}
```

### Max Width Options

Control page content width:

```json
{
  "type": "page",
  "title": "Settings",
  "maxWidth": "lg",  // Centered content with max width
  "body": {
    "type": "form",
    "fields": [...]
  }
}
```

Available values:
- `sm` - 640px
- `md` - 768px
- `lg` - 1024px
- `xl` - 1280px
- `2xl` - 1536px
- `full` - No maximum width (default)

## PageHeader Component

The `PageHeader` provides consistent page headers with a title, an optional subtitle,
an icon chip, and an action row.

### Usage

```json
{
  "type": "page-header",
  "title": "Customer Details",
  "subtitle": "View and edit customer information",
  "icon": "users",
  "actions": ["edit", "delete"]
}
```

`title` and `subtitle` both interpolate `{field.path}` tokens against the surrounding
record context, so `"title": "{first_name} {last_name}"` resolves on a record page.
Unresolvable tokens collapse to an empty string rather than leaking the raw template.

### Schema API

```typescript
{
  type: 'page-header',

  title: string,                     // required; {field.path} tokens interpolated
  subtitle?: string,                 // secondary line; {field.path} tokens interpolated
  icon?: string,                     // Lucide icon name, rendered in a chip left of the title
  actions?: Array<string | ActionDef>, // action ids, or inline ActionDef objects
  showBack?: boolean,                // back arrow; inferred from record context when omitted
  children?: ComponentSchema[],      // rendered into the right-aligned slot; `actions` takes precedence
  className?: string,
}
```

`showBack` defaults to `true` when a record context carrying a `recordId` is in scope and
the header is not rendered inside embedded chrome (drawer / modal, which already provide
their own Close control), and `false` otherwise. Pass it explicitly to override.

`actions` is handed to the `record:quick_actions` widget with
`location: 'record_header'`. Its entries are **action ids** — resolved from the object's
own `actions` metadata, which keeps the definitions in one place — or inline `ActionDef`
objects. They are **not** `ComponentSchema` nodes: a `{ "type": "button", … }` entry
renders nothing here.

> **Write `subtitle`. `description` is retired.** `@objectstack/spec/ui`'s
> `PageHeaderProps` — the contract for the canonical `page:header` node — declares
> `title / subtitle / icon / breadcrumb / actions / aria` and has **no** `description`,
> and `page-header`'s registration declares only `title` and `subtitle` as authorable
> inputs. The renderer used to read `description` as well, as a legacy alias; objectui#3789
> removed that read, so `subtitle` is now the only spelling this component draws. Stored
> metadata written the old way is not stranded: protocol 17's ADR-0087 D2 conversion
> `page-header-subtitle-alias` rewrites `description` to `subtitle` on header nodes as the
> stack loads — at every position a header can occupy, regions and slots and containers
> nested to any depth (objectstack#6775 / #6776) — and `os migrate meta` rewrites it at
> rest. See the [PageHeader reference](/docs/layout/page-header).

> **There is no `breadcrumbs` array.** The component reads no breadcrumb property of any
> kind, in either spelling. The spec's `breadcrumb` is singular and a **boolean** — a
> display toggle on the canonical `page:header` node (see
> [Slotted pages](/docs/guide/slotted-pages)), not a list of links.

## SidebarNav Component

The `SidebarNav` provides a collapsible navigation sidebar with menu items.

### Basic Usage

```json
{
  "type": "sidebar-nav",
  "items": [
    {
      "label": "Dashboard",
      "href": "/dashboard",
      "icon": "layout-dashboard"
    },
    {
      "label": "Users",
      "href": "/users", 
      "icon": "users",
      "badge": "12"
    },
    {
      "label": "Reports",
      "icon": "bar-chart",
      "items": [
        { "label": "Sales", "href": "/reports/sales" },
        { "label": "Analytics", "href": "/reports/analytics" }
      ]
    }
  ]
}
```

### Schema API

```typescript
{
  type: 'sidebar-nav',
  
  items: Array<{
    label: string,
    href?: string,
    icon?: string,
    badge?: string | number,
    badgeVariant?: 'default' | 'destructive' | 'outline',
    items?: Array<...>,  // Nested menu items (collapsible children)
    active?: boolean,
    disabled?: boolean
  }>,
  
  // Items can also be grouped using NavGroup:
  // items: Array<{ label: string, items: NavItem[] }>

  collapsible?: boolean,
  defaultOpen?: boolean,
  searchEnabled?: boolean,        // Show search input to filter navigation
  searchPlaceholder?: string,     // Placeholder for search input
  
  className?: string
}
```

### Features

- Nested menu items (2 levels) with collapsible expand/collapse
- Active state highlighting via React Router
- Icon support (Lucide icons)
- Badge/counter support with variant styling (`default`, `destructive`, `outline`)
- NavGroup support for grouped navigation sections
- Built-in search filtering (`searchEnabled`) across all items and children
- Collapse/expand animation

## Common Layout Patterns

### Full Application Layout

The shell is React; the page inside it is your JSON.

```tsx
import { AppShell, SidebarNav, type NavItem } from '@object-ui/layout';
import { SchemaRenderer } from '@object-ui/react';
import { SidebarTrigger } from '@object-ui/components';
import { Home, Package, ShoppingCart } from 'lucide-react';

const navItems: NavItem[] = [
  { title: 'Home', href: '/', icon: Home },
  { title: 'Products', href: '/products', icon: Package },
  { title: 'Orders', href: '/orders', icon: ShoppingCart },
];

<AppShell
  navbar={
    <div className="flex w-full items-center gap-2">
      <SidebarTrigger />
      <span className="font-semibold">My App</span>
    </div>
  }
  sidebar={<SidebarNav items={navItems} />}
  defaultOpen
>
  <SchemaRenderer schema={pageSchema} />
</AppShell>
```

`AppShell` adds no controls of its own to the top bar — the sidebar toggle above is one
you render yourself, in `navbar`. There is no `sidebarCollapsible` prop: the sidebar's
collapse behaviour belongs to the sidebar node you pass (`SidebarNav`'s `collapsible`),
and `defaultOpen` is the shell's own initial-state prop.

### Landing Page (No Sidebar)

Omit `sidebar` and the content fills the width under the top bar.

```tsx
<AppShell navbar={<span className="font-semibold">Welcome</span>}>
  <SchemaRenderer schema={landingSchema} />
</AppShell>
```

### Settings Page with Tabs

```json
{
  "type": "page",
  "title": "Settings",
  "maxWidth": "2xl",
  "body": {
    "type": "tabs",
    "tabs": [
      {
        "label": "General",
        "value": "general",
        "content": { "type": "form", "fields": [...] }
      },
      {
        "label": "Security", 
        "value": "security",
        "content": { "type": "form", "fields": [...] }
      },
      {
        "label": "Notifications",
        "value": "notifications", 
        "content": { "type": "form", "fields": [...] }
      }
    ]
  }
}
```

### Detail Page with Actions

```json
{
  "type": "page",
  "title": "${record.name}",
  "breadcrumbs": [
    { "label": "Home", "href": "/" },
    { "label": "Customers", "href": "/customers" },
    { "label": "${record.name}" }
  ],
  "actions": [
    {
      "type": "button",
      "text": "Edit",
      "variant": "default",
      "icon": "pencil",
      "onClick": "editRecord"
    },
    {
      "type": "button",
      "text": "Delete",
      "variant": "destructive",
      "icon": "trash",
      "onClick": "deleteRecord"
    }
  ],
  "body": {
    "type": "card",
    "children": [
      { "type": "text", "value": "Record details..." }
    ]
  }
}
```

## Responsive Behavior

Layout components automatically adapt to different screen sizes:

### Desktop (≥1024px)
- Full sidebar visible
- Header spans full width
- Content area uses remaining space

### Tablet (768px - 1023px)  
- Collapsible sidebar (overlay mode)
- Full header
- Content uses most of screen

### Mobile (<768px)
- Hidden sidebar (toggle button in header)
- Compact header
- Full-width content

## Styling and Customization

### Custom Classes

Add Tailwind classes to layout components:

```tsx
<AppShell
  className="bg-background"
  navbar={
    <div className="flex w-full items-center bg-primary text-primary-foreground">
      My App
    </div>
  }
  sidebar={<SidebarNav className="bg-muted" items={navItems} />}
>
  <SchemaRenderer schema={pageSchema} />
</AppShell>
```

`className` is the only class hook `AppShell` itself takes, and it lands on the `<main>`
content element — not on the outer container. There is **no** per-slot className:
`headerClassName`, `sidebarClassName` and `contentClassName` do not exist. The top bar and
the sidebar are nodes you build, so style them where you build them, as above.

### Page Padding

Control page content padding:

```json
{
  "type": "page",
  "padding": false,  // Remove default padding
  "body": {
    "type": "container",
    "className": "p-8",  // Custom padding
    "children": [...]
  }
}
```

## Best Practices

### 1. Consistent Structure

Compose the shell once and let the page JSON change per route:

```tsx
// One shell for the whole app; `pageSchema` is whatever the route resolves to.
<AppShell navbar={navbar} sidebar={<SidebarNav items={navItems} />}>
  <SchemaRenderer schema={pageSchema} />
</AppShell>
```

### 2. Breadcrumbs for Deep Navigation

Add breadcrumbs to help users navigate:

```json
{
  "breadcrumbs": [
    { "label": "Home", "href": "/" },
    { "label": "Products", "href": "/products" },
    { "label": "Electronics", "href": "/products/electronics" },
    { "label": "Laptops" }
  ]
}
```

### 3. Action Buttons in Headers

Place primary actions in page headers:

```json
{
  "type": "page",
  "title": "Orders",
  "actions": [
    { "type": "button", "text": "New Order", "variant": "default" }
  ]
}
```

### 4. Max Width for Forms

Use constrained width for forms and reading content:

```json
{
  "type": "page",
  "maxWidth": "lg",  // Better for forms
  "body": {
    "type": "form",
    "fields": [...]
  }
}
```

### 5. Sidebar Organization

Group related items in the sidebar:

```json
{
  "items": [
    { "label": "Dashboard", "icon": "home", "href": "/" },
    { "label": "divider" },  // Visual separator
    { "label": "Sales", "icon": "dollar-sign", "items": [
      { "label": "Orders", "href": "/orders" },
      { "label": "Invoices", "href": "/invoices" }
    ]},
    { "label": "divider" },
    { "label": "Settings", "icon": "settings", "href": "/settings" }
  ]
}
```

## Related Documentation

- [Components Overview](/docs/components) - All available components
- [Schema Rendering](/docs/guide/schema-rendering) - How schemas work
- [Architecture Overview](/docs/guide/architecture) - System architecture
