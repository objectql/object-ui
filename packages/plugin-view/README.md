# @object-ui/plugin-view

Object View plugin for Object UI - Unified component for displaying and managing ObjectQL data with automatic form and grid generation.

## Features

- **Automatic Views** - Generate views from ObjectQL schemas
- **Form Generation** - Auto-generate forms from object definitions
- **Grid Generation** - Auto-generate data grids
- **CRUD Operations** - Built-in create, read, update, delete
- **Field Mapping** - Automatic field type detection
- **Validation** - Schema-based validation
- **ObjectQL Integration** - Native ObjectStack support
- **View Controls** - View switcher, filter UI, and sort UI components

## Installation

```bash
pnpm add @object-ui/plugin-view
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-view';

// Now you can use view types in your schemas
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'grid'
};
```

### What the side-effect import registers

Registration is *only* a side effect of importing the package — the single
`import '@object-ui/plugin-view'` above is the whole of it. There is no
components map to iterate over: importing the entry point runs the
`ComponentRegistry.register(...)` calls in `src/index.tsx`, which claim these
schema types:

| Schema `type` | Namespaced key | Renderer |
| --- | --- | --- |
| `object-view` | `plugin-view:object-view` | `ObjectViewRenderer` |
| `view` | `plugin-view:view` | `ObjectViewRenderer` (alias of `object-view`) |
| `view-switcher` | `view:view-switcher` | `ViewSwitcher` |
| `filter-ui` | `view:filter-ui` | `FilterUI` |
| `sort-ui` | `view:sort-ui` | `SortUI` |
| `shared-view-link` | `view:shared-view-link` | `SharedViewLink` |
| `view:simple` | `plugin-view:view:simple` | `SimpleViewRenderer` (container) |

Both spellings resolve — `register` stores the namespaced key *and* a bare-`type`
fallback (`packages/core/src/registry/Registry.ts:195,240`). Note the namespaces
are not uniform: `object-view` / `view` / `view:simple` register under
`plugin-view`, the four control components under `view`.

`ObjectViewRenderer` is a thin internal wrapper — it pulls `dataSource` off the
renderer context and hands the schema to `ObjectView`. It is not exported,
because `ObjectView` itself takes `dataSource` as a **required prop**, not as a
schema key.

### Public exports

The package exports components, helpers and their types — not a registry map:

```typescript
import {
  ObjectView, // ObjectQL-integrated view: list + integrated create/edit
  ViewSwitcher, // registered renderer for `view-switcher`
  FilterUI, // registered renderer for `filter-ui`
  SortUI, // registered renderer for `sort-ui`
  SharedViewLink, // registered renderer for `shared-view-link`
  ViewTabBar, // horizontal strip of saved-view tabs
  ManageViewsDialog, // sortable dialog over every saved view
  deriveRecordSurface, // record schema -> drawer / modal / page surface
  deriveRecordFlowSurface,
  deriveOverlaySize,
  overlayWidthFor,
  RECORD_SURFACE_PAGE_THRESHOLD,
  deriveFieldOptions, // object fields -> picker options
  toFilterGroup, // filter rules -> FilterGroup
  toSortItems, // sort config -> SortItem[]
  VIEW_TYPE_LABELS,
  VIEW_TYPE_OPTIONS,
  isImageLikeField,
  isGeoLikeField,
  pickPreferredField,
  KANBAN_GROUP_PREFERRED,
  PRIMARY_DATE_PREFERRED,
  END_DATE_PREFERRED,
  TITLE_PREFERRED,
} from '@object-ui/plugin-view';

import type {
  ObjectViewProps,
  ViewSwitcherProps,
  FilterUIProps,
  SortUIProps,
  SharedViewLinkProps,
  ViewTabBarProps,
  ViewTabItem,
  AvailableViewType,
  ManageViewsDialogProps,
  RecordSurface,
  RecordFlow,
  RecordFlowContainer,
  RecordFlowSurface,
  OverlaySize,
  FieldOption,
} from '@object-ui/plugin-view';
```

To serve one of these components under a registry key of your own, register the
exported component under that key:

```typescript
import { ComponentRegistry } from '@object-ui/core';
import { ViewSwitcher } from '@object-ui/plugin-view';

ComponentRegistry.register('my-switcher', ViewSwitcher, {
  namespace: 'my-app',
});
```

## Schema API

### ObjectView

Unified view component for ObjectQL objects:

```typescript
{
  type: 'object-view',
  object: string,                 // ObjectQL object name
  viewMode?: 'grid' | 'form' | 'detail',
  fields?: string[],              // Fields to display
  dataSource?: DataSource,
  onCreate?: (data) => void,
  onUpdate?: (id, data) => void,
  onDelete?: (id) => void,
  className?: string
}
```

### ViewSwitcher

Toggle between multiple view configurations:

```typescript
{
  type: 'view-switcher',
  views: [
    { type: 'grid', label: 'Grid', schema: { type: 'text', content: 'Grid content' } },
    { type: 'kanban', label: 'Kanban', schema: { type: 'text', content: 'Kanban content' } }
  ],
  defaultView: 'grid',
  variant: 'tabs',
  position: 'top',
  persistPreference: true,
  storageKey: 'my-view-switcher'
}
```

### FilterUI

Render a filter toolbar with multiple field types:

```typescript
{
  type: 'filter-ui',
  layout: 'popover',
  showApply: true,
  showClear: true,
  filters: [
    { field: 'name', label: 'Name', type: 'text', placeholder: 'Search name' },
    { field: 'status', label: 'Status', type: 'select', options: [
      { label: 'Open', value: 'open' },
      { label: 'Closed', value: 'closed' }
    ] },
    { field: 'created_at', label: 'Created', type: 'date-range' }
  ]
}
```

### SortUI

Configure sorting with dropdowns or buttons:

```typescript
{
  type: 'sort-ui',
  variant: 'dropdown',
  multiple: true,
  fields: [
    { field: 'name', label: 'Name' },
    { field: 'created_at', label: 'Created At' }
  ],
  sort: [{ field: 'name', direction: 'asc' }]
}
```

## Examples

### Grid View

Display objects in a data grid:

```typescript
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'grid',
  fields: ['name', 'email', 'role', 'created_at'],
  dataSource: myDataSource
};
```

### Form View

Create or edit objects with a form:

```typescript
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'form',
  mode: 'create',
  fields: ['name', 'email', 'role'],
  onSubmit: (data) => {
    console.log('Form submitted:', data);
  }
};
```

### Detail View

Display a single object's details:

```typescript
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'detail',
  recordId: '123',
  fields: ['name', 'email', 'role', 'bio', 'created_at']
};
```

## CRUD Operations

### Create

```typescript
const schema = {
  type: 'object-view',
  object: 'products',
  viewMode: 'form',
  mode: 'create',
  onCreate: async (data) => {
    const newProduct = await dataSource.create('products', data);
    console.log('Created:', newProduct);
  }
};
```

### Read/List

```typescript
const schema = {
  type: 'object-view',
  object: 'products',
  viewMode: 'grid',
  pagination: true,
  searchable: true,
  filters: {
    category: 'electronics'
  }
};
```

### Update

```typescript
const schema = {
  type: 'object-view',
  object: 'products',
  viewMode: 'form',
  mode: 'edit',
  recordId: '123',
  onUpdate: async (id, data) => {
    await dataSource.update('products', id, data);
    console.log('Updated product:', id);
  }
};
```

### Delete

```typescript
const schema = {
  type: 'object-view',
  object: 'products',
  viewMode: 'grid',
  enableDelete: true,
  onDelete: async (id) => {
    await dataSource.delete('products', id);
    console.log('Deleted product:', id);
  }
};
```

## Integration with ObjectQL

The plugin works seamlessly with ObjectStack:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

const schema = {
  type: 'object-view',
  object: 'contacts',
  viewMode: 'grid',
  dataSource,
  fields: ['first_name', 'last_name', 'email', 'company'],
  searchable: true,
  sortable: true,
  pagination: {
    pageSize: 25
  }
};
```

## Field Configuration

Customize field display and behavior:

```typescript
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'form',
  fieldConfig: {
    name: {
      label: 'Full Name',
      required: true,
      placeholder: 'Enter name'
    },
    email: {
      label: 'Email Address',
      type: 'email',
      required: true,
      validation: [
        { type: 'email', message: 'Invalid email format' }
      ]
    },
    role: {
      label: 'User Role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
        { label: 'Guest', value: 'guest' }
      ]
    }
  }
};
```

## Advanced Features

### Nested Objects

```typescript
const schema = {
  type: 'object-view',
  object: 'orders',
  viewMode: 'detail',
  fields: ['order_number', 'customer.name', 'items', 'total'],
  nestedFields: {
    items: {
      type: 'object-grid',
      object: 'order_items',
      fields: ['product.name', 'quantity', 'price']
    }
  }
};
```

### Tabs View

```typescript
const schema = {
  type: 'object-view',
  object: 'users',
  viewMode: 'tabs',
  tabs: [
    { label: 'Details', fields: ['name', 'email', 'bio'] },
    { label: 'Settings', fields: ['theme', 'notifications', 'timezone'] },
    { label: 'Activity', type: 'object-grid', object: 'user_activities' }
  ]
};
```

## TypeScript Support

This package's type export surface is the seven `*Props` types plus the
record-surface and field-option types listed under "Public exports" — it ships
**no schema types**. The authored `type: 'object-view'` node is typed by
`@object-ui/types`, which this package imports (`src/ObjectView.tsx`) without
re-exporting, so import it from there:

| Import from `@object-ui/types` | What it types |
| --- | --- |
| `ObjectViewSchema` | the whole `type: 'object-view'` node — `objectName` (required), `title`, `description`, `layout`, `defaultViewType`, `listViews`, `defaultListView`, `navigation`, `table`, `form`, `searchableFields`, `filterableFields`, `show*`, `operations`, `onNavigate`, `viewTabBar`, `viewActions` |
| `NamedListView` | one entry of `listViews` |
| `ViewNavigationConfig` | `navigation` — row/item click behaviour |
| `ViewTabBarConfig` | `viewTabBar` — tab-bar UX (inline add, overflow, indicators) |

```typescript
import type { ObjectViewSchema } from '@object-ui/types';

const userView: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'users',
  defaultViewType: 'grid',
  // Displayed columns are grid configuration, inherited from ObjectGridSchema.
  table: { columns: ['name', 'email', 'role'] },
};
```

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-view)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-view)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).

## Multi-view UX

In addition to the renderer, the package ships two components that wrap an
object's set of saved views (Airtable / Notion-style):

- **`<ViewTabBar>`** — a horizontal strip of view tabs. Per-tab chevron menu
  exposes rename, pin, duplicate, set default, delete, and "Manage all
  views…". An overflow `… N more` dropdown surfaces the remaining views and
  links to the management dialog. (In-place tab drag is intentionally
  disabled — reordering happens in `<ManageViewsDialog>` to avoid the
  ambiguity of "does dragging the visible tab change the global order or
  just the visible subset?".)
- **`<ManageViewsDialog>`** — a Shadcn `Dialog` containing a vertical sortable
  list of **every** view (visible + overflow + metadata-defined). Supports
  drag-reorder, search, inline rename, pin / set-default toggles, and a per-row
  `⋯` action menu (rename, duplicate, edit configuration, set default,
  pin/unpin, delete). Open it from the chevron menu's "Manage all views…"
  item or from the header of the overflow `… N more` dropdown.

Both components share the same callback surface
(`onRenameView`, `onDeleteView`, `onReorderViews`, …) so a host like
`@object-ui/app-shell`'s `ObjectView` wires the same set of handlers into
both. View ordering is persisted to `localStorage` under
`viewOrder:{objectName}` and, for backend-saved views, also written back as
`sortOrder`.
