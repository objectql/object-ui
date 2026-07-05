---
title: Console Architecture
description: Internal architecture of the ObjectStack Console — data flow, routing, and how JSON metadata becomes a working UI.
---

# Console Architecture

This document describes the internal architecture of the Console app (`apps/console`).

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  objectstack.config.ts                                  │
│  (defineStack → apps, objects, views)                   │
└────────────────────┬────────────────────────────────────┘
                     │ MSW / Real Server
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
│  SchemaRendererProvider  (@object-ui/react)              │
│  • provides dataSource + registry to all children       │
└────────────────────┬────────────────────────────────────┘
                     │ React Context
                     ▼
┌─────────────────────────────────────────────────────────┐
│  App.tsx                                                │
│  ├── ExpressionProvider  (user, app, evaluator)         │
│  ├── ConsoleLayout                                      │
│  │   ├── AppShell (@object-ui/layout)                   │
│  │   │   └── useAppShellBranding (CSS vars)             │
│  │   ├── AppSidebar (navigation tree)                   │
│  │   └── AppHeader (breadcrumbs, status)                │
│  └── Routes                                             │
│      ├── /apps/:appName/:objectName  → ObjectView       │
│      ├── /apps/:appName/:objectName/record/:id → Detail │
│      └── /apps/:appName  → Home Page                    │
└─────────────────────────────────────────────────────────┘
```

## Routing

The console uses React Router DOM v7 with a simple flat route structure:

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

The `ExpressionProvider` wraps the layout and provides an `ExpressionEvaluator` that resolves `${}` templates against context variables (`user`, `app`, `data`).

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

The console's `ObjectView` is a **thin wrapper** around `@object-ui/plugin-view`'s `ObjectView`:

- Resolves views from the object definition's `list_views`
- Passes a `renderListView` callback for multi-view rendering (kanban, calendar, chart)
- Handles console-specific concerns: URL routing, MetadataInspector, record detail Sheet

### 4. App Creation & Editing

The console integrates the `AppCreationWizard` from `@object-ui/plugin-designer` for creating and editing apps:

- **Create App** — `CreateAppPage` at `/apps/:appName/create-app`. Passes metadata objects as `availableObjects`, handles `onComplete` (converts draft via `wizardDraftToAppSchema()`, navigates to new app), `onCancel` (navigate back), and `onSaveDraft` (localStorage persistence).
- **Edit App** — `EditAppPage` at `/apps/:appName/edit-app/:editAppName`. Loads existing app config as `initialDraft` and updates on completion.

**Entry Points:**
- AppSidebar app switcher → "Add App" / "Edit App" buttons
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

## MSW Mock Mode

In development, the console uses MSW (Mock Service Worker) to simulate an ObjectStack backend:

1. `objectstack.config.ts` defines apps and objects via `@objectstack/spec`
2. `@objectstack/runtime` boots an `ObjectKernel` with `MSWPlugin`
3. MSW intercepts `/api/v1/*` requests and serves in-memory data
4. The `ObjectStackAdapter` connects to this mock server transparently

This allows full offline development without a real backend.
