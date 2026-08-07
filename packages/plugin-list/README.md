# @object-ui/plugin-list

ListView plugin for ObjectUI - A unified view component with view type switching, filtering, sorting, and view configuration persistence.

## Features

- **View Type Switching**: Switch between Grid, List, Kanban, Calendar, and Chart views
- **View Persistence**: Automatically saves user's view preference
- **Integrated Search**: Full-text search across records
- **Filtering**: Advanced filter UI (expandable filter panel)
- **Sorting**: Sort by any field, toggle ascending/descending
- **Flexible Configuration**: Configure available view types per object
- **Custom Templates**: Support for custom view options per view type

## Visual density defaults (renderer-only, metadata always wins)

The toolbar and cell renderers are tuned for low visual noise on dense tables:

- **Unified toolbar row**: view tabs (`schema.tabs`), user filters and tool
  buttons share a single bordered row. The previous stacked rows (`tabs` /
  `description` / `toolbar`) are collapsed into one separator line.
- **Flat user-filter pills**: `userFilters` (dropdown mode) render as ghost
  text + count. Active state is shown via `text-foreground font-medium`
  rather than a filled / bordered pill.
- **Quiet active state for tool buttons**: filter / group / sort / color /
  density / search no longer paint a `bg-primary/10 border` block when
  active — they switch to `text-foreground font-medium` and rely on the
  trailing count for emphasis.
- **Dot-style select/status cells (opt-in)**: the cell renderer supports
  `appearance: 'dot'` to render `● label` instead of a filled badge for
  high-density tables. **This is opt-in** — by default select/status
  cells render as filled badges in both list and detail views, keeping
  visual consistency across views. Set `appearance: 'dot'` on the field
  (or column) in metadata when you want the lighter style.

## Installation

```bash
pnpm add @object-ui/plugin-list
```

## Usage

### Basic Example

```tsx
import { ListView } from '@object-ui/plugin-list';

function ContactsView() {
  return (
    <ListView
      schema={{
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        columns: ['name', 'email', 'phone', 'company'],
        sort: [{ field: 'name', order: 'asc' }],
      }}
    />
  );
}
```

### Grouping Records (Airtable-style)

Group rows in grid/gallery views by one or more fields. Two equivalent shapes
are supported on the schema:

```tsx
// Spec-compliant: structured GroupingConfig (multi-level + per-field options)
<ListView
  schema={{
    type: 'list-view',
    objectName: 'tasks',
    viewType: 'grid',
    columns: ['title', 'status', 'assignee'],
    grouping: {
      fields: [
        { field: 'status', order: 'asc', collapsed: false },
        { field: 'assignee', order: 'asc', collapsed: true },
      ],
    },
  }}
/>

// Shorthand: a single field name (used by the visual view-config UI).
// Internally normalized into the GroupingConfig above.
<ListView
  schema={{
    type: 'list-view',
    objectName: 'tasks',
    viewType: 'grid',
    columns: ['title', 'status'],
    groupBy: 'status',
  }}
/>
```

When both are present, `grouping` wins. End users can also add or remove
grouping fields at runtime via the Group toolbar button.

### With Multiple View Types

```tsx
<ListView
  schema={{
    type: 'list-view',
    objectName: 'deals',
    viewType: 'kanban',
    columns: ['name', 'amount', 'stage', 'close_date'],
    options: {
      kanban: {
        groupField: 'stage',
        titleField: 'name',
      },
      calendar: {
        startDateField: 'close_date',
        titleField: 'name',
      },
      chart: {
        chartType: 'bar',
        xAxisField: 'stage',
        yAxisFields: ['amount'],
      }
    }
  }}
/>
```

### With Callbacks

```tsx
<ListView
  schema={{
    type: 'list-view',
    objectName: 'tasks',
    columns: ['title', 'status', 'priority'],
  }}
  onViewChange={(view) => console.log('View changed to:', view)}
  onSearchChange={(search) => console.log('Search:', search)}
  onSortChange={(sort) => console.log('Sort:', sort)}
  onFilterChange={(filters) => console.log('Filters:', filters)}
/>
```

## Schema

The ListView component accepts a `ListViewSchema`:

```typescript
interface ListViewSchema {
  type: 'list-view';
  objectName: string;
  viewType?: 'grid' | 'kanban' | 'calendar' | 'gantt' | 'map' | 'chart';
  /** Spec-canonical column list. The legacy `fields` alias is still accepted
   *  on input (stored view metadata carries it) and folded into `columns` by
   *  `normalizeListViewSchema` — but nothing reads it, so emit `columns`. */
  columns?: string[] | ListColumn[];
  filters?: Array<any[] | string>;
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  options?: {
    grid?: Record<string, any>;
    list?: Record<string, any>;
    kanban?: {
      groupField: string;
      titleField?: string;
      cardFields?: string[];
    };
    calendar?: {
      startDateField: string;
      endDateField?: string;
      titleField: string;
    };
    chart?: {
      chartType: 'bar' | 'line' | 'pie' | 'area';
      xAxisField: string;
      yAxisFields: string[];
    };
  };
}
```

## Sorting (and why relational columns are not offered)

The toolbar sort becomes a server `$orderby` on the **flat field name**, so the
sort key is whatever that field stores. For a relational field
(`lookup` / `master_detail` / `user` / `tree`) that is the foreign-key **id**,
while the column shows the related record's name — the rows would come back in
an order with no visible relation to the column ("sorting is broken", from the
user's side). The server cannot order by the related name without a join, and
`objectstack#4256` settled that it will not add one.

So the sort picker withholds relational fields and says so. To sort by a related
record's name, denormalize it onto this object with a **formula field** and sort
that column like any other text column. A relational field that the view's
CURRENT sort already uses stays listed, labelled `(by ID)`, so existing view
metadata round-trips instead of silently losing its sort.

Column-header sorting inside the grid is unaffected: it is client-side over the
rows already loaded, where the label the cell shows IS available, so it orders by
that label (see `getSortValue` in `@object-ui/core`).

## View Persistence

The ListView automatically persists the user's view type preference in localStorage using the key `listview-{objectName}-view`.

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-list)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-list)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
