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

See [full documentation](https://objectui.org/api/core) for detailed API reference.

## License

MIT
