# @object-ui/types

Pure TypeScript type definitions for Object UI - **The Protocol Layer**.

## Features

- 🎯 **Complete Type Coverage** - Every component has full TypeScript definitions
- 🏛️ **Built on @objectstack/spec** - Extends the universal UI component specification
- 📦 **Minimal Dependencies** - Only depends on @objectstack/spec (pure types)
- 🔌 **Framework Agnostic** - Use with React, Vue, or any framework
- 🌍 **Backend Agnostic** - Works with REST, GraphQL, ObjectQL, or local data
- 🎨 **Tailwind Native** - Designed for Tailwind CSS styling
- 📚 **Comprehensive JSDoc** - Every type is fully documented

## Installation

```bash
npm install @object-ui/types
# or
yarn add @object-ui/types
# or
pnpm add @object-ui/types
```

**Important:** This package depends on `@objectstack/spec` which provides the foundational protocol.

## Architecture: The Inheritance Chain

Object UI follows a strict **"Protocol First"** approach with a clear inheritance hierarchy:

```
@objectstack/spec                   ← The "Highest Law" - Universal protocol. The
                                      required range is declared in package.json,
                                      the authority; a copy here goes stale unnoticed.
    ↓
BaseSchema (@object-ui/types)       ← A component node: the base interface every
                                      UI component schema extends, carrying `type`
                                      plus the shared keys (visibleOn, hiddenOn, etc.)
    ↓
Specific Schemas                    ← Component implementations (ChartSchema, etc.)
    ↓
@object-ui/core (Engine)            ← Schema validation and expression evaluation
    ↓
@object-ui/react (Framework)        ← React renderer
    ↓
@object-ui/components (UI)          ← Shadcn/Tailwind implementation
```

This separation allows:
- ✅ Multiple UI implementations (Shadcn, Material, Ant Design)
- ✅ Multiple framework bindings (React, Vue, Svelte)
- ✅ Multiple backend adapters (REST, GraphQL, ObjectQL)
- ✅ Static analysis and validation without runtime dependencies
- ✅ Compliance with the ObjectStack ecosystem standards

## Usage

### Basic Example

```typescript
import type { FormSchema, InputSchema, ButtonSchema } from '@object-ui/types';

const loginForm: FormSchema = {
  type: 'form',
  fields: [
    {
      name: 'email',
      type: 'input',
      inputType: 'email',
      label: 'Email',
      required: true,
    },
    {
      name: 'password',
      type: 'input',
      inputType: 'password',
      label: 'Password',
      required: true,
    }
  ],
  submitLabel: 'Sign In'
};
```

### Advanced Example

```typescript
import type { DataTableSchema, FlexSchema, CardSchema } from '@object-ui/types';

const dashboard: CardSchema = {
  type: 'card',
  title: 'User Management',
  content: {
    type: 'data-table',
    columns: [
      { header: 'Name', accessorKey: 'name' },
      { header: 'Email', accessorKey: 'email' },
      { header: 'Role', accessorKey: 'role' }
    ],
    data: [], // Connected to data source
    pagination: true,
    searchable: true,
    selectable: true
  }
};
```

### Type Narrowing

```typescript
import type { AnySchema, SchemaByType } from '@object-ui/types';

function renderComponent(schema: AnySchema) {
  if (schema.type === 'input') {
    // TypeScript automatically narrows to InputSchema
    console.log(schema.placeholder);
  }
}

// Or use the utility type
type ButtonSchema = SchemaByType<'button'>;
```

### The strict authoring face

`@object-ui/types/zod` publishes **two** faces over the same declarations.

- The **rendering face** (`AnyComponentSchema`, `SchemaNodeSchema`, every named
  mirror) is tolerant: a node may carry keys the schema does not declare, because
  renderer props ride through it.
- The **strict authoring face** is a derived twin that closes every declared
  object, at every depth. It is meant for authoring-time checking — validating a
  document a person or an agent just wrote — where an undeclared key is far more
  likely to be a typo than a renderer prop.

```typescript
import {
  AnyComponentSchema,
  ButtonSchema,
  StrictAnyComponentSchema,
  deriveStrictAuthoringSchema,
} from '@object-ui/types/zod';

const document = { type: 'card', childrn: [] }; // note the typo

AnyComponentSchema.safeParse(document).success;       // true  — the tolerant face
StrictAnyComponentSchema.safeParse(document).success; // false — `unrecognized_keys: ["childrn"]`

// Take the strict twin of any schema on the face:
const StrictButton = deriveStrictAuthoringSchema(ButtonSchema);
```

The twins are derived from the mirrors, never hand-written, so they cannot drift
from them. Strictness here is a property of the parse, not of the declaration:
the derived schema carries the same TypeScript type as the schema it came from.
Opaque `custom` / `function` / `transform` validators have no shape to close;
`deriveStrictAuthoringSchema` reports each one it meets through the optional
`onOpaqueShape` callback.

## Type Categories

### Base Types

Foundation types that all components build upon:

- `BaseSchema` - The base interface for all components
- `SchemaNode` - Union type for schema nodes (objects, strings, numbers, etc.)
- `ComponentMeta` - Metadata for component registration
- `ComponentInput` - Input field definitions for designers/editors

### Layout Components

Structure and organization:

- `ContainerSchema` - Max-width container
- `FlexSchema` - Flexbox layout
- `GridSchema` - CSS Grid layout
- `CardSchema` - Card container
- `TabsSchema` - Tabbed interface

### Form Components

User input and interaction:

- `FormSchema` - Complete form with validation
- `InputSchema` - Text input field
- `SelectSchema` - Dropdown select
- `CheckboxSchema` - Checkbox input
- `RadioGroupSchema` - Radio button group
- `DatePickerSchema` - Date selection
- And 10+ more form components

### Data Display Components

Information presentation:

- `DataTableSchema` - Enterprise data table with sorting, filtering, pagination
- `TableSchema` - Simple table
- `ListSchema` - List with items
- `ChartSchema` - Charts and graphs
- `TreeViewSchema` - Hierarchical tree
- `TimelineSchema` - Timeline visualization

### Feedback Components

Status and progress:

- `LoadingSchema` - Loading spinner
- `ProgressSchema` - Progress bar
- `SkeletonSchema` - Loading placeholder
- `ToastSchema` - Toast notifications

### Overlay Components

Modals and popovers:

- `DialogSchema` - Modal dialog
- `SheetSchema` - Side panel/drawer
- `PopoverSchema` - Popover
- `TooltipSchema` - Tooltip
- `DropdownMenuSchema` - Dropdown menu

### Navigation Components

Menus and navigation:

- `HeaderBarSchema` - Top navigation bar
- `SidebarSchema` - Side navigation
- `BreadcrumbSchema` - Breadcrumb navigation
- `PaginationSchema` - Pagination controls

### Complex Components

Advanced composite components:

- `ObjectKanbanSchema` - Kanban board (`object-kanban`; the bare `kanban` node type key and its `KanbanSchema` arm retired in objectui#8802)
- `CalendarViewSchema` - Calendar with events
- `FilterBuilderSchema` - Advanced filter builder
- `CarouselSchema` - Image/content carousel
- `ChatbotSchema` - Chat interface

### Data Management

Backend integration:

- `DataSource` - Universal data adapter interface
- `QueryParams` - Query parameters (OData-style)
- `QueryResult` - Paginated query results
- `DataBinding` - Data binding configuration

## Design Principles

### 1. Protocol Agnostic

Types don't assume any specific backend:

```typescript
import type { DataSource, QueryParams, QueryResult } from '@object-ui/types';

// Two methods quoted from the shipped `DataSource`. `extends Pick` ties the
// quotation to the real interface: the day either member is renamed away or its
// return type changes, this block stops compiling.
interface DataSourceExcerpt<T = any> extends Pick<DataSource<T>, 'find' | 'create'> {
  find(resource: string, params?: QueryParams): Promise<QueryResult<T>>;
  create(resource: string, data: Partial<T>): Promise<T>;
  // Works with REST, GraphQL, ObjectQL, or anything
}
```

### 2. Tailwind Native

All components support `className` for Tailwind styling:

```typescript
import type { ButtonSchema } from '@object-ui/types';

const button: ButtonSchema = {
  type: 'button',
  label: 'Click Me',
  className: 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded'
};
```

### 3. Type Safe

Full TypeScript support with discriminated unions:

```typescript
import type { AnySchema, ButtonSchema, FormSchema, InputSchema } from '@object-ui/types';

// The shipped `AnySchema` carries 50+ members. These three are a slice of it,
// and the assignment below is what proves the slice really is part of the union.
type SchemaSlice = InputSchema | ButtonSchema | FormSchema;
declare const slice: SchemaSlice;
const anySchema: AnySchema = slice;

function render(schema: AnySchema) {
  switch (schema.type) {
    case 'input': /* schema is InputSchema */ break;
    case 'button': /* schema is ButtonSchema */ break;
  }
}
```

### 4. Composable

Components can nest indefinitely:

```typescript
import type { ContainerSchema, FlexSchema, SidebarSchema } from '@object-ui/types';

// The two leaves are annotated so the nesting below is checked against the
// shipped types rather than absorbed by `BaseSchema`'s index signature.
const sidebar: SidebarSchema = {
  type: 'sidebar',
  nav: [{ label: 'Home', href: '/' }]
};

const main: ContainerSchema = {
  type: 'container',
  children: [{ type: 'data-table', data: [] }]
};

const page: FlexSchema = {
  type: 'flex',
  direction: 'col',
  children: [
    { type: 'header-bar', title: 'My App' },
    {
      type: 'flex',
      direction: 'row',
      children: [sidebar, main]
    }
  ]
};
```

## Comparison

### vs Amis Types

- ✅ **Lighter** - No runtime dependencies
- ✅ **Tailwind Native** - Built for Tailwind CSS
- ✅ **Better TypeScript** - Full type inference
- ✅ **Framework Agnostic** - Not tied to React

### vs Formily Types

- ✅ **Full Pages** - Not just forms, entire UIs
- ✅ **Simpler** - More straightforward API
- ✅ **Better Docs** - Comprehensive JSDoc

## Contributing

We follow these constraints for this package:

1. **ZERO runtime dependencies** - Only TypeScript types
2. **No React imports** - Framework agnostic
3. **Comprehensive JSDoc** - Every property documented
4. **Protocol first** - Types define the contract

## Links

- 📚 [Documentation](https://www.objectui.org/docs/api/schema-reference)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/types)
- 📝 [Changelog](./CHANGELOG.md)
- 💻 [GitHub repository](https://github.com/objectstack-ai/objectui)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT
