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
  "props": {
    "title": "Customer Summary"
  },
  "hidden": "${data.userRole !== 'admin'}",
  "children": [
    {
      "type": "text",
      "props": {
        "content": "Active users: ${data.metrics.activeUsers}"
      }
    }
  ]
}
```

Prefer expression-based behavior (`hidden`, `disabled`, computed props) over imperative branching in component code.

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

**Evaluated by SchemaRenderer automatically:**

| Field | What happens |
|-------|-------------|
| `props.*` | All values in the `props` object are expression-evaluated. Use `props.label`, `props.value`, etc. |
| `content` | Evaluated for text components. `"content": "Hello ${user.name}"` works. |
| `hidden` / `hiddenOn` | Boolean expression. Component removed from DOM when true. |
| `visible` / `visibleOn` | Boolean expression. `visible` takes priority over `hidden`. |
| `disabled` / `disabledOn` | Boolean expression. Passed as prop to component. |

**NOT evaluated (raw strings passed through):**

| Field | Workaround |
|-------|-----------|
| `value` (top-level) | Move to `props.value` |
| `label` (top-level) | Move to `props.label` |
| `description` (top-level) | Move to `props.description` |
| `className` | Not expression-evaluated. Use static Tailwind classes only. |
| `id` | Static string. No expressions. |

**Correct pattern:**
```json
{
  "type": "statistic",
  "props": {
    "label": "Active Users",
    "value": "${data.metrics.activeUsers}",
    "description": "+${data.metrics.growth}% from last month"
  }
}
```

**Wrong pattern (value will show as raw `${...}` text):**
```json
{
  "type": "statistic",
  "value": "${data.metrics.activeUsers}",
  "label": "${data.labels.title}"
}
```

For the full expression syntax reference (operators, formula functions, security model), see the `objectui-schema-expressions` skill.

## CSS theming template for third-party apps

Third-party projects must set up Tailwind + Shadcn CSS variables correctly. Without this, Object UI components render unstyled.

**Required `src/index.css`:**
```css
@import "tailwindcss";

/* Scan ObjectUI packages so Tailwind generates their utility classes */
@source "../../packages/components/src/**/*.tsx";
@source "../../packages/fields/src/**/*.tsx";
@source "../../packages/layout/src/**/*.tsx";
@source "../../packages/react/src/**/*.tsx";
@source "../../node_modules/@object-ui/components/src/**/*.tsx";
@source "../../node_modules/@object-ui/fields/src/**/*.tsx";

/* Map Shadcn CSS variables to Tailwind 4 color tokens */
@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* Light mode CSS variables (Shadcn defaults) */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}
```

Adjust `@source` paths based on your project's location relative to `node_modules` or the monorepo root.

## Plugin integration in page schemas

When pages need heavy widgets (grids, forms, kanbans, charts), import the plugin package and ensure its components are registered before rendering.

**Grid plugin example:**
```json
{
  "type": "object-grid",
  "props": {
    "objectName": "products",
    "columns": [
      { "name": "name", "label": "Name", "type": "text" },
      { "name": "price", "label": "Price", "type": "currency" },
      { "name": "status", "label": "Status", "type": "select" }
    ]
  },
  "bind": "products"
}
```

**Form plugin example:**
```json
{
  "type": "object-form",
  "props": {
    "objectName": "customer",
    "mode": "edit",
    "fields": [
      { "name": "name", "label": "Name", "type": "text", "required": true },
      { "name": "email", "label": "Email", "type": "text" }
    ]
  }
}
```

**Kanban plugin example:**
```json
{
  "type": "kanban",
  "props": {
    "objectName": "tasks",
    "groupBy": "status"
  },
  "bind": "tasks"
}
```

**Gantt plugin example:**
```json
{
  "type": "gantt",
  "props": {
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
      "effortField": "effort"
    },
    "criticalPath": true,
    "skipWeekends": true,
    "holidays": ["2026-01-01", "2026-12-25"],
    "quickFilters": [
      { "field": "status", "label": "状态" },
      { "field": "project", "label": "项目" },
      { "field": "priority", "label": "优先级", "options": ["high", "medium", "low"] }
    ],
    "autoZoomToFilter": true,
    "readOnly": false
  },
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

**Top-level display / behavior options** (siblings of `gantt` on `props`, not
field mappings):

| Option | Effect |
|--------|--------|
| `criticalPath: true` | Start with the critical-path (zero-slack chain) highlight on; a toolbar toggle stays available. |
| `showBaselines: false` | Hide the baseline strips even when baseline fields are mapped (default `true`). |
| `skipWeekends: true` | Working-calendar math: auto-schedule + critical path count working days only, snapping reschedules off Sat/Sun. In **day mode** this also folds weekend columns out of the timeline (非线性工作时间轴) — Friday sits against Monday and a one-column drag advances one working day. Coarser scales stay linear. |
| `holidays: ["yyyy-mm-dd", …]` | Extra non-working days for the working calendar (combine with or instead of `skipWeekends`). In day mode these columns fold out of the axis too. |
| `resourceView: true` | Render the **resource / workload view** instead of the task grid: one row per resource with a per-column load histogram. Requires `assigneeField` to bucket tasks; each task adds `effortField` units (default 1) over its span, and any column whose summed load exceeds `capacity` is painted as over-allocated. |
| `assigneeField` / `effortField` / `capacity` | Resource bucketing (required for `resourceView`), per-task workload weight (default `1`), and the per-resource capacity ceiling (default `1`; loads above it flag overload). Also usable as field mappings under `gantt`. |
| `quickFilters: [{ field, label?, options? }]` | Render a **快速筛选 (quick filter)** bar above the grid — one multi-select dropdown per entry that narrows the visible task bars by that field (AND across dimensions). Option lists resolve in priority order: explicit `options` → the object schema's `select`/`enum` options (full domain) → a `lookup`/`master_detail`'s referenced records (pulled in full via the data source, so values with **no** tasks still appear) → distinct values from the loaded data. Lookup values match on the embedded record id. Selecting every option of a dimension collapses to "no constraint". |
| `autoZoomToFilter: true` | When a quick filter narrows the set, re-derive the timeline range from the **remaining** tasks so the axis zooms to the filtered span (default `true`). Set `false` to pin the axis to the full task span so bars keep their absolute position while filtering. |
| `markers: [{ date, label?, color? }]` | Extra vertical marker lines (like the Today line). |
| `viewMode: "day"\|"week"\|"month"\|"quarter"\|"year"` | Initial timeline granularity (default `day`); the toolbar segmented control switches it live. `year` widens the axis to one column per year with a decade (`2020s`) band above. |
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
- Putting expression values in top-level `value`/`label` fields instead of `props.*`.
- Missing Shadcn CSS variables — components render but look completely unstyled.
- Forgetting `@source` directives in Tailwind config — utility classes not generated for ObjectUI packages.

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
