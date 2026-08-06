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
| **Design in Studio** | Workspace admins get a top-bar entry inside a running app that opens its owning package on the Studio design surface. On an interface route — a dashboard, page, or report — it deep-links straight to that surface's design page in the Interfaces pillar (`/studio/:packageId/interfaces?surface=<type>:<name>`, e.g. `surface=page:showcase_crm_workbench`); elsewhere (objects, the app root) it opens the package's Data tab (`/studio/:packageId/data`). These interfaces are authored in Studio — there is no in-page edit panel. |
| **App Creation Wizard** | 4-step wizard (Basic Info → Objects → Navigation → Branding) to create or edit apps. |
| **Record Approval Panel** | A record with approval requests shows a read-gated panel on its detail page — current step, decision progress, resolved "waiting on" approvers, the merged decision timeline, and a submitter remind button — visible to every viewer who can read the record, not just approvers. |
| **Error Boundary** | Graceful error handling with a retry button. |

### Object design (Studio Data tab)

Selecting an object in Studio's **Data** pillar (`/studio/:packageId/data`) opens a
tab strip over that object — **Records · Form · Validations · Hooks · Actions ·
API · Settings**. Each of Validations, Hooks and Actions is a no-code **config
panel driven by the corresponding metadata**, and each supports **adding** new
entries — no code round-trip required:

| Tab | Edits | Panel |
|-----|-------|-------|
| **Validations** | the object's inline `validations[]` (spec `ValidationRuleSchema`) | Master-detail covering **every** rule type — `script`, `cross_field`, `state_machine`, `format`, `json_schema`, `conditional`. The **New** menu adds any type (seeded with a valid, never-firing skeleton); a rule's type can be switched in place. CEL predicates reuse the shared `ConditionBuilder`, fed the object's draft fields. |
| **Hooks** | the separate `hook` metadata type targeting this object | Master-detail whose editor is the platform `SchemaForm` **driven by the live `hook` JSONSchema from `/meta/types`**, so its fields and enums always match the running server's contract. |
| **Actions** | the object's inline `actions[]` (spec `ActionSchema`) | Master-detail using the type-aware `ActionDefaultInspector`; anything not curated falls through to a **"More fields"** form fed the live `action` JSONSchema, so no spec property is un-editable. |

Validations and Actions persist with the object's own **Save draft**; Hooks (a
distinct metadata type) save per-hook. Nothing goes live until the package is
published from the top-bar **Publish** flow.

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
