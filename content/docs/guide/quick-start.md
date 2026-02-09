---
title: "Quick Start"
description: "Get up and running with ObjectUI in 5 minutes - install, configure, and render your first server-driven UI"
---

# Quick Start

Get up and running with ObjectUI in **5 minutes**. This guide walks you through installation, basic setup, and rendering your first server-driven UI.

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (recommended) or npm/yarn
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

Install Tailwind CSS (required for styling):

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
```

## Step 4: Register Components

Create `src/setup.ts` to register the built-in components:

```ts
import { Registry } from '@object-ui/core';
import { registerAllComponents } from '@object-ui/components';
import { registerAllFields } from '@object-ui/fields';

// Register the built-in component renderers
registerAllComponents(Registry);
registerAllFields(Registry);
```

## Step 5: Render Your First UI

Replace `src/App.tsx` with:

```tsx
import './setup';
import { SchemaRenderer } from '@object-ui/react';

// Define your UI as JSON schema
const schema = {
  type: 'form',
  fields: [
    {
      name: 'name',
      label: 'Full Name',
      type: 'string',
      required: true,
    },
    {
      name: 'email',
      label: 'Email Address',
      type: 'string',
      widget: 'email',
    },
    {
      name: 'role',
      label: 'Role',
      type: 'string',
      widget: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Viewer', value: 'viewer' },
      ],
    },
  ],
  submitLabel: 'Create User',
};

function App() {
  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">ObjectUI Demo</h1>
      <SchemaRenderer
        schema={schema}
        onSubmit={(data) => {
          console.log('Form submitted:', data);
          alert(JSON.stringify(data, null, 2));
        }}
      />
    </div>
  );
}

export default App;
```

## Step 6: Run the App

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) — you should see a fully functional form rendered from JSON!

## What Just Happened?

1. **JSON Schema** → You defined a form as a JSON object with fields, types, and labels
2. **Registry** → Built-in components were registered to handle each schema type
3. **SchemaRenderer** → Converted the JSON into interactive React components (Shadcn UI)
4. **Zero UI Code** → No JSX needed for the form fields — it's all driven by data

## Next Steps

### Add a Data Table

```tsx
const tableSchema = {
  type: 'crud',
  resource: 'users',
  columns: [
    { name: 'name', label: 'Name' },
    { name: 'email', label: 'Email' },
    { name: 'role', label: 'Role' },
  ],
};
```

### Add Internationalization

```bash
pnpm add @object-ui/i18n
```

```tsx
import { I18nProvider } from '@object-ui/i18n';

function App() {
  return (
    <I18nProvider config={{ defaultLanguage: 'zh' }}>
      <SchemaRenderer schema={schema} />
    </I18nProvider>
  );
}
```

### Use Lazy Loading for Plugins

```tsx
import { createLazyPlugin } from '@object-ui/react';

const ObjectGrid = createLazyPlugin(
  () => import('@object-ui/plugin-grid'),
  { fallback: <div>Loading grid...</div> }
);
```

### Learn More

- [Architecture Overview](/docs/guide/architecture) — Understand how ObjectUI works
- [Schema Rendering](/docs/guide/schema-rendering) — Deep dive into schema rendering
- [Component Registry](/docs/guide/component-registry) — Customize and extend components
- [Plugins](/docs/guide/plugins) — Add views like Grid, Kanban, Charts
- [Fields Guide](/docs/guide/fields) — All 30+ field types
