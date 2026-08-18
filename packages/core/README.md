# @object-ui/core

Core logic, types, and validation for Object UI. Zero React dependencies.

## Features

- 🎯 **Type Definitions** - Re-exported runtime types; the component schema
  vocabulary itself is `@object-ui/types`
- 🔍 **Component Registry** - Framework-agnostic component registration system
- 📊 **Data Scope** - Data scope management and expression evaluation
- ✅ **Validation** - Zod-based schema validation
- 🚀 **Zero React** - Can run in Node.js or any JavaScript environment

## Installation

```bash
npm install @object-ui/core
```

## Usage

### Type Definitions

The component schema vocabulary lives in `@object-ui/types`. Core depends on
that package and does not re-export it, so import the types from there. The
page node type is `PageNodeSchema` — the SDUI node, as distinct from the
authored page document.

```typescript
import type {
  PageNodeSchema,
  FormSchema,
  InputSchema,
  BaseSchema
} from '@object-ui/types'

const mySchema: PageNodeSchema = {
  type: 'page',
  title: 'My Page',
  body: []
}
```

### Component Registry

```typescript
import { ComponentRegistry } from '@object-ui/core'

ComponentRegistry.register('button', buttonMetadata)
const metadata = ComponentRegistry.get('button')
```

`ComponentRegistry` is a process-level singleton exported by `@object-ui/core`;
`SchemaRenderer` resolves every `type` against it, so a component registered
here is renderable from schema anywhere in the app.

### Data Scope

`DataScopeManager` owns the named scopes a component tree reads from, and
`evaluateExpression` evaluates a `${...}` expression against a context. They
are separate exports: a scope holds data, it does not evaluate.

```typescript
import { DataScopeManager, evaluateExpression } from '@object-ui/core'

const manager = new DataScopeManager()
manager.registerScope('user', { data: { name: 'John', role: 'admin' } })

const userName = manager.getScope('user')?.data.name // 'John'
const isAdmin = evaluateExpression('${user.role === "admin"}', {
  user: { name: 'John', role: 'admin' },
}) // true
```

### Server Action Dispatch (`createServerActionHandler`)

`ActionSchema.body` (L1 expression / L2 sandboxed JS) executes **server-side**
— `POST /api/v1/actions/{object}/{action}` → the runtime sandbox. The client
dispatches; it never interprets a body. Build the dispatch handler with the
factory and register it — core stays opinion-free about auth, origin and
object scope, which are injected:

```typescript
import { createServerActionHandler } from '@object-ui/core'

const script = createServerActionHandler({
  fetch: myAuthenticatedFetch,          // your auth wrapper (Bearer/cookies/...)
  baseUrl: 'https://api.example.com',   // '' or omitted = same-origin
  resolveObject: () => currentObject,   // fallback when the action has no objectName
  onRefresh: () => refetchData(),       // called per the action's refreshAfter
})

// Registered handlers beat the built-in executors:
runner.registerHandler('script', script)
// (React hosts: <ActionProvider handlers={{ script }} ... />)
```

The factory owns the protocol so consumers cannot drift on it: name-based
action identity (ADR-0110), the record-id resolution dance (`_rowRecord`,
`recordIdField`, selection fallback, aggregate `_selectedIds`), a re-entrancy
guard, and the `/actions` response-envelope rule (`interpretActionResponse` /
`readActionPayload`, also exported).

### System Views (`defineSystemView`)

Schemas authored in source code are part of the product contract and must
not be mutated at runtime. Wrap them with `defineSystemView()` to deep-freeze
the graph and tag it as a *System View*.

```typescript
import { defineSystemView, cloneAsOverride, isSystemView } from '@object-ui/core'

export const userListView = defineSystemView({
  type: 'list',
  data: { object: 'User' },
  columns: [{ name: 'email' }],
})

userListView.columns.push({ name: 'name' }) // ❌ TypeError (strict mode)
isSystemView(userListView)                   // ✅ true

// To produce a Tenant- or User-level override, derive a mutable copy:
const draft = cloneAsOverride(userListView)
draft.columns.push({ name: 'name' })         // ✅ allowed
isSystemView(draft)                          // false — clone is no longer System
```

**View tiers (recommended layering):**

| Tier        | Source                | Mutable? | API                         |
| ----------- | --------------------- | -------- | --------------------------- |
| System View | code (`import` / `as const`) | ❌ frozen | `defineSystemView()`        |
| Tenant View | backend / DB          | ⚠️ admin only | `cloneAsOverride()` + persist |
| User View   | localStorage / API    | ✅ user-editable | `cloneAsOverride()` + persist |

`Date`, `RegExp`, `Map`, `Set`, and class instances passed via `props` are
intentionally **not** frozen so infrastructure objects keep working.

## Philosophy

This package is designed to be **framework-agnostic**. It contains:

- ✅ Pure TypeScript types and interfaces
- ✅ Core logic and utilities
- ✅ Validation schemas
- ❌ NO React components
- ❌ NO UI rendering logic
- ❌ NO framework dependencies

This allows the core types and logic to be used in:
- Build tools and CLI utilities
- Backend validation
- Code generators
- Alternative framework adapters (Vue, Svelte, etc.)

## API Reference

See [full documentation](https://objectui.org/docs/api) for detailed API reference.

## Links

- 📚 [Documentation](https://www.objectui.org/docs/guide/architecture)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/core)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
