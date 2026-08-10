# @object-ui/core

Core logic, types, and validation for Object UI. Zero React dependencies.

## Features

- 🎯 **Type Definitions** - Complete TypeScript schemas for all components
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

```typescript
import type { 
  PageSchema, 
  FormSchema, 
  InputSchema,
  BaseSchema 
} from '@object-ui/core'

const mySchema: PageSchema = {
  type: 'page',
  title: 'My Page',
  body: []
}
```

### Component Registry

```typescript
import { ComponentRegistry } from '@object-ui/core'

const registry = new ComponentRegistry()
registry.register('button', buttonMetadata)
const metadata = registry.get('button')
```

### Data Scope

```typescript
import { DataScope } from '@object-ui/core'

const scope = new DataScope({ 
  user: { name: 'John', role: 'admin' } 
})

const userName = scope.get('user.name') // 'John'
const isAdmin = scope.evaluate('${user.role === "admin"}') // true
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

### System Views (`defineView`)

Schemas authored in source code are part of the product contract and must
not be mutated at runtime. Wrap them with `defineView()` to deep-freeze the
graph and tag it as a *System View*.

```typescript
import { defineView, cloneAsOverride, isSystemView } from '@object-ui/core'

export const userListView = defineView({
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
| System View | code (`import` / `as const`) | ❌ frozen | `defineView()`              |
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
