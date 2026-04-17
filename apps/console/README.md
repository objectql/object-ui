# ObjectStack Console

The standard runtime UI for ObjectStack applications. This package provides the **Console** — a full-featured enterprise admin interface that renders from JSON metadata alone, requiring zero custom pages.

> **Version:** 0.5.1 &nbsp;|&nbsp; **Spec:** @objectstack/spec v3.0.7 &nbsp;|&nbsp; [Full Roadmap →](./CONSOLE_ROADMAP.md)

## Features

- **Server-Driven UI**: Renders objects, views, dashboards, reports, and pages from JSON schemas
- **Multi-App Support**: Switch between apps defined in your stack, each with its own branding
- **Plugin Architecture**: 15+ view plugins (grid, kanban, calendar, timeline, chart, map, gantt, gallery, etc.)
- **Expression Engine**: Dynamic visibility, disabled, and hidden expressions evaluated at runtime
- **CRUD Operations**: Create, edit, delete records via schema-driven forms and dialogs
- **Command Palette**: `⌘+K` for quick navigation across apps and objects
- **Dark/Light Theme**: System-aware theme with per-app branding (logo, colors, favicon)
- **Developer Tools**: Built-in metadata inspector with collapsible sections and copy-to-clipboard support

## Quick Start

```bash
# From the repository root
pnpm install

# Start development server (with MSW mock backend)
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

The console opens at **http://localhost:5173** with a simulated backend (CRM + Todo + Kitchen Sink demo data).

## Running Modes

The console supports two distinct running modes:

### 1. Development Mode (Standalone)
**Command:** `pnpm dev`

- Runs Vite dev server directly with Hot Module Replacement (HMR)
- Uses Mock Service Worker (MSW) to intercept API calls in the browser
- Fast development cycle with instant feedback
- Best for UI development and testing
- Opens at http://localhost:5173

### 2. Plugin Mode (Production-like)
**Command:** `pnpm start`

- Runs via `@objectstack/cli serve` with ObjectStack runtime
- Serves the console as a UI plugin from `dist/` directory
- Tests plugin integration and routing
- Simulates production deployment pattern
- Useful for testing the plugin architecture
- Opens at http://localhost:3000 (default CLI port)

Both modes support the same features and use the same codebase. Choose development mode for fast iteration, and plugin mode to verify deployment behavior.

## Vercel Deployment

The console can be deployed as a standalone static SPA (e.g. to Vercel) that connects to a remote ObjectStack backend. The build configured in `vercel.json` disables the MSW mock worker (`VITE_USE_MOCK_SERVER=false`) so that all `/api/v1/*` requests go to the real backend.

**Required environment variable** (set in the Vercel project's *Environment Variables* panel):

| Variable | Example | Description |
| --- | --- | --- |
| `VITE_SERVER_URL` | `https://demo.objectstack.ai` | Absolute URL of the ObjectStack backend. When unset, requests default to the same origin — which will 404 on a static SPA host. |

Additional backend requirements for cross-origin deployments:

1. The backend must allow CORS from the SPA origin (`Access-Control-Allow-Origin: <spa-origin>`, `Access-Control-Allow-Credentials: true`).
2. Auth cookies must use `SameSite=None; Secure` so they are sent on cross-site requests.
3. The apps and objects referenced in URLs (e.g. `crm_enterprise`, `lead`) must actually exist in the backend metadata — otherwise the console will render its *object not found* empty state.

## ObjectStack Spec Compliance

### AppSchema Support
- ✅ `name`, `label`, `icon` — Basic app metadata
- ✅ `description`, `version` — Optional app information
- ✅ `homePageId` — Custom landing page configuration
- ✅ `requiredPermissions` — Permission-based access control
- ✅ `branding.logo`, `branding.primaryColor`, `branding.favicon` — App branding

### Navigation Support
- ✅ `object` — Navigate to object list views
- ✅ `dashboard` — Navigate to dashboards
- ✅ `page` — Navigate to custom pages
- ✅ `report` — Navigate to reports
- ✅ `url` — External URL navigation with target support
- ✅ `group` — Nested navigation groups with collapse
- ✅ `visible` / `visibleOn` — Expression-based visibility conditions

### Object Operations
- ✅ Multi-view switching (grid, kanban, calendar, timeline, chart, map, gantt, gallery)
- ✅ Create / Read / Update / Delete via ObjectForm
- ✅ Search, filter, sort across all view types
- ✅ Record detail page and drawer preview
- ✅ Metadata inspector for developers

## Architecture

The console is a thin orchestration layer on top of the ObjectUI plugin system:

```
Console App
├── @object-ui/react          — SchemaRenderer (JSON → Component)
├── @object-ui/components     — Shadcn UI primitives
├── @object-ui/layout         — AppShell, Sidebar
├── @object-ui/core           — ExpressionEvaluator, ActionRunner
├── @object-ui/data-objectstack — API adapter (auto-reconnect, caching)
├── @object-ui/plugin-view    — ObjectView (multi-view container)
├── @object-ui/plugin-form    — ObjectForm (CRUD forms)
├── @object-ui/plugin-grid    — DataGrid (AG Grid)
├── @object-ui/plugin-kanban  — Kanban board
├── @object-ui/plugin-calendar— Calendar view
├── @object-ui/plugin-dashboard — Dashboard renderer
├── @object-ui/plugin-report  — Report viewer/builder
└── 8 more view plugins...
```

## Documentation

| Document | Description |
|----------|-------------|
| [Console Roadmap](./CONSOLE_ROADMAP.md) | Full development plan with phases, timeline, and verified status |
| [Getting Started Guide](../../content/docs/guide/console.md) | User-facing documentation |
| [Architecture Guide](../../content/docs/guide/console-architecture.md) | Technical deep-dive |
| [UI Improvement Proposal](./docs/UI_IMPROVEMENT_PROPOSAL.md) | Modern UI design improvements for metadata inspector |

## License

MIT
