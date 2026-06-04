---
title: Console App
description: Getting started with the ObjectStack Console — the reference SDUI application for ObjectUI.
---

# ObjectStack Console

The **Console** is the reference application for [ObjectUI](/docs/guide). It renders a full-featured admin interface from JSON metadata — objects, views, dashboards, and actions — with zero custom pages required.

## Quick Start

```bash
# From the repository root
pnpm install
pnpm console        # starts the dev server (Vite)
```

The console opens at **http://localhost:5175** with MSW (Mock Service Worker) providing a simulated backend.

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-App Switcher** | Switch between apps defined in `objectstack.config.ts`. |
| **Dynamic Navigation** | Sidebar renders from the app's `navigation` tree (objects, groups, URLs, pages). |
| **Object Views** | List / Grid / Kanban / Calendar — backed by `@object-ui/plugin-view`. |
| **CRUD Dialogs** | Create & edit records via schema-driven forms. |
| **Expression Visibility** | Show/hide navigation items using `visible: "${data.role === 'admin'}"`. |
| **Branding** | Per-app colors, favicons, and logos via `AppShell` branding. |
| **Command Palette** | `⌘+K` opens a searchable command bar for quick navigation. |
| **Studio Package Scope** | Studio home, metadata counts, quick-create links, and diagnostics follow the selected package. |
| **App Creation Wizard** | 4-step wizard (Basic Info → Objects → Navigation → Branding) to create or edit apps. |
| **Error Boundary** | Graceful error handling with a retry button. |

## Configuration

The console reads its configuration from `objectstack.config.ts`:

```ts
import { defineStack } from '@objectstack/spec';
import { ObjectSchema, App, Field } from '@objectstack/spec';

export default defineStack({
  apps: [
    App.create({
      name: 'crm',
      label: 'CRM',
      icon: 'briefcase',
      navigation: [
        { type: 'object', objectName: 'contacts', label: 'Contacts', icon: 'users' },
        { type: 'object', objectName: 'deals', label: 'Deals', icon: 'dollar-sign' },
      ],
      branding: { primaryColor: '#3B82F6' },
    }),
  ],
  objects: [
    ObjectSchema.create({
      name: 'contacts',
      label: 'Contacts',
      fields: [
        Field.text('name', { label: 'Name', required: true }),
        Field.email('email', { label: 'Email' }),
      ],
    }),
  ],
});
```

## Running with a Real Backend

To connect to a real ObjectStack server instead of MSW:

1. Set the `VITE_API_URL` environment variable:
   ```bash
   VITE_API_URL=http://localhost:3000 pnpm console
   ```
2. The console will use the ObjectStack client to discover metadata and perform CRUD operations against the server.

## Folder Structure

```
apps/console/
  src/
    App.tsx                    # Root component + routing
    dataSource.ts              # ObjectStackAdapter wrapper
    components/
      AppHeader.tsx            # Top navbar (breadcrumbs, connection status)
      AppSidebar.tsx           # Left sidebar (app switcher, navigation tree)
      CommandPalette.tsx       # ⌘+K command bar
      ConsoleLayout.tsx        # AppShell wrapper
      ObjectView.tsx           # Object list view (wraps plugin-view)
      RecordDetailView.tsx     # Single-record detail view
    pages/
      CreateAppPage.tsx        # App creation wizard page
      EditAppPage.tsx          # Edit existing app page
    context/
      ExpressionProvider.tsx   # Expression evaluation context
    hooks/
      useBranding.ts           # Delegates to @object-ui/layout
      useObjectActions.ts      # CRUD action handlers
    mocks/
      browser.ts               # MSW browser worker
```

## See Also

- [Console Architecture](/docs/guide/console-architecture) — data flow, routing, and plugin integration
- [Schema Overview](/docs/guide/schema-overview) — the JSON protocol that drives the console
- [Data Source](/docs/guide/data-source) — how the adapter fetches and caches data
