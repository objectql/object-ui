---
title: "Architecture Overview"
description: "Understanding ObjectUI's architecture, design principles, and how the pieces fit together"
---

# Architecture Overview

ObjectUI is a universal, server-driven UI (SDUI) engine built on React, Tailwind CSS, and Shadcn UI. This guide explains the core architecture and how all the pieces work together.

## Core Philosophy

ObjectUI follows three fundamental principles:

1. **JSON-First**: Every UI element is described as JSON metadata, not hardcoded React components
2. **Backend Agnostic**: Works with any backend system (ObjectStack, custom APIs, etc.)
3. **Component Library Quality**: Combines low-code speed with Shadcn/Tailwind design quality

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│         JSON Schema (Protocol)              │  ← Backend sends this
├─────────────────────────────────────────────┤
│      @object-ui/react (Renderer)            │  ← Interprets schema
├─────────────────────────────────────────────┤
│  Component Registry + Field Registry        │  ← Lookup system
├─────────────────────────────────────────────┤
│    @object-ui/components (UI Primitives)    │  ← Buttons, Cards, etc.
│    @object-ui/fields (Form Inputs)          │  ← Text, Date, Select
│    @object-ui/layout (Page Structure)       │  ← AppShell, Sidebar
│    @object-ui/plugin-* (Advanced Widgets)   │  ← Grid, Charts, Kanban
├─────────────────────────────────────────────┤
│   Shadcn UI + Radix UI (Primitives)         │  ← Accessible components
│   Tailwind CSS (Styling)                    │  ← Utility-first CSS
└─────────────────────────────────────────────┘
```

## Package Structure

ObjectUI is organized as a PNPM monorepo with clear separation of concerns:

### Core Packages

#### `@object-ui/types`
- **Role**: The Protocol
- **Contains**: Pure TypeScript interfaces for JSON schemas
- **Constraint**: ZERO dependencies, no React code
- **Example**: `ComponentSchema`, `ActionSchema`, `FieldSchema`

#### `@object-ui/core`
- **Role**: The Engine
- **Contains**: Schema validation, expression evaluation, registries
- **Constraint**: No UI library dependencies, logic only
- **Features**: 
  - Expression engine (`visible: "${data.age > 18}"`)
  - Schema registry and validation
  - Event system

#### `@object-ui/react`
- **Role**: The Runtime
- **Contains**: `SchemaRenderer` and React integration
- **Purpose**: Transforms JSON schemas into live React components

### UI Packages

#### `@object-ui/components`
- **Role**: The Atoms
- **Contains**: Shadcn primitives (Button, Badge, Card, Dialog, etc.)
- **Constraint**: Pure UI, no business logic
- **Style**: Tailwind CSS with `class-variance-authority`

#### `@object-ui/fields`
- **Role**: The Inputs
- **Contains**: Standard field renderers (Text, Number, Select, Date, etc.)
- **Implements**: `FieldWidgetProps` interface
- **Purpose**: Reusable form inputs with consistent API

#### `@object-ui/layout`
- **Role**: The Shell
- **Contains**: Page structure components (AppShell, Page, Sidebar, Header)
- **Purpose**: Routing-aware composition and app scaffolding

### Plugin Packages

Each plugin provides specialized, complex widgets:

- `@object-ui/plugin-grid` - Data tables with ObjectStack integration
- `@object-ui/plugin-kanban` - Kanban board view
- `@object-ui/plugin-charts` - Recharts-based visualizations
- `@object-ui/plugin-calendar` - Calendar and event views
- `@object-ui/plugin-map` - Map visualization
- `@object-ui/plugin-form` - Advanced forms
- `@object-ui/plugin-editor` - Code editor (Monaco)
- `@object-ui/plugin-markdown` - Markdown renderer
- `@object-ui/plugin-gantt` - Gantt chart timeline
- `@object-ui/plugin-timeline` - Event timeline
- `@object-ui/plugin-dashboard` - Dashboard layouts
- `@object-ui/plugin-chatbot` - Chat interface
- `@object-ui/plugin-aggrid` - AG Grid integration

**Important**: Heavy dependencies (like AG Grid, Monaco, Recharts) are only allowed in plugin packages to keep the core bundle small.

## How Schema Rendering Works

### 1. JSON Schema Input

A backend system sends a JSON schema:

```json
{
  "type": "card",
  "title": "Welcome",
  "body": {
    "type": "text",
    "value": "Hello, ${user.name}!"
  }
}
```

### 2. SchemaRenderer Processing

The `SchemaRenderer` component:

1. Receives the schema + data context
2. Evaluates expressions (`${user.name}`)
3. Looks up the component type in the registry
4. Recursively renders child schemas
5. Handles events and state updates

```tsx
import { SchemaRenderer } from '@object-ui/react'

function App() {
  const data = { user: { name: "Alice" } }
  
  return <SchemaRenderer schema={schema} data={data} />
}
```

### 3. Component Registry Lookup

The registry maps type strings to React components:

```typescript
// During app initialization
ComponentRegistry.register('card', CardComponent)
ComponentRegistry.register('text', TextComponent)

// At runtime
const Component = ComponentRegistry.get('card') // → CardComponent
```

### 4. React Component Rendering

The registered component renders with evaluated props:

```tsx
<CardComponent title="Welcome">
  <TextComponent value="Hello, Alice!" />
</CardComponent>
```

## The Registry Pattern

ObjectUI uses two registry systems for extensibility:

### Component Registry

Maps schema types to React components:

```tsx
import { ComponentRegistry } from '@object-ui/core'

// Register a component
ComponentRegistry.register('my-widget', MyWidgetComponent, {
  label: 'My Widget',
  category: 'Custom',
  icon: 'box',
  inputs: [
    { name: 'title', type: 'string', label: 'Title' }
  ]
})
```

### Field Registry

Maps field types to input components:

```tsx
import { registerFieldRenderer } from '@object-ui/fields'

// Register a field renderer
registerFieldRenderer('rating', RatingFieldComponent)
```

This allows:
- ✅ Overriding standard components
- ✅ Adding custom field types
- ✅ Plugin system for complex widgets
- ✅ Keeping bundles small (lazy loading)

## Expression System

ObjectUI includes a powerful expression engine for dynamic UIs:

### String Interpolation

```json
{
  "type": "text",
  "value": "Welcome, ${user.firstName} ${user.lastName}!"
}
```

### Conditional Rendering

```json
{
  "type": "button",
  "text": "Submit",
  "visible": "${form.isValid && !form.isSubmitting}",
  "disabled": "${form.isSubmitting}"
}
```

### Data Transformations

```json
{
  "type": "badge",
  "text": "${orders.length} Orders",
  "variant": "${orders.length > 10 ? 'success' : 'warning'}"
}
```

See the [Expressions Guide](/docs/guide/expressions) for complete details.

## Data Flow

```
Backend API
    ↓
JSON Schema + Data
    ↓
SchemaRenderer (evaluates expressions)
    ↓
Component Registry (maps types)
    ↓
React Components (render UI)
    ↓
User Interactions (events)
    ↓
Event Handlers (update data)
    ↓
Re-render (React state updates)
```

## Styling System

ObjectUI uses **Tailwind CSS** exclusively for styling:

### Class-Variance-Authority (CVA)

All component variants use `cva` for type-safe variants:

```tsx
import { cva } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      }
    }
  }
)
```

### Class Merging

Use `cn()` helper (tailwind-merge + clsx) for class overrides:

```tsx
import { cn } from '@/lib/utils'

<Button className={cn('default-classes', props.className)} />
```

### ❌ Forbidden

- Inline styles (`style={{}}`) - except for dynamic values
- CSS Modules
- Styled-components
- Any CSS-in-JS library

## Type Safety

ObjectUI is built with **TypeScript 5.0+** in strict mode:

```typescript
import type { ComponentSchema, ButtonSchema } from '@object-ui/types'

const schema: ButtonSchema = {
  type: 'button',
  text: 'Click me',
  variant: 'default', // ✅ Type-checked
  onClick: 'handleClick'
}
```

## Testing Strategy

- **Unit Tests**: Vitest + React Testing Library
- **Component Tests**: Storybook for visual testing
- **Type Tests**: TypeScript strict mode

## Best Practices

### 1. Keep Core Light

Heavy dependencies only go in plugins:

- ✅ `@object-ui/plugin-charts` can import Recharts
- ❌ `@object-ui/components` cannot import Recharts

### 2. Use Registries

Don't import components directly - use registries:

```tsx
// ❌ Bad
import { MyGrid } from './MyGrid'
<MyGrid data={data} />

// ✅ Good
ComponentRegistry.register('my-grid', MyGrid)
{ type: 'my-grid', data: [...] }
```

### 3. Tailwind Only

Never use inline styles or CSS-in-JS:

```tsx
// ❌ Bad
<div style={{ backgroundColor: 'red' }}>

// ✅ Good
<div className="bg-red-500">
```

### 4. Expressions for Dynamic Values

Use expressions for dynamic content:

```tsx
// ❌ Bad - hardcoded
{ type: 'text', value: 'Hello, John!' }

// ✅ Good - dynamic
{ type: 'text', value: 'Hello, ${user.name}!' }
```

## Plugin Development

When creating a plugin:

1. Create package in `packages/plugin-{name}/`
2. Export components and types
3. Register components with ComponentRegistry
4. Add documentation in `content/docs/plugins/`
5. Add to plugins meta.json

```typescript
// packages/plugin-mywidget/src/index.tsx
import { ComponentRegistry } from '@object-ui/core'
import { MyWidget } from './MyWidget'

export { MyWidget }

ComponentRegistry.register('my-widget', MyWidget, {
  label: 'My Widget',
  category: 'Plugins',
  icon: 'box'
})
```

## Related Documentation

- [Schema Rendering](/docs/guide/schema-rendering) - How schemas become React components
- [Component Registry](/docs/guide/component-registry) - Registering custom components
- [Field Registry](/docs/guide/fields) - Custom field types
- [Expressions](/docs/guide/expressions) - Dynamic expressions
- [Plugins](/docs/guide/plugins) - Plugin system
- [Data Sources](/docs/guide/data-source) - Data integration
