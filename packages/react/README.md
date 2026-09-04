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
      // `content` is evaluated on every component type. `input` has no row in
      // the spec's expression carriage map, so a `${…}` in ITS `value` would be
      // rendered as those characters rather than resolved.
      type: 'text',
      content: 'Editing ${user.name}'
    },
    {
      type: 'input',
      name: 'name',
      label: 'Name'
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

### useElementDataSourceSchema / ElementDataSourceGate

Consume `PageComponentSchema.dataSource` — the spec's per-element data binding
(`{ object, view?, filter?, sort?, limit? }`) — in a block that has its own key
names. `useElementDataSource` resolves the binding (fetching the object's saved
views so `view` can be matched); these two apply the composed result to the
block's schema and render the two non-final states.

```tsx
import { ElementDataSourceGate } from '@object-ui/react'
// The seam is imported from CORE, not from here — see the note below.
import { elementDataSourceBlock } from '@object-ui/core'

// `mapping` names ONLY the keys this block reads. A composed value written onto
// a key the block ignores would be accepted and silently dropped — the defect
// the binding exists to remove.
const OBJECT_GRID_BINDING = {
  columns: true,          // the view's FIELD list may fill `schema.columns`
  filter: true,           // AND-combined, never replaced ("additional criteria")
  sort: true,
  limit: 'pagination.pageSize' as const,
}

// `elementDataSourceBlock` is not optional decoration — see below.
const ObjectGridRenderer = elementDataSourceBlock(({ schema, ...props }) => (
  <ElementDataSourceGate schema={schema} mapping={OBJECT_GRID_BINDING} testId="object-grid">
    {(bound) => <ObjectGrid schema={bound} {...props} />}
  </ElementDataSourceGate>
))
```

**Wrap the registered renderer in `elementDataSourceBlock`.** It is what makes
`ComponentRegistry.register` emit the `dataSource` input on that block's
authoring surface, so the key the gate READS is also the key the manifest, the
save gate, the generated JSX types and the designer DECLARE. Skip it and the
binding still works at runtime while the html tier reports `dataSource` as a prop
that does not exist — the one spelling that resolves a saved view, reported
exactly like the spellings that do nothing (objectui#6678). The declaration is
emitted from this one seam, so never hand-write a `dataSource` entry in a block's
`inputs`. `pnpm check:element-data-source-declaration` fails any source that
consumes the gate without reaching the seam.

⚠️ **Import the seam from `@object-ui/core`, not from this package** — it is one
function under one name, re-exported here for discoverability, and the check
above enforces the core import at call sites. The reason is measured, not
stylistic: a registration runs at MODULE SCOPE, 101 suites in this repo partially
mock `@object-ui/react` by hand-listing the exports they return, and a
module-scope read of a name absent from such a list throws at COLLECTION time —
the importing test file dies before running a single assertion. Taking the seam
from `@object-ui/react` reddened 17 files across all four CI shards with zero
failed assertions among them. Nothing mocks `@object-ui/core`, and every
registration module already imports `ComponentRegistry` from it.

`object` lands on `objectName` by default (pass `object: 'apiName'` for another
key, or `object: false` for a block that reads the composed binding itself).
Precedence: binding keys beat the component's own, view-sourced values are only a
baseline the component's own key overrides, and `filter` AND-combines all three.
A `view` name that does not resolve renders a configuration error rather than
falling back to the object's full scope. Use `useElementDataSourceSchema` (plus
the exported `ElementDataSourceErrorPanel` / `ElementDataSourceLoadingPanel`) when
a block cannot be wrapped — a renderer whose hooks must run before the panels.
That form still reads `dataSource`, so it still owes the seam: mark the renderer
at its registration, `register('x', elementDataSourceBlock(XRenderer), { … })` —
again importing `elementDataSourceBlock` from `@object-ui/core`.

### useSettledSchema

The settled-schema RESOLUTION half, shared by every view that gates a record
query on its object definition — `ObjectKanban`, `ObjectView`,
`ObjectCalendar`, `ObjectTree` and `ObjectGantt` (objectui#6482, converged in
objectui#7225). Tracks whether an object's definition has finished resolving
FOR THE KEY THE CURRENT RENDER IS ASKING ABOUT — `ready` and `def` are two views of one piece of state, so a
stale key can never read as ready. GATE PLACEMENT — which effect actually
waits on `ready` — stays a per-component decision; this hook only owns the
resolution.

```tsx
import { useSettledSchema } from '@object-ui/react'

function ObjectSomething({ schema, dataSource }) {
  const key = schema.objectName ?? ''
  const { ready, def } = useSettledSchema(key, dataSource)

  useEffect(() => {
    if (!ready) return // gate placement is local to this component
    // issue the record query, e.g. buildExpandFields(def?.fields)
  }, [ready, def])
}
```

Pass `dataSource: undefined` for a render that should settle immediately with
no definition (e.g. a provider that issues no metadata read at all) instead of
adding a separate enable flag.

### NON_GRID_ROW_CEILING

The platform's hard row ceiling for a NON-GRID visualisation — gantt, calendar,
map and tree (objectui#7210). Those four fetch the whole FILTERED result set,
because a truthful range or layout needs all of it, but the fetch is bounded:
past the ceiling they draw the first N rows and say so.

```tsx
import {
  NON_GRID_ROW_CEILING,
  NON_GRID_ROW_CEILING_TOP,
  applyNonGridRowCeiling,
  NonGridRowCeilingNote,
} from '@object-ui/react'

const result = await dataSource.find(objectName, {
  $filter: schema.filter,
  $top: NON_GRID_ROW_CEILING_TOP, // the ceiling plus ONE probe row
})
const { rows, total, truncated } = applyNonGridRowCeiling(result)
// …draw `rows`, then:
<NonGridRowCeilingNote drawn={NON_GRID_ROW_CEILING} total={total} truncated={truncated} />
```

`NON_GRID_ROW_CEILING_TOP` is the ceiling plus one deliberately: the probe row
is what makes truncation a fact about the rows in hand, since `QueryResult.total`
is optional and a bare-array response carries none. The note renders `null` when
nothing was truncated, so it can be mounted unconditionally.

⛔ The ceiling is not authorable and must not become so. Silent truncation is
the failure it exists to prevent — a cut-off schedule still looks like a
schedule — so a view that caps rows without rendering the note is a defect, not
an optimisation.

### ComponentRegistry

There is no registry hook: the registry is a process-level singleton exported
by `@object-ui/core`, so read it directly. Subscribe to it only when a lazily
registered plugin must trigger a re-render.

```tsx
import { ComponentRegistry } from '@object-ui/core'

function MyComponent(props: Record<string, unknown>) {
  const Component = ComponentRegistry.get('button')

  return Component ? <Component {...props} /> : null
}
```

### useDiscovery

Access server discovery information — service availability and server identity:

```tsx
import { useDiscovery } from '@object-ui/react'

function MyComponent() {
  const { discovery, isLoading, isAuthEnabled, isAiEnabled } = useDiscovery()
  
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
| `mode` | `string` | Runtime mode the server reports (`RuntimeMode` in `@objectstack/spec`) |
| `services` | `object` | Service availability status (auth, data, metadata, ai) |
| `capabilities` | `string[]` | API capabilities |

> The `previewMode` block and the `'preview'` runtime mode were retired in
> objectui#6654, following their retirement in `@objectstack/spec`
> (objectstack#11846). A server that still sends them is read as any other
> payload: authentication follows `services.auth` alone, so a preview
> deployment requires login rather than silently running with auth off.
> `AuthProvider`'s `previewMode` **prop** in `@object-ui/auth` is a separate,
> host-supplied capability and is unaffected.

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

See [full documentation](https://objectui.org/docs/core/schema-renderer) for detailed API reference.

## Links

- 📚 [Documentation](https://www.objectui.org/docs/core/schema-renderer)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/react)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
