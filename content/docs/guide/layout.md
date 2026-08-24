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
your JSON pages *inside* it. `app-shell` is not a component key either — what a
`{ "type": "app-shell" }` node does now is measured under
[There is no `app-shell` node](#there-is-no-app-shell-node) below.

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

These are React props, passed in JSX. None of them is authorable in JSON — there is no
`app-shell` node to write them on.

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `sidebar` | `React.ReactNode` | no | Left sidebar node, a flex sibling of the content. Pass `SidebarNav`, or your own node. |
| `navbar` | `React.ReactNode` | no | Top-bar content. `AppShell` supplies the sticky `<header>` around it, so pass only what goes inside. |
| `children` | `React.ReactNode` | yes | Main content, rendered inside the `<main>` element. |
| `className` | `string` | no | Tailwind overrides for the `<main>` content element — **not** for the outer container. |
| `defaultOpen` | `boolean` | no | Initial open state of the underlying Shadcn `SidebarProvider`. Defaults to `true`. |
| `branding` | `AppShellBranding` | no | App branding, applied by `useAppShellBranding`: `primaryColor` / `accentColor` become CSS custom properties on the document root, `favicon` sets the icon link's `href`, and `title` sets `document.title`. |
| `rightRail` | `React.ReactNode` | no | Optional right-side rail. It reflows the content beside it rather than overlaying it; absent → unchanged single-pane layout. |

### There is no `app-shell` node

`app-shell` is not a component key. `registerLayout()` (`packages/layout/src/index.ts`)
does not register it, and nothing else in this repo does either, so a
`{ "type": "app-shell" }` node resolves to nothing and says so. Measured on this tree:

- `SchemaRenderer` replaces the node with its error panel —
  `Unknown component type: app-shell`, error code `OBJUI-001`.
- `sdui-parser` reports it before render, as an `error`-severity diagnostic with code
  `unknown-component` and the message `<app-shell> is not a known component`.

It **was** registered until objectui#4841, and the registration could never produce a
shell. Four of the seven props are `React.ReactNode` slots that a JSON document cannot
fill, so a node had exactly two outcomes: `children` was stripped by `SchemaRenderer`
before a node's keys were spread as props — `AppShell` reads its `children` prop, never
`schema.children` — so the `<main>` element rendered **empty with nothing logged**; and a
schema written into `sidebar` / `navbar` / `rightRail` arrived as a plain object, which
React refuses to render, replacing the node with an error box. Only `className`,
`defaultOpen` and `branding` ever survived the JSON path, i.e. the best result JSON could
reach was a shell with no navigation, no top bar and an empty content area. The key was
retired under ADR-0049 (enforce-or-remove) so that this comes out as a named refusal
rather than a page that renders nothing.

Two doors remain, one per capability:

- **Compose in React** — `<AppShell>` as shown above, with your JSON pages rendered
  *inside* it through `SchemaRenderer`.
- **The whole shell from metadata** — `AppSchemaRenderer`, registered as
  `app-schema-renderer` and declaring its `inputs`, which builds branding and sidebar
  navigation from an `AppSchema` JSON document and takes the page content as its
  `children`.

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

> **The canonical author key is `page:header`; `page-header` is a legacy alias.** The
> snippets in this section are the `@object-ui/layout` component, which `registerLayout()`
> registers as `page-header` (plus its namespaced form `layout:page-header`) — that node
> still renders, so metadata already written this way is not stranded. The contract knows
> only `page:header`, though: that is the `PageComponentType` value and the
> `ComponentPropsMap` row binding `PageHeaderProps`, and it resolves to a different,
> record-aware renderer in `@object-ui/components`. Props written under the alias have no
> `ComponentPropsMap` row to dispatch, so nothing validates them — a misspelling there is
> neither rejected nor reported. Author metadata pages against `page:header`
> ([Slotted pages](/docs/guide/slotted-pages)); its props are not the ones below — see the
> [PageHeader reference](/docs/layout/page-header).

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

**`SidebarNav` is a React component, and `sidebar-nav` is not a component key at all.**
`registerLayout()` (`packages/layout/src/index.ts`) registers five keys — `page-header`,
`page:card`, `responsive-grid`, `navigation-renderer` and `app-schema-renderer` — and
nothing in this repo registers `sidebar-nav`. What a
`{ "type": "sidebar-nav" }` node actually does is measured under
[There is no `sidebar-nav` node](#there-is-no-sidebar-nav-node) below. Compose the nav in
React, or use `navigation-renderer` when the tree has to come from metadata.

### Basic Usage

`SidebarNav` renders a Shadcn `Sidebar`, so it must be inside a `SidebarProvider` —
`AppShell` supplies one. Its rows are `NavLink`s, so it also needs a router above it.

```tsx
import { AppShell, SidebarNav, type NavItem } from '@object-ui/layout';
import { SchemaRenderer } from '@object-ui/react';
import { BarChart3, LayoutDashboard, Users } from 'lucide-react';

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Users', href: '/users', icon: Users, badge: '12' },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart3,
    children: [
      { title: 'Sales', href: '/reports/sales' },
      { title: 'Analytics', href: '/reports/analytics' },
    ],
  },
];

<AppShell sidebar={<SidebarNav items={navItems} />}>
  <SchemaRenderer schema={pageSchema} />
</AppShell>;
```

Three things that block a copy-paste: `icon` is a **component**, not an icon name —
`SidebarNav` renders it as `<item.icon />`. Nested rows go in `children`; `items` is a key
on `NavGroup`, never on a `NavItem`. And `href` is **required** on every item, including
one that only expands children — it is the row's React key as well as its link target.

### Props

`SidebarNavProps` (`packages/layout/src/SidebarNav.tsx`) declares exactly these six.

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `items` | `NavItem[] \| NavGroup[]` | yes | The rows. A flat `NavItem[]`, or `NavGroup[]` for labelled sections — the array's first element decides which. |
| `title` | `string` | no | Group label shown above a flat, ungrouped `items` list. Defaults to `"Application"`. |
| `className` | `string` | no | Tailwind overrides for the `Sidebar` root. |
| `collapsible` | `"offcanvas" \| "icon" \| "none"` | no | How the sidebar collapses at or above 768px. Defaults to `"icon"`. Not a boolean. |
| `searchEnabled` | `boolean` | no | Show a search input that filters rows by title, children included. Defaults to `false`. |
| `searchPlaceholder` | `string` | no | Placeholder for that input. Defaults to `"Search…"`. |

#### `NavItem`

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | `string` | yes | The row's label. |
| `href` | `string` | yes | Link target, and the row's React key. |
| `icon` | `React.ComponentType<{ className?: string }>` | no | Rendered as `<item.icon />` — pass the Lucide component, not its name. |
| `badge` | `string \| number` | no | Trailing badge content. Rendered whenever it is not `null`/`undefined`, so `0` shows. |
| `badgeVariant` | `'default' \| 'destructive' \| 'outline'` | no | Badge styling. Defaults to `'default'`. |
| `children` | `NavItem[]` | no | One level of nested rows; the parent becomes a collapsible trigger. |

#### `NavGroup`

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `label` | `string` | yes | Section heading, shown in place of `title`. |
| `items` | `NavItem[]` | yes | The section's rows. |

There is no `active` key — the active row is derived from the router
(`pathname === item.href`), never declared. There is no `disabled` key either, and no
`defaultOpen`: that one is `AppShell`'s prop, not this component's.

### There is no `sidebar-nav` node

`sidebar-nav` was never registered, so the node does not resolve to anything. Rendering
`{ "type": "sidebar-nav", "items": [...] }` produces the renderer's red error box instead
of a sidebar:

```
Unknown component type: sidebar-nav
💡 Ensure the component is registered via registry.register() before rendering.
   Check for typos in the component type name. (OBJUI-001)
```

This is louder than the `app-shell` case above — nothing is silently dropped, because
nothing is parsed as props at all. The whole sidebar is replaced by the error panel.

When the navigation tree genuinely has to come from JSON, that path exists and is a
different component: `navigation-renderer` (`NavigationRenderer`) renders a
`NavigationItem[]` tree from AppSchema JSON, and it declares its `inputs`, so an unknown
key there is diagnosed rather than ignored. Its items are JSON-shaped — `icon` really is
a string name there, resolved by `resolveIcon`. `app-schema-renderer` wraps that up with
branding for a whole-shell-from-metadata setup.

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

The shell has exactly **one** layout breakpoint, at **768px** — Tailwind's `md`, and
`MOBILE_BREAKPOINT` in `packages/components/src/hooks/use-mobile.tsx`. There is no
separate tablet tier: nothing in `AppShell`, `SidebarNav` or the Shadcn sidebar underneath
them reads `lg` (1024px), so 800px and 1400px get the same layout.

### Sidebar, at or above 768px

- Rendered inline, as a flex sibling of the content — not an overlay.
- How it collapses is the sidebar node's own `collapsible` prop: `"icon"` (the `SidebarNav`
  default) leaves an icon rail, `"offcanvas"` slides it fully out, `"none"` pins it open.
- `AppShell`'s `defaultOpen` picks the initial state, and defaults to `true`.

### Sidebar, below 768px

- It leaves the layout entirely and becomes a `Sheet` overlay (18rem) above the content,
  which is why the content is full-width there.
- **Nothing opens it for you.** `AppShell`'s header renders `{navbar}` and nothing else —
  it adds no controls of its own, in particular **no sidebar toggle**. Render a
  `SidebarTrigger` inside `navbar` yourself; otherwise the only way in is the
  `SidebarProvider` keyboard shortcut, `Cmd/Ctrl + B`, which no touch device has.

### Header and content

- The header is `h-14` (3.5rem / 56px) at **every** breakpoint — there is no compact
  variant — and spans the full viewport width at every size. The only thing about it that
  responds is horizontal padding, and it turns at `sm` (640px), not 768: `px-2 sm:px-4`.
- Content padding steps three ways — `p-3`, `sm:p-4` (640px), `md:p-6` (768px) — with a
  taller `pb-20` below `sm` only.

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

Group related items with `NavGroup`. Pass groups instead of a flat list and `SidebarNav`
labels each section and draws the separator between them itself — there is no `divider`
item, and a row is either a link or a group, never both:

```tsx
import { SidebarNav, type NavGroup } from '@object-ui/layout';
import { DollarSign, Home, Settings } from 'lucide-react';

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ title: 'Dashboard', href: '/', icon: Home }],
  },
  {
    label: 'Sales',
    items: [
      {
        title: 'Sales',
        href: '/sales',
        icon: DollarSign,
        children: [
          { title: 'Orders', href: '/orders' },
          { title: 'Invoices', href: '/invoices' },
        ],
      },
    ],
  },
  {
    label: 'System',
    items: [{ title: 'Settings', href: '/settings', icon: Settings }],
  },
];

<SidebarNav items={navGroups} />;
```

## Related Documentation

- [Components Overview](/docs/components) - All available components
- [Schema Rendering](/docs/guide/schema-rendering) - How schemas work
- [Architecture Overview](/docs/guide/architecture) - System architecture
