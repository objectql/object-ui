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
pnpm dev            # starts the console dev server (Vite)
```

The console opens at **http://localhost:5180** (the port is fixed in `apps/console/vite.config.ts`). There is no bundled mock backend — `apps/console/.env.development` points `VITE_SERVER_URL` at `http://localhost:3000`, so an ObjectStack server has to be listening there. See [Running with a Real Backend](#running-with-a-real-backend) to target a different one.

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-App Switcher** | Switch between the apps discovered from the connected server. |
| **Dynamic Navigation** | Sidebar renders from the app's `navigation` tree (objects, groups, URLs, pages). |
| **Object Views** | List / Grid / Kanban / Calendar — backed by `@object-ui/plugin-view`. |
| **CRUD Dialogs** | Create & edit records via schema-driven forms. |
| **Expression Visibility** | Show/hide navigation items using `visible: "${data.role === 'admin'}"`. |
| **Branding** | Per-app colors, favicons, and logos via `AppShell` branding. |
| **Command Palette** | `⌘+K` opens a searchable command bar for quick navigation. |
| **Studio Package Scope** | Studio home, metadata counts, quick-create links, and diagnostics follow the selected package. |
| **Design in Studio** | Workspace admins get a top-bar entry inside a running app that opens its owning package on the Studio design surface. On an interface route — a dashboard, page, or report — it deep-links straight to that surface's design page in the Interfaces pillar (`/studio/:packageId/interfaces?surface=<type>:<name>`, e.g. `surface=page:showcase_crm_workbench`); elsewhere (objects, the app root) it opens the package's Data tab (`/studio/:packageId/data`). These interfaces are authored in Studio — there is no in-page edit panel. |
| **App Creation Wizard** | 4-step wizard (Basic Info → Objects → Navigation → Branding) to create or edit apps. |
| **Record Approvals Tab** | A record with approval requests grows an Approvals tab on its detail page (peer of Details/Related, with a request-count badge) — current step, decision progress, resolved "waiting on" approvers, the merged decision timeline, and a submitter remind button — visible to every viewer who can read the record, not just approvers. |
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

**The console has no configuration file.** It declares no apps, objects or views of its own —
it renders whatever the server it is pointed at publishes. There are only two inputs:

**1. `VITE_SERVER_URL` — which backend to talk to.** A build-time Vite variable, and the only
setting the console itself owns. It seeds the data adapter's base URL and the runtime-config
fetch; `apps/console/.env.development` defaults it to `http://localhost:3000`, and an empty
value means same origin. See [Running with a Real Backend](#running-with-a-real-backend).

**2. Server-pushed runtime config — everything else.** Before React mounts, the console
resolves `/api/v1/runtime/config` from that server and applies it: product branding, feature
flags (marketplace, AI Studio, SSO, custom domain), and the cloud URL. Operators configure
these on the **server**, not in the SPA, which is why changing them needs no console rebuild.

Apps, objects and views themselves are metadata fetched over HTTP — discovered at connect
time and loaded on demand. To change what the console shows, change the metadata on the
server: author it in the ObjectStack server project (`objectstack.config.ts` lives **there**,
not here) or edit and publish it from Studio. See
[ObjectOS Integration](/docs/guide/objectos-integration) for the server-side configuration
shape.

## Running with a Real Backend

`VITE_SERVER_URL` is the setting that decides which backend the console talks to — the data adapter, auth, i18n and action endpoints all hang off it.

1. Point it at your server. An inline value overrides `apps/console/.env.development`:
   ```bash
   VITE_SERVER_URL=http://localhost:3000 pnpm dev
   ```
   Leave it empty (`VITE_SERVER_URL=`) to use the same origin — the right setting when an ObjectStack server serves the console itself.
2. The console will use the ObjectStack client to discover metadata and perform CRUD operations against the server.

## Where the Code Lives

Most of what you see in the console does not live in `apps/console`. The shell and layout, sidebar, header, command palette, object list and record detail views all ship from **`packages/app-shell`** (`@object-ui/app-shell`), so any host application can mount the same experience; the heavier view surfaces (grid, kanban, calendar, charts, designer) come from the `@object-ui/plugin-*` packages.

`apps/console` is the assembly layer on top: it owns the route tree, registers the plugin set, wires the backend connection, and adds the surfaces specific to this app (auth pages, the docs portal, system and settings pages). So when you want to change something you *see* in the console, look in `packages/app-shell` first.

## See Also

- [Console Architecture](/docs/guide/console-architecture) — data flow, routing, and plugin integration
- [Schema Overview](/docs/guide/schema-overview) — the JSON protocol that drives the console
- [Data Source](/docs/guide/data-source) — how the adapter fetches and caches data
