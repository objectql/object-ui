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

### SchemaRendererProvider

Injects the host's data source (and optional capabilities) into every renderer
below it:

```tsx
import { SchemaRendererProvider } from '@object-ui/react'

<SchemaRendererProvider
  dataSource={adapter}
  // Optional: host-authenticated fetch used by `provider: 'api'` view data
  // sources, so custom endpoints carry the same credentials (Authorization,
  // tenant, locale headers) as the native data channel. When omitted,
  // ApiDataSource falls back to the bare global fetch (cookies only).
  apiFetch={authenticatedFetch}
>
  <SchemaRenderer schema={schema} />
</SchemaRendererProvider>
```

Nested providers inherit `apiFetch` from their parent when they don't supply
their own, so re-wrapped subtrees (embedded pages, preview surfaces) keep the
host's authentication.

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
  const { discovery, isLoading, isAuthEnabled, isAiEnabled } = useDiscovery()
  
  // Check if the server is in preview mode
  if (discovery?.mode === 'preview') {
    console.log('Preview mode active:', discovery.previewMode)
  }

  // Check if AI service is available
  if (isAiEnabled) {
    console.log('AI service route:', discovery?.services?.ai?.route)
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
| `services` | `object` | Service availability status (auth, data, metadata, ai) |
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

### useNotifications / useNotificationsByPresentation

`NotificationProvider` implements the spec `NotificationSchema`. A notification's
`severity` picks its icon and tone; its `displayType` picks the **surface** that
renders it — and each of the five spec types has a distinct one:

| `displayType` | Presentation | Rendered by | Auto-dismiss |
| --- | --- | --- | --- |
| `toast` | transient overlay | the `onToast` delegate | yes |
| `snackbar` | bottom-anchored bar, one at a time, one action | `<NotificationSnackbar />` | yes |
| `banner` | page-width strip in the content flow | `<NotificationBanners />` | no |
| `alert` | blocking acknowledgement dialog (FIFO) | `<NotificationAlerts />` | no |
| `inline` | in place, at the raising surface | `<NotificationInline />` | no |

The surface components ship in `@object-ui/components`; mount them where they
belong (a banner is in flow, an inline notification sits next to its raiser).
`onToast` receives **only** `toast` items — it used to receive all five, which is
why every type looked like a toast.

```tsx
const { notify } = useNotifications()

notify({ title: 'Saved', severity: 'success' })                     // toast (spec default)
notify({ title: 'Viewing a draft', severity: 'warning', displayType: 'banner' })
notify({ title: 'Fix 2 fields', severity: 'error', displayType: 'inline', scope: 'contact-form' })
```

A surface component subscribes with `useNotificationsByPresentation(type, scope?)`,
which also registers the surface — raising a `banner` with no banner surface
mounted warns in dev instead of vanishing.

`config` is the spec `NotificationConfigSchema` (`defaultPosition`,
`defaultDuration`, `maxVisible`, `stackDirection`, `pauseOnHover`); the legacy
`position` / `stacking` spellings still resolve through
`resolveNotificationConfig`. Three helpers apply it so every surface agrees:
`resolveNotificationPosition` (a declared position always wins; nothing declared
leaves the surface on its own anchor), `visibleNotificationStack` (`maxVisible` +
`stackDirection`), and the context's `pauseAutoDismiss` / `resumeAutoDismiss`
(`pauseOnHover`). See the
[notifications guide](https://objectui.org/docs/guide/notifications).

## API Reference

See [full documentation](https://objectui.org/api/react) for detailed API reference.

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/core/schema-renderer)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/react)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
