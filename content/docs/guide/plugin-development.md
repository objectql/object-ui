---
title: "Custom Plugin Development"
---

This guide walks you through creating custom ObjectUI plugins — from scaffolding to publishing. Plugins extend ObjectUI with new view types, field widgets, or complex interactive components while keeping your application bundle lean through lazy loading.

## What Is an ObjectUI Plugin?

A plugin is a self-contained package that registers one or more components into the [Component Registry](./component-registry.md). When a JSON schema references a plugin's component type, the renderer resolves and renders it automatically.

Plugins differ from regular components in two ways:

- **Lazy-loaded** — heavy dependencies are code-split and fetched on demand.
- **Self-registering** — importing the package is enough; no manual wiring required.

Official plugins (`@object-ui/plugin-grid`, `@object-ui/plugin-kanban`, `@object-ui/plugin-charts`, etc.) all follow this pattern, and your custom plugins should too.

## Plugin Anatomy

Every plugin has three key parts:

```
packages/plugin-board/
├── src/
│   ├── index.tsx          # Entry point: lazy wrapper + ComponentRegistry.register()
│   ├── BoardImpl.tsx      # Heavy implementation (imported lazily)
│   ├── BoardImpl.test.tsx # Tests
│   └── types.ts           # TypeScript interfaces & schema types
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

| File | Role |
|------|------|
| `index.tsx` | Lightweight entry — sets up `React.lazy()`, `Suspense` fallback, and calls `ComponentRegistry.register()`. |
| `BoardImpl.tsx` | The actual renderer. All heavy dependencies live here so they are tree-shaken from the initial bundle. |
| `types.ts` | Schema interfaces extending `BaseSchema` from `@object-ui/types`. |

## Scaffolding With the CLI

The fastest way to start is the `create-plugin` generator:

```bash
npx @object-ui/create-plugin board --description "Kanban-style board view"

# Or with pnpm / npm create aliases:
pnpm create @object-ui/plugin board
npm create @object-ui/plugin board
```

This produces a ready-to-build plugin under `packages/plugin-board/` with the correct `package.json`, Vite config, test file, and registry call already in place.

After scaffolding, install dependencies:

```bash
pnpm install
```

## Implementing a Custom View Plugin

Let's build a **board** view plugin that renders items in columns (similar to a Kanban but simplified).

### 1. Define the Schema Types

```typescript
// src/types.ts
import type { BaseSchema } from '@object-ui/types';

export interface BoardColumn {
  id: string;
  title: string;
}

export interface BoardItem {
  id: string;
  columnId: string;
  title: string;
  description?: string;
}

export interface BoardSchema extends BaseSchema {
  type: 'board';
  columns: BoardColumn[];
  items: BoardItem[];
  onItemMove?: (itemId: string, toColumnId: string) => void;
}

export interface BoardProps {
  schema: BoardSchema;
  className?: string;
}
```

### 2. Build the Implementation

```tsx
// src/BoardImpl.tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@object-ui/components';
import { cn } from '@object-ui/components';
import type { BoardProps } from './types';

export default function BoardImpl({ schema, className }: BoardProps) {
  const { columns, items } = schema;

  return (
    <div className={cn('grid gap-4', className)} style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
      {columns.map((col) => (
        <div key={col.id} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{col.title}</h3>
          {items
            .filter((item) => item.columnId === col.id)
            .map((item) => (
              <Card key={item.id}>
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                </CardHeader>
                {item.description && (
                  <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                    {item.description}
                  </CardContent>
                )}
              </Card>
            ))}
        </div>
      ))}
    </div>
  );
}
```

### 3. Create the Entry Point

```tsx
// src/index.tsx
import React, { Suspense } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { Skeleton } from '@object-ui/components';

const LazyBoard = React.lazy(() => import('./BoardImpl'));

export const BoardRenderer: React.FC<{ schema: any; [key: string]: any }> = ({
  schema,
  ...props
}) => (
  <Suspense fallback={<Skeleton className="w-full h-[300px]" />}>
    <LazyBoard schema={schema} {...props} />
  </Suspense>
);

// Auto-register on import
ComponentRegistry.register('board', BoardRenderer, {
  namespace: 'plugin-board',
  label: 'Board View',
  category: 'plugin',
  inputs: [
    { name: 'columns', type: 'array', label: 'Columns', required: true },
    { name: 'items', type: 'array', label: 'Items', required: true },
  ],
  defaultProps: {
    columns: [
      { id: 'todo', title: 'To Do' },
      { id: 'done', title: 'Done' },
    ],
    items: [],
  },
});

export { default as BoardImpl } from './BoardImpl';
export type { BoardSchema, BoardProps, BoardColumn, BoardItem } from './types';
```

Now any schema with `"type": "board"` will resolve to your component.

## Implementing a Custom Field Widget

Field widgets follow the `FieldWidgetProps` interface from `@object-ui/fields`.

```typescript
// FieldWidgetProps<T> shape (from packages/fields/src/widgets/types.ts)
type FieldWidgetProps<T = any> = {
  value: T;
  onChange: (val: T) => void;
  field: FieldMetadata;
  readonly?: boolean;
  disabled?: boolean;
  className?: string;
  errorMessage?: string;
};
```

### Example: Color Picker Field

```tsx
// src/ColorPickerField.tsx
import React from 'react';
import { Input } from '@object-ui/components';
import type { FieldWidgetProps } from '@object-ui/fields';

export function ColorPickerField({
  value,
  onChange,
  field,
  readonly,
  disabled,
  errorMessage,
}: FieldWidgetProps<string>) {
  if (readonly) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-4 w-4 rounded-full border"
          style={{ backgroundColor: value || '#000' }}
        />
        <span className="text-sm">{value || '—'}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-8 w-8 cursor-pointer rounded border-0 p-0"
        />
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field?.placeholder || '#000000'}
          disabled={disabled}
          className="font-mono text-sm"
        />
      </div>
      {errorMessage && (
        <span className="text-xs text-destructive">{errorMessage}</span>
      )}
    </div>
  );
}
```

Register it as a field widget:

```tsx
// src/index.tsx
import { ComponentRegistry } from '@object-ui/core';
import { ColorPickerField } from './ColorPickerField';

ComponentRegistry.register('field-color', ColorPickerField, {
  namespace: 'plugin-board',
  label: 'Color Picker',
  category: 'field',
  inputs: [
    { name: 'value', type: 'string', label: 'Value' },
    { name: 'placeholder', type: 'string', label: 'Placeholder' },
  ],
});

export { ColorPickerField };
```

## Using the ComponentRegistry

### Namespaced Registration

Namespaces prevent type collisions between plugins:

```tsx
import { ComponentRegistry } from '@object-ui/core';

// Register with a namespace — accessible as 'plugin-board:board' AND 'board'
ComponentRegistry.register('board', BoardRenderer, {
  namespace: 'plugin-board',
});

// Explicit lookup by namespace
ComponentRegistry.get('board', 'plugin-board');

// Fallback lookup (works when the type is unambiguous)
ComponentRegistry.get('board');
```

Use `skipFallback: true` in the metadata if you do **not** want the component to be available without a namespace prefix.

### Querying Registered Components

```tsx
ComponentRegistry.has('board');                              // boolean
ComponentRegistry.getAllTypes();                              // string[]
ComponentRegistry.getNamespaceComponents('plugin-board');     // ComponentConfig[]
```

## Plugin Configuration & Schema Types

Define your schema interface in `types.ts` and extend `BaseSchema`:

```typescript
import type { BaseSchema } from '@object-ui/types';

export interface BoardSchema extends BaseSchema {
  type: 'board';
  columns: BoardColumn[];
  items: BoardItem[];
}
```

Declare `ComponentInput` entries when registering so the visual designer can offer a property panel:

```tsx
ComponentRegistry.register('board', BoardRenderer, {
  inputs: [
    { name: 'columns', type: 'array', label: 'Columns', required: true },
    { name: 'items', type: 'array', label: 'Items', required: true },
    {
      name: 'layout',
      type: 'enum',
      label: 'Layout',
      enum: ['horizontal', 'vertical'],
      defaultValue: 'horizontal',
    },
  ],
});
```

## Testing Plugins

ObjectUI uses **Vitest + React Testing Library**. Place tests next to the implementation.

```tsx
// src/BoardImpl.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BoardImpl from './BoardImpl';

const schema = {
  type: 'board' as const,
  columns: [
    { id: 'todo', title: 'To Do' },
    { id: 'done', title: 'Done' },
  ],
  items: [
    { id: '1', columnId: 'todo', title: 'Write tests' },
    { id: '2', columnId: 'done', title: 'Ship plugin' },
  ],
};

describe('BoardImpl', () => {
  it('renders all columns', () => {
    render(<BoardImpl schema={schema} />);
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders items in correct columns', () => {
    render(<BoardImpl schema={schema} />);
    expect(screen.getByText('Write tests')).toBeInTheDocument();
    expect(screen.getByText('Ship plugin')).toBeInTheDocument();
  });

  it('handles empty items gracefully', () => {
    render(<BoardImpl schema={{ ...schema, items: [] }} />);
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });
});
```

Run tests:

```bash
pnpm vitest run packages/plugin-board
```

## Adding Storybook Stories

Create a story for visual testing and documentation:

```tsx
// src/BoardImpl.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import BoardImpl from './BoardImpl';

const meta: Meta<typeof BoardImpl> = {
  title: 'Plugins/Board',
  component: BoardImpl,
};

export default meta;
type Story = StoryObj<typeof BoardImpl>;

export const Default: Story = {
  args: {
    schema: {
      type: 'board',
      columns: [
        { id: 'backlog', title: 'Backlog' },
        { id: 'in-progress', title: 'In Progress' },
        { id: 'done', title: 'Done' },
      ],
      items: [
        { id: '1', columnId: 'backlog', title: 'Research', description: 'Investigate options' },
        { id: '2', columnId: 'in-progress', title: 'Prototype' },
        { id: '3', columnId: 'done', title: 'Setup repo' },
      ],
    },
  },
};

export const Empty: Story = {
  args: {
    schema: {
      type: 'board',
      columns: [{ id: 'todo', title: 'To Do' }],
      items: [],
    },
  },
};
```

## Publishing Guidelines

### Package Checklist

Before publishing, verify:

- [ ] `package.json` has correct `name`, `version`, `exports`, and `peerDependencies`.
- [ ] `react` and `react-dom` are **peer** dependencies, not direct dependencies.
- [ ] `@object-ui/core` and `@object-ui/components` are in `devDependencies` (or `peerDependencies`).
- [ ] `vite.config.ts` marks React and ObjectUI packages as **external**.
- [ ] Types are exported via `"types"` field in `package.json`.
- [ ] All tests pass (`pnpm vitest run`).
- [ ] The entry point is lightweight — heavy code lives in `*Impl.tsx` files.

### Build & Verify

```bash
pnpm build --filter @object-ui/plugin-board
ls -lh packages/plugin-board/dist/
```

The entry chunk should be under 1 KB; the lazy chunk carries the bulk.

### Publish

```bash
cd packages/plugin-board
npm publish --access public
```

### Consumers Install & Use

```bash
pnpm add @object-ui/plugin-board
```

```tsx
// app/main.tsx — import once, auto-registers
import '@object-ui/plugin-board';
```

```json
{
  "type": "board",
  "columns": [
    { "id": "todo", "title": "To Do" },
    { "id": "done", "title": "Done" }
  ],
  "items": [
    { "id": "1", "columnId": "todo", "title": "Write docs" }
  ]
}
```

## Related Documentation

- [Component Registry](./component-registry.md) — registry internals and advanced usage
- [Plugins Overview](./plugins.md) — official plugin catalog
- [Schema Rendering](./schema-rendering.md) — how schemas become UI
- [Fields Guide](./fields.md) — built-in field widgets and `FieldWidgetProps`
