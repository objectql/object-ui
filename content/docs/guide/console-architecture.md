---
title: Console Architecture
description: Internal architecture of the ObjectStack Console — data flow, routing, and how JSON metadata becomes a working UI.
---

# Console Architecture

This document describes the internal architecture of the Console SPA.

`apps/console` is a thin host: it owns the Vite build, the outermost route tree, and plugin
registration. Almost everything named below is a **component exported by a package**, not a file
under `apps/console` — the shell (providers, layout, object and record views) ships from
`@object-ui/app-shell`, view rendering from `@object-ui/plugin-view`, and the app wizard from
`@object-ui/plugin-designer`. Packages are named where it matters; import from the package, never
from a path.

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  ObjectStack server  (owns apps, objects, views)        │
│  • metadata is authored and stored server-side          │
│  • the console reads it over HTTP — it has no local     │
│    metadata file of its own                             │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP  (base URL from VITE_SERVER_URL)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  ObjectStackAdapter  (@object-ui/data-objectstack)      │
│  • discovery() → apps[], objects[]                      │
│  • find / findOne / create / update / delete            │
│  • getView / getApp (optional metadata cache)           │
└────────────────────┬────────────────────────────────────┘
                     │ DataSource interface
                     ▼
┌─────────────────────────────────────────────────────────┐
│  SchemaRendererProvider  (@object-ui/react)             │
│  • provides dataSource + registry to all children       │
└────────────────────┬────────────────────────────────────┘
                     │ React Context
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Console shell  (@object-ui/app-shell)                  │
│  ├── ExpressionProvider  (user, app, evaluator)         │
│  ├── ConsoleLayout                                      │
│  │   ├── AppShell (@object-ui/layout)                   │
│  │   │   └── useAppShellBranding (CSS vars)             │
│  │   ├── sidebar nav (app switcher + nav tree)          │
│  │   └── AppHeader (breadcrumbs, status)                │
│  └── Routes (mounted by apps/console at /apps/:appName) │
│      ├── /apps/:appName/:objectName  → ObjectView       │
│      ├── /apps/:appName/:objectName/record/:id → Detail │
│      └── /apps/:appName  → Home Page                    │
└─────────────────────────────────────────────────────────┘
```

### What the console boots from

The console has **no metadata file of its own** — nothing in `apps/console` declares apps,
objects or views. Everything above the adapter is fetched. Its entire local configuration is
one build-time Vite variable:

- **`VITE_SERVER_URL`** — the only setting that picks a backend. It seeds both the adapter's
  `baseUrl` and the runtime-config fetch. Empty means same origin, which is what a server that
  serves the console itself wants.
- **Server-pushed runtime config** — before React mounts, the entry point resolves
  `/api/v1/runtime/config` (branding, feature flags, cloud URL) through `@object-ui/app-shell`,
  so first paint already shows operator branding instead of the static defaults.
- **Discovery + metadata** — `AdapterProvider` (`@object-ui/app-shell`) constructs the
  `ObjectStackAdapter`, `connect()`s it (one `/api/v1/discovery` probe, cached per base URL),
  and the metadata provider pulls apps, objects and views from the server's metadata API on
  demand.

Apps and objects **are** authored declaratively — but in the ObjectStack **server** project
(`objectstack.config.ts` there, or through Studio), not in this repo. The console is a pure
consumer of whatever that server publishes; see
[ObjectOS Integration](/docs/guide/objectos-integration) for the server-side shape.

## Routing

Routing is React Router DOM v7. `apps/console` mounts the per-app subtree at
`/apps/:appName/*`; the routes below are declared inside it by the console shell
(`@object-ui/app-shell`). Every component in the table is exported by `@object-ui/app-shell`,
except `CreateAppPage` / `EditAppPage`, which are lazy-loaded from `@object-ui/plugin-designer`.

**The table below is a curated subset, not an inventory.** It covers the object-facing routes
— the ones you need to understand how metadata becomes a page. The real tree is several times
larger and is declared in exactly two places, which are the source of truth when you need the
full list:

- the **console's own route tree** (`apps/console`) — the unauthenticated auth surfaces
  (login, register, password reset, verify-email, setup, OAuth consent, invitations), plus
  home, Studio, AI, organizations, docs and the shared/public record pages;
- the **shell's app-content route tree** (`@object-ui/app-shell`) — everything under
  `/apps/:appName/*`: record create and edit, dashboards, pages, reports, search, the
  marketplace, and the whole metadata-admin subtree.

Read those two route trees in the source rather than trusting a hand-copied table to stay
current.

| Route Pattern | Component | Purpose |
|---------------|-----------|---------|
| `/apps/:appName` | Home redirect | Redirects to the first object in navigation |
| `/apps/:appName/:objectName` | `ObjectView` | Object list with view switcher |
| `/apps/:appName/:objectName/view/:viewId` | `ObjectView` | Specific view for an object |
| `/apps/:appName/:objectName/data` | `ObjectDataPage` | Bare data surface — URL `filter[<field>]=<value>` conditions, not bound to any saved view (ADR-0055) |
| `/apps/:appName/:objectName/record/:recordId` | `RecordDetailView` | Single-record detail |
| `/apps/:appName/create-app` | `CreateAppPage` | App creation wizard (4-step) |
| `/apps/:appName/edit-app/:editAppName` | `EditAppPage` | Edit existing app configuration |

## Key Patterns

### 1. Expression-Based Visibility

Navigation items can be conditionally hidden using expressions:

```json
{
  "type": "object",
  "objectName": "admin_settings",
  "visible": "${user.role === 'admin'}"
}
```

`ExpressionProvider` (`@object-ui/app-shell`) wraps the layout and provides an `ExpressionEvaluator` that resolves `${}` templates against context variables (`user`, `app`, `data`).

### 2. Action System

Actions are typed with `ActionDef` from `@object-ui/core`:

```ts
const { execute } = useActionRunner({
  context: { objectName: 'contacts' },
});

await execute({
  type: 'delete',
  confirmText: 'Are you sure?',
  params: { recordId: '123' },
});
```

The `ActionRunner` supports:
- **Confirmation** — async `ConfirmationHandler` (default: `window.confirm`, override with Shadcn AlertDialog)
- **Toast notifications** — `ToastHandler` for success/error messages
- **Custom handlers** — register domain-specific action types (e.g., `'create'`, `'delete'`, `'refresh'`)

### 3. Plugin ObjectView Delegation

The shell's `ObjectView` — the one exported by `@object-ui/app-shell` and bound to the routes
above — is a **thin wrapper** around `@object-ui/plugin-view`'s `ObjectView`:

- Resolves views from the object definition's `list_views`
- Passes a `renderListView` callback for multi-view rendering (kanban, calendar, chart)
- Handles shell-level concerns: URL routing, MetadataInspector, record detail overlay

### 4. App Creation & Editing

App creation and editing are owned end to end by `@object-ui/plugin-designer`: it exports both
route pages and the `AppCreationWizard` they render. The console shell only lazy-loads them onto
routes.

- **Create App** — `CreateAppPage` at `/apps/:appName/create-app`. Passes metadata objects as `availableObjects`, handles `onComplete` (converts draft via `wizardDraftToAppSchema()`, navigates to new app), `onCancel` (navigate back), and `onSaveDraft` (localStorage persistence).
- **Edit App** — `EditAppPage` at `/apps/:appName/edit-app/:editAppName`. Loads existing app config as `initialDraft` and updates on completion.

**How users get there.** Manual app creation is **deprecated in favour of the AI-first
builder**, and the menu entries that used to launch it are gone. Today:

- **Build with AI** — the primary path. The console home (`/home`) offers it whenever the
  server reports a deployed build agent, and it opens the AI build surface rather than the
  4-step wizard.
- **Studio** — the authoring surface for a package and the apps inside it (`/studio`, and the
  design surface per package). This is where app structure is edited by hand now.
- **The wizard routes themselves** — `create-app` / `edit-app/:editAppName` stay mounted and
  reachable as direct (legacy) deep links, which is why the pages above still ship.

Do not re-document the old sidebar / command-palette entries: the "Add App" and "Edit App"
items exist only in `AppSidebar`, which the console no longer mounts (`ConsoleLayout` renders
`UnifiedSidebar`), and the command palette never registered a create-app command.

### 5. Branding

Per-app branding is applied via `AppShell`'s `branding` prop:

```tsx
<AppShell branding={{
  primaryColor: '#3B82F6',
  accentColor: '#10B981',
  favicon: '/custom-favicon.ico',
  title: 'CRM — ObjectStack Console',
}}>
```

This sets CSS custom properties (`--brand-primary`, `--brand-primary-hsl`, etc.) on the document root.

## Development Mode

There is **no bundled mock backend** — offline development is not a thing here. In dev exactly as
in production, `ObjectStackAdapter` talks over HTTP to a live ObjectStack server at
`VITE_SERVER_URL`, and everything above the adapter in the data flow depends on that call
succeeding: no server, no discovery, no apps in the sidebar.

See [Console App → Quick Start](/docs/guide/console#quick-start) for the dev server port, the
default `VITE_SERVER_URL`, and how to point the console at a different backend.
