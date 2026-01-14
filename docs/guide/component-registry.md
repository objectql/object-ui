# Component Registry

The Component Registry is Object UI's system for mapping schema types to React components. Understanding the registry is key to extending Object UI with custom components.

## Overview

The registry acts as a lookup table that the `SchemaRenderer` uses to determine which React component to render for each schema type:

```
Schema Type → Component Registry → React Component
```

## Getting the Registry

```tsx
import { getComponentRegistry } from '@object-ui/react'

const registry = getComponentRegistry()
```

## Registering Components

### Using Default Components

The easiest way to get started is to register all default components:

```tsx
import { registerDefaultRenderers } from '@object-ui/components'

// Call once at app initialization
registerDefaultRenderers()
```

This registers all built-in components like:
- Forms: `input`, `textarea`, `select`, `checkbox`, etc.
- Data: `table`, `list`, `card`, `tree`, etc.
- Layout: `page`, `grid`, `flex`, `container`, etc.
- Feedback: `alert`, `dialog`, `toast`, etc.

### Registering Individual Components

Register specific components one at a time:

```tsx
import { getComponentRegistry } from '@object-ui/react'
import { InputRenderer } from '@object-ui/components'

const registry = getComponentRegistry()

registry.register('input', InputRenderer)
```

### Registering Custom Components

Create and register your own components:

```tsx
import { getComponentRegistry } from '@object-ui/react'
import type { BaseSchema } from '@object-ui/core'

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

const registry = getComponentRegistry()
registry.register('my-component', MyComponent)
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

```tsx
registry.register('my-component', MyComponent, {
  displayName: 'My Custom Component',
  category: 'Custom',
  icon: 'component-icon',
  description: 'A custom component for special use cases',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content: { type: 'string' }
    }
  }
})
```

This metadata is used by the Visual Designer to provide better editing experience.

### Lazy Loading

Register components that load on demand:

```tsx
import { lazy } from 'react'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

registry.register('heavy-component', HeavyComponent, {
  lazy: true
})
```

### Overriding Built-in Components

Override default components with your own:

```tsx
import { registerDefaultRenderers } from '@object-ui/components'

// Register defaults first
registerDefaultRenderers()

// Override specific component
registry.register('button', MyCustomButton)
```

## Component Categories

Default components are organized by category:

### Form Components
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
```tsx
- menu
- breadcrumb
- pagination
- steps
```

### Other
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
const types = registry.getRegisteredTypes()
console.log(types) // ['input', 'button', 'form', ...]
```

### Check if Type is Registered

```tsx
if (registry.has('my-component')) {
  console.log('Component is registered')
}
```

### Get Component Metadata

```tsx
const metadata = registry.getMetadata('input')
console.log(metadata)
// {
//   displayName: 'Input',
//   category: 'Form',
//   icon: 'input-icon',
//   ...
// }
```

## Best Practices

### 1. Register Once at App Initialization

```tsx
// main.tsx or App.tsx
import { registerDefaultRenderers } from '@object-ui/components'

registerDefaultRenderers()

function App() {
  // Your app code
}
```

### 2. Use TypeScript for Custom Components

```tsx
import type { BaseSchema } from '@object-ui/core'

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

```tsx
registry.register('rating', RatingComponent, {
  displayName: 'Star Rating',
  category: 'Form',
  icon: 'star',
  description: 'A 5-star rating input component',
  tags: ['form', 'input', 'rating']
})
```

### 5. Handle Missing Props Gracefully

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

```tsx
// @my-org/objectui-plugin-charts
import { getComponentRegistry } from '@object-ui/react'
import { BarChart } from './BarChart'
import { LineChart } from './LineChart'
import { PieChart } from './PieChart'

export function registerChartComponents() {
  const registry = getComponentRegistry()
  
  registry.register('bar-chart', BarChart)
  registry.register('line-chart', LineChart)
  registry.register('pie-chart', PieChart)
}
```

Usage:

```tsx
import { registerDefaultRenderers } from '@object-ui/components'
import { registerChartComponents } from '@my-org/objectui-plugin-charts'

registerDefaultRenderers()
registerChartComponents()
```

## Example: Custom Form Component

Here's a complete example of a custom form component:

```tsx
import { forwardRef } from 'react'
import { getComponentRegistry } from '@object-ui/react'
import type { BaseSchema } from '@object-ui/core'
import { cn } from '@/lib/utils'

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
const registry = getComponentRegistry()
registry.register('rating', RatingComponent, {
  displayName: 'Star Rating',
  category: 'Form',
  description: 'A star rating input component',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      label: { type: 'string' },
      maxStars: { type: 'number', default: 5 },
      required: { type: 'boolean' },
      disabled: { type: 'boolean' }
    },
    required: ['name']
  }
})

export { RatingComponent }
```

## Next Steps

- [Expression System](./expressions.md) - Learn about dynamic expressions
- [Schema Rendering](./schema-rendering.md) - Understand the rendering engine
- [Creating Custom Components](/spec/component-package.md) - Deep dive into component creation

## Related Documentation

- [Core API](/api/core) - Component registry API
- [React API](/api/react) - React integration
- [Component Specification](/spec/component.md) - Component metadata spec
