# ObjectUI Zod Validation Schemas

Complete Zod validation schemas for all ObjectUI components, following the @objectstack/spec UI specification format.

## Overview

This directory contains runtime validation schemas using [Zod](https://github.com/colinhacks/zod) for all ObjectUI component types. These schemas provide:

- **Type-safe runtime validation** of component configurations
- **Compliance with @objectstack/spec** UI specification format  
- **Auto-completion and IntelliSense** through TypeScript integration
- **Detailed error messages** for invalid configurations

## Installation

The Zod schemas are included in the `@object-ui/types` package:

```bash
npm install @object-ui/types zod
# or
pnpm add @object-ui/types zod
```

## Usage

### Basic Validation

```typescript
import { ButtonSchema, InputSchema } from '@object-ui/types/zod';

// Validate a button configuration
const buttonConfig = {
  type: 'button',
  label: 'Click Me',
  variant: 'primary',
  onClick: () => console.log('clicked'),
};

const result = ButtonSchema.safeParse(buttonConfig);

if (result.success) {
  console.log('Valid config:', result.data);
} else {
  console.error('Validation errors:', result.error);
}
```

### Form Validation

```typescript
import { FormSchema } from '@object-ui/types/zod';

const formConfig = {
  type: 'form',
  fields: [
    {
      name: 'email',
      label: 'Email',
      type: 'input',
      inputType: 'email',
      required: true,
    },
    {
      name: 'password',
      label: 'Password',
      type: 'input',
      inputType: 'password',
      required: true,
    },
  ],
  submitLabel: 'Sign In',
  layout: 'vertical',
};

const result = FormSchema.safeParse(formConfig);
```

### Runtime Type Inference

```typescript
import { z } from 'zod';
import { ButtonSchema, InputSchema } from '@object-ui/types/zod';

// Infer TypeScript type from schema
type Button = z.infer<typeof ButtonSchema>;
type Input = z.infer<typeof InputSchema>;
```

### Generic Component Validation

```typescript
import { AnyComponentSchema } from '@object-ui/types/zod';

function validateComponent(config: unknown) {
  const result = AnyComponentSchema.safeParse(config);
  
  if (!result.success) {
    throw new Error(`Invalid component: ${result.error.message}`);
  }
  
  return result.data;
}
```

## Available Schemas

### Base Schemas
- `BaseSchema` - Foundation for all components
- `SchemaNodeSchema` - Recursive schema node type

### Layout Components (17)
- `DivSchema`, `SpanSchema`, `TextSchema`
- `ImageSchema`, `IconSchema`, `SeparatorSchema`
- `ContainerSchema`, `FlexSchema`, `StackSchema`
- `GridSchema`, `CardSchema`, `TabsSchema`
- `ScrollAreaSchema`, `ResizableSchema`
- `AspectRatioSchema`, `PageSchema`

### Form Components (17)
- `ButtonSchema`, `InputSchema`, `TextareaSchema`
- `SelectSchema`, `CheckboxSchema`, `RadioGroupSchema`
- `SwitchSchema`, `ToggleSchema`, `SliderSchema`
- `FileUploadSchema`, `DatePickerSchema`, `CalendarSchema`
- `InputOTPSchema`, `ComboboxSchema`, `LabelSchema`
- `CommandSchema`, `FormSchema`

### Data Display Components (14)
- `AlertSchema`, `BadgeSchema`, `AvatarSchema`
- `ListSchema`, `TableSchema`, `DataTableSchema`
- `MarkdownSchema`, `TreeViewSchema`, `ChartSchema`
- `TimelineSchema`, `BreadcrumbSchema`
- `KbdSchema`, `HtmlSchema`, `StatisticSchema`

### Feedback Components (8)
- `LoadingSchema`, `ProgressSchema`, `SkeletonSchema`
- `ToastSchema`, `ToasterSchema`, `SpinnerSchema`
- `EmptySchema`, `SonnerSchema`

### Disclosure Components (3)
- `AccordionSchema`, `CollapsibleSchema`, `ToggleGroupSchema`

### Overlay Components (10)
- `DialogSchema`, `AlertDialogSchema`, `SheetSchema`
- `DrawerSchema`, `PopoverSchema`, `TooltipSchema`
- `HoverCardSchema`, `DropdownMenuSchema`
- `ContextMenuSchema`, `MenubarSchema`

### Navigation Components (6)
- `HeaderBarSchema`, `SidebarSchema`, `BreadcrumbSchema`
- `PaginationSchema`, `NavigationMenuSchema`, `ButtonGroupSchema`

### Complex Components (5)
- `KanbanSchema`, `CalendarViewSchema`
- `FilterBuilderSchema`, `CarouselSchema`, `ChatbotSchema`

## Schema Structure

All component schemas follow the @objectstack/spec UI specification format:

```typescript
{
  // Required
  type: string,              // Component type identifier
  
  // Common Optional Properties
  id?: string,               // Unique identifier
  name?: string,             // Component name
  label?: string,            // Display label
  className?: string,        // Tailwind classes
  visible?: boolean,         // Visibility control
  disabled?: boolean,        // Disabled state
  
  // Type-specific properties...
}
```

## Validation Features

### Type Safety
- Strict type checking for all properties
- Enum validation for predefined values
- Recursive validation for nested structures

### Error Messages
```typescript
const result = ButtonSchema.safeParse({
  type: 'button',
  variant: 'invalid-variant'
});

// result.error.errors:
// [
//   {
//     code: 'invalid_enum_value',
//     path: ['variant'],
//     message: "Invalid enum value. Expected 'default' | 'secondary' | ...",
//   }
// ]
```

### Nested Validation
```typescript
// Validates nested components in Card
const cardWithChildren = CardSchema.parse({
  type: 'card',
  title: 'My Card',
  children: [
    { type: 'text', value: 'Hello' },
    { type: 'button', label: 'Click' }
  ]
});
```

## Best Practices

1. **Use safeParse()** for user input validation
   ```typescript
   const result = ButtonSchema.safeParse(userInput);
   if (!result.success) {
     // Handle errors gracefully
   }
   ```

2. **Use parse()** for internal configurations
   ```typescript
   // Throws error on invalid data
   const config = ButtonSchema.parse(internalConfig);
   ```

3. **Validate at boundaries**
   - API endpoints receiving component configs
   - Form submissions
   - Configuration file parsing
   - Component registration

4. **Combine with TypeScript types**
   ```typescript
   import type { ButtonSchema as ButtonType } from '@object-ui/types';
   import { ButtonSchema } from '@object-ui/types/zod';
   
   // Use type for declarations
   const config: ButtonType = { ... };
   
   // Use schema for validation
   ButtonSchema.parse(config);
   ```

## Performance

Zod schemas are designed for runtime validation:

- **Lazy evaluation** for recursive schemas (trees, menus)
- **Optional validation** - only validate when needed
- **Partial validation** - validate specific properties
- **Caching** - Zod internally caches schema structures

## Integration Examples

### With React Hook Form
```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSchema } from '@object-ui/types/zod';

const form = useForm({
  resolver: zodResolver(FormSchema),
});
```

### With API Routes
```typescript
import { ButtonSchema } from '@object-ui/types/zod';

export async function POST(req: Request) {
  const body = await req.json();
  const result = ButtonSchema.safeParse(body);
  
  if (!result.success) {
    return Response.json(
      { error: result.error },
      { status: 400 }
    );
  }
  
  // Process valid data
  return Response.json(result.data);
}
```

### With Component Registry
```typescript
import { AnyComponentSchema } from '@object-ui/types/zod';

function registerComponent(config: unknown) {
  // Validate before registration
  const validated = AnyComponentSchema.parse(config);
  registry.set(validated.type, validated);
}
```

## Migration from TypeScript-only Types

If you're currently using only TypeScript types:

```typescript
// Before (TypeScript only)
import type { ButtonSchema } from '@object-ui/types';
const button: ButtonSchema = { ... };

// After (with runtime validation)
import type { ButtonSchema as ButtonType } from '@object-ui/types';
import { ButtonSchema } from '@object-ui/types/zod';

const button: ButtonType = { ... };
const validated = ButtonSchema.parse(button);
```

## Contributing

When adding new component types:

1. Define TypeScript interface in `src/`
2. Create corresponding Zod schema in `src/zod/`
3. Export from `src/zod/index.zod.ts`
4. Add tests in `examples/zod-validation-example.ts`
5. Update this README

## License

MIT - Copyright (c) 2024-present ObjectStack Inc.
