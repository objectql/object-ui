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
│  objectstack.config.ts                                  │
│  (defineStack → apps, objects, views)                   │
└────────────────────┬────────────────────────────────────┘
                     │ ObjectStack server  (HTTP, VITE_SERVER_URL)
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

## Routing

Routing is React Router DOM v7. `apps/console` mounts the per-app subtree at
`/apps/:appName/*`; the routes below are declared inside it by the console shell
(`@object-ui/app-shell`). Every component in the table is exported by `@object-ui/app-shell`,
except `CreateAppPage` / `EditAppPage`, which are lazy-loaded from `@object-ui/plugin-designer`.
These are the object-facing routes — the shell declares more (record create/edit, the metadata
admin subtree), and `apps/console` adds the unauthenticated auth surfaces outside this subtree.

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

**Entry Points:**
- Sidebar app switcher → "Add App" / "Edit App" buttons
- CommandPalette (⌘+K) → "Create New App" command in Actions group
- Empty state CTA → "Create Your First App" button when no apps are configured

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
