# Plugin AgGrid - Lazy-Loaded AG Grid Data Grid

A lazy-loaded data grid component for Object UI based on AG Grid Community Edition.

## Features

- **Internal Lazy Loading**: AG Grid libraries are loaded on-demand using `React.lazy()` and `Suspense`
- **Zero Configuration**: Just import the package and use `type: 'aggrid'` in your schema
- **Automatic Registration**: Components auto-register with the ComponentRegistry
- **Skeleton Loading**: Shows a skeleton while AG Grid loads
- **Full AG Grid Features**: Sorting, filtering, pagination, cell rendering, and more
- **Cell & Row Editing**: Inline editing using AG Grid's built-in editors
- **CSV Export**: Built-in data export functionality
- **Event Callbacks**: Handle cell clicks, selection changes, and value updates
- **Status Bar**: Display aggregations (count, sum, avg, min, max)
- **Context Menu**: Customizable right-click menu with built-in and custom actions
- **Column Configuration**: Global settings for resizable, sortable, and filterable columns
- **Range Selection**: Excel-like range selection support
- **Multiple Themes**: Support for Quartz, Alpine, Balham, and Material themes
- **Customizable**: Full access to AG Grid's GridOptions for advanced configuration

## AG Grid Community vs Enterprise

This plugin uses **AG Grid Community Edition** which is free and open source. Most features (sorting, filtering, editing, CSV export, basic context menu) work with the Community edition. Some advanced features like integrated charting may require AG Grid Enterprise (commercial license). See [AG Grid Pricing](https://www.ag-grid.com/license-pricing/) for details.

## Installation

```bash
pnpm add @object-ui/plugin-aggrid ag-grid-community ag-grid-react
```

Note: `ag-grid-community` and `ag-grid-react` are peer dependencies and must be installed separately.

### Next.js App Router Setup

If you're using Next.js with the App Router and dynamic imports, you may need to import AG Grid CSS in your root layout to ensure styles load correctly:

```typescript
// app/layout.tsx
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import 'ag-grid-community/styles/ag-theme-material.css';
```

This is necessary when the plugin is loaded dynamically (e.g., via `React.lazy()` or dynamic imports in client components), as Next.js may not properly process CSS imports from dynamically loaded modules.

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-aggrid';

// Now you can use aggrid type in your schemas
const schema = {
  type: 'aggrid',
  rowData: [
    { make: 'Tesla', model: 'Model Y', price: 64950 },
    { make: 'Ford', model: 'F-Series', price: 33850 },
    { make: 'Toyota', model: 'Corolla', price: 29600 }
  ],
  columnDefs: [
    { field: 'make', headerName: 'Make', sortable: true, filter: true },
    { field: 'model', headerName: 'Model', sortable: true, filter: true },
    { field: 'price', headerName: 'Price', sortable: true, filter: 'number' }
  ],
  pagination: true,
  paginationPageSize: 10,
  theme: 'quartz',
  height: 500
};
```

### Manual Integration

```typescript
import { aggridComponents } from '@object-ui/plugin-aggrid';
import { ComponentRegistry } from '@object-ui/core';

// Manually register if needed
Object.entries(aggridComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

### TypeScript Support

The plugin exports TypeScript types for full type safety:

```typescript
import type { 
  AgGridSchema, 
  SimpleColumnDef, 
  AgGridCallbacks,
  ExportConfig,
  StatusBarConfig,
  ColumnConfig,
  ContextMenuConfig
} from '@object-ui/plugin-aggrid';

const schema: AgGridSchema = {
  type: 'aggrid',
  rowData: [
    { make: 'Tesla', model: 'Model Y', price: 64950 }
  ],
  columnDefs: [
    { field: 'make', headerName: 'Make', sortable: true, filter: true }
  ],
  pagination: true,
  theme: 'quartz',
  editable: true,
  exportConfig: {
    enabled: true,
    fileName: 'cars.csv'
  },
  columnConfig: {
    resizable: true,
    sortable: true,
    filterable: true
  },
  contextMenu: {
    enabled: true,
    items: ['copy', 'export']
  },
  callbacks: {
    onCellValueChanged: (event) => {
      console.log('Changed:', event);
    }
  }
};
```

## Schema API

```typescript
{
  type: 'aggrid',
  
  // Data
  rowData?: any[],                              // Grid data (required)
  columnDefs?: ColDef[],                        // Column definitions (required)
  
  // Display
  pagination?: boolean,                         // Enable pagination (default: false)
  paginationPageSize?: number,                  // Rows per page (default: 10)
  theme?: 'quartz' | 'alpine' | 'balham' | 'material',  // Grid theme (default: 'quartz')
  height?: number | string,                     // Grid height (default: 500)
  rowSelection?: 'single' | 'multiple',         // Row selection mode
  domLayout?: 'normal' | 'autoHeight' | 'print', // Layout mode
  animateRows?: boolean,                        // Animate row changes (default: true)
  
  // Editing
  editable?: boolean,                           // Enable cell editing (default: false)
  editType?: 'fullRow',                         // Row editing mode
  singleClickEdit?: boolean,                    // Start edit on single click (default: false)
  stopEditingWhenCellsLoseFocus?: boolean,      // Stop editing on blur (default: true)
  
  // Export
  exportConfig?: {
    enabled?: boolean,                          // Show export button (default: false)
    fileName?: string,                          // Export filename (default: 'export.csv')
    skipColumnHeaders?: boolean,                // Skip column headers in export (default: false)
    onlySelected?: boolean,                     // Export only selected rows (default: false)
    allColumns?: boolean                        // Export all columns (default: false)
  },
  
  // Status Bar
  statusBar?: {
    enabled?: boolean,                          // Show status bar (default: false)
    aggregations?: ('sum' | 'avg' | 'count' | 'min' | 'max')[] // Aggregations to show
  },
  
  // Event Callbacks
  callbacks?: {
    onCellClicked?: (event) => void,            // Cell click handler
    onRowClicked?: (event) => void,             // Row click handler
    onSelectionChanged?: (event) => void,       // Selection change handler
    onCellValueChanged?: (event) => void,       // Cell value change handler
    onExport?: (data, format) => void,          // Export handler (CSV only)
    onContextMenuAction?: (action, rowData) => void  // Context menu action handler
  },
  
  // Column Configuration
  columnConfig?: {
    resizable?: boolean,                        // Make all columns resizable
    sortable?: boolean,                         // Make all columns sortable
    filterable?: boolean,                       // Make all columns filterable
  },
  enableRangeSelection?: boolean,               // Enable Excel-like range selection (default: false)
  enableCharts?: boolean,                       // Enable integrated charts (requires Enterprise, default: false)
  
  // Context Menu
  contextMenu?: {
    enabled?: boolean,                          // Enable context menu (default: false)
    items?: string[],                           // Menu items: 'copy', 'export', 'autoSizeAll', etc.
    customItems?: Array<{                       // Custom menu items
      name: string,
      action: string,
      icon?: string,
      disabled?: boolean
    }>
  },
  
  // Advanced
  gridOptions?: GridOptions,                    // Advanced AG Grid options
  className?: string                            // Tailwind classes
}
```

## Column Definition Examples

### Basic Column

```typescript
{
  field: 'name',
  headerName: 'Name',
  sortable: true,
  filter: true
}
```

### Numeric Column with Formatter

```typescript
{
  field: 'price',
  headerName: 'Price',
  sortable: true,
  filter: 'number',
  valueFormatter: (params) => '$' + params.value.toLocaleString()
}
```

### Column with Custom Cell Renderer

```typescript
{
  field: 'status',
  headerName: 'Status',
  cellRenderer: (params) => {
    return params.value === 'active' 
      ? '<span class="text-green-500">✓ Active</span>' 
      : '<span class="text-red-500">✗ Inactive</span>';
  }
}
```

## Themes

AG Grid comes with four built-in themes:

- **Quartz** (default): Modern, clean design
- **Alpine**: Traditional data grid appearance
- **Balham**: Professional business look
- **Material**: Google Material Design inspired

```typescript
const schema = {
  type: 'aggrid',
  theme: 'alpine', // or 'quartz', 'balham', 'material'
  // ... other props
};
```

## Cell & Row Editing

Enable inline editing of cells:

```typescript
const schema = {
  type: 'aggrid',
  rowData: [...],
  columnDefs: [
    { field: 'name', headerName: 'Name', editable: true },
    { field: 'price', headerName: 'Price', editable: true },
    { field: 'status', headerName: 'Status', editable: false }
  ],
  editable: true,              // Enable editing globally
  singleClickEdit: false,      // Double-click to edit (default)
  callbacks: {
    onCellValueChanged: (event) => {
      console.log('Cell changed:', event.data, event.colDef.field, event.newValue);
      // Save to backend here
    }
  }
};
```

## CSV Export

Enable data export with a built-in button:

```typescript
const schema = {
  type: 'aggrid',
  rowData: [...],
  columnDefs: [...],
  exportConfig: {
    enabled: true,              // Show export button
    fileName: 'my-data.csv',    // Custom filename
    onlySelected: false,        // Export all rows (or only selected)
    allColumns: true            // Export all columns
  },
  callbacks: {
    onExport: (data, format) => {
      console.log(`Exporting ${data.length} rows as ${format}`);
      // Track export event or custom processing
    }
  }
};
```

## Status Bar & Aggregations

Display summary statistics at the bottom of the grid:

```typescript
const schema = {
  type: 'aggrid',
  rowData: [...],
  columnDefs: [...],
  statusBar: {
    enabled: true,
    aggregations: ['count', 'sum', 'avg', 'min', 'max']
  }
};
```

## Event Callbacks

Handle user interactions with the grid:

```typescript
const schema = {
  type: 'aggrid',
  rowData: [...],
  columnDefs: [...],
  rowSelection: 'multiple',
  callbacks: {
    onRowClicked: (event) => {
      console.log('Row clicked:', event.data);
    },
    onCellClicked: (event) => {
      console.log('Cell clicked:', event.colDef.field, event.value);
    },
    onSelectionChanged: (event) => {
      const selectedRows = event.api.getSelectedRows();
      console.log('Selected rows:', selectedRows);
    },
    onCellValueChanged: (event) => {
      console.log('Value changed from', event.oldValue, 'to', event.newValue);
      // Save changes to backend
      saveToBackend(event.data);
    }
  }
};
```

## Context Menu

Add a right-click context menu with custom actions:

```typescript
const schema = {
  type: 'aggrid',
  rowData: [...],
  columnDefs: [...],
  contextMenu: {
    enabled: true,
    items: [
      'copy',              // Copy selected cells
      'copyWithHeaders',   // Copy with column headers
      'separator',
      'export',            // Export to CSV
      'autoSizeAll',       // Auto-size all columns
      'resetColumns'       // Reset column state
    ],
    customItems: [
      {
        name: 'Delete Row',
        action: 'delete',
        disabled: false
      },
      {
        name: 'View Details',
        action: 'view'
      }
    ]
  },
  callbacks: {
    onContextMenuAction: (action, rowData) => {
      console.log(`Action: ${action}`, rowData);
      // Handle custom menu actions
      if (action === 'delete') {
        deleteRow(rowData);
      } else if (action === 'view') {
        viewDetails(rowData);
      }
    }
  }
};
```

## Column Configuration

Apply global settings to all columns:

```typescript
const schema = {
  type: 'aggrid',
  rowData: [...],
  columnDefs: [...],
  columnConfig: {
    resizable: true,      // All columns resizable by default
    sortable: true,       // All columns sortable by default
    filterable: true,     // All columns filterable by default
  },
  enableRangeSelection: true  // Excel-like range selection
};
```

You can override these defaults on individual columns:

```typescript
const schema = {
  type: 'aggrid',
  rowData: [...],
  columnDefs: [
    { field: 'id', headerName: 'ID', sortable: false }, // Override: not sortable
    { field: 'name', headerName: 'Name' },              // Uses defaults
    { field: 'email', headerName: 'Email' }             // Uses defaults
  ],
  columnConfig: {
    resizable: true,
    sortable: true,
    filterable: true
  }
};
```

## Lazy Loading Architecture

The plugin uses a two-file pattern for optimal code splitting:

1. **`AgGridImpl.tsx`**: Contains the actual AG Grid imports (heavy ~200-300 KB)
2. **`index.tsx`**: Entry point with `React.lazy()` wrapper (light)

When bundled, Vite automatically creates separate chunks:
- `index.js` (~200 bytes) - The entry point
- `AgGridImpl-xxx.js` (~200-300 KB) - The lazy-loaded implementation

The AG Grid library is only downloaded when an `aggrid` component is actually rendered, not on initial page load.

## Bundle Size Impact

By using lazy loading, the main application bundle stays lean:
- Without lazy loading: +200-300 KB on initial load
- With lazy loading: +0.19 KB on initial load, +200-300 KB only when grid is rendered

This results in significantly faster initial page loads for applications that don't use data grids on every page.

## Advanced Usage

### With GridOptions

```typescript
const schema = {
  type: 'aggrid',
  rowData: [...],
  columnDefs: [...],
  gridOptions: {
    suppressCellFocus: true,
    enableCellTextSelection: true,
    enableRangeSelection: true,
    rowMultiSelectWithClick: true,
    // Any AG Grid GridOptions property
  }
};
```

### Auto Height Layout

```typescript
const schema = {
  type: 'aggrid',
  rowData: [...],
  columnDefs: [...],
  domLayout: 'autoHeight', // Grid adjusts height to fit all rows
};
```

## Development

```bash
# Build the plugin
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check

# The package will generate proper ESM and UMD builds with lazy loading preserved
```

## License

MIT

## Object AgGrid - Metadata-Driven AG Grid

The `object-aggrid` component extends the standard `aggrid` with metadata-driven capabilities using `@objectstack/client`. It automatically fetches object schemas and data, and generates appropriate column definitions based on field types.

### Features

- **Automatic Metadata Fetching**: Retrieves object schema from ObjectStack backend
- **Automatic Data Loading**: Fetches data with pagination, filtering, and sorting
- **Field Type Support**: Supports all ObjectUI field types with appropriate formatters and renderers
- **Inline Editing**: Automatically saves changes to the backend
- **Zero Column Configuration**: Columns are generated from metadata
- **Selective Field Display**: Optionally show only specific fields

### Installation

```bash
pnpm add @object-ui/plugin-aggrid @object-ui/data-objectstack ag-grid-community ag-grid-react
```

### Usage

```typescript
import '@object-ui/plugin-aggrid';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

// Create data source
const dataSource = new ObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-api-token'
});

// Use in schema
const schema = {
  type: 'object-aggrid',
  objectName: 'contacts',  // Object to fetch
  dataSource: dataSource,  // ObjectStack data source
  pagination: true,
  pageSize: 20,
  theme: 'quartz',
  height: 600
};
```

### Supported Field Types

The component automatically applies appropriate formatters and cell renderers for all field types:

- **Text Types**: text, textarea, markdown, html
- **Numeric Types**: number, currency (with locale formatting), percent
- **Boolean**: Displays ✓ Yes / ✗ No
- **Date/Time**: date, datetime, time (with locale formatting)
- **Contact**: email (clickable mailto), phone (clickable tel), url (clickable link)
- **Select/Lookup**: select, lookup, master_detail (shows labels)
- **Visual**: color (with color swatch), image, avatar, rating (stars)
- **Advanced**: formula, summary, auto_number, user, file

### Schema API for Object AgGrid

```typescript
{
  type: 'object-aggrid',
  
  // Required
  objectName: string,              // Name of the object to fetch
  dataSource: DataSource,          // ObjectStack data source instance
  
  // Optional Field Configuration
  fieldNames?: string[],           // Show only these fields (default: all)
  fields?: FieldMetadata[],        // Override field metadata
  
  // Query Parameters
  filters?: Record<string, any>,   // Query filters
  sort?: Record<string, 'asc' | 'desc'>, // Sorting
  pageSize?: number,               // Rows per page (default: 10)
  
  // Display Options (same as aggrid)
  pagination?: boolean,            // Enable pagination (default: true)
  theme?: string,                  // Grid theme (default: 'quartz')
  height?: number | string,        // Grid height (default: 500)
  
  // Editing
  editable?: boolean,              // Enable inline editing (auto-saves to backend)
  
  // Export, Status Bar, Callbacks, etc. (same as aggrid)
  exportConfig?: ExportConfig,
  statusBar?: StatusBarConfig,
  columnConfig?: ColumnConfig,
  callbacks?: {
    onDataLoaded?: (data: any[]) => void,
    onDataError?: (error: Error) => void,
    // ... other aggrid callbacks
  }
}
```

### Examples

#### Basic Usage

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'users',
  dataSource: myDataSource,
  pagination: true,
  pageSize: 25
};
```

#### With Field Selection

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'contacts',
  dataSource: myDataSource,
  fieldNames: ['name', 'email', 'phone', 'company'],
  pagination: true
};
```

#### With Filters and Sorting

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'products',
  dataSource: myDataSource,
  filters: {
    category: 'Electronics',
    price: { $lt: 1000 }
  },
  sort: {
    price: 'asc'
  },
  pagination: true
};
```

#### Editable Grid with Auto-Save

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'tasks',
  dataSource: myDataSource,
  editable: true,               // Enable editing
  singleClickEdit: true,        // Single-click to edit
  callbacks: {
    onCellValueChanged: (event) => {
      // Changes are automatically saved to backend
      console.log('Saved:', event.data);
    }
  }
};
```

#### With Export

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'sales',
  dataSource: myDataSource,
  exportConfig: {
    enabled: true,
    fileName: 'sales-report.csv'
  }
};
```

### Field Type Formatting Examples

**Currency Field:**
```typescript
// Schema defines: { type: 'currency', currency: 'USD', precision: 2 }
// Renders as: $1,234.56
```

**Percent Field:**
```typescript
// Schema defines: { type: 'percent', precision: 1 }
// Renders as: 45.5%
```

**Email Field:**
```typescript
// Schema defines: { type: 'email' }
// Renders as: <a href="mailto:user@example.com">user@example.com</a>
```

**Rating Field:**
```typescript
// Schema defines: { type: 'rating', max: 5 }
// Renders as: ⭐⭐⭐⭐⭐
```

**Color Field:**
```typescript
// Schema defines: { type: 'color' }
// Renders as: [color swatch] #FF5733
```

## License



- [AG Grid Community Documentation](https://www.ag-grid.com/documentation/)
- [AG Grid Column Definitions](https://www.ag-grid.com/documentation/javascript/column-definitions/)
- [AG Grid Grid Options](https://www.ag-grid.com/documentation/javascript/grid-options/)
