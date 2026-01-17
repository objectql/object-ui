# React API

The `@object-ui/react` package provides React components and hooks for rendering Object UI schemas.

## Installation

```bash
npm install @object-ui/react
```

## Components

### SchemaRenderer

The main component for rendering schemas:

```tsx
import { SchemaRenderer } from '@object-ui/react'

function App() {
  return (
    <SchemaRenderer
      schema={mySchema}
      data={myData}
      onSubmit={handleSubmit}
    />
  )
}
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `schema` | `ComponentSchema` | The schema to render |
| `data` | `Record<string, any>` | Data context for expressions |
| `onSubmit` | `(data: any) => void` | Form submit handler |
| `onChange` | `(data: any) => void` | Data change handler |

## Hooks

### useSchemaContext

Access the current schema context:

```tsx
import { useSchemaContext } from '@object-ui/react'

function MyComponent() {
  const { data, updateData } = useSchemaContext()
  
  return <div>{data.value}</div>
}
```

### useRegistry

Access the component registry:

```tsx
import { useRegistry } from '@object-ui/react'

function MyComponent() {
  const registry = useRegistry()
  const Component = registry.get('button')
  
  return <Component {...props} />
}
```

## Context Providers

### SchemaProvider

Provides schema context to child components:

```tsx
import { SchemaProvider } from '@object-ui/react'

<SchemaProvider data={myData}>
  <MyApp />
</SchemaProvider>
```

## API Reference

Full API documentation coming soon.

For now, see:
- [GitHub Repository](https://github.com/objectstack-ai/objectui/tree/main/packages/react)
- [Examples](https://github.com/objectstack-ai/objectui/tree/main/examples)
