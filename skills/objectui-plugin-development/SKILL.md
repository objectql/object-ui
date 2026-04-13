---
name: objectui-plugin-development
description: Create, register, and publish custom Object UI plugins. Use this skill when the user wants to build a new plugin for Object UI, register custom components in ComponentRegistry, implement field widgets with FieldWidgetProps, create Storybook stories for plugins, scaffold a plugin package with create-plugin, or extend the Object UI renderer with custom component types. Also applies when the user asks about component registration, plugin architecture, namespace conflicts, or how to package heavy third-party dependencies (maps, charts, editors) as Object UI plugins.
---

# ObjectUI Plugin Development

Use this skill to build custom plugins that extend Object UI's rendering capabilities. Plugins are the extension mechanism for adding heavy or specialized components (grids, charts, maps, editors, kanbans) to the schema-driven UI engine.

## When to create a plugin vs. a component

**Use `@object-ui/components` (atoms)** for lightweight Shadcn wrappers: Button, Badge, Card, Input. Zero heavy dependencies.

**Use `@object-ui/fields`** for form input renderers that implement `FieldWidgetProps`.

**Create a `@object-ui/plugin-*`** when:
- The widget has heavy third-party deps (>50KB): DnD kit, chart libraries, map SDKs, rich editors
- It's a complex composite view: grid with virtual scrolling, kanban board, calendar
- It needs plugin-scoped state or lazy loading
- It should be tree-shakeable / independently installable

## Scaffolding a new plugin

Use the create-plugin CLI to generate the full structure:

```bash
pnpm create-plugin my-widget
```

This generates:

```
packages/plugin-my-widget/
├── src/
│   ├── index.tsx                 # Entry: exports + ComponentRegistry registration
│   ├── MyWidgetImpl.tsx          # Component implementation
│   ├── MyWidgetImpl.test.tsx     # Vitest tests
│   ├── MyWidget.stories.tsx      # Storybook stories
│   └── types.ts                  # Schema type definitions
├── package.json                  # Dependencies, exports config
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # ESM + UMD build
└── README.md
```

## ComponentRegistry API

The registry maps JSON `type` strings to React component implementations.

### Registering a component

```typescript
import { ComponentRegistry } from '@object-ui/core';

ComponentRegistry.register('my-widget', MyWidgetRenderer, {
  namespace: 'plugin-my-widget',   // Registers as "plugin-my-widget:my-widget"
  label: 'My Widget',              // Display name in designer
  icon: 'layout-grid',            // Lucide icon name
  category: 'plugin',             // Grouping: 'plugin' | 'view' | 'field' | 'layout'
  isContainer: false,              // Accepts child components?
  inputs: [                        // Designer configuration inputs
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'columns', type: 'array', label: 'Columns', required: true },
    { name: 'mode', type: 'enum', label: 'Mode', enum: ['compact', 'full'] },
  ],
  defaultProps: { mode: 'full' },  // Defaults when dropped in designer
});
```

### ComponentMeta options (full reference)

| Option | Type | Description |
|--------|------|-------------|
| `namespace` | `string` | Plugin namespace. Registers as `namespace:type` |
| `label` | `string` | Display name for designer UI |
| `icon` | `string` | Lucide icon name |
| `category` | `string` | Grouping category |
| `skipFallback` | `boolean` | Don't register non-namespaced fallback (prevents overwrites) |
| `inputs` | `ComponentInput[]` | Schema inputs for designer |
| `defaultProps` | `Record<string, any>` | Default properties |
| `defaultChildren` | `SchemaNode[]` | Default child schema |
| `isContainer` | `boolean` | Accepts child components |
| `resizable` | `boolean` | Designer allows resizing |
| `resizeConstraints` | `object` | Min/max width/height |

### ComponentInput types

```typescript
type ComponentInput = {
  name: string;          // Maps to component prop
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object'
       | 'color' | 'date' | 'code' | 'file' | 'slot';
  label?: string;
  defaultValue?: any;
  required?: boolean;
  enum?: string[] | Array<{ label: string; value: string }>;
  description?: string;
  advanced?: boolean;    // Hide by default in designer
};
```

### Looking up components

```typescript
// By type (searches all namespaces)
const Component = ComponentRegistry.get('my-widget');

// By type + explicit namespace
const Component = ComponentRegistry.get('my-widget', 'plugin-my-widget');

// By full qualified name
const Component = ComponentRegistry.get('plugin-my-widget:my-widget');

// Query all
const allTypes = ComponentRegistry.getAllTypes();
const allConfigs = ComponentRegistry.getAllConfigs();
const pluginComponents = ComponentRegistry.getNamespaceComponents('plugin-my-widget');
```

### Namespace system

When registering with a namespace:
1. Component stored as `plugin-my-widget:my-widget` (full key)
2. Also stored as `my-widget` (fallback for backward compatibility)
3. If `skipFallback: true`, only the namespaced key is registered

**Use `skipFallback: true`** when multiple plugins register the same base type (e.g., both `plugin-form` and `plugin-grid` registering `'form'`).

## Implementing a plugin component

### Entry point pattern (`index.tsx`)

```typescript
import React, { Suspense } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { Skeleton } from '@object-ui/components';

// Export types
export type { MyWidgetSchema, MyWidgetProps } from './types';

// Export component for direct usage
export { MyWidget } from './MyWidgetImpl';

// Lazy load for schema-driven rendering (keeps bundle small for non-users)
const LazyMyWidget = React.lazy(() => import('./MyWidgetImpl'));

// Renderer wrapper for SchemaRenderer
const MyWidgetRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <LazyMyWidget {...schema} {...schema.props} />
    </Suspense>
  );
};

// Register in ComponentRegistry
ComponentRegistry.register('my-widget', MyWidgetRenderer, {
  namespace: 'plugin-my-widget',
  label: 'My Widget',
  category: 'plugin',
  inputs: [
    { name: 'title', type: 'string', label: 'Title' },
  ],
});
```

### Component implementation pattern

```typescript
// MyWidgetImpl.tsx
import React from 'react';
import { cn } from '@object-ui/components';
import { useDataScope } from '@object-ui/react';
import type { MyWidgetProps } from './types';

export function MyWidget({
  title,
  columns,
  className,
  bind,
  ...props
}: MyWidgetProps) {
  // Get data from schema's `bind` path
  const data = useDataScope(bind);

  return (
    <div className={cn('rounded-lg border p-4', className)}>
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      {/* Widget rendering logic */}
    </div>
  );
}

export default MyWidget;
```

### Type definitions

```typescript
// types.ts
export interface MyWidgetSchema {
  type: 'my-widget';
  id?: string;
  className?: string;
  bind?: string;
  props?: MyWidgetProps;
  hidden?: string;
  disabled?: string;
}

export interface MyWidgetProps {
  title?: string;
  columns?: ColumnDef[];
  className?: string;
  [key: string]: any;
}
```

## Implementing field widgets

Field widgets are simpler plugins that render form inputs. They implement `FieldWidgetProps`:

```typescript
import { type FieldWidgetProps } from '@object-ui/fields';
import { Input } from '@object-ui/components';

export function ColorField({
  value,
  onChange,
  field,
  readonly,
  disabled,
  className,
  errorMessage,
}: FieldWidgetProps<string>) {
  return (
    <div className={cn('space-y-1', className)}>
      <Input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        disabled={readonly || disabled}
      />
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
```

### FieldWidgetProps interface

```typescript
type FieldWidgetProps<T = any> = {
  value: T;                     // Current field value
  onChange: (val: T) => void;   // Value change callback
  field: FieldMetadata;         // Field metadata (name, label, type, etc.)
  readonly?: boolean;           // Read-only mode
  disabled?: boolean;           // HTML disabled state
  className?: string;           // Tailwind CSS classes
  errorMessage?: string;        // Validation error
  [key: string]: any;           // Additional forwarded props
};
```

## Storybook stories

### Basic story pattern

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { MyWidget } from './MyWidgetImpl';

const meta = {
  title: 'Plugins/MyWidget',
  component: MyWidget,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof MyWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'My Widget',
    columns: [{ name: 'id', label: 'ID' }],
  },
};
```

### Schema-driven story pattern (for plugins that render via SchemaRenderer)

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import { createStorybookDataSource } from '@storybook-config/datasource';

const meta = {
  title: 'Plugins/MyWidget',
  component: SchemaRenderer,
  tags: ['autodocs'],
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const dataSource = createStorybookDataSource();

export const Default: Story = {
  render: (args) => (
    <SchemaRendererProvider dataSource={dataSource}>
      <SchemaRenderer schema={args as any} />
    </SchemaRendererProvider>
  ),
  args: {
    type: 'my-widget',
    props: { title: 'Demo Widget' },
  },
};
```

## Package configuration

### package.json essentials

```json
{
  "name": "@object-ui/plugin-my-widget",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "dependencies": {
    "@object-ui/components": "workspace:*",
    "@object-ui/core": "workspace:*",
    "@object-ui/react": "workspace:*",
    "@object-ui/types": "workspace:*",
    "lucide-react": "^0.400.0"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  }
}
```

### tsconfig.json

```json
{
  "extends": "../../tsconfig.react.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx", "**/*.stories.tsx"]
}
```

## Registration patterns from existing plugins

### Multiple type registrations (plugin-form pattern)

```typescript
// Register primary type
ComponentRegistry.register('object-form', FormRenderer, {
  namespace: 'plugin-form',
  label: 'Object Form',
  category: 'plugin',
});

// Register semantic alias
ComponentRegistry.register('form', FormRenderer, {
  namespace: 'view',
  skipFallback: true,  // Don't overwrite other 'form' registrations
});

// Register variant
ComponentRegistry.register('embeddable-form', EmbeddableFormRenderer, {
  namespace: 'plugin-form',
  label: 'Embeddable Form',
  category: 'plugin',
});
```

### Data-driven component with `useDataScope` (plugin-kanban pattern)

```typescript
const KanbanRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  const boundData = useDataScope(schema.bind);

  // Transform flat data + groupBy into column structure
  const columns = transformToColumns(boundData, schema.props?.groupBy);

  return <ObjectKanban columns={columns} {...schema.props} />;
};
```

## Testing patterns

### Registration test

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

describe('plugin-my-widget registration', () => {
  beforeAll(async () => {
    await import('./index');
  });

  it('registers my-widget component', () => {
    expect(ComponentRegistry.has('my-widget')).toBe(true);
  });

  it('has correct metadata', () => {
    const config = ComponentRegistry.getConfig('my-widget');
    expect(config?.meta?.label).toBe('My Widget');
    expect(config?.meta?.category).toBe('plugin');
  });
});
```

## Common mistakes

- Forgetting to export the component as `default` for `React.lazy()` dynamic imports.
- Registering without a namespace, causing collisions with other plugins.
- Importing heavy dependencies at the top level instead of using `React.lazy()`.
- Not including `@object-ui/core` in dependencies (needed for `ComponentRegistry`).
- Putting business logic in the renderer — keep renderers thin, delegate to the implementation component.
- Using `any` for schema types — define proper TypeScript interfaces in `types.ts`.
