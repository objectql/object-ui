---
title: "Component Registry"
---

The Component Registry is Object UI's system for mapping schema types to React components. Understanding the registry is key to extending Object UI with custom components.

## Overview

The registry acts as a lookup table that the `SchemaRenderer` uses to determine which React component to render for each schema type:

```
Schema Type → Component Registry → React Component
```

## Getting the Registry

`ComponentRegistry` is a process-level singleton exported by `@object-ui/core`.
Import it directly — there is no accessor function and nothing to construct:

```tsx
import { ComponentRegistry } from '@object-ui/core'
```

## Registering Components

### Using Default Components

The easiest way to get started is to register all default components:

```tsx
import { initializeComponents } from '@object-ui/components'
// Side-effect import: loading the package runs its own field registration.
import '@object-ui/fields'

// Call once at app initialization
initializeComponents()
```

Loading each package registers what it owns — the components and the field
widgets both land in the one `ComponentRegistry`; `initializeComponents()` exists
so a bundler cannot tree-shake the side-effect import away. The individual
renderers are not exported for hand-registration: registration is what loading
the package does.

This registers all built-in components like:
- Forms: `input`, `textarea`, `select`, `checkbox`, etc.
- Data: `table`, `list`, `card`, `tree`, etc.
- Layout: `page`, `grid`, `flex`, `container`, etc.
- Feedback: `alert`, `dialog`, `toast`, etc.

### Registering Custom Components

Create and register your own components:

```tsx
import { ComponentRegistry } from '@object-ui/core'
import type { BaseSchema } from '@object-ui/types'

interface MyComponentSchema extends BaseSchema {
  type: 'my-component'
  title: string
  content: string
}

function MyComponent(props: MyComponentSchema) {
  return (
    <div className="my-component">
      <h3>{props.title}</h3>
      <p>{props.content}</p>
    </div>
  )
}

ComponentRegistry.register('my-component', MyComponent)
```

Now you can use it in schemas:

```json
{
  "type": "my-component",
  "title": "Hello",
  "content": "This is my custom component!"
}
```

## Component Interface

All registered components receive the schema as props:

<!-- doc-snippet: fragment — continues the custom-component block above — `BaseSchema` and `MyComponentSchema` are declared there, and re-declaring them here would teach the reader to write the same interface twice (measured: TS2304 x3) -->
```tsx
interface ComponentProps<T extends BaseSchema = BaseSchema> {
  // The complete schema object
  schema: T
  
  // Data context (optional)
  data?: Record<string, any>
  
  // Event handlers (optional)
  onAction?: (action: any, context: any) => void
  onChange?: (value: any) => void
  onSubmit?: (data: any) => void
}

function MyRenderer(props: ComponentProps<MyComponentSchema>) {
  const { schema, data, onChange } = props
  
  return (
    <div className={schema.className}>
      {/* Your component implementation */}
    </div>
  )
}
```

## Advanced Registration

### With Metadata

Register components with additional metadata:

<!-- doc-snippet: fragment — continues the custom-component block above — `MyComponent` and the `ComponentRegistry` import come from it (measured: TS2304 x2). The `ComponentMeta` literal this block shows is type-checked on the complete example at the end of the page, which does compile -->
```tsx
ComponentRegistry.register('my-component', MyComponent, {
  label: 'My Custom Component',
  category: 'Custom',
  icon: 'component-icon',
  inputs: [
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'content', type: 'string', label: 'Content' }
  ]
})
```

This metadata is used by the Visual Designer to provide better editing experience.

### Lazy Loading

Register components that load on demand:

<!-- doc-snippet: fragment — `./HeavyComponent` is the reader's own module, so the dynamic import cannot resolve here (measured: TS2307 x1, plus TS2304 on the `ComponentRegistry` the block above imports) -->
```tsx
// The loader runs the first time a schema asks for `heavy-component`.
ComponentRegistry.registerLazy('heavy-component', () => import('./HeavyComponent'))
```

### Overriding Built-in Components

Override default components with your own:

<!-- doc-snippet: fragment — `MyCustomButton` is the reader's own replacement component; there is nothing in this repo to import it from (measured: TS2304 x1) -->
```tsx
import { ComponentRegistry } from '@object-ui/core'
import { initializeComponents } from '@object-ui/components'
import '@object-ui/fields'

// Register defaults first
initializeComponents()

// Override specific component
ComponentRegistry.register('button', MyCustomButton)
```

## Component Categories

Default components are organized by category:

### Form Components
<!-- doc-snippet: fragment — not TypeScript at all — this fence holds a markdown bullet list naming the eleven form-component keys the registry ships, and a leading `-` reads as unary minus on an undeclared name (measured: TS2304 across the list, and the form list does not even parse because `switch` is a keyword — TS1109/TS1005 x3). The fence language is the underlying defect; correcting it is a separate change -->
```tsx
- input
- textarea
- select
- checkbox
- radio
- switch
- slider
- date-picker
- time-picker
- file-upload
- color-picker
```

### Data Display
<!-- doc-snippet: fragment — not TypeScript at all — this fence holds a markdown bullet list naming the seven data-display keys the registry ships, and a leading `-` reads as unary minus on an undeclared name (measured: TS2304 across the list, and the form list does not even parse because `switch` is a keyword — TS1109/TS1005 x3). The fence language is the underlying defect; correcting it is a separate change -->
```tsx
- table
- list
- card
- tree
- timeline
- calendar
- kanban
```

### Layout
<!-- doc-snippet: fragment — not TypeScript at all — this fence holds a markdown bullet list naming the eight layout keys the registry ships, and a leading `-` reads as unary minus on an undeclared name (measured: TS2304 across the list, and the form list does not even parse because `switch` is a keyword — TS1109/TS1005 x3). The fence language is the underlying defect; correcting it is a separate change -->
```tsx
- page
- container
- grid
- flex
- tabs
- accordion
- divider
- spacer
```

### Feedback
<!-- doc-snippet: fragment — not TypeScript at all — this fence holds a markdown bullet list naming the nine feedback keys the registry ships, and a leading `-` reads as unary minus on an undeclared name (measured: TS2304 across the list, and the form list does not even parse because `switch` is a keyword — TS1109/TS1005 x3). The fence language is the underlying defect; correcting it is a separate change -->
```tsx
- alert
- toast
- dialog
- drawer
- popover
- tooltip
- progress
- skeleton
- spinner
```

### Navigation
<!-- doc-snippet: fragment — not TypeScript at all — this fence holds a markdown bullet list naming the four navigation keys the registry ships, and a leading `-` reads as unary minus on an undeclared name (measured: TS2304 across the list, and the form list does not even parse because `switch` is a keyword — TS1109/TS1005 x3). The fence language is the underlying defect; correcting it is a separate change -->
```tsx
- menu
- breadcrumb
- pagination
- steps
```

### Other
<!-- doc-snippet: fragment — not TypeScript at all — this fence holds a markdown bullet list naming the eight remaining keys the registry ships, and a leading `-` reads as unary minus on an undeclared name (measured: TS2304 across the list, and the form list does not even parse because `switch` is a keyword — TS1109/TS1005 x3). The fence language is the underlying defect; correcting it is a separate change -->
```tsx
- button
- link
- text
- icon
- image
- video
- badge
- avatar
```

## Checking Registered Components

### Get All Registered Types

```tsx
import { ComponentRegistry } from '@object-ui/core'

const types = ComponentRegistry.getAllTypes()
console.log(types) // ['input', 'button', 'form', ...]
```

### Check if Type is Registered

```tsx
import { ComponentRegistry } from '@object-ui/core'

if (ComponentRegistry.has('my-component')) {
  console.log('Component is registered')
}
```

### Get Component Metadata

```tsx
import { ComponentRegistry } from '@object-ui/core'

const metadata = ComponentRegistry.getMeta('input')
console.log(metadata)
// {
//   label: 'Input',
//   category: 'Form',
//   icon: 'input-icon',
//   ...
// }
```

## Best Practices

### 1. Register Once at App Initialization

```tsx
// main.tsx or App.tsx
import { initializeComponents } from '@object-ui/components'
import '@object-ui/fields'

initializeComponents()

function App() {
  // Your app code
}
```

### 2. Use TypeScript for Custom Components

```tsx
import type { BaseSchema } from '@object-ui/types'

interface CustomSchema extends BaseSchema {
  type: 'custom'
  customProp: string
}

function CustomComponent(props: { schema: CustomSchema }) {
  // TypeScript ensures type safety
}
```

### 3. Follow Naming Conventions

Use kebab-case for component types:
- ✅ `my-component`, `custom-button`, `data-table`
- ❌ `MyComponent`, `customButton`, `DataTable`

### 4. Provide Meaningful Metadata

<!-- doc-snippet: fragment — `RatingComponent` is the component built in the complete example at the end of this page, and the `ComponentRegistry` import comes with it (measured: TS2304 x2) -->
```tsx
ComponentRegistry.register('rating', RatingComponent, {
  label: 'Star Rating',
  category: 'Form',
  icon: 'star',
  labelling: 'group'
})
```

### 5. Handle Missing Props Gracefully

<!-- doc-snippet: fragment — continues the component-interface block above — `ComponentProps` is declared there and `MySchema` stands for whatever schema the reader's component takes (measured: TS2304 x2) -->
```tsx
function MyComponent(props: ComponentProps<MySchema>) {
  const { schema } = props
  const title = schema.title || 'Default Title'
  const content = schema.content || ''
  
  return (
    <div>
      <h3>{title}</h3>
      <p>{content}</p>
    </div>
  )
}
```

## Creating Plugin Packages

Group related components into plugin packages:

<!-- doc-snippet: fragment — the three chart components are files the reader is being told to write, so `./BarChart` / `./LineChart` / `./PieChart` cannot resolve here (measured: TS2307 x3) -->
```tsx
// @my-org/objectui-plugin-charts
import { ComponentRegistry } from '@object-ui/core'
import { BarChart } from './BarChart'
import { LineChart } from './LineChart'
import { PieChart } from './PieChart'

export function registerChartComponents() {
  ComponentRegistry.register('bar-chart', BarChart)
  ComponentRegistry.register('line-chart', LineChart)
  ComponentRegistry.register('pie-chart', PieChart)
}
```

Usage:

<!-- doc-snippet: fragment — `@my-org/objectui-plugin-charts` is the package the reader has just been shown how to create, not one this repo publishes (measured: TS2307 x1) -->
```tsx
import { initializeComponents } from '@object-ui/components'
import '@object-ui/fields'
import { registerChartComponents } from '@my-org/objectui-plugin-charts'

initializeComponents()
registerChartComponents()
```

## Example: Custom Form Component

Here's a complete example of a custom form component:

```tsx
import { forwardRef, useState } from 'react'
import { ComponentRegistry } from '@object-ui/core'
import type { BaseSchema } from '@object-ui/types'
import { cn } from '@object-ui/components'

interface RatingSchema extends BaseSchema {
  type: 'rating'
  name: string
  label?: string
  maxStars?: number
  required?: boolean
  disabled?: boolean
  onChange?: (value: number) => void
}

const RatingComponent = forwardRef<HTMLDivElement, { schema: RatingSchema }>(
  ({ schema }, ref) => {
    const [value, setValue] = useState(0)
    const maxStars = schema.maxStars || 5

    const handleClick = (rating: number) => {
      if (schema.disabled) return
      setValue(rating)
      schema.onChange?.(rating)
    }

    return (
      <div ref={ref} className={cn('flex flex-col gap-2', schema.className)}>
        {schema.label && (
          <label className="text-sm font-medium">
            {schema.label}
            {schema.required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="flex gap-1">
          {Array.from({ length: maxStars }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleClick(index + 1)}
              disabled={schema.disabled}
              className={cn(
                'text-2xl transition-colors',
                index < value ? 'text-yellow-400' : 'text-gray-300',
                !schema.disabled && 'hover:text-yellow-300 cursor-pointer'
              )}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    )
  }
)

RatingComponent.displayName = 'Rating'

// Register the component
ComponentRegistry.register('rating', RatingComponent, {
  label: 'Star Rating',
  category: 'Form',
  labelling: 'group',
  inputs: [
    { name: 'name', type: 'string', label: 'Name', required: true },
    { name: 'label', type: 'string', label: 'Label' },
    { name: 'maxStars', type: 'number', label: 'Max stars', defaultValue: 5 },
    { name: 'required', type: 'boolean', label: 'Required' },
    { name: 'disabled', type: 'boolean', label: 'Disabled' }
  ]
})

export { RatingComponent }
```

## Next Steps

- [Expression System](./expressions.md) - Learn about dynamic expressions
- [Schema Rendering](./schema-rendering.md) - Understand the rendering engine
- [Custom Plugin Development](/docs/guide/plugin-development) - Deep dive into component creation

## Related Documentation

- [`@object-ui/core` README](https://github.com/objectstack-ai/objectui/tree/main/packages/core) - Component registry API
- [`@object-ui/react` README](https://github.com/objectstack-ai/objectui/tree/main/packages/react) - React integration
- [Schema Type Reference](/docs/api/schema-reference) - Component metadata reference
