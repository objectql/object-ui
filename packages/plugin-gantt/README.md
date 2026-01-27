# @object-ui/plugin-gantt

Gantt chart plugin for Object UI - Visualize project timelines and task dependencies.

## Features

- **Gantt Charts** - Interactive Gantt chart visualization
- **Task Dependencies** - Link tasks with dependencies
- **Timeline View** - Visualize project schedules
- **Task Management** - Create, edit, and track tasks
- **Responsive** - Scrollable timeline for large projects
- **Customizable** - Tailwind CSS styling support

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

## License

MIT
