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

### Manual Registration

```typescript
import { ganttComponents } from '@object-ui/plugin-gantt';
import { ComponentRegistry } from '@object-ui/core';

// Register gantt components
Object.entries(ganttComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
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
  className?: string
}
```

### Task Structure

```typescript
interface GanttTask {
  id: string;
  name: string;
  start: string;                  // ISO date string
  end: string;                    // ISO date string
  progress: number;               // 0-100
  dependencies?: string[];         // Task IDs
  assignee?: string;
  color?: string;                 // Tailwind color class
}
```

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

The Gantt chart supports different time scales:

- **day** - Day-by-day view
- **week** - Week-by-week view
- **month** - Month-by-month view

```typescript
const schema = {
  type: 'gantt',
  viewMode: 'month',
  tasks: [/* tasks */]
};
```

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

```typescript
import type { GanttSchema, GanttTask } from '@object-ui/plugin-gantt';

const task: GanttTask = {
  id: '1',
  name: 'My Task',
  start: '2024-01-01',
  end: '2024-01-10',
  progress: 50,
  dependencies: []
};

const gantt: GanttSchema = {
  type: 'gantt',
  viewMode: 'week',
  tasks: [task]
};
```

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-gantt)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-gantt)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
