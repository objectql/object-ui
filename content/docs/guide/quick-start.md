---
title: "Quick Start"
description: "Get up and running with ObjectUI in 5 minutes - install, configure, and render your first server-driven UI"
---

# Quick Start

Get up and running with ObjectUI in a small Vite app. This guide installs the core renderer, registers the built-in component packages, and renders a first JSON schema.

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ or npm/yarn
- Basic knowledge of **React** and **TypeScript**

## Step 1: Create a React Project

If you don't have an existing React project, create one with Vite:

```bash
pnpm create vite my-app --template react-ts
cd my-app
```

## Step 2: Install ObjectUI

Install the core ObjectUI packages:

```bash
pnpm add @object-ui/react @object-ui/core @object-ui/types @object-ui/components @object-ui/fields
```

Install Tailwind CSS for styling:

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

## Step 3: Configure Tailwind CSS

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
@import "@object-ui/components/style.css";
```

`style.css` is the stylesheet `@object-ui/components` compiled from its own sources, and it already carries every utility its components use — the themed ones (`bg-primary`, `border-input`) included. That is the whole styling setup: you do not add `@source` lines for the ObjectUI packages, and pointing Tailwind at them inside `node_modules` only regenerates utilities the import already gave you.

## Step 4: Render Your First Schema

Replace `src/App.tsx` with:

```tsx
import '@object-ui/components';
import '@object-ui/fields';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';

const schema = {
  type: 'card',
  title: 'Team Directory',
  description: 'Rendered from JSON metadata',
  className: 'mx-auto max-w-3xl',
  body: {
    type: 'data-table',
    caption: 'Users',
    columns: [
      { header: 'Name', accessorKey: 'name', sortable: true },
      { header: 'Email', accessorKey: 'email' },
      { header: 'Role', accessorKey: 'role' },
    ],
    data: [
      { name: 'Ada Lovelace', email: 'ada@example.com', role: 'Admin' },
      { name: 'Grace Hopper', email: 'grace@example.com', role: 'Editor' },
      { name: 'Katherine Johnson', email: 'katherine@example.com', role: 'Viewer' },
    ],
    pagination: false,
    searchable: false,
  },
} as const;

function App() {
  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <SchemaRendererProvider dataSource={{}}>
        <SchemaRenderer schema={schema} />
      </SchemaRendererProvider>
    </div>
  );
}

export default App;
```

Importing `@object-ui/components` and `@object-ui/fields` registers their renderers with the shared `ComponentRegistry`. `SchemaRendererProvider` supplies the data scope used by expressions, smart fields, and data-aware plugins.

## Step 5: Run the App

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). You should see a card and data table rendered from JSON.

## What Just Happened?

1. **Schema** - the UI was described as JSON with `type`, visual props, and nested `body`.
2. **Registry** - importing the component packages registered renderers for `card` and `data-table`.
3. **Renderer** - `SchemaRenderer` resolved each `type` and rendered React components.
4. **Provider** - `SchemaRendererProvider` made a data scope available for expressions and plugins.

## Next Steps

### Add Actions

Actions are data, not inline functions. Define them in schema events:

```json
{
  "type": "button",
  "label": "Open details",
  "events": {
    "onClick": [
      {
        "action": "navigate",
        "params": {
          "url": "/users/ada"
        }
      }
    ]
  }
}
```

Learn the full action model in [Enhanced Actions](/docs/core/enhanced-actions).

### Connect a Data Source

```bash
pnpm add @object-ui/data-objectstack
```

```tsx
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com'
});
```

Pass the adapter to `SchemaRendererProvider` and let data-aware renderers call the `DataSource` interface. See [Data Connectivity](/docs/guide/data-source).

### Learn More

- [Architecture Overview](/docs/guide/architecture) — Understand how ObjectUI works
- [Schema Rendering](/docs/guide/schema-rendering) — Deep dive into schema rendering
- [Component Registry](/docs/guide/component-registry) — Customize and extend components
- [Plugins](/docs/guide/plugins) — Add views like Grid, Kanban, Charts
- [Fields Guide](/docs/guide/fields) — Field widgets and cell renderers
