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
        fields: ['name', 'email', 'phone', 'company'],
        sort: [{ field: 'name', order: 'asc' }],
      }}
    />
  );
}
```

### With Multiple View Types

```tsx
<ListView
  schema={{
    type: 'list-view',
    objectName: 'deals',
    viewType: 'kanban',
    fields: ['name', 'amount', 'stage', 'close_date'],
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
    fields: ['title', 'status', 'priority'],
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
  fields?: string[];
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

## View Persistence

The ListView automatically persists the user's view type preference in localStorage using the key `listview-{objectName}-view`.

## License

MIT
