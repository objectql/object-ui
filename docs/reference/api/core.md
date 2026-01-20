---
title: "Core API"
---

The `@object-ui/core` package provides the foundational type definitions, schemas, and core logic for Object UI.

This package is **framework-agnostic** with zero React dependencies, making it suitable for use in Node.js environments, build tools, or other frameworks.

## Installation

```bash
npm install @object-ui/core
```

## Type Definitions

### Schema Types

```typescript
import type {
  BaseSchema,
  PageSchema,
  FormSchema,
  ViewSchema,
  ComponentSchema
} from '@object-ui/core'
```

### BaseSchema

All schemas extend from `BaseSchema`:

```typescript
interface BaseSchema {
  type: string
  id?: string
  name?: string
  className?: string
  style?: React.CSSProperties
  visible?: boolean
  visibleOn?: string
}
```

## Component Types

### Page

```typescript
interface PageSchema extends BaseSchema {
  type: 'page'
  title: string
  description?: string
  body: ComponentSchema | ComponentSchema[]
}
```

### Form

```typescript
interface FormSchema extends BaseSchema {
  type: 'form'
  title?: string
  body: FieldSchema[]
  actions?: ActionSchema[]
  onSubmit?: string
}
```

### Input

```typescript
interface InputSchema extends BaseSchema {
  type: 'input'
  name: string
  label: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  inputType?: 'text' | 'email' | 'password' | 'number'
}
```

## Validation

### Using Zod

```typescript
import { PageSchema } from '@object-ui/core'
import { z } from 'zod'

const pageValidator = z.object({
  type: z.literal('page'),
  title: z.string(),
  body: z.any()
})

// Validate
const result = pageValidator.safeParse(mySchema)
```

## Utilities

### Type Guards

```typescript
import { isPageSchema, isFormSchema } from '@object-ui/core'

if (isPageSchema(schema)) {
  // TypeScript knows schema is PageSchema
  console.log(schema.title)
}
```

## Component Registry

The core package provides a framework-agnostic component registry:

```typescript
import { ComponentRegistry } from '@object-ui/core'

const registry = new ComponentRegistry()
registry.register('button', buttonMetadata)
```

## Data Scope

Data scope management for expression evaluation:

```typescript
import { DataScope } from '@object-ui/core'

const scope = new DataScope({ user: { name: 'John' } })
const value = scope.get('user.name') // 'John'
```

## API Reference

For detailed API documentation, see:
- [GitHub Repository](https://github.com/objectstack-ai/objectui/tree/main/packages/core)
- [TypeScript Definitions](https://github.com/objectstack-ai/objectui/blob/main/packages/core/src/index.ts)
