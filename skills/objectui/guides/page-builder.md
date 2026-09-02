---
name: objectui-sdui-page-builder
description: Build and integrate Schema-Driven UI pages in third-party projects using Object UI. Use this skill whenever the user asks to create app pages from JSON schemas, wire SchemaRenderer into an existing React app, implement CRUD/dashboard/form/list/detail pages with Object UI, or migrate handwritten React pages to schema-driven rendering. Use it even if the user does not explicitly mention "skill" or "SchemaRenderer" but describes metadata-driven page development, console-like page composition, or JSON-to-UI workflows.
---

# ObjectUI SDUI Page Builder

Use this skill to guide app developers (not framework maintainers) to build production pages with Object UI's Schema-Driven UI Engine.

## What this skill should optimize for

- Deliver working page features quickly with JSON-first design.
- Keep architecture aligned with Object UI conventions.
- Keep third-party projects backend-agnostic through DataSource interfaces.
- Produce outputs that are immediately usable in app codebases.

## When to use this skill

Use this skill when requests include:

- "Build a page with Object UI / SchemaRenderer"
- "Create a CRUD/dashboard/form/detail page from JSON"
- "Integrate Object UI in an existing React/Vite/Next app"
- "Design a metadata-driven page similar to console"
- "Move an existing React page to schema-driven rendering"

Do not use this skill for:

- Modifying Shadcn upstream primitives under `packages/components/src/ui/**`.
- Core engine internals that belong to `@object-ui/core` maintenance.
- Non-UI backend implementation unrelated to schema rendering.

## Required mindset

1. JSON first, React second.
2. Protocol compatibility before convenience shortcuts.
3. Reusable schema blocks before one-off page code.
4. DataSource abstraction over hardcoded transport logic.

## Standard workflow

### 1. Frame the page contract first

Before writing implementation code, define:

- Page purpose (dashboard, list, detail, form, wizard, board).
- Required data inputs and output actions.
- User roles and visibility rules.
- Interaction model (navigation, submit, bulk actions, modals).

Then produce a first schema draft.

### 2. Select the right package boundaries

Use these boundaries in guidance and generated code:

- `@object-ui/types`: schema and typed interfaces.
- `@object-ui/core`: expression/action/registry logic.
- `@object-ui/components`: base visual components and wrappers.
- `@object-ui/fields`: form input renderers.
- `@object-ui/layout`: shell and page composition.
- `@object-ui/plugin-*`: heavy feature widgets (grid, charts, kanban, map).
- `@object-ui/react`: `SchemaRenderer`, provider wiring, runtime bridge.

When helping third-party apps, consume these packages; avoid duplicating core runtime logic in the app layer.

### 3. Compose schema using proven node shape

Use a strict component schema shape similar to:

```json
{
  "type": "card",
  "id": "customer_summary",
  "className": "col-span-12 lg:col-span-4",
  "title": "Customer Summary",
  "hidden": "${data.userRole !== 'admin'}",
  "children": [
    {
      "type": "text",
      "content": "Active users: ${data.metrics.activeUsers}"
    }
  ]
}
```

**Every key belongs on the node itself — never in a `props` envelope.** The
renderers read `schema.title` / `schema.content` / `schema.columns` directly;
`SchemaRenderer` spreads `schema.props` as React props instead of merging it
into the node, so a key parked under `props` is never read and the component
paints an empty frame (the envelope itself also lands in the DOM as
`props="[object Object]"`). Namespaced `element:*` components are where `props`
is read by design (`readProps` in
`packages/components/src/renderers/basic/elements.tsx`).

`properties` is a different envelope with a different fate: `SchemaRenderer`
evaluates it and then **hoists its keys onto the node**, so unlike `props` it
does reach every renderer. That is why it is the only spelling that gets a
provider expression into a `data-table` today — measured, with the failing legs
and the reason it is recorded rather than recommended, in
[`rules/protocol.md`](../rules/protocol.md).

Prefer expression-based behavior (`hidden`, `disabled`) over imperative
branching in component code.

### 4. Wire renderer and registry cleanly

Typical integration sequence:

1. Register default renderers/components.
2. Register plugin components needed by the page type.
3. Provide `dataSource` and contextual data through renderer provider.
4. Render schema via `SchemaRenderer`.

Keep custom component registrations namespaced to avoid collisions.

### 5. Use action data, not inline callback spaghetti

Represent interactions as data where possible:

```json
{
  "events": {
    "onClick": [
      { "action": "validate", "target": "customer_form" },
      { "action": "submit", "target": "customer_form" },
      { "action": "navigate", "params": { "url": "/customers" } }
    ]
  }
}
```

If custom app-side handlers are needed, isolate them in action handlers instead of embedding business logic into presentation components.

### 6. Validate responsiveness and accessibility

For every generated page, ensure:

- Responsive layout behavior (mobile/tablet/desktop).
- Semantic labels and ARIA fields where relevant.
- Keyboard-safe interactions for forms and actions.
- Error and loading states are present in schema or wrappers.

### 7. Ship with verification artifacts

Always include:

- Final page schema JSON.
- Integration code snippet (provider + renderer + registry wiring).
- Test checklist (rendering, expressions, actions, data loading).
- Optional migration notes if replacing legacy React page code.

## Output format

Always structure results in this order:

1. `Page Goal` - one paragraph.
2. `Schema JSON` - complete runnable draft.
3. `Integration Steps` - app wiring steps.
4. `Code Snippets` - minimal required TS/TSX examples.
5. `Validation Checklist` - what to test before merge.
6. `Extension Options` - how to add fields/plugins/actions next.

## Console-inspired patterns to reuse

When users ask for a "console-like" experience, prefer:

- App-shell layout with persistent navigation.
- Metadata-driven detail pages composed from widgets.
- Registry-based component resolution over switch/case rendering.
- PageSchema factories for page variants of the same domain entity.

## Expression evaluation boundaries

Understanding what gets evaluated and what does not is critical for correct schemas.

A key must clear **two independent gates** to reach the screen: the renderer
has to *read* it, and `SchemaRenderer` has to *evaluate* it. Keys on the node
clear the first gate; only the short list below clears the second.

**Evaluated by SchemaRenderer automatically:**

| Field | What happens |
|-------|-------------|
| `content` | Template-evaluated **and** read by the text renderers. `"content": "Hello ${user.name}"` works end to end. |
| `hidden` / `hiddenOn` | Boolean expression. Component removed from DOM when true. |
| `visible` / `visibleOn` | Boolean expression. `visible` takes priority over `hidden`. |
| `disabled` / `disabledOn` | Boolean expression. Passed as prop to component. |
| `props.*` | Template-evaluated, but handed to the component as React props — a `ui:*` / `page:*` renderer never reads the result back, so the evaluated value is discarded. Only `element:*` components consume it. Do not use it as an expression carrier. |
| `properties.*` | Template-evaluated **and hoisted onto the node**, so unlike `props` the result is read — by every namespace. Its status as an authoring channel is open (objectui#4795); see [`rules/protocol.md`](../rules/protocol.md) before reaching for it. |
| `title` / `label` / `value` / `description` | Template-evaluated **on the component types that declare them** — `statistic` (`label`/`value`/`description`), `card` (`title`/`description`), `button` (`label`). The list is closed and declared in `@objectstack/spec`; see [`rules/protocol.md`](../rules/protocol.md). |

**NOT evaluated (raw strings passed through):**

| Field | What to do instead |
|-------|-----------|
| `title` / `label` / `value` / `description` **on any other type** | Read by the renderer, but not template-evaluated there — an inline `${...}` reaches the screen as literal text. Moving it under `props` does not help: it gets evaluated there and then dropped. Resolve the value in the host **before** handing the schema to `SchemaRenderer` (the same pattern the i18n guide uses for `t(...)`), or carry it on a `text` node's `content`. |
| `className` | Not expression-evaluated. Use static Tailwind classes only. |
| `id` | Static string. No expressions. |

**Correct pattern** — a `statistic`'s text keys sit on the node. Static values
work as-is, and so do expressions (`statistic` declares all three):
```json
{
  "type": "statistic",
  "label": "Active Users",
  "value": "42",
  "description": "+5% from last month",
  "trend": "up"
}
```

**Correct pattern on a type that does NOT declare the key** — `content` is
evaluated on every component type, so a `text` child carries the binding:
```json
{
  "type": "card",
  "title": "Active Users",
  "children": [
    { "type": "text", "content": "${data.metrics.activeUsers} active, +${data.metrics.growth}% this month" }
  ]
}
```

**Wrong pattern (renders an empty card — the envelope is never read):**
```json
{
  "type": "statistic",
  "props": {
    "label": "Active Users",
    "value": "${data.metrics.activeUsers}"
  }
}
```

**Right, since objectui#4795 — `statistic` declares `value` and `label`, so
these are evaluated on the node and read back:**
```json
{
  "type": "statistic",
  "value": "${data.metrics.activeUsers}",
  "label": "${data.labels.title}"
}
```

⚠️ The same two keys on a type with no declaration (e.g. `text`) still reach the
screen as literal `${...}`. The declaring types are listed in
[`rules/protocol.md`](../rules/protocol.md).

For the full expression syntax reference (operators, formula functions, security model), see the `objectui-schema-expressions` skill.

## CSS theming template for third-party apps

Object UI components render unstyled unless the app's Tailwind entry brings in the
packages' styles. How it does that depends on where the packages come from — installed
from npm, or linked inside the ObjectUI workspace. The two cases are not interchangeable.

### Installed from npm (the third-party case)

Import the published stylesheets. There is no `tailwind.config.js` step, and no scanning
of `node_modules`.

**Required `src/index.css`:**
```css
@import "tailwindcss";
@import "@object-ui/components/style.css";
@import "@object-ui/fields/style.css";
```

Each `style.css` is a real package export, mapped to that package's `dist/index.css` and
compiled at build time from the package's own sources. The components sheet carries every
utility its components use **and** the `@theme` block those utilities are built on, so the
whole Shadcn palette and the `:root` / `.dark` token defaults arrive with that one import
— you do not restate those tokens in a `@theme` block of your own. The order is
load-bearing: the fields sheet is a supplement compiled against the components theme with
every rule that sheet already ships subtracted from it, so imported first or alone its
rules resolve against tokens that are not there yet. `@object-ui/fields` is a separate
dependency, not a transitive one — install it, or leave that second line out.

Do **not** point Tailwind at the ObjectUI packages inside `node_modules`, with neither a
v4 `@source` line nor a v3 `content` entry: the published tarballs carry `dist` only, and
the `@theme` block the themed utilities come from lives in package source, which is not
published. To recolour, override the token values (Shadcn HSL channel triples) rather than
the utilities — see `content/docs/guide/theming.md`.

### Inside the ObjectUI workspace

Here the packages are linked to their sources, so Tailwind scans them directly and the app
owns the theme declaration:

```css
@import "tailwindcss";

/* Workspace packages are linked to their sources — scan them */
@source "../../packages/components/src/**/*.tsx";
@source "../../packages/fields/src/**/*.tsx";
@source "../../packages/layout/src/**/*.tsx";
@source "../../packages/react/src/**/*.tsx";
```

Adjust those paths to your app's location relative to the monorepo root, and add a
`@source` line per plugin package the app renders. Because the app owns the Tailwind entry
in this case, it also declares the `@theme` mapping and the `:root` token values;
`apps/console/src/index.css` is the maintained reference for both.

## Plugin integration in page schemas

When pages need heavy widgets (grids, forms, kanbans, charts), import the plugin package and ensure its components are registered before rendering. Plugin
widgets read their configuration off the node exactly like the built-in
renderers do (`schema.objectName`, `schema.columns`, `schema.fields`,
`schema.gantt`) — the `props` envelope is not read here either.

**Grid plugin example:**
```json
{
  "type": "object-grid",
  "objectName": "products",
  "columns": [
    { "field": "name", "label": "Name", "type": "text" },
    { "field": "price", "label": "Price", "type": "currency" },
    { "field": "status", "label": "Status", "type": "select" }
  ],
  "bind": "products"
}
```

> **Grid columns key off `field`; form fields key off `name`.** The two layers sit
> next to each other here and use the same pair of words for opposite things:
> `ListColumn.field` names the object field a column shows, while `FormField.name`
> names the field a form input writes. A grid column written as `{ "name": ... }`
> names no field, so `ObjectGrid` drops it.

**Form plugin example:**
```json
{
  "type": "object-form",
  "objectName": "customer",
  "mode": "edit",
  "fields": [
    { "name": "name", "label": "Name", "type": "text", "required": true },
    { "name": "email", "label": "Email", "type": "text" }
  ]
}
```

**Kanban plugin example:**
```json
{
  "type": "kanban",
  "objectName": "tasks",
  "groupBy": "status",
  "bind": "tasks"
}
```

**Gantt plugin example:**
```json
{
  "type": "gantt",
  "objectName": "project_task",
  "gantt": {
    "titleField": "name",
    "startDateField": "start_date",
    "endDateField": "end_date"
  }
}
```

Those three `gantt` keys are the required ones; every other option — the tree,
dependency, baseline, resource-view, quick-filter, working-calendar and
read-only surfaces — is optional and documented in
[`@object-ui/plugin-gantt`'s README](https://github.com/objectstack-ai/objectui/blob/main/packages/plugin-gantt/README.md).
The same configuration can also be written as flat `startDateField` /
`endDateField` / ... keys **on the node** — never under `props`, which no
`ui:*` renderer reads. That flat spelling is the internal ObjectView / ListView
flatten product: it is taken only when there is no `gantt` block, and a node
carrying both renders the block and warns about the ignored top-level keys.
Author the `gantt` block.

Import plugins in your app entry point to trigger registration:
```typescript
import '@object-ui/plugin-grid';
import '@object-ui/plugin-form';
import '@object-ui/plugin-kanban';
```

### Full plugin catalog

Pick plugins by domain — each registers its own `type` strings in the ComponentRegistry on import:

| Domain | Plugins |
|--------|---------|
| Tables | `plugin-grid` |
| List / Detail / Form | `plugin-list`, `plugin-detail`, `plugin-form` |
| Time-based | `plugin-calendar`, `plugin-timeline`, `plugin-gantt` |
| Boards / Dashboards | `plugin-kanban`, `plugin-dashboard`, `plugin-report` |
| Visualization | `plugin-charts`, `plugin-map` |
| Editors | `plugin-editor`, `plugin-markdown` |
| Views & Design | `plugin-view`, `plugin-tree`, `plugin-designer` |
| AI | `plugin-ai`, `plugin-chatbot` |

For lazy loading, use `LazyPluginLoader` from `@object-ui/react` rather than top-level imports.

### Shell integration

For host apps that need more than the raw renderer, prefer `@object-ui/app-shell`:

```tsx
import { AppShell, ObjectView, PageView, DashboardView } from '@object-ui/app-shell';
```

It exposes `ObjectView`, `RecordDetailView`, `PageView`, `DashboardView`,
`ReportView` and matching providers (`AdapterProvider`, `MetadataProvider`,
`ExpressionProvider`). ⚠️ Not `ObjectRenderer` / `PageRenderer` /
`DashboardRenderer`. `ObjectRenderer` exists nowhere in the repo;
`DashboardRenderer` is a public export of `@object-ui/plugin-dashboard`; and
`PageRenderer` is an internal renderer inside `@object-ui/components`,
reachable only through the `page` / `app` / `utility` / `home` / `record`
registry keys it registers, never as an import. See
`guides/project-setup.md` for the decision matrix.

## Common mistakes to avoid

- Writing large bespoke React JSX trees before schema definition.
- Hardcoding API calls directly inside visual renderers.
- Introducing package coupling (for example, UI package depending on business logic package).
- Registering components without namespace in plugin-heavy projects.
- Skipping docs updates for newly introduced schema patterns.
- Expecting a `${...}` on top-level `value` / `label` to evaluate — it does not, and moving it under `props` renders nothing at all. Resolve it in the host, or carry it on a `text` node's `content`.
- Missing Shadcn CSS variables — components render but look completely unstyled.
- Forgetting the `@object-ui/components/style.css` and `@object-ui/fields/style.css` imports, or importing them in the wrong order — ObjectUI's utilities never reach the page.

## Fast triage playbook for ambiguous requests

If the request is underspecified:

1. Infer likely page category (list/detail/form/dashboard).
2. Produce a minimal viable schema first.
3. Mark assumptions clearly.
4. Provide one conservative and one advanced variant.

This keeps momentum while inviting focused user feedback.

## Example prompts this skill should handle well

- "In our CRM app, create a customer detail page with tabs, related orders, and action buttons using SchemaRenderer."
- "Migrate this existing React order list to Object UI schema, keep filters and bulk actions."
- "Set up a dashboard page in a Vite app with Object UI cards + chart plugin and role-based visibility."
- "My ObjectUI components are rendering but look completely unstyled — help me fix the CSS setup."
- "Add a kanban board to my existing schema-driven project page."
