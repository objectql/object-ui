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
import type { ObjectViewSchema } from '@object-ui/types';

// Now you can use view types in your schemas
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'users', // required — the ObjectQL object name
  defaultViewType: 'grid',
};
```

The object name key is **`objectName`**, and it is the only required key besides
`type`. There is no `object`, `viewMode`, `fields`, `mode` or `recordId` key on
this node — see "Schema API" below for the keys `ObjectView` actually reads.

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

Unified view component for ObjectQL objects. The keys below are the ones
`ObjectView` reads off the schema node (`src/ObjectView.tsx`); every example in
this README is typed with `ObjectViewSchema` from `@object-ui/types`, so a
missing `objectName` fails to compile.

```typescript
import type { ObjectViewSchema } from '@object-ui/types';

const shape: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'users', // required — ObjectQL object name
  title: 'Users',
  description: 'Everyone with an account',

  // --- List surface ---
  defaultViewType: 'grid', // grid | kanban | gallery | calendar | timeline | gantt | map
  listViews: { all: { label: 'All Users' } }, // named views; each needs a `label`
  defaultListView: 'all',
  table: { columns: ['name', 'email'] }, // grid configuration (see below)

  // --- Record surface (create / edit / read) ---
  layout: 'drawer', // drawer | modal | page
  form: { showSubmit: true }, // form configuration (see below)
  navigation: { mode: 'drawer' }, // row-click behaviour
  onNavigate: (recordId, mode) => {}, // required by layout/navigation 'page'

  // --- Toolbar ---
  showSearch: true,
  showFilters: true,
  showSort: true,
  showCreate: true,
  showViewSwitcher: false, // default false
  allowCreateView: false,
  viewActions: [{ type: 'share' }],

  // --- Built-in CRUD toggles ---
  operations: { create: true, read: true, update: true, delete: true },
};
```

Three structural facts this component's schema does **not** work the way an
older version of this README claimed:

- **`dataSource` is not a schema key.** It is a **required prop** of
  `ObjectViewProps` (`src/ObjectView.tsx`). Pass it to `<ObjectView>` directly,
  or let the registered renderer pull it off `SchemaRendererProvider` context.
  Putting `dataSource` inside the schema object does nothing.
- **There is no `viewMode`, and no per-record `mode` / `recordId`.** The list
  type is `defaultViewType` (plus `listViews` / `defaultListView`); create,
  edit and read are internal states of one record surface, opened by the
  toolbar's create button and by row actions, and rendered as a drawer, a modal
  or a page according to `layout`. Accordingly `ObjectViewSchema['form']` omits
  `mode` — the component sets it.
- **There are no `onCreate` / `onUpdate` / `onDelete` / `onSubmit` callbacks.**
  The component performs mutations itself through the `dataSource`. What you
  can author is `operations` (booleans that enable or disable each built-in)
  and `onNavigate(recordId, mode)`, which hands off to your router when the
  record surface is a page.

#### `table` and `form` sub-configuration

`table` carries grid configuration and `form` carries form configuration, but
`ObjectView` forwards a **fixed set of keys** from each rather than passing the
object through. Anything else you put in them is ignored:

| Sub-config | Keys `ObjectView` forwards |
| --- | --- |
| `table` | `columns`, `fields`, `title`, `description`, `defaultFilters`, `defaultSort`, `pageSize`, `selectable`, `operations`, `className` |
| `form` | `fields`, `customFields`, `sections`, `groups`, `layout`, `columns`, `title`, `description`, `subforms`, `buttons`, `defaults`, `initialValues`, `readOnly`, `showSubmit`, `submitText`, `showCancel`, `cancelText`, `showReset`, `className` |

Note that several of the forwarded `table` keys are the ones `ObjectGridSchema`
marks legacy — `fields`, `pageSize`, `selectable`, `defaultFilters` and
`defaultSort` each have a newer counterpart there (`columns`, `pagination`,
`selection`, `filter`, `sort`). `ObjectView` forwards the legacy spellings, so
on an `object-view` node those are the ones that take effect; `columns` is the
exception, forwarded alongside `fields` and preferred here. Shapes follow
`ObjectGridSchema`: `defaultSort` is a single `{ field, order }` object and
`defaultFilters` is a plain `Record` of field to value.

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

### Choosing the list type

The list is always rendered; `defaultViewType` picks which renderer draws it,
and `table` configures the grid:

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'users',
  defaultViewType: 'grid',
  table: {
    columns: ['name', 'email', 'role', 'created_at'],
    defaultSort: { field: 'created_at', order: 'desc' },
  },
};
```

Non-grid types (`kanban`, `gallery`, `calendar`, `timeline`, `gantt`, `map`)
are rendered through `SchemaRenderer`, so `@object-ui/react` and the matching
plugin must be installed for those.

### Configuring the record form

Create and edit share one record surface. `layout` chooses where it opens and
`form` configures what it contains — there is no separate "form view" node and
no authored `mode`:

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'users',
  layout: 'drawer', // drawer | modal | page
  form: {
    fields: ['name', 'email', 'role'],
    submitText: 'Save user',
    showCancel: true,
  },
};
```

When `layout` is omitted, the surface is derived from how heavy the object is
(`deriveRecordSurface`): a field-heavy object opens as a page, a light one as a
drawer, and mobile always pages.

### Opening a record

Reading a record is the same surface in its read state, reached by clicking a
row. `navigation.mode` decides how, and `onNavigate` is what hands a page-mode
record off to your router:

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'users',
  layout: 'page',
  navigation: { mode: 'page' }, // none | drawer | modal | page | split | popover | new_window
  onNavigate: (recordId, mode) => {
    // mode is 'view' or 'edit'
    router.push(`/users/${recordId}${mode === 'edit' ? '/edit' : ''}`);
  },
};
```

Without an `onNavigate` handler, `page` mode has nowhere to send the user, so
keep the two together. `navigation: { mode: 'none' }` (or `preventNavigation`)
makes rows inert.

## CRUD Operations

All four operations are built in and run against the `dataSource` prop. You do
not wire handlers for them — you switch them on or off with `operations`, and
`show*` controls whether the matching toolbar affordance is visible.

### Create

`operations.create` enables record creation; `showCreate` shows the button.
Both default to on, and the new-record form opens on the `layout` surface:

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'products',
  showCreate: true,
  operations: { create: true },
  layout: 'drawer',
  form: { fields: ['name', 'price', 'category'] },
};
```

With `layout: 'page'`, creation calls `onNavigate('new', 'edit')` instead of
opening a drawer, so the host route owns the form.

### Read/List

Search, filter and sort are toolbar toggles; column set, default filter,
default sort and page size live in `table`:

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'products',
  defaultViewType: 'grid',
  showSearch: true,
  showFilters: true,
  showSort: true,
  table: {
    columns: ['name', 'price', 'category'],
    defaultFilters: { category: 'electronics' },
    pageSize: 25,
  },
};
```

Saved views are `listViews`, keyed by view name, with `defaultListView`
selecting which opens first:

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'products',
  listViews: {
    all: { label: 'All Products', type: 'grid', columns: ['name', 'price'] },
    cheap: {
      label: 'Under 100',
      type: 'grid',
      filter: [{ field: 'price', operator: 'lessThan', value: 100 }],
    },
  },
  defaultListView: 'all',
};
```

### Update

Editing is reached from a row's edit action; `operations.update` is what gates
it. The edited record is chosen by the click, never by an authored `recordId`:

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'products',
  operations: { update: true },
  layout: 'modal',
  form: { fields: ['name', 'price'], submitText: 'Update' },
};
```

Under `layout: 'page'` this becomes `onNavigate(recordId, 'edit')`.

### Delete

`operations.delete` enables both the per-row delete and bulk delete; there is
no `enableDelete` key and no `onDelete` callback:

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'products',
  operations: { create: true, read: true, update: true, delete: false },
};
```

## Integration with ObjectQL

The plugin works seamlessly with ObjectStack:

The adapter is the `dataSource` **prop**, not part of the schema:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';
import { ObjectView } from '@object-ui/plugin-view';
import type { ObjectViewSchema } from '@object-ui/types';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token',
});

const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'contacts',
  defaultViewType: 'grid',
  showSearch: true,
  showSort: true,
  table: {
    columns: ['first_name', 'last_name', 'email', 'company'],
    pageSize: 25,
  },
};

<ObjectView schema={schema} dataSource={dataSource} />;
```

Rendering the same node through the registry instead (`type: 'object-view'` in
a larger schema tree) works because `ObjectViewRenderer` reads the
`dataSource` off `SchemaRendererProvider` context — again, not off the schema.

## Field Configuration

There is no `fieldConfig` key. Labels, types, requiredness and validation come
from the object's own metadata, which the view reads through the `dataSource` —
that is what makes the view "automatic". What the schema node chooses is
**which** fields appear and how they are grouped:

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'users',
  table: {
    columns: ['name', 'email', 'role'], // grid columns
  },
  form: {
    fields: ['name', 'email', 'role'], // flat field list, or use sections
    sections: [
      { label: 'Identity', fields: ['name', 'email'] },
      { label: 'Access', fields: ['role'] },
    ],
    columns: 2,
  },
};
```

To override a field's rendering beyond what the object metadata says, use
`form.customFields` (full field definitions) rather than a per-field patch on
the view node.

## Advanced Features

### Child records (master-detail)

There is no `nestedFields` key. A child collection is declared as a **subform**
on the record form, which is where an order's line items belong:

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'orders',
  layout: 'page',
  form: {
    fields: ['order_number', 'customer', 'total'],
    subforms: [
      {
        childObject: 'order_items',
        title: 'Line items',
        columns: ['product', 'quantity', 'price'],
      },
    ],
  },
};
```

Only `childObject` is required — the relationship field and the grid columns are
derived from the child object's metadata unless you override them
(`relationshipField`, `columns`).

### View tabs

There is no `tabs` key, and `form.layout` has no tabbed value
(`vertical | horizontal | inline | grid`). The tab strip this package ships is
the **saved-view** tab bar: declare the views and render `<ViewTabBar>` (or let
a host such as `@object-ui/app-shell` do it):

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'users',
  showViewSwitcher: true,
  allowCreateView: true,
  listViews: {
    active: { label: 'Active', type: 'grid', columns: ['name', 'email'] },
    admins: {
      label: 'Admins',
      type: 'grid',
      filter: [{ field: 'role', operator: 'equals', value: 'admin' }],
    },
  },
  defaultListView: 'active',
};
```

To group a *form's* fields instead, use `form.sections` as shown under "Field
Configuration".

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
