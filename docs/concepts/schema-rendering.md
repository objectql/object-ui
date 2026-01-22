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
import { registerDefaultRenderers } from '@object-ui/components'

// Register components once at app initialization
registerDefaultRenderers()

function App() {
  const schema = {
    type: "page",
    title: "My Dashboard",
    body: { /* ... */ }
  }
  
  return <SchemaRenderer schema={schema} />
}
```

## Schema Structure

Every schema object must have at minimum a `type` field:

```typescript
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
    "value": "Total Users: ${stats.totalUsers}"
  }
}
```

## Data Context

The `SchemaRenderer` accepts a `data` prop that provides context for expressions:

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
  "value": "Welcome, ${user.name}!"
}
```

## Component Registry

The schema renderer uses a component registry to map schema types to React components:

```tsx
import { getComponentRegistry } from '@object-ui/react'

const registry = getComponentRegistry()

// Register a custom component
registry.register('my-component', MyComponent)

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
          "value": "Nested content"
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
    { "type": "text", "value": "First item" },
    { "type": "text", "value": "Second item" },
    { "type": "text", "value": "Third item" }
  ]
}
```

## Expression System

Object UI includes a powerful expression system for dynamic behavior:

### Simple Expressions

```json
{
  "type": "text",
  "value": "${user.firstName} ${user.lastName}"
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

```tsx
import { lazy } from 'react'

const HeavyChart = lazy(() => import('./HeavyChart'))

registry.register('heavy-chart', HeavyChart)
```

## Error Handling

The renderer includes built-in error boundaries:

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
import type { PageSchema, FormSchema } from '@object-ui/core'

const schema: PageSchema = {
  type: "page",
  title: "Typed Page",
  body: {
    type: "form",
    // TypeScript will validate this entire structure
    body: [
      // ...
    ]
  }
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
  "type": "empty-state",
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
- [Protocol Overview](/protocol/overview) - Explore all available schemas

## Related Documentation

- [Schema Specification](/spec/schema-rendering) - Technical specification
- [Architecture](/spec/architecture) - System architecture
- [Core API](/api/core) - Core package API reference
- [React API](/api/react) - React package API reference
