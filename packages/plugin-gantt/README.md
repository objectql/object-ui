# @object-ui/plugin-gantt

Gantt chart plugin for Object UI - Visualize project timelines and task dependencies.

## Features

- **Gantt Charts** - Interactive Gantt chart visualization
- **Full CRUD on the timeline** - Create via toolbar quick-create dialog, edit
  inline or via drag, delete via row kebab → confirmation dialog, view detail
  via click → navigation overlay
- **Drag-and-drop rescheduling** - Drag a bar to move it; drag either edge to resize
  start/end (snaps to whole days, persists via `dataSource.update`)
- **Task Dependencies** - Link tasks with dependencies
- **Timeline View** - Visualize project schedules
- **Task Management** - Create, edit, and track tasks
- **Responsive** - Scrollable timeline for large projects
- **Customizable** - Tailwind CSS styling support

### Create / Edit / Delete / View

When used through `ObjectGantt` (the wiring the framework uses for the
`gantt` view type) the full CRUD lifecycle is wired automatically:

- **Create** — click the toolbar "+ New Task" button. A small dialog opens
  pre-filled with start/end (today → +7 days). On submit the component calls
  `dataSource.create(objectName, { [titleField], [startDateField],
  [endDateField], …required fields })` and optimistically inserts the new
  record into the chart.
- **Edit** — drag the bar (move), drag an edge (resize), or hover the row
  and pick **Edit inline** from the kebab menu to rename / change dates
  inline. All paths funnel through `dataSource.update`.
- **Delete** — hover a row, open the kebab menu, choose **Delete**. A
  shadcn `<AlertDialog>` asks for confirmation; on confirm `dataSource.delete`
  removes the record (optimistic local removal, reverts on failure).
- **View / Edit / Delete in a side drawer** — click anywhere on a row
  (or pick **View details** in the kebab) to open a right-side drawer
  containing the standard `<DetailView>` from `@object-ui/plugin-detail`.
  The drawer ships the same record-header chrome used everywhere else
  (badges, summary chips, **Edit** + **Inline edit** buttons, and a
  **…** more-actions menu with **Delete**). Edits via inline-edit save
  through `dataSource.update` and merge into the local timeline state;
  delete confirms via the platform standard dialog and removes the row
  on success. Fields are auto-derived from the record (object schema is
  fetched by `DetailView` itself when `dataSource.getObjectSchema` is
  available).

  Override by setting `navigation` on the schema: set `{ "mode": "page" }` to
  route to the standalone detail page instead.

  ```json
  { "navigation": { "mode": "page" } }
  ```

  The destination route is **not** authorable here — `useNavigationOverlay`
  builds no URL out of this config, so page mode hands the record to the
  host's `onNavigate` / `onRowClick` and the host owns where it lands. To
  choose *which* detail view opens, use the declared `view` member (a
  form-view name, e.g. `"summary_view"`). `navigation` is the spec's
  `NavigationConfig`, and its schema refuses any key it does not declare: an
  undeclared key rejects the whole config, so the `mode` beside it never
  takes effect either. `@objectstack/spec`'s `NavigationConfigSchema` owns the
  member list.


### Drag-and-drop rescheduling

When the renderer is used through `ObjectGantt` (the standard wiring used by
the framework's `gantt` view type) drag is enabled automatically: each bar
shows a grab cursor; the body drags the entire task, and the two thin edge
zones (≈6px) resize start or end. Pointer motion snaps to whole days using
the current column width. On release `ObjectGantt` issues an optimistic local
patch and a `dataSource.update(objectName, recordId, { [startDateField]: …,
[endDateField]: … })`. If the request fails the local state is reverted.

When you embed the lower-level `<GanttView>` directly, pass `onTaskUpdate`
to opt in:

```tsx
<GanttView
  tasks={tasks}
  onTaskUpdate={(task, { start, end }) => {
    // `changes` is a Partial<Pick<GanttTask, 'title' | 'start' | 'end' | 'progress'>>:
    // only the keys the edit actually touched are present. A bar drag/resize
    // sends start + end, but the progress grip sends just { progress } — so
    // guard, or a progress drag writes both dates back as undefined.
    if (!start || !end) return;
    save(task.id, { start, end });
  }}
/>
```

## Installation

```bash
pnpm add @object-ui/plugin-gantt
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-gantt';

// Now you can use gantt types in your schemas.
// The gantt is RECORD-DRIVEN: it names a data source and the fields to read.
// It does not take a task array — see "Schema API" below.
const schema = {
  type: 'gantt',
  objectName: 'project_tasks',
  titleField: 'name',
  startDateField: 'start_date',
  endDateField: 'end_date',
  progressField: 'completion_percentage'
};
```

### What the side-effect import registers

Registration is *only* a side effect of importing the package — the single
`import '@object-ui/plugin-gantt'` above is the whole of it. There is no
components map to iterate over: importing the entry point runs the
`ComponentRegistry.register(...)` calls at the bottom of `src/index.tsx`, which
claim these schema types:

| Schema `type` | Namespaced key | Renderer |
| --- | --- | --- |
| `object-gantt` | `plugin-gantt:object-gantt` | `ObjectGanttRenderer` |
| `gantt` | `view:gantt` | `ObjectGanttRenderer` |

Both spellings resolve — `register` stores the namespaced key *and* a bare-`type`
fallback. Both keys declare the same two inputs: `objectName` (required) and the
`gantt` configuration object.

`ObjectGanttRenderer` is a thin wrapper: it pulls `dataSource` off the renderer
context and hands the schema to `ObjectGantt`.

### Public exports

The package exports components, helpers and their types — not a registry map:

```typescript
import {
  ObjectGantt, // ObjectQL-integrated gantt: loads records, writes back edits
  ObjectGanttRenderer, // the registered renderer for `object-gantt` / `gantt`
  GanttView, // the standalone timeline component
  QuickFilterBar, // the toolbar's quick-filter dropdowns
  ResourceWorkload, // resource × period workload grid
  normalizeDependencies, // raw dependency-field value -> GanttDependency[]
  normalizeTaskType, // raw type-field value -> GanttTaskType
  normalizeShiftSegments, // raw timeSegments config -> NormShiftSegments
  parseHHMM,
  shiftDayStart,
  bandAt,
  computeWorkload,
} from '@object-ui/plugin-gantt';

import type {
  ObjectGanttProps,
  GanttViewProps,
  GanttTask,
  GanttTaskType,
  GanttViewMode,
  GanttDependency,
  GanttDependencyObject,
  GanttLinkType,
  GanttMarker,
  QuickFilterDef,
  QuickFilterBarProps,
  QuickFilterField,
  QuickFilterOption,
  QuickFilterLabels,
  ShiftSegmentsConfig,
  ShiftBandConfig,
  NormShiftSegments,
  NormShiftBand,
  ResourceWorkloadProps,
  WorkloadColumn,
  WorkloadOptions,
  ResourceCell,
  ResourceLoad,
} from '@object-ui/plugin-gantt';
```

To serve the gantt under a registry key of your own, register the exported
renderer under that key:

```typescript
import { ComponentRegistry } from '@object-ui/core';
import { ObjectGanttRenderer } from '@object-ui/plugin-gantt';

ComponentRegistry.register('my-gantt', ObjectGanttRenderer, {
  namespace: 'my-app',
});
```

## Schema API

### Gantt Chart

The gantt node is **record-driven**: it names *where records come from* and
*which fields* carry the schedule. It does not carry a task array — the task
objects further down this page are the component's runtime shape, produced by
`ObjectGantt` from each record.

`ObjectGantt` decides what to render from exactly two reads
(`src/ObjectGantt.tsx`):

**1. Where the records come from — `getDataConfig`.** The first of these three
that is present wins; if none is present there is no data config at all and the
chart renders empty:

```typescript
{
  type: 'gantt',

  // Pick ONE of the three:
  objectName: 'project_tasks',                          // load through the host DataSource
  // data: { provider: 'value', items: [ /* records */ ] },  // inline records
  // staticData: [ /* records */ ],                          // shorthand for the above
}
```

`data` is the spec's `ViewData` union — `{ provider: 'object', object }`,
`{ provider: 'value', items }`, `{ provider: 'api', read, write }` or
`{ provider: 'schema', schemaId }`.

**2. How the fields map — `getGanttConfig`.** Two spellings, checked in order.
The **`gantt` block wins whenever it is present**, and it is taken WHOLE — the
flat top-level keys are not merged into it. The flat spelling is read only when
there is no `gantt` block, and then only when `startDateField` and
`endDateField` are both present. A node carrying both spellings renders the
block's values and gets a dev-mode warning naming the ignored top-level keys.

Precedence follows the maintainer ruling on objectui#5018 (2026-08-17), which
settled the identical two-faces shape for `plugin-map`; objectui#6469 inherited
it here. Before that flip the flat branch returned first, so an authored `gantt`
block was discarded silently.

```typescript
{
  type: 'gantt',
  objectName: 'project_tasks',

  // (a) flat spelling — read only when there is no `gantt` block,
  //     and then only with BOTH date fields present
  startDateField: 'start_date',
  endDateField: 'end_date',
  titleField: 'name',                 // defaults to 'name'
  progressField: 'completion_percentage',
  dependenciesField: 'dependent_task_ids',
  colorField: 'bar_color',
  parentField: 'parent_task',
  typeField: 'task_kind',
  viewMode: 'week',                   // 'day'|'week'|'month'|'quarter'|'year'

  // (b) …or the same configuration as one block, which OUTRANKS (a):
  // gantt: { startDateField: 'start_date', endDateField: 'end_date', … }
}
```

`viewMode` is real authoring surface (`ObjectGanttSchema`, derived from the
spec's `GanttConfigSchema.viewMode`) and is honoured by **both** renderer
branches — the timeline and the resource-workload grid. It reaches the renderer
through `getGanttConfig`, so it only takes effect alongside a taken gantt
config: as a top-level key it needs `startDateField` + `endDateField` beside it
and no `gantt` block on the node, or it can sit inside the `gantt` block.
Omitting it is meaningful — a persisted layout then seeds the granularity before
the renderer's `'day'` fallback.

#### Keys this page used to teach that the renderer never reads

Earlier revisions of this README showed a task-array schema. Those keys have no
read site anywhere in `src/` — a schema built from them renders an **empty
chart with no diagnostic**, because `type: 'gantt'` *is* a registered type, so
the node mounts and simply finds nothing to draw:

| Key shown before | Status | Use instead |
| --- | --- | --- |
| `tasks` | never read off the schema | `objectName` / `data` / `staticData` |
| `object` | never read | `objectName` |
| `nameField` | never read | `titleField` |
| `startField` | never read | `startDateField` |
| `endField` | never read | `endDateField` |
| `fields: { name, start, end, … }` | never read | the flat `*Field` keys, or the `gantt` block |
| `onTaskClick`, `onTaskUpdate` | never read *off the schema* | React props on `<ObjectGantt>` / `<GanttView>` — functions do not belong in serializable metadata |
| `className` | never read off the schema | a React prop on `<ObjectGantt>` |

Keys that **are** read but only through a cast, so they are easy to miss when
grepping — all of them genuine, all optional: `readOnly` (disables every edit
path — drag/resize/inline/delete/link/undo), `mobileReadOnly`, `markers`,
`navigation`, `skipWeekends`, `holidays`, `criticalPath`, `showBaselines`,
`persistLayout` / `viewName`, `label`.

#### Full field-mapping reference (`GanttConfig` members)

`titleField` / `startDateField` / `endDateField` are required; everything below
is optional. Set them INSIDE the `gantt` block — beside a `gantt` block a
top-level copy is ignored (with a dev-mode warning naming the losing keys).

| Key (under `gantt`) | Effect |
| --- | --- |
| `parentField` | Builds the summary tree: parents roll up their children's span and weighted progress. |
| `typeField` | Distinguishes `task` / `summary` (aliases `project`, `phase`) / `milestone` / `group` (alias `folder`). A `group` row renders as a **pure tree header with no timeline bar** — expandable like a summary but never scheduled, for grouping-only levels that have no dates of their own. `summary` still renders a bar-carrying rollup bracket. |
| `lockField` | Marks a row **view-only** when the field is truthy: no bar drag/resize, no progress drag, no dependency connector dot, and inline-edit plus context-menu edit/delete are hidden. Clicking still works (open drawer / jump). Independent of `readOnly`, so one level of a tree can be frozen while its siblings stay editable. |
| `defaultCollapsedDepth` | Auto-collapse every tree node at or below this 0-indexed depth that has children, on first render. Roots are depth 0; the user can still expand any of them, this only seeds the initial state. In a 4-level tree, `2` starts with every level-2 node (and its children) folded. Omit to start fully expanded. |
| `dependenciesField` | Draws the dependency arrows. Accepts CSV, an id array, or `[{ id, type: 'fs'\|'ss'\|'ff'\|'sf' }]`. Setting it also makes links **editable** unless `readOnly`: drag a bar's connector dot to create an FS link, right-click a link to switch its type or remove it, right-click a bar to add a predecessor or successor. Every change is written back to the field, which is auto-promoted to the `[{ id, type }]` form the moment a non-FS link is stored. |
| `tooltipFields` | The hover detail. Each entry is a field name or `{ field, label }`, formatted by field type. |
| `baselineStartField` / `baselineEndField` | Draw a thin planned-vs-actual baseline strip under each bar. |
| `groupByField` | Swimlane the rows by any field — a select/lookup label or a raw value; empty values fall into an "ungrouped" bucket. |
| `colorField` | Field whose value picks the bar colour. |
| `resourceView: true` | Render the **resource / workload view** instead of the task grid: one row per resource with a per-column load histogram. Requires `assigneeField` to bucket tasks. |
| `assigneeField` / `effortField` / `capacity` | Resource bucketing (required for `resourceView`), per-task workload weight (default `1`), and the per-resource capacity ceiling (default `1`). Any column whose summed load exceeds `capacity` is painted as over-allocated. |
| `quickFilters: [{ field, label?, options? }]` | Render a quick-filter bar above the grid — one multi-select dropdown per entry, narrowing the visible bars by that field (AND across dimensions). Option lists resolve in priority order: explicit `options` → the object schema's `select`/`enum` options (the full domain) → a `lookup` / `master_detail`'s referenced records (pulled in full through the data source, so values with **no** tasks still appear) → distinct values from the loaded data. Lookup values match on the embedded record id. Selecting every option of a dimension collapses to "no constraint". |
| `autoZoomToFilter` | When a quick filter narrows the set, re-derive the timeline range from the **remaining** tasks so the axis zooms to the filtered span (default `true`). Set `false` to pin the axis to the full task span, so bars keep their absolute position while filtering. |
| `viewMode` | Initial granularity, `'day'` (default) / `'week'` / `'month'` / `'quarter'` / `'year'`; the toolbar switches it live. `year` widens the axis to one column per year with a decade band above. |

With links present, dragging a bar into a position that violates a dependency
raises a reschedule confirmation: accepting runs a topological forward pass
(link-type aware; summaries stay fixed rollups) over the affected tasks,
declining keeps the manual placement. This is on by default whenever
`dependenciesField` is set, and suppressed under `readOnly`.

#### Node-level display and behaviour options

True siblings of `gantt` on the node itself, not `GanttConfig` members — they
apply with either spelling of the field mapping.

| Key (on the node) | Effect |
| --- | --- |
| `criticalPath: true` | Start with the critical-path (zero-slack chain) highlight on; the toolbar toggle stays available. |
| `showBaselines: false` | Hide the baseline strips even when baseline fields are mapped (default `true`). |
| `skipWeekends: true` | Working-calendar math: auto-schedule and critical path count working days only, and reschedules snap off Sat/Sun. In **day mode** this also folds weekend columns out of the timeline — Friday sits against Monday and a one-column drag advances one working day. Coarser scales stay linear. |
| `holidays: ["yyyy-mm-dd", …]` | Extra non-working days for the working calendar, combined with or instead of `skipWeekends`. In day mode these columns fold out of the axis too. |
| `markers: [{ date, label?, color? }]` | Extra vertical marker lines, like the Today line. |
| `persistLayout: false` | Disable layout persistence. By default the toolbar's save-layout button snapshots the current granularity, zoom and task-list collapse state to `localStorage` (key `gantt-layout:OBJECT:VIEW`) and restores it on the next load. |
| `readOnly: true` | **Disable every edit path** — no bar drag/resize/progress, no inline edit, no delete, no dependency-link drag, no reorder, no auto-schedule, and the Undo/Redo buttons are hidden. A read-only badge shows in the toolbar and the right-click menu drops to view-only (or is suppressed when nothing is actionable). Task click and granularity switching still work. Use it for dashboards and shared read-only views. |
| `mobileReadOnly: false` | On a narrow viewport (≤ 640 px) the chart auto-enters read-only, giving touch users a clean scrollable thumbnail — the same gating as `readOnly`, applied only while narrow. Enabled by default. |

The toolbar also carries **navigation** (jump-to-today / this-week / this-month
buttons that scroll the timeline to the start of that period) and **export**
(PNG, plus a dependency-free single-page PDF of the whole chart), always
available regardless of `readOnly`. Each task-list row carries a **locate** icon
by its End cell that smooth-scrolls the timeline to centre that row's bar and
pulses it — useful in deep or long trees.

#### A maximal node, for reference

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
      { "field": "status", "label": "Status" },
      { "field": "project", "label": "Project" },
      { "field": "priority", "label": "Priority", "options": ["high", "medium", "low"] }
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

### Task Structure

`GanttTask` is the **component's runtime** task — what `<GanttView>` renders and
what `ObjectGantt` produces from each record. Dates are real `Date` objects and
the label field is `title` (`src/GanttView.tsx`):

```typescript
interface GanttTask {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  progress: number;                  // 0-100
  dependencies?: GanttDependency[];  // predecessor id, optionally with a link type
  parent?: string | number | null;   // builds the hierarchy; unknown ids render as roots
  type?: GanttTaskType;              // 'task' | 'summary' | 'milestone' | 'group'
  color?: string;                    // bar fill — any CSS color, e.g. '#3b82f6'
  borderColor?: string;              // alert outline, fill untouched
  locked?: boolean;                  // view-only row (still clickable)
  baselineStart?: Date;              // planned-vs-actual reference bar
  baselineEnd?: Date;
  data?: any;                        // the source record behind the row
}
```

A few more optional fields (`fields` for tooltip rows, `hasOwnDates`) are
populated by `ObjectGantt` itself — see `GanttTask` in `src/GanttView.tsx` for
the full declaration.

## Examples

### Basic Gantt Chart

Inline records, no backend — `data.items` carries the records and the `*Field`
keys say which of their fields the chart reads. Note that the record field
names are yours; only the `*Field` keys are fixed vocabulary.

```typescript
const schema = {
  type: 'gantt',
  viewMode: 'week',
  startDateField: 'start',
  endDateField: 'end',
  titleField: 'name',
  progressField: 'progress',
  dependenciesField: 'dependencies',
  colorField: 'color',
  data: {
    provider: 'value',
    items: [
      {
        id: '1',
        name: 'Project Planning',
        start: '2024-01-01',
        end: '2024-01-07',
        progress: 100,
        // bar fill goes straight into an inline `backgroundColor` —
        // it must be a CSS color, NOT a Tailwind class
        color: '#3b82f6'
      },
      {
        id: '2',
        name: 'Design Phase',
        start: '2024-01-08',
        end: '2024-01-21',
        progress: 75,
        dependencies: ['1'],
        color: '#a855f7'
      },
      {
        id: '3',
        name: 'Development',
        start: '2024-01-22',
        end: '2024-02-15',
        progress: 30,
        dependencies: ['2'],
        color: '#22c55e'
      },
      {
        id: '4',
        name: 'Testing',
        start: '2024-02-16',
        end: '2024-02-28',
        progress: 0,
        dependencies: ['3'],
        color: '#f97316'
      }
    ]
  }
};
```

### Interactive Gantt

Callbacks are **not** schema keys — the schema is serializable metadata, and a
function cannot survive it. Through the registered `gantt` / `object-gantt`
types the whole CRUD lifecycle is already wired to the host `DataSource`
(create/edit/drag/delete/detail drawer), so there is usually nothing to pass.
When you render the component yourself, hand the callbacks in as React props:

```tsx
import { ObjectGantt } from '@object-ui/plugin-gantt';

<ObjectGantt
  schema={{
    type: 'gantt',
    objectName: 'project_tasks',
    startDateField: 'start_date',
    endDateField: 'end_date',
    titleField: 'name',
  }}
  dataSource={dataSource}
  onTaskClick={(record) => console.log('Task clicked:', record)}
/>
```

To turn editing off from the metadata instead, set `readOnly: true` on the
schema — that one *is* read.

### With ObjectQL Integration

```typescript
const schema = {
  type: 'object-gantt',
  objectName: 'project_tasks',
  titleField: 'name',
  startDateField: 'start_date',
  endDateField: 'end_date',
  progressField: 'completion_percentage',
  dependenciesField: 'dependent_task_ids'
};
```

## View Modes

The Gantt chart renders one timeline column per unit of the active scale:

- **day** - one column per day (weekday + weekend shading)
- **week** - one column per week (starting Monday)
- **month** - one column per calendar month
- **quarter** - one column per quarter (Q1–Q4)
- **year** - one column per year (decade band above)

A two-row header shows the grouping above the units (months above days/weeks,
years above months/quarters). The toolbar's segmented control switches scales
interactively (`onViewChange` notifies you), and the zoom buttons step the
column width — falling through to the next coarser/finer scale at the bounds.
Drag snapping follows the active scale: bars snap to days in day view, weeks
in week view, and whole calendar months/quarters (duration preserved) in the
coarse views.

### The toolbar period label and its steppers

The label between the `‹` / `›` buttons names the period **currently on screen**,
not the extent of the data: it reads the date at the left edge of the viewport
and snaps it to the same tier the band header groups by — a month under day and
week view, a year under month and quarter view, a decade under year view, and
the shift-day under shift-segmented day view. So the label and the band header
directly beneath it always name the same period, and the label moves as the
chart is scrolled.

`‹` / `›` step the visible window by one of those periods (one month in day and
week view, one year in month and quarter view, a decade in year view), clamped
to the ends of the timeline. They step the *label's* tier rather than a single
column, so one click always changes what the label says.

Set the initial scale with `viewMode`. It is read through the gantt config, so
it needs the field mapping beside it (or a `gantt` block of its own):

```typescript
const schema = {
  type: 'gantt',
  viewMode: 'month',
  objectName: 'project_tasks',
  startDateField: 'start_date',
  endDateField: 'end_date',
  titleField: 'name'
};
```

## Task Hierarchy, Summaries & Milestones

Give a task a `parent` (or configure `parentField` on the data-source schema)
to build a tree: child rows indent under their parent with expand/collapse
chevrons in the task list. Any task with children renders as a **summary**
bracket spanning its children's combined date range, with progress rolled up
as the duration-weighted average of its descendants — summaries are read-only,
their children drive them.

Zero-duration tasks (`end <= start`) — or tasks whose `type` is
`'milestone'` (via `typeField`: values like `milestone`, `summary`,
`project`, `group` are recognized) — render as diamond markers. Milestones
can be dragged to move but not resized; dependency arrows anchor at the
diamond center.

These are runtime `GanttTask` objects (what `<GanttView>` takes directly) —
dates are real `Date`s and the label field is `title`. Coming from records
instead, the same tree is configured with `parentField` / `typeField`.

```typescript
import type { GanttTask } from '@object-ui/plugin-gantt';

const tasks: GanttTask[] = [
  // summary (has children) — its span and progress are rolled up
  { id: 'phase1', title: 'Phase 1', start: new Date('2024-06-01'), end: new Date('2024-06-30'), progress: 0 },
  { id: 't1', title: 'Design', parent: 'phase1', start: new Date('2024-06-01'), end: new Date('2024-06-14'), progress: 80 },
  { id: 't2', title: 'Build', parent: 'phase1', start: new Date('2024-06-15'), end: new Date('2024-06-30'), progress: 20 },
  { id: 'launch', title: 'Launch', type: 'milestone', start: new Date('2024-07-01'), end: new Date('2024-07-01'), progress: 0 },
];
```

## Interactions

Beyond drag-to-reschedule, the timeline supports:

- **Progress drag** — hover a bar and drag the round grip at the progress
  boundary; the fill follows live and `onTaskUpdate(task, { progress })`
  commits on release (snapped to whole percent, clamped 0–100).
- **Hover tooltip** — bars, milestones and summaries show a tooltip with
  title, date range, duration and progress.
- **Context menu** — right-click a bar or list row for View details / Edit
  inline / Delete (items appear only when the matching callback is wired).
- **Keyboard navigation** — the chart body is focusable: ↑/↓ move the row
  selection, Enter opens the task, Delete deletes it, ←/→ collapse/expand
  summary rows. Rows carry `treeitem` roles with `aria-level`/`aria-selected`.
- **Drag-to-create dependency** — drag the connector dot on a bar's right
  edge onto another bar; a dashed rubber band previews the link and
  `onDependencyCreate(source, target, 'fs')` fires on drop. Through
  `ObjectGantt` the new predecessor is appended to the record's
  `dependenciesField`, preserving the field's original shape (CSV or array).
- **Row drag-to-reorder** — pass `onTaskReorder(task, before)` to enable
  HTML5 drag reordering in the task list (sibling-scoped; persistence is up
  to the host, e.g. via a sort field).

## Scale & Performance

Rows and timeline columns are **virtualized**: only what is in (or near) the
viewport renders, so the chart stays responsive with thousands of tasks and
multi-year day-scale ranges. No configuration needed — windowing follows the
scroll position automatically, and dependency arrows keep their absolute
positions while scrolling.

Two more chrome features ship with it:

- **Fullscreen** — the expand button in the toolbar puts the whole chart into
  native fullscreen (and back).
- **Custom markers** — vertical reference lines beyond the Today marker:

```tsx
<GanttView
  tasks={tasks}
  markers={[
    { date: '2026-07-01', label: 'Code freeze', color: '#ef4444' },
    { date: '2026-07-15', label: 'Release' }, // defaults to the primary theme color
  ]}
/>
```

Through the schema, pass the same array as `markers` on the gantt node.

## Task Dependencies

Link tasks to show dependencies:

```typescript
import type { GanttTask } from '@object-ui/plugin-gantt';

const tasks: GanttTask[] = [
  {
    id: 'task-1',
    title: 'Foundation',
    start: new Date('2024-01-01'),
    end: new Date('2024-01-10'),
    progress: 100
  },
  {
    id: 'task-2',
    title: 'Building',
    start: new Date('2024-01-11'),
    end: new Date('2024-01-25'),
    progress: 50,
    dependencies: ['task-1']  // Depends on task-1
  },
  {
    id: 'task-3',
    title: 'Finishing',
    start: new Date('2024-01-26'),
    end: new Date('2024-02-05'),
    progress: 0,
    dependencies: ['task-2']  // Depends on task-2
  }
];
```

Through a data source the same links come from `dependenciesField` on the
schema, and the tree/label fields from `parentField` / `titleField`.

Dependencies render as arrows from the predecessor bar to the dependent bar.
Arrows follow bars live while dragging, and hovering a bar highlights its links.

### Link Types

Each dependency entry is either a predecessor id (`'task-1'`) or an object with
an explicit link type:

```typescript
dependencies: [
  { id: 'task-1', type: 'fs' },  // finish-to-start (default)
  { id: 'task-2', type: 'ss' },  // start-to-start
  { id: 'task-3', type: 'ff' },  // finish-to-finish
  { id: 'task-4', type: 'sf' },  // start-to-finish
]
```

When records come from a data source (`dependenciesField`), the field value may
be a CSV string (`"task1, task2"`), an array of ids, or an array of objects —
`task`/`target`/`_id` are accepted as id aliases, and long-form type names like
`"finish_to_start"` / `"end-to-end"` map onto `fs`/`ss`/`ff`/`sf`.

## Integration with Data Sources

The adapter is **not** a schema key — it reaches the renderer through the
renderer context (or as an explicit `dataSource` prop), while the schema names
the object and the fields:

```tsx
import { createObjectStackAdapter } from '@object-ui/data-objectstack';
import { ObjectGantt } from '@object-ui/plugin-gantt';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

const schema = {
  type: 'object-gantt',
  objectName: 'tasks',
  titleField: 'task_name',
  startDateField: 'start_date',
  endDateField: 'end_date',
  progressField: 'progress_percent'
};

<ObjectGantt schema={schema} dataSource={dataSource} />
```

⚠️ A `dataSource` key **on the schema node** is a different thing with the same
name: it is the spec's `PageComponentSchema.dataSource` *binding* —
`{ object, view?, filter?, sort?, limit? }`, a declarative reference resolved
against the host — **not** an adapter instance. The renderer guards against the
confusion explicitly, so putting a live adapter there does not wire anything up.

## TypeScript Support

Two different vocabularies, two different packages — don't mix them up.

**The component's runtime types** come from this package. Use them when you
render `<GanttView>` (or `ObjectGantt`) yourself in React:

```typescript
import type { GanttTask, GanttViewProps } from '@object-ui/plugin-gantt';

const task: GanttTask = {
  id: '1',
  title: 'My Task',
  start: new Date('2024-01-01'),
  end: new Date('2024-01-10'),
  progress: 50,
  dependencies: [],
};

const props: GanttViewProps = {
  tasks: [task],
  viewMode: 'week',
};
```

**The authored (JSON metadata) types** live in `@object-ui/types` — this package
imports them and does not re-export them. There is no `GanttSchema`; the
component schema is `ObjectGanttSchema`, and it is **record-driven**: it names an
object and the fields to read, it does not carry a task array.

```typescript
import type { ObjectGanttSchema } from '@object-ui/types';

const gantt: ObjectGanttSchema = {
  type: 'object-gantt',
  objectName: 'project_tasks',
  titleField: 'name',
  startDateField: 'start_date',
  endDateField: 'end_date',
  progressField: 'completion_percentage',
  dependenciesField: 'dependent_task_ids',
};
```

`dependenciesField` (plural) is the spec's spelling and the one to author. The
singular `dependencyField` is a `@deprecated` legacy alias: `ObjectGantt` still
reads it (`dependenciesField || dependencyField`), so existing metadata keeps
working, but new metadata should not use it.

For a list view served under the `gantt` view type, the same configuration is a
`gantt` block on `ListViewSchema` (typed by `GanttConfig`, also from
`@object-ui/types`) rather than top-level keys — `ObjectGantt` reads either
spelling.

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-gantt)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-gantt)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
