# Core API

The `@object-ui/core` package (also published as `@object-ui/protocol`) provides the foundational type definitions and schemas for Object UI.

## Installation

```bash
npm install @object-ui/protocol
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
} from '@object-ui/protocol'
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
import { PageSchema } from '@object-ui/protocol'
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
import { isPageSchema, isFormSchema } from '@object-ui/protocol'

if (isPageSchema(schema)) {
  // TypeScript knows schema is PageSchema
  console.log(schema.title)
}
```

## API Reference

Full API documentation coming soon.

For now, see:
- [GitHub Repository](https://github.com/objectql/objectui/tree/main/packages/protocol)
- [TypeScript Definitions](https://github.com/objectql/objectui/blob/main/packages/protocol/src/types)
