# @object-ui/plugin-grid

Grid plugin for Object UI - Advanced data grid with sorting, filtering, and pagination.

## Features

- **Data grid** — enterprise-grade grid over one ObjectQL object
- **Sorting** — per column (`ListColumn.sortable`), with an initial `sort` order
- **Filtering & search** — a metadata `filter` on the query, plus a toolbar search
  over `searchableFields`
- **Pagination** — `pagination: { pageSize, pageSizeOptions }`
- **Row selection** — `selection: { type: 'single' | 'multiple' }`
- **Inline editing** — `editable`, persisted through the host's data source

## Installation

```bash
pnpm add @object-ui/plugin-grid
```

## Usage

### Registration is a side effect of the import

There is no registration call to make. Importing the package entry once runs the
three `ComponentRegistry.register(…)` calls in `src/index.tsx`, and from then on
the schema types below resolve:

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-grid';

// The data grid is `object-grid`, and it queries an object — see below for why
// this is not `type: 'grid'`.
const schema = {
  type: 'object-grid',
  objectName: 'users',
  columns: ['name', 'email']
};
```

### The schema types this package claims

`register(type, component, { namespace })` publishes `namespace:type`, and — unless
`skipFallback` is set — the bare `type` as a back-compat fallback
(`packages/core/src/registry/Registry.ts:194`, fallback at `:226-240`). So the
three calls in `src/index.tsx` claim exactly these keys:

| `register(…)` call | Namespaced key | Bare fallback |
| --- | --- | --- |
| `('object-grid', ObjectGridRenderer, { namespace: 'plugin-grid' })` — `src/index.tsx:181` | `plugin-grid:object-grid` | `object-grid` |
| `('grid', ObjectGridRenderer, { namespace: 'view', skipFallback: true })` — `src/index.tsx:193` | `view:grid` | **none** — `skipFallback: true` |
| `('import-wizard', ImportWizardRenderer, { namespace: 'plugin-grid' })` — `src/index.tsx:216` | `plugin-grid:import-wizard` | `import-wizard` |

**Bare `grid` is deliberately not ours.** `skipFallback: true` on the second call
keeps this plugin from claiming it, because `grid` belongs to the CSS Grid *layout*
container in `@object-ui/components`
(`src/renderers/layout/grid.tsx:50`), whose schema type is `GridSchema` in
`@object-ui/types` (`src/layout.ts:202` — `columns` there is a **column count**,
not a column list). A schema written as `{ type: 'grid', columns: [...] }` therefore
renders that layout container, not this data grid. Use `object-grid`, or `view:grid`
when you want the namespaced spelling.

### Registering the renderer under your own key

If you need the data grid under an additional key, register the exported renderer
directly — that is what a "manual registration" is here:

```typescript
import { ObjectGridRenderer } from '@object-ui/plugin-grid';
import { ComponentRegistry } from '@object-ui/core';

ComponentRegistry.register('my-grid', ObjectGridRenderer, {
  namespace: 'my-app',
  label: 'My Grid',
  category: 'plugin',
});
```

### Exports

The complete public surface — 20 values and 29 types:

```typescript
import {
  ObjectGrid,
  ObjectGridRenderer,
  VirtualGrid,
  SplitPaneGrid,
  ImportWizard,
  InlineEditing,
  FormulaBar,
  GroupRow,
  RowActionMenu,
  BulkActionBar,
  formatActionLabel,
  inferColumnType,
  parseSpreadsheetFile,
  parseClipboardTable,
  useCellClipboard,
  useColumnSummary,
  useGradientColor,
  useGroupReorder,
  useGroupedData,
  useRowColor,
} from '@object-ui/plugin-grid';

import type {
  ObjectGridComponentProps,
  ObjectGridColumnState,
  ObjectGridExternalPaginationProps,
  ObjectGridProps, // deprecated alias of ObjectGridComponentProps (objectui#4650)
  VirtualGridProps,
  VirtualGridColumn,
  SplitPaneGridProps,
  ImportWizardProps,
  ImportResult,
  InlineEditingProps,
  FormulaBarProps,
  GroupRowProps,
  RowActionMenuProps,
  BulkActionBarProps,
  GroupEntry,
  UseGroupedDataResult,
  AggregationType,
  AggregationConfig,
  AggregationResult,
  CellRange,
  UseCellClipboardOptions,
  UseCellClipboardResult,
  GradientStop,
  UseGradientColorOptions,
  UseGroupReorderOptions,
  UseGroupReorderResult,
  ColumnSummarySetting,
  ColumnSummaryType,
  ColumnSummaryResult,
} from '@object-ui/plugin-grid';
```

The *schema* types are not here — they live in `@object-ui/types`
(`ObjectGridSchema`, `ListColumn`), because the schema is the shared authoring
contract rather than this package's component API.

## Schema API

### Grid

A grid node is an `ObjectGridSchema`: one required `objectName`, and keys drawn
from the list this package **declares** as its authoring surface
(`GRID_QUERY_INPUTS`, `src/index.tsx:145`) — the same list that feeds the designer
panel and the generated `sdui-intrinsics.d.ts`, so what is authorable here is what
the renderer reads.

```typescript
import type { ObjectGridSchema } from '@object-ui/types';

const grid: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  columns: ['name', 'email'],
  sort: [{ field: 'created', order: 'desc' }],
  pagination: { pageSize: 20 },
  selection: { type: 'multiple' },
};
```

| Key | Type | Notes |
| --- | --- | --- |
| `objectName` | `string` (**required**) | The object queried. There is no `object`. |
| `columns` | `string[] \| ListColumn[]` | Field names or column objects — see below. |
| `label` | `I18nLabel` | Table caption and export title. |
| `filter` | `ViewFilterRule[]` | Lowered to `$filter`. |
| `sort` | `[{ field, order }]` | Initial order; a header click replaces it. |
| `pagination` | `PaginationConfig` | `{ pageSize?, pageSizeOptions? }` — **strict**, and its presence is what enables paging. |
| `searchableFields` | `string[]` | A non-empty list is what enables the toolbar search. |
| `data` | `ViewData` | Bypasses the object query — see [Inline data](#inline-data). |
| `selection` | `SelectionConfig` | `{ type: 'none' \| 'single' \| 'multiple' }`. |
| `rowActions` / `bulkActions` | `string[]` | **Names** of actions, not definitions. |
| `editable` / `singleClickEdit` | `boolean` | Inline editing — see [Inline Editing](#inline-editing). |
| `navigation` | `NavigationConfig` | What a row click does, `{ mode: 'page' \| 'drawer' \| 'modal' \| 'split' \| 'none', … }`. |
| `operations` | `object` | Toggles the built-in CRUD/export/import affordances, e.g. `{ delete: false }`. |
| `rowHeight`, `frozenColumns`, `resizable`, `reorderableColumns`, `showColumnTypeIcons`, `rowColor`, `conditionalFormatting`, `grouping`, `aggregations`, `exportOptions`, `className` | | The rest of the declared surface. |

**There is no `sortable`, `filterable`, `onRowClick`, `onSelectionChange`,
`onCellChange`, `onRowSave`, `onBatchSave` or `object` on this schema.** The
booleans do not exist at all; the five `on*` names are **component props**
(`ObjectGridComponentProps`), which no metadata document can carry — see
[Row callbacks are component props](#row-callbacks-are-component-props).

### Column Definition

A column is either a **field name** (`'name'`) or a `ListColumn` object. `ListColumn`
is declared by `@objectstack/spec/ui` (`ListColumnSchema`) and re-exported from
`@object-ui/types`; it is the type of `ObjectGridSchema['columns']`, so it is the
same column vocabulary the saved-view metadata uses.

| Key | Type | Meaning |
| --- | --- | --- |
| `field` | `string` (**required**) | The field this column reads. There is no `accessorKey`. |
| `label` | `string \| Record<string, string>` | Header text, or an inline locale map. There is no `header`. |
| `width` | `number` | Column width in pixels. |
| `align` | `'left' \| 'center' \| 'right'` | Cell alignment. |
| `hidden` | `boolean` | Hidden by default, revealable in the column chooser. |
| `sortable` | `boolean` | Allow sorting on this column. |
| `resizable` | `boolean` | Allow dragging this column's width. |
| `wrap` | `boolean` | Wrap long cell text instead of eliding it. |
| `type` | `string` | Override the rendered cell type instead of inferring it from the field. |
| `pinned` | `'left' \| 'right'` | Freeze the column to one edge. |
| `summary` | `ColumnSummary \| { type; field? }` | Footer aggregation — see [Column Summaries](#column-summaries). |
| `prefix` | `{ field: string; type?: 'text' \| 'badge' }` | Render a second field inline before the value. |
| `link` | `boolean` | Render the value as a link to the record. |
| `action` | `string` | Run a named action when the cell is clicked. |

`ListColumnSchema` is a **strict** Zod object, so an unknown key is rejected rather
than ignored — a column is spelled this one way.

```typescript
import type { ListColumn } from '@object-ui/types';

const columns: ListColumn[] = [
  { field: 'name', label: 'Full Name', width: 200, sortable: true, pinned: 'left', link: true },
  { field: 'stage', type: 'select', prefix: { field: 'health', type: 'badge' }, wrap: true },
  { field: 'amount', type: 'currency', align: 'right', summary: 'sum', resizable: true },
  { field: 'owner_id', label: { en: 'Owner', 'zh-CN': '负责人' }, hidden: true, action: 'reassign' },
];
```

### Column Summaries

A column can declare a footer aggregation with `summary`, either as a shorthand
string or as an object that aggregates a different field than the one displayed:

```json
{
  "columns": [
    { "field": "name", "summary": "count_filled" },
    { "field": "amount", "type": "currency", "summary": "sum" },
    { "field": "owner", "summary": { "type": "count_unique", "field": "owner_id" } }
  ]
}
```

The accepted values are `ColumnSummarySchema` from `@objectstack/spec`:

| `summary` | Footer shows | Reads |
|---|---|---|
| `none` | nothing — the column opts out | — |
| `count` | number of rows | every row |
| `count_filled` | rows whose cell is non-empty | raw values |
| `count_empty` | rows whose cell is empty | raw values |
| `count_unique` | distinct non-empty values | raw values |
| `percent_filled` | share of rows that are non-empty | raw values |
| `percent_empty` | share of rows that are empty | raw values |
| `sum` | total | numeric values |
| `avg` | mean | numeric values |
| `min` | smallest | numeric values |
| `max` | largest | numeric values |

A cell counts as empty when it is `null`, `undefined`, `""` or an empty array,
so an unset multi-select or lookup reads as empty rather than as a filled `[]`.

The count and percent families read raw cell values, so they work on text,
select and lookup columns. `sum`/`avg`/`min`/`max` need numeric values (numeric
strings are parsed) and render nothing when the column has none.

A `currency` or `percent` column formats its `sum`/`avg`/`min`/`max` in that
unit. Counts stay plain cardinalities and percentages carry their own `%`, so
`count_unique` on a currency column reads `Unique: 3`, not `$3.00`.

The footer row renders only when at least one column resolves to a summary — a
view whose columns are all `none` (or carry no `summary`) has no footer.

## Examples

Every example below is annotated `ObjectGridSchema`, which is the point: an
un-annotated `const schema = { … }` type-checks no matter what is written in it,
so a snippet that carries no annotation cannot tell you whether its keys are real.
And note the `type` — `object-grid`, never `grid`. Bare `grid` renders the CSS Grid
*layout container* from `@object-ui/components`
([above](#the-schema-types-this-package-claims)), which is how a copied example ends
up leaking `columns="[object Object]"` into the DOM instead of drawing a table
(objectui#4787).

### Basic Grid

```typescript
import type { ObjectGridSchema } from '@object-ui/types';

const schema: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  columns: [
    { field: 'name', label: 'Name', width: 200, sortable: true },
    { field: 'email', label: 'Email' },
    { field: 'role', label: 'Role' },
    { field: 'status', label: 'Status', type: 'select' },
  ],
  sort: [{ field: 'name', order: 'asc' }],
  pagination: { pageSize: 20 },
};
```

Sorting is declared **per column** (`ListColumn.sortable`) — there is no top-level
`sortable` switch, and none is needed: a column is sortable by default, so the key
is there to turn one off.

### Inline data

A grid normally queries `objectName`. To render fixed rows instead — demos,
fixtures, tests — give it a `ViewData` with the `value` provider. The rows go
under `items`; a bare array is the deprecated `staticData` spelling.

```typescript
import type { ObjectGridSchema } from '@object-ui/types';

const schema: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email' },
  ],
  data: {
    provider: 'value',
    items: [
      { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Active' },
    ],
  },
};
```

### Cell appearance

A column does not carry a render function. What it can say is which **cell type**
to use and how to decorate the value — the same vocabulary the saved-view metadata
uses, so a grid authored by hand and one authored in the designer render alike.

```typescript
import type { ListColumn } from '@object-ui/types';

const columns: ListColumn[] = [
  { field: 'status', type: 'select' },
  { field: 'amount', type: 'currency', align: 'right', summary: 'sum' },
  { field: 'name', link: true, prefix: { field: 'health', type: 'badge' } },
  { field: 'owner_id', action: 'reassign' },
];
```

`link: true` renders the value as a link to the record and `action: 'reassign'`
runs a named action on click — that is the metadata form of the "Actions column"
a render function used to be written for. A genuinely custom cell **renderer** is
a component-layer concern: `VirtualGridColumn.cell` on `VirtualGrid`, a React prop,
not an authoring key.

### Selectable Grid

```typescript
import type { ObjectGridSchema } from '@object-ui/types';

const schema: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  columns: ['name', 'email'],
  selection: { type: 'multiple' },
  bulkActions: ['delete', 'export'],
};
```

`selection.type` is the canonical spelling; the boolean `selectable` is a
deprecated legacy alias, read only when `selection` is absent. Declaring bulk
actions auto-enables multi-select, so the two keys agree by construction.

To react to a selection in React, pass the `onRowSelect` **component prop** —
see [Row callbacks are component props](#row-callbacks-are-component-props).

### Grid with Pagination

```typescript
import type { ObjectGridSchema } from '@object-ui/types';

const schema: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  columns: ['name', 'email'],
  pagination: { pageSize: 10, pageSizeOptions: [10, 20, 50, 100] },
};
```

`PaginationConfig` is a **strict** object of exactly `pageSize` and
`pageSizeOptions` — a page-size picker is offered whenever `pageSizeOptions` is
set, so there is no separate `showSizeChanger` toggle to write.

## Integration with Data Sources

**The adapter is not a schema key.** A schema is a serialisable document; a live
adapter is an object with methods, so it cannot travel in one. The grid reads its
adapter from React context — `useSchemaContext()` at `src/index.tsx:80` — which the
host installs once, above the whole tree:

```tsx
import { SchemaRendererProvider, SchemaRenderer } from '@object-ui/react';
import { createObjectStackAdapter } from '@object-ui/data-objectstack';
import '@object-ui/plugin-grid';
import type { ObjectGridSchema } from '@object-ui/types';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token',
});

const schema: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email' },
    { field: 'created', label: 'Created', type: 'datetime' },
  ],
  filter: [{ field: 'status', operator: 'equals', value: 'active' }],
  searchableFields: ['name', 'email'],
  pagination: { pageSize: 20 },
};

export const App = () => (
  <SchemaRendererProvider dataSource={dataSource}>
    <SchemaRenderer schema={schema} />
  </SchemaRendererProvider>
);
```

The object comes from `objectName`; there is no `object` key. Filtering is the
metadata `filter` (lowered to `$filter`) and search is `searchableFields` (lowered
to `$searchFields`) — a non-empty list is what puts the search box in the toolbar.

> A top-level `dataSource` **does** mean something on a schema node, but it is not
> this: it is the spec's element **binding** (`PageComponentSchema.dataSource`,
> objectstack#6953) — a descriptor such as `{ object: 'users', view: 'my_view' }`,
> resolved by `useElementDataSource`
> (`packages/react/src/hooks/useElementDataSource.ts:139`) and mapped onto this
> grid's keys by the gate at `src/index.tsx:88`. Handing that slot a live adapter is
> rejected on purpose: the predicate refuses any value carrying a `find` method
> (`packages/core/src/data-scope/element-data-source.ts:131`), so an adapter written
> there is silently ignored rather than mistaken for a binding. Pass adapters
> through the provider above; see the spec for the binding's own surface.

## Features

### Sorting

Columns sort by default. `sortable` is a **per-column** key, used to turn a column
off; the grid-level `sort` declares the order the grid opens with.

```typescript
import type { ObjectGridSchema } from '@object-ui/types';

const schema: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  sort: [{ field: 'created', order: 'desc' }],
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email', sortable: false },
  ],
};
```

### Filtering and search

There is no per-column filter key. A grid narrows its query two ways: a `filter`
baked into the metadata, and a toolbar search over the fields named in
`searchableFields`.

```typescript
import type { ObjectGridSchema } from '@object-ui/types';

const schema: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  filter: [
    { field: 'status', operator: 'equals', value: 'active' },
    { field: 'created', operator: 'after', value: '2026-01-01' },
  ],
  searchableFields: ['name', 'email'],
  columns: ['name', 'email', 'status'],
};
```

### Row Actions

`rowActions` and `bulkActions` are lists of **action names** — the actions
themselves live in the object's action set, so the same action behaves identically
wherever it is offered. They are `string[]`, not inline definitions with callbacks.

```typescript
import type { ObjectGridSchema } from '@object-ui/types';

const schema: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  columns: ['name', 'email'],
  rowActions: ['view', 'edit', 'delete'],
  selection: { type: 'multiple' },
  bulkActions: ['delete', 'export'],
};
```

### Row callbacks are component props

`onRowClick`, `onRowSelect`, `onCellChange`, `onRowSave`, `onBatchSave`, `onEdit`,
`onDelete`, `onBulkDelete` and `onAddRecord` are React props on
`ObjectGridComponentProps` — they are functions, so no metadata document can hold
them, and writing one into a schema does nothing at all: the grid builds the inner
table's handlers itself and never reads a callback off the schema.

```tsx
import { ObjectGrid } from '@object-ui/plugin-grid';
import type { ObjectGridComponentProps } from '@object-ui/plugin-grid';

export const Grid = (props: ObjectGridComponentProps) => (
  <ObjectGrid
    {...props}
    onRowClick={(record) => console.log('Row clicked:', record)}
    onRowSelect={(rows) => console.log('Selection changed:', rows)}
  />
);
```

Note `onRowSelect` — the prop that reports a selection change is spelled that way;
there is no `onSelectionChange` on this component.

The declarative alternative, which *is* metadata and survives a round trip through
storage, is `navigation`: `{ mode: 'page' | 'drawer' | 'modal' | 'split' | 'none' }`
decides what a row click does without any host code.

### Inline Editing

Enable inline cell editing for quick updates:

```typescript
import type { ObjectGridSchema } from '@object-ui/types';

const schema: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  columns: [
    { field: 'id', label: 'ID' },
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email' },
    { field: 'status', label: 'Status', type: 'select' },
  ],
  editable: true,
  singleClickEdit: false,
};
```

`editable` is the only switch: it is a grid-level flag, and edits persist through
the host's data source (`dataSource.update`) with no callback to wire.

**Inline Editing Features:**
- **Double-click to edit**: double-click any editable cell to enter edit mode
  (`singleClickEdit: true` opens it on the first click instead)
- **Keyboard shortcuts**:
  - Press `Enter` on a focused cell to start editing
  - Press `Enter` while editing to save changes
  - Press `Escape` to cancel editing
- **Per-field read-only**: which cells open is decided by the **field definition**,
  not by a column key — a field marked `readonly`, and computed/binary field types
  (formula, autonumber, file, …), never open an editor
  (`isFieldInlineEditable`, `src/inline-edit-options.ts:82`). There is no
  `editable` key on `ListColumn`.
- **Visual feedback**: editable cells show a hover state
- **Automatic focus**: the input is focused and selected when editing begins

**Use Cases:**
- Quick data corrections
- Batch data entry
- Spreadsheet-like editing experience
- Real-time updates with backend synchronization

### Batch Editing & Multi-Row Save

Edit multiple cells across multiple rows and save them individually or all at once:

The schema half is just `editable` — the save/cancel affordances appear on their
own once a row has pending changes:

```typescript
import type { ObjectGridSchema } from '@object-ui/types';

const schema: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'products',
  columns: [
    { field: 'sku', label: 'SKU' },
    { field: 'name', label: 'Name' },
    { field: 'price', label: 'Price', type: 'currency', align: 'right' },
    { field: 'stock', label: 'Stock', type: 'number', align: 'right' },
  ],
  editable: true,
};
```

Left alone, saving goes through the host's data source. A React host that needs to
own persistence supplies `onRowSave` / `onBatchSave` as **component props** — and
because they are props, they take the adapter from the host's own scope rather than
from anything in the schema:

```tsx
import type { ObjectGridComponentProps } from '@object-ui/plugin-grid';

type Persistence = Pick<ObjectGridComponentProps, 'onRowSave' | 'onBatchSave'>;

const persistence = (
  dataSource: NonNullable<ObjectGridComponentProps['dataSource']>,
): Persistence => ({
  onRowSave: async (rowIndex, changes, row) => {
    await dataSource.update('products', row.id, changes);
  },
  onBatchSave: async (allChanges) => {
    await Promise.all(
      allChanges.map(({ row, changes }) => dataSource.update('products', row.id, changes)),
    );
  },
});
```

**Batch Editing Features:**
- **Pending changes tracking**: Edit multiple cells across multiple rows before saving
- **Visual indicators**: 
  - Modified rows are highlighted with amber background
  - Modified cells are shown in bold with amber text
  - Toolbar shows count of modified rows
- **Row-level actions**: Save or cancel changes for individual rows
- **Batch operations**: 
  - "Save All" button to save all modified rows at once
  - "Cancel All" button to discard all pending changes
- **Flexible callbacks** — all three are `ObjectGridComponentProps`, never schema keys:
  - `onRowSave`: called when saving a single row
  - `onBatchSave`: called when saving multiple rows at once
  - `onCellChange`: called for each staged cell edit

**Example Workflow:**
1. User edits multiple cells across different rows
2. Modified rows are visually highlighted
3. Toolbar shows "X rows modified" with Save All/Cancel All buttons
4. User can:
   - Save individual rows using row-level save button
   - Save all changes at once using "Save All" button
   - Cancel individual row changes or all changes

## TypeScript Support

The schema and column types come from `@object-ui/types`; this package exports the
*component* types.

```typescript
import type { ObjectGridSchema, ListColumn } from '@object-ui/types';
import type { ObjectGridComponentProps } from '@object-ui/plugin-grid';

const nameColumn: ListColumn = {
  field: 'name',
  label: 'Full Name',
  sortable: true
};

const grid: ObjectGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  columns: [nameColumn],
  pagination: { pageSize: 20 }
};

// Row callbacks are COMPONENT props, not schema keys.
const gridProps: ObjectGridComponentProps = {
  schema: grid,
  onRowClick: (record) => console.log('Row clicked:', record)
};
```

`ObjectGridProps` is a deprecated alias of `ObjectGridComponentProps` and denotes the
same type; `@objectstack/spec/ui` owns the name `ObjectGridProps` for the *authored*
props document of the `object-grid` element (objectui#4650).

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-grid)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-grid)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
