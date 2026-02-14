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

### useDiscovery

Access server discovery information including preview mode detection:

```tsx
import { useDiscovery } from '@object-ui/react'

function MyComponent() {
  const { discovery, isLoading, isAuthEnabled } = useDiscovery()
  
  // Check if the server is in preview mode
  if (discovery?.mode === 'preview') {
    console.log('Preview mode active:', discovery.previewMode)
  }

  return <div>Server: {discovery?.name}</div>
}
```

#### DiscoveryInfo

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | Server name |
| `version` | `string` | Server version |
| `mode` | `string` | Runtime mode (e.g. `'development'`, `'production'`, `'preview'`) |
| `previewMode` | `object` | Preview mode configuration (present when mode is `'preview'`) |
| `services` | `object` | Service availability status (auth, data, metadata) |
| `capabilities` | `string[]` | API capabilities |

The `previewMode` object contains:

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `autoLogin` | `boolean` | `true` | Skip login/registration pages |
| `simulatedRole` | `'admin' \| 'user' \| 'viewer'` | `'admin'` | Simulated user role |
| `simulatedUserName` | `string` | `'Preview User'` | Display name |
| `readOnly` | `boolean` | `false` | Read-only mode |
| `expiresInSeconds` | `number` | `0` | Session duration (0 = no expiry) |
| `bannerMessage` | `string` | — | UI banner message |

## API Reference

See [full documentation](https://objectui.org/api/react) for detailed API reference.

## License

MIT
