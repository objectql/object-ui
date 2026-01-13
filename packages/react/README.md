# @object-ui/react

React bindings and SchemaRenderer component for Object UI.

## Features

- ⚛️ **SchemaRenderer** - Main component for rendering Object UI schemas
- 🪝 **React Hooks** - Hooks for accessing renderer context
- 🔄 **Context Providers** - React Context for state management
- 📦 **Tree-Shakable** - Import only what you need

## Installation

```bash
npm install @object-ui/react @object-ui/core
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Usage

### Basic Example

```tsx
import { SchemaRenderer } from '@object-ui/react'

const schema = {
  type: 'text',
  value: 'Hello, Object UI!'
}

function App() {
  return <SchemaRenderer schema={schema} />
}
```

### With Data

```tsx
import { SchemaRenderer } from '@object-ui/react'

const schema = {
  type: 'form',
  body: [
    {
      type: 'input',
      name: 'name',
      label: 'Name',
      value: '${user.name}'
    }
  ]
}

const data = {
  user: { name: 'John Doe' }
}

function App() {
  return <SchemaRenderer schema={schema} data={data} />
}
```

### Handling Actions

```tsx
import { SchemaRenderer } from '@object-ui/react'

function App() {
  const handleSubmit = (data) => {
    console.log('Form submitted:', data)
  }

  return (
    <SchemaRenderer 
      schema={formSchema}
      onSubmit={handleSubmit}
    />
  )
}
```

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

## API Reference

See [full documentation](https://objectui.org/api/react) for detailed API reference.

## License

MIT
