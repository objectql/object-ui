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

  Override by setting `navigation` on the schema, e.g.
  `{ mode: 'page', basePath: '/console/apps/.../campaign' }` to route
  to the standalone detail page instead.


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
    // start/end are JS Date objects already snapped to whole days,
    // and the resize-left/right cases clamp so end - start >= 1 day.
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

// Now you can use gantt types in your schemas
const schema = {
  type: 'gantt',
  tasks: [
    {
      id: '1',
      name: 'Project Setup',
      start: '2024-01-01',
      end: '2024-01-05',
      progress: 100
    }
  ]
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

Display project timeline with tasks:

```typescript
{
  type: 'gantt',
  tasks: GanttTask[],
  viewMode?: 'day' | 'week' | 'month',
  onTaskClick?: (task) => void,
  onTaskUpdate?: (task) => void,
  readOnly?: boolean,          // disable all editing (drag/resize/inline/delete/link/undo)
  className?: string
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

```typescript
const schema = {
  type: 'gantt',
  viewMode: 'week',
  tasks: [
    {
      id: '1',
      name: 'Project Planning',
      start: '2024-01-01',
      end: '2024-01-07',
      progress: 100,
      color: 'bg-blue-500'
    },
    {
      id: '2',
      name: 'Design Phase',
      start: '2024-01-08',
      end: '2024-01-21',
      progress: 75,
      dependencies: ['1'],
      color: 'bg-purple-500'
    },
    {
      id: '3',
      name: 'Development',
      start: '2024-01-22',
      end: '2024-02-15',
      progress: 30,
      dependencies: ['2'],
      color: 'bg-green-500'
    },
    {
      id: '4',
      name: 'Testing',
      start: '2024-02-16',
      end: '2024-02-28',
      progress: 0,
      dependencies: ['3'],
      color: 'bg-orange-500'
    }
  ]
};
```

### Interactive Gantt

```typescript
const schema = {
  type: 'gantt',
  tasks: [/* tasks */],
  onTaskClick: (task) => {
    console.log('Task clicked:', task);
    // Show task details
  },
  onTaskUpdate: (updatedTask) => {
    console.log('Task updated:', updatedTask);
    // Save changes to backend
  }
};
```

### With ObjectQL Integration

```typescript
const schema = {
  type: 'object-gantt',
  object: 'project_tasks',
  nameField: 'name',
  startField: 'start_date',
  endField: 'end_date',
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

A two-row header shows the grouping above the units (months above days/weeks,
years above months/quarters). The toolbar's segmented control switches scales
interactively (`onViewChange` notifies you), and the zoom buttons step the
column width — falling through to the next coarser/finer scale at the bounds.
Drag snapping follows the active scale: bars snap to days in day view, weeks
in week view, and whole calendar months/quarters (duration preserved) in the
coarse views.

```typescript
const schema = {
  type: 'gantt',
  viewMode: 'month',
  tasks: [/* tasks */]
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

```typescript
const tasks = [
  { id: 'phase1', title: 'Phase 1', start: '…', end: '…', progress: 0 },        // summary (has children)
  { id: 't1', title: 'Design', parent: 'phase1', start: '…', end: '…', progress: 80 },
  { id: 't2', title: 'Build', parent: 'phase1', start: '…', end: '…', progress: 20 },
  { id: 'launch', title: 'Launch', type: 'milestone', start: '2024-07-01', end: '2024-07-01', progress: 0 },
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
const tasks = [
  {
    id: 'task-1',
    name: 'Foundation',
    start: '2024-01-01',
    end: '2024-01-10',
    progress: 100
  },
  {
    id: 'task-2',
    name: 'Building',
    start: '2024-01-11',
    end: '2024-01-25',
    progress: 50,
    dependencies: ['task-1']  // Depends on task-1
  },
  {
    id: 'task-3',
    name: 'Finishing',
    start: '2024-01-26',
    end: '2024-02-05',
    progress: 0,
    dependencies: ['task-2']  // Depends on task-2
  }
];
```

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

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

const schema = {
  type: 'object-gantt',
  dataSource,
  object: 'tasks',
  fields: {
    name: 'task_name',
    start: 'start_date',
    end: 'end_date',
    progress: 'progress_percent'
  }
};
```

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
  dependencyField: 'dependent_task_ids',
};
```

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
