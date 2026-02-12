---
title: "Building a CRUD App"
description: "End-to-end tutorial for building a complete CRUD application with ObjectUI — from schema definition to deployment"
---

# Building a CRUD App

This tutorial walks you through building a **Task Manager** CRUD application with ObjectUI — from schema definition to data source setup to deployment.

## Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- Basic knowledge of **React** and **TypeScript**

## Step 1: Project Setup

Create a new React project and install the required ObjectUI packages:

```bash
pnpm create vite task-manager --template react-ts
cd task-manager
```

Install ObjectUI core packages and the plugins you need:

```bash
pnpm add @object-ui/react @object-ui/core @object-ui/types @object-ui/components @object-ui/fields
pnpm add @object-ui/plugin-grid @object-ui/plugin-form
```

Install Tailwind CSS:

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

Add Tailwind to your `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Add to your `src/index.css`:

```css
@import "tailwindcss";
```

## Step 2: Register Components

Create `src/setup.ts` to register the built-in component and field renderers:

```ts
import { Registry } from '@object-ui/core';
import { registerAllComponents } from '@object-ui/components';
import { registerAllFields } from '@object-ui/fields';

registerAllComponents(Registry);
registerAllFields(Registry);
```

Import this file once at the top of your app entry point (`src/main.tsx` or `src/App.tsx`).

## Step 3: Define the Object Schema

Create `src/schemas/task.ts`. This is the metadata that drives the entire UI — grid columns, form fields, validation, and views are all derived from this schema:

```ts
import { ObjectSchema, Field } from '@object-ui/types';

export const TaskSchema = ObjectSchema.create({
  name: 'task',
  label: 'Task',
  icon: 'check-circle-2',
  titleFormat: '{title}',
  fields: {
    title: Field.text({
      label: 'Title',
      required: true,
      searchable: true,
    }),
    status: Field.select(
      ['Backlog', 'Todo', 'In Progress', 'Review', 'Done'],
      { label: 'Status', defaultValue: 'Todo' }
    ),
    priority: Field.select(
      ['Critical', 'High', 'Medium', 'Low'],
      { label: 'Priority', defaultValue: 'Medium' }
    ),
    assignee: Field.text({ label: 'Assignee' }),
    due_date: Field.date({ label: 'Due Date' }),
    description: Field.textarea({ label: 'Description' }),
  },
  list_views: {
    all: {
      label: 'All Tasks',
      columns: ['title', 'status', 'priority', 'assignee', 'due_date'],
    },
    active: {
      label: 'Active',
      columns: ['title', 'status', 'priority', 'assignee', 'due_date'],
      filter: [['status', '!=', 'Done']],
      sort: [['priority', 'asc']],
    },
  },
});
```

Each `Field.*()` call produces a `FieldMetadata` entry that ObjectUI uses to choose the correct renderer, apply validation, and generate form controls automatically.

## Step 4: Create a Data Source

ObjectUI never hardcodes `fetch` calls inside components. Instead, it communicates with your backend through the `DataSource` interface. Create `src/data/rest-data-source.ts`:

```ts
import type { DataSource, QueryParams, QueryResult } from '@object-ui/types';

export class RestDataSource implements DataSource {
  constructor(private baseUrl: string) {}

  async find(resource: string, params?: QueryParams): Promise<QueryResult> {
    const query = new URLSearchParams();
    if (params?.$top) query.set('$top', String(params.$top));
    if (params?.$skip) query.set('$skip', String(params.$skip));
    if (params?.$orderby) query.set('$orderby', params.$orderby);
    if (params?.$search) query.set('$search', params.$search);
    const res = await fetch(`${this.baseUrl}/${resource}?${query}`);
    const data = await res.json();
    return { data: data.items, total: data.total };
  }

  async findOne(resource: string, id: string | number) {
    return (await fetch(`${this.baseUrl}/${resource}/${id}`)).json();
  }

  async create(resource: string, data: Partial<any>) {
    const res = await fetch(`${this.baseUrl}/${resource}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async update(resource: string, id: string | number, data: Partial<any>) {
    const res = await fetch(`${this.baseUrl}/${resource}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async delete(resource: string, id: string | number) {
    return (await fetch(`${this.baseUrl}/${resource}/${id}`, { method: 'DELETE' })).ok;
  }

  async getObjectSchema(objectName: string) {
    return (await fetch(`${this.baseUrl}/schema/${objectName}`)).json();
  }
}
```

> **Tip:** For the ObjectStack backend, use the official `@object-ui/data-objectstack` adapter instead of writing your own. See the [Data Connectivity](/docs/guide/data-source) guide for details.

## Step 5: Render a CRUD Grid View

Wire everything together in `src/App.tsx`. The `SchemaRenderer` takes your schema and data source and renders the appropriate view:

```tsx
import './setup';
import { SchemaRenderer } from '@object-ui/react';
import { TaskSchema } from './schemas/task';
import { RestDataSource } from './data/rest-data-source';

const dataSource = new RestDataSource('https://api.example.com/v1');

function App() {
  return (
    <div className="min-h-screen bg-background p-6">
      <SchemaRenderer
        schema={{
          type: 'ObjectGrid',
          object: 'task',
          view: 'all',
          data: { objectSchema: TaskSchema },
        }}
        dataSource={dataSource}
      />
    </div>
  );
}

export default App;
```

This renders a fully interactive data grid with sortable columns, pagination, and row actions — all driven by the `TaskSchema` you defined.

## Step 6: Add Create and Edit Forms

ObjectUI generates forms directly from your schema. Extend `App.tsx` with form state:

```tsx
const [showForm, setShowForm] = useState(false);
const [editId, setEditId] = useState<string | null>(null);
```

Add a "New Task" button and handle row clicks to open the edit form:

```tsx
<SchemaRenderer
  schema={{ type: 'ObjectGrid', object: 'task', view: 'all', data: { objectSchema: TaskSchema } }}
  dataSource={dataSource}
  onRowClick={(row: any) => { setEditId(row.id); setShowForm(true); }}
/>

{showForm && (
  <SchemaRenderer
    schema={{
      type: 'ObjectForm',
      object: 'task',
      mode: editId ? 'edit' : 'create',
      recordId: editId,
      data: { objectSchema: TaskSchema },
    }}
    dataSource={dataSource}
    onSubmit={() => setShowForm(false)}
    onCancel={() => setShowForm(false)}
  />
)}
```

The form automatically renders the correct field widgets (text inputs, select dropdowns, date pickers) based on your `FieldMetadata` definitions. Validation rules like `required` are enforced out of the box.

## Step 7: Add Filters and Search

Leverage the `active` list view you defined in Step 3, or add dynamic search:

```tsx
const [activeView, setActiveView] = useState('all');
const [searchQuery, setSearchQuery] = useState('');

// View switcher buttons
<button onClick={() => setActiveView('all')}>All Tasks</button>
<button onClick={() => setActiveView('active')}>Active</button>
<input
  placeholder="Search tasks..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>

// Grid responds to view and search changes
<SchemaRenderer
  schema={{
    type: 'ObjectGrid',
    object: 'task',
    view: activeView,
    data: {
      objectSchema: TaskSchema,
      queryParams: searchQuery ? { $search: searchQuery } : undefined,
    },
  }}
  dataSource={dataSource}
/>
```

The `filter` and `sort` arrays defined in the `active` list view are applied automatically when that view is selected. The `$search` query param is passed through to your `DataSource.find()` method.

## Step 8: Add a Detail View

Create a detail page that renders a single record with all its fields:

```tsx
function TaskDetail({ taskId, onBack }: { taskId: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-background p-6">
      <button onClick={onBack} className="mb-4 text-sm text-muted-foreground">
        ← Back to list
      </button>
      <SchemaRenderer
        schema={{
          type: 'ObjectDetail',
          object: 'task',
          recordId: taskId,
          data: { objectSchema: TaskSchema },
        }}
        dataSource={dataSource}
      />
    </div>
  );
}
```

Use this component in your main app with simple routing state, or integrate with a router like React Router or TanStack Router for URL-based navigation.

## Deployment Considerations

**Environment config** — Keep your API URL configurable:

```ts
const dataSource = new RestDataSource(
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
);
```

**Performance** — Use server-side pagination via `$top`/`$skip` query params. ObjectUI plugins support lazy loading via `LazyPluginLoader` from `@object-ui/react`. Set `cache: { enabled: true, ttl: 300 }` on your schema for client-side caching.

**Production build** — Run `pnpm build` and deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages).

**Authentication** — Extend `RestDataSource` to inject auth headers:

```ts
class AuthenticatedDataSource extends RestDataSource {
  constructor(baseUrl: string, private getToken: () => string) {
    super(baseUrl);
  }
  // Override fetch calls to include: Authorization: `Bearer ${this.getToken()}`
}
```

## Next Steps

- Explore the [Schema Overview](/docs/guide/schema-overview) for advanced schema features
- Add a Kanban board view using `@object-ui/plugin-kanban` (see the [Todo example](https://github.com/objectstack-ai/objectui/tree/main/examples/todo))
- Connect to a production backend with the [Data Connectivity](/docs/guide/data-source) guide
- Build multi-object apps with relationships (see the [CRM example](https://github.com/objectstack-ai/objectui/tree/main/examples/crm))
