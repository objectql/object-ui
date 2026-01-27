# @object-ui/plugin-grid

Grid plugin for Object UI - Advanced data grid with sorting, filtering, and pagination.

## Features

- **Data Grid** - Enterprise-grade data grid component
- **Sorting** - Multi-column sorting support
- **Filtering** - Column-level filtering
- **Pagination** - Built-in pagination controls
- **Row Selection** - Single and multi-row selection
- **Customizable** - Tailwind CSS styling support

## Installation

```bash
pnpm add @object-ui/plugin-grid
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-grid';

// Now you can use grid types in your schemas
const schema = {
  type: 'grid',
  columns: [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' }
  ],
  data: []
};
```

### Manual Registration

```typescript
import { gridComponents } from '@object-ui/plugin-grid';
import { ComponentRegistry } from '@object-ui/core';

// Register grid components
Object.entries(gridComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

## Schema API

### Grid

Data grid with advanced features:

```typescript
{
  type: 'grid',
  columns: GridColumn[],
  data?: any[],
  sortable?: boolean,
  filterable?: boolean,
  pagination?: boolean | PaginationConfig,
  selectable?: boolean,
  onRowClick?: (row) => void,
  className?: string
}
```

### Column Definition

```typescript
interface GridColumn {
  header: string;
  accessorKey: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  cell?: (value, row) => ReactNode;
}
```

## Examples

### Basic Grid

```typescript
const schema = {
  type: 'grid',
  columns: [
    { header: 'ID', accessorKey: 'id', width: 80 },
    { header: 'Name', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Role', accessorKey: 'role' },
    { header: 'Status', accessorKey: 'status' }
  ],
  data: [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'Active' }
  ],
  sortable: true,
  filterable: true,
  pagination: true
};
```

### Grid with Custom Cells

```typescript
const schema = {
  type: 'grid',
  columns: [
    { header: 'Name', accessorKey: 'name' },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (value) => ({
        type: 'badge',
        label: value,
        variant: value === 'Active' ? 'success' : 'default'
      })
    },
    {
      header: 'Actions',
      accessorKey: 'id',
      cell: (value, row) => ({
        type: 'button-group',
        buttons: [
          { label: 'Edit', onClick: () => console.log('Edit', row) },
          { label: 'Delete', variant: 'destructive', onClick: () => console.log('Delete', row) }
        ]
      })
    }
  ],
  data: [/* data */]
};
```

### Selectable Grid

```typescript
const schema = {
  type: 'grid',
  columns: [/* columns */],
  data: [/* data */],
  selectable: true,
  onRowClick: (row) => {
    console.log('Row clicked:', row);
  },
  onSelectionChange: (selectedRows) => {
    console.log('Selection changed:', selectedRows);
  }
};
```

### Grid with Pagination

```typescript
const schema = {
  type: 'grid',
  columns: [/* columns */],
  data: [/* data */],
  pagination: {
    pageSize: 10,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100]
  }
};
```

## Integration with Data Sources

Connect grid to backend APIs:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

const schema = {
  type: 'object-grid',
  dataSource,
  object: 'users',
  columns: [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Created', accessorKey: 'created_at' }
  ],
  pagination: true,
  sortable: true,
  filterable: true
};
```

## Features

### Sorting

Enable sorting on columns:

```typescript
const schema = {
  type: 'grid',
  sortable: true,  // Enable sorting on all columns
  columns: [
    { header: 'Name', accessorKey: 'name', sortable: true },
    { header: 'Email', accessorKey: 'email', sortable: false }  // Disable for specific column
  ]
};
```

### Filtering

Enable column filtering:

```typescript
const schema = {
  type: 'grid',
  filterable: true,
  columns: [
    { header: 'Status', accessorKey: 'status', filterable: true }
  ]
};
```

### Row Actions

Add actions to rows:

```typescript
const schema = {
  type: 'grid',
  columns: [/* columns */],
  rowActions: [
    { label: 'View', onClick: (row) => console.log('View', row) },
    { label: 'Edit', onClick: (row) => console.log('Edit', row) },
    { label: 'Delete', onClick: (row) => console.log('Delete', row) }
  ]
};
```

## TypeScript Support

```typescript
import type { GridSchema, GridColumn } from '@object-ui/plugin-grid';

const nameColumn: GridColumn = {
  header: 'Name',
  accessorKey: 'name',
  sortable: true
};

const grid: GridSchema = {
  type: 'grid',
  columns: [nameColumn],
  data: [],
  sortable: true,
  pagination: true
};
```

## License

MIT
