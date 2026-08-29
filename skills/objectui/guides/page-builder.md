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

**NOT evaluated (raw strings passed through):**

| Field | What to do instead |
|-------|-----------|
| `title` / `label` / `value` / `description` | Read by the renderer, but never template-evaluated — an inline `${...}` reaches the screen as literal text. Moving it under `props` does not help: it gets evaluated there and then dropped. Resolve the value in the host **before** handing the schema to `SchemaRenderer` (the same pattern the i18n guide uses for `t(...)`), or carry it on a `text` node's `content`. |
| `className` | Not expression-evaluated. Use static Tailwind classes only. |
| `id` | Static string. No expressions. |

**Correct pattern** — a `statistic`'s text keys sit on the node and carry
values the host already resolved:
```json
{
  "type": "statistic",
  "label": "Active Users",
  "value": "42",
  "description": "+5% from last month",
  "trend": "up"
}
```

**Correct pattern for a live-bound number** — `content` is the one text key
that is both evaluated and read:
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

**Also wrong (value shows as raw `${...}` text — read, but not evaluated):**
```json
{
  "type": "statistic",
  "value": "${data.metrics.activeUsers}",
  "label": "${data.labels.title}"
}
```

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
    "endDateField": "end_date",
    "progressField": "progress",
    "parentField": "parent_id",
    "dependenciesField": "depends_on",
    "typeField": "item_type",
    "lockField": "is_locked",
    "defaultCollapsedDepth": 2,
    "colorField": "status",
    "baselineStartField": "planned_start",
    "baselineEndField": "planned_end",
    "tooltipFields": [{ "field": "owner", "label": "Owner" }, "status", "effort"],
    "groupByField": "owner",
    "assigneeField": "owner",
    "effortField": "effort",
    "quickFilters": [
      { "field": "status", "label": "状态" },
      { "field": "project", "label": "项目" },
      { "field": "priority", "label": "优先级", "options": ["high", "medium", "low"] }
    ],
    "autoZoomToFilter": true
  },
  "criticalPath": true,
  "skipWeekends": true,
  "holidays": ["2026-01-01", "2026-12-25"],
  "readOnly": false,
  "bind": "project_task"
}
```

`titleField` / `startDateField` / `endDateField` are required; the rest are
optional. `parentField` builds the summary tree (parents roll up their
children's span + weighted progress), `typeField` distinguishes
`task` / `summary` (alias `project` / `phase`) / `milestone` / `group`
(alias `folder`), `dependenciesField` draws the dependency
arrows (accepts CSV, an id array, or `[{ id, type: 'fs'|'ss'|'ff'|'sf' }]`).
Setting `dependenciesField` also makes links **editable** (unless `readOnly`):
drag a bar's connector dot to create a FS link, right-click a link to switch its
type (FS/SS/FF/SF) or remove it (移除依赖), or right-click a bar for
添加紧前/添加紧后依赖 — every change is written back to the field (the field is
auto-promoted to `[{ id, type }]` form the moment a non-FS link is stored).
With links present, dragging a bar into a position that violates a dependency
(拖拽冲突校验) raises a 顺延 confirmation: 自动顺延 reschedules the affected tasks
via a topological forward pass (link-type aware, summaries stay fixed rollups),
取消保留 keeps the manual placement. This is on by default whenever
`dependenciesField` is set and suppressed in `readOnly`.
`tooltipFields` configures the hover detail (悬浮详情) — each entry a
field name or `{ field, label }`, formatted by field type.
`baselineStartField` / `baselineEndField` draw a thin planned-vs-actual
baseline strip under each bar. `groupByField` swimlanes the rows by any field
(a select/lookup label or raw value; empty values fall into an "ungrouped"
bucket). `assigneeField` / `effortField` configure the **resource / workload
view** (see below). The gantt field config may also be hoisted to top-level
`props` instead of nesting under `gantt`.

**Multi-level trees (无条分组层 / 默认折叠 / 仅查看)** — for deep hierarchies like
项目 → 产品 → 排产计划 → 派工单, drive the shape from data, not hardcoded logic:

| Field mapping (under `gantt`) | Effect |
|--------|--------|
| `typeField: "…"` with a `group` (or `folder`) value | Renders that record as a **pure tree header with NO timeline bar** (无条) — expandable/collapsible like a summary but never scheduled. Use for grouping-only levels (项目/产品) that organize rows without their own dates. `summary` (and aliases `project`/`phase`) still render a bar-carrying rollup bracket. |
| `lockField: "is_locked"` | Marks a row **view-only / 仅查看** when the field is truthy: its bar can't be dragged/resized, progress can't be dragged, no dependency connector dot, and inline-edit + context-menu edit/delete are hidden. **Clicking still works** (open drawer / jump). Independent of `readOnly`, so you can freeze just one level (e.g. 派工单) while siblings stay editable. |
| `defaultCollapsedDepth: 2` | **Auto-collapse 默认折叠** every tree node at or below this 0-indexed depth that has children, on first render. Roots are depth 0. The user can still expand any of them — this only seeds the initial state. Example: in a 项目(0)→产品(1)→排产计划(2)→派工单(3) tree, `2` starts with every 排产计划 (and its 派工单) folded. Omit to start fully expanded. |

**Gantt config options** (`GanttConfig` members — set them INSIDE `gantt`, or hoist
the whole config as above; beside a `gantt` block a top-level copy is IGNORED):

| Option (under `gantt`) | Effect |
|--------|--------|
| `resourceView: true` | Render the **resource / workload view** instead of the task grid: one row per resource with a per-column load histogram. Requires `assigneeField` to bucket tasks; each task adds `effortField` units (default 1) over its span, and any column whose summed load exceeds `capacity` is painted as over-allocated. |
| `assigneeField` / `effortField` / `capacity` | Resource bucketing (required for `resourceView`), per-task workload weight (default `1`), and the per-resource capacity ceiling (default `1`; loads above it flag overload). |
| `quickFilters: [{ field, label?, options? }]` | Render a **快速筛选 (quick filter)** bar above the grid — one multi-select dropdown per entry that narrows the visible task bars by that field (AND across dimensions). Option lists resolve in priority order: explicit `options` → the object schema's `select`/`enum` options (full domain) → a `lookup`/`master_detail`'s referenced records (pulled in full via the data source, so values with **no** tasks still appear) → distinct values from the loaded data. Lookup values match on the embedded record id. Selecting every option of a dimension collapses to "no constraint". |
| `autoZoomToFilter: true` | When a quick filter narrows the set, re-derive the timeline range from the **remaining** tasks so the axis zooms to the filtered span (default `true`). Set `false` to pin the axis to the full task span so bars keep their absolute position while filtering. |
| `viewMode: "day"\|"week"\|"month"\|"quarter"\|"year"` | Initial timeline granularity (default `day`); the toolbar segmented control switches it live. `year` widens the axis to one column per year with a decade (`2020s`) band above. |

**Node-level display / behavior options** (true siblings of `gantt` on the node
itself, not `GanttConfig` members — they apply with either face):

| Option | Effect |
|--------|--------|
| `criticalPath: true` | Start with the critical-path (zero-slack chain) highlight on; a toolbar toggle stays available. |
| `showBaselines: false` | Hide the baseline strips even when baseline fields are mapped (default `true`). |
| `skipWeekends: true` | Working-calendar math: auto-schedule + critical path count working days only, snapping reschedules off Sat/Sun. In **day mode** this also folds weekend columns out of the timeline (非线性工作时间轴) — Friday sits against Monday and a one-column drag advances one working day. Coarser scales stay linear. |
| `holidays: ["yyyy-mm-dd", …]` | Extra non-working days for the working calendar (combine with or instead of `skipWeekends`). In day mode these columns fold out of the axis too. |
| `markers: [{ date, label?, color? }]` | Extra vertical marker lines (like the Today line). |
| `persistLayout: false` | Disable layout persistence. By default the toolbar's **保存布局 (save layout)** button snapshots the current granularity + zoom + task-list collapse to `localStorage` (key `gantt-layout:<object>:<view>`) and restores it on next load; set `false` to opt out. |
| `readOnly: true` | **Disable all editing** — no bar drag/resize/progress, no inline edit, no delete, no dependency-link drag, no reorder, no auto-schedule, and the Undo/Redo buttons are hidden. A 🔒 只读 badge shows in the toolbar, and the right-click menu drops to view-only (or is suppressed when nothing is actionable). Task click + granularity switching still work. Use for dashboards / shared read-only views. |
| `mobileReadOnly: false` | On a narrow viewport (≤ 640px) the chart **auto-enters read-only** to give touch users a clean, scrollable thumbnail (移动端只读缩略) — same gating as `readOnly`, applied only while narrow. Enabled by default; set `false` to keep editing live on small screens. |

The toolbar also carries **navigation** (今天 / 本周 / 本月 jump-to buttons that
scroll the timeline to the start of today/this-week/this-month) and **export**
(导出 PNG and a dependency-free single-page 导出 PDF of the whole chart) controls,
always available regardless of `readOnly`. Each task-list row also has a **定位
(locate)** icon by its End cell that smooth-scrolls the timeline to center that
row's bar and pulses it (闪烁) so it's easy to spot after the jump — handy in
deep/long trees.

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
| Views & Design | `plugin-view`, `plugin-designer`, `plugin-workflow` |
| AI | `plugin-ai`, `plugin-chatbot` |

For lazy loading, use `LazyPluginLoader` from `@object-ui/react` rather than top-level imports.

### Shell integration

For host apps that need more than the raw renderer, prefer `@object-ui/app-shell`:

```tsx
import { AppShell, ObjectRenderer, PageRenderer, DashboardRenderer } from '@object-ui/app-shell';
```

It exposes `ObjectRenderer`, `PageRenderer`, `DashboardRenderer` and matching providers (`AdapterProvider`, `MetadataProvider`, `ExpressionProvider`). See `guides/project-setup.md` for the decision matrix.

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
