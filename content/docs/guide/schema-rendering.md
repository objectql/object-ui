---
title: "Schema Rendering"
---

Object UI's schema rendering system is the core mechanism that transforms JSON configurations into live React components. This guide explains how it works and how to use it effectively.

## Overview

The schema rendering engine follows a simple principle:

```
JSON Schema → SchemaRenderer → React Components → Beautiful UI
```

Every visual element in Object UI starts as a JSON object that describes what should be rendered, not how it should be rendered.

## The SchemaRenderer Component

The `SchemaRenderer` is the primary component that interprets your JSON schemas:

```tsx
import { SchemaRenderer } from '@object-ui/react'
import { initializeComponents } from '@object-ui/components'
// Side-effect import: loading the package runs its own field registration.
import '@object-ui/fields'

// Register components once at app initialization
initializeComponents()

function App() {
  const schema = {
    type: "page",
    title: "My Dashboard",
    body: { type: "text", content: "Hello" }
  }
  
  return <SchemaRenderer schema={schema} />
}
```

## Schema Structure

Every schema object must have at minimum a `type` field:

```typescript
import type { CSSProperties } from 'react'

interface BaseSchema {
  type: string           // Component type identifier
  id?: string           // Optional unique identifier
  className?: string    // Tailwind CSS classes
  style?: CSSProperties // Inline styles (use sparingly)
  visibleOn?: string    // Expression for conditional visibility
  hiddenOn?: string     // Expression for conditional hiding
  disabledOn?: string   // Expression for conditional disabling
}
```

### Example Schema

```json
{
  "type": "card",
  "id": "stats-card",
  "className": "p-6 shadow-lg",
  "title": "User Statistics",
  "visibleOn": "${user.role === 'admin'}",
  "body": {
    "type": "text",
    "content": "Total Users: ${stats.totalUsers}"
  }
}
```

## Data Context

The `SchemaRenderer` accepts a `data` prop that provides context for expressions:

<!-- doc-snippet: fragment — continues the block above — SchemaRenderer and schema are already in scope there; the closing JSX line is the call shown in place, not a statement that parses on its own -->
```tsx
const data = {
  user: { name: "John", role: "admin" },
  stats: { totalUsers: 1234 }
}

<SchemaRenderer schema={schema} data={data} />
```

### Accessing Data in Schemas

Use expression syntax `${}` to reference data:

```json
{
  "type": "text",
  "content": "Welcome, ${user.name}!"
}
```

## Component Registry

The schema renderer uses a component registry to map schema types to React components:

<!-- doc-snippet: fragment — MyComponent is the reader's own React component, named here to show what register() takes as its second argument -->
```tsx
import { ComponentRegistry } from '@object-ui/core'

// `ComponentRegistry` is a process-level singleton — import it, do not construct one.
// Register a custom component
ComponentRegistry.register('my-component', MyComponent)

// Now you can use it in schemas
const schema = {
  type: "my-component",
  // ... component props
}
```

## Nested Schemas

Schemas can be nested to create complex UIs:

```json
{
  "type": "page",
  "title": "Dashboard",
  "body": {
    "type": "grid",
    "columns": 2,
    "items": [
      {
        "type": "card",
        "title": "Card 1",
        "body": {
          "type": "text",
          "content": "Nested content"
        }
      },
      {
        "type": "card",
        "title": "Card 2",
        "body": {
          "type": "chart",
          "chartType": "bar",
          "data": "${chartData}"
        }
      }
    ]
  }
}
```

## Array Rendering

Use arrays for multiple items:

```json
{
  "type": "container",
  "body": [
    { "type": "text", "content": "First item" },
    { "type": "text", "content": "Second item" },
    { "type": "text", "content": "Third item" }
  ]
}
```

## Expression System

Object UI includes a powerful expression system for dynamic behavior:

### Simple Expressions

```json
{
  "type": "text",
  "content": "${user.firstName} ${user.lastName}"
}
```

### Conditional Expressions

```json
{
  "type": "badge",
  "text": "${status === 'active' ? 'Active' : 'Inactive'}",
  "variant": "${status === 'active' ? 'success' : 'default'}"
}
```

### Visibility Control

```json
{
  "type": "button",
  "label": "Delete",
  "visibleOn": "${user.role === 'admin'}"
}
```

### Complex Logic

```json
{
  "type": "alert",
  "message": "Welcome!",
  "variant": "${
    user.isNew ? 'info' :
    user.tasks.length === 0 ? 'warning' :
    'success'
  }"
}
```

## Event Handling

Components can emit events that you handle in React:

<!-- doc-snippet: fragment — prop excerpt: the JSX call is shown alone to isolate onAction and onSubmit; schema and SchemaRenderer come from the first example on this page -->
```tsx
<SchemaRenderer 
  schema={schema}
  onAction={(action, context) => {
    console.log('Action:', action)
    console.log('Context:', context)
  }}
  onSubmit={(data) => {
    console.log('Form submitted:', data)
  }}
/>
```

Reference actions in schemas:

```json
{
  "type": "button",
  "label": "Click Me",
  "onClick": {
    "actionType": "ajax",
    "api": "/api/action"
  }
}
```

## Performance Optimization

### Lazy Loading

Large schemas are automatically optimized:

```json
{
  "type": "tabs",
  "lazyLoad": true,
  "tabs": [
    { "title": "Tab 1", "body": { /* Loaded when tab is clicked */ } },
    { "title": "Tab 2", "body": { /* Loaded when tab is clicked */ } }
  ]
}
```

### Memoization

The renderer automatically memoizes components to prevent unnecessary re-renders.

### Code Splitting

Use dynamic imports for heavy components:

<!-- doc-snippet: fragment — code-splitting excerpt: ./HeavyChart is the reader's own component file, and registry is whichever registry instance the host already holds -->
```tsx
import { lazy } from 'react'

const HeavyChart = lazy(() => import('./HeavyChart'))

registry.register('heavy-chart', HeavyChart)
```

## Error Handling

The renderer includes built-in error boundaries:

<!-- doc-snippet: fragment — prop excerpt: the JSX call is shown alone to isolate onError; schema and SchemaRenderer come from the first example on this page -->
```tsx
<SchemaRenderer 
  schema={schema}
  onError={(error, errorInfo) => {
    console.error('Rendering error:', error)
    // Log to error tracking service
  }}
/>
```

## TypeScript Support

Full type safety for your schemas:

```tsx
import type { PageNodeSchema, FormSchema } from '@object-ui/types'

const form: FormSchema = {
  type: "form",
  // TypeScript will validate this entire structure
  fields: []
}

const schema: PageNodeSchema = {
  type: "page",
  title: "Typed Page",
  body: [form]
}
```

## Best Practices

### 1. Keep Schemas Simple

Break complex UIs into smaller, reusable schemas:

```tsx
// ❌ Bad: One massive schema
const massiveSchema = { /* 500 lines of JSON */ }

// ✅ Good: Composed schemas
const headerSchema = { /* ... */ }
const contentSchema = { /* ... */ }
const footerSchema = { /* ... */ }

const pageSchema = {
  type: "page",
  body: [headerSchema, contentSchema, footerSchema]
}
```

### 2. Use Data Context Effectively

Pass all necessary data upfront:

<!-- doc-snippet: fragment — best-practice excerpt: userData, userSettings and dashboardStats are the reader's own values, and the closing JSX line is shown in place rather than as a parseable statement -->
```tsx
// ✅ Good
const data = {
  user: userData,
  settings: userSettings,
  stats: dashboardStats
}

<SchemaRenderer schema={schema} data={data} />
```

### 3. Leverage Expressions

Move logic to expressions instead of creating conditional schemas:

<!-- doc-snippet: fragment — a bad/good contrast pair in one fence: schema is deliberately declared twice so the two spellings sit side by side, and user, adminSchema and userSchema are the reader's own values -->
```tsx
// ❌ Bad
const schema = user.isAdmin ? adminSchema : userSchema

// ✅ Good
const schema = {
  type: "page",
  body: [
    { 
      type: "admin-panel",
      visibleOn: "${user.isAdmin}"
    },
    {
      type: "user-panel",
      visibleOn: "${!user.isAdmin}"
    }
  ]
}
```

### 4. Use TypeScript

Always type your schemas for better IDE support and fewer runtime errors.

## Common Patterns

### Loading States

```json
{
  "type": "container",
  "body": {
    "type": "spinner",
    "visibleOn": "${loading}"
  }
}
```

### Empty States

```json
{
  "type": "empty",
  "visibleOn": "${items.length === 0}",
  "message": "No items found",
  "action": {
    "type": "button",
    "label": "Create New"
  }
}
```

### Error States

```json
{
  "type": "alert",
  "variant": "error",
  "visibleOn": "${error}",
  "message": "${error.message}"
}
```

## Next Steps

- [Component Registry](./component-registry.md) - Learn about component registration
- [Expression System](./expressions.md) - Master expressions
- [Schema Overview](/docs/guide/schema-overview) - Explore all available schemas

## Related Documentation

- [SchemaRenderer](/docs/core/schema-renderer) - Technical reference for the renderer
- [Architecture Overview](/docs/guide/architecture) - System architecture
- [`@object-ui/core` README](https://github.com/objectstack-ai/objectui/tree/main/packages/core) - Core package API reference
- [`@object-ui/react` README](https://github.com/objectstack-ai/objectui/tree/main/packages/react) - React package API reference
