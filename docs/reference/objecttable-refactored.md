# ObjectTable Component - Built on data-table

## Overview

ObjectTable is now a unified component that supports both traditional table views and inline grid editing. It's built on top of the data-table component with ObjectQL-specific features.

## Key Changes

### Merged ObjectGrid into ObjectTable

- **Before**: Separate `ObjectGrid` and `ObjectTable` components
- **After**: Single `ObjectTable` component that supports both modes via schema type

### Built on data-table

ObjectTable now leverages the existing data-table component which provides:
- Sorting (multi-column)
- Searching (real-time across columns)
- Pagination (configurable page sizes)
- Row selection
- CSV export
- Column resizing
- Column reordering

## Usage

### Traditional Table Mode

```typescript
<ObjectTable
  schema={{
    type: 'object-grid',
    objectName: 'users',
    fields: ['name', 'email', 'status'],
    operations: { create: true, update: true, delete: true },
    showSearch: true,
    showPagination: true,
    pageSize: 25
  }}
  dataSource={dataSource}
  onEdit={(record) => handleEdit(record)}
  onDelete={(record) => handleDelete(record)}
/>
```

### Grid Mode (Inline Editing)

```typescript
<ObjectTable
  schema={{
    type: 'object-grid',
    objectName: 'contacts',
    fields: ['name', 'email', 'phone', 'status'],
    editable: true,
    keyboardNavigation: true,
    frozenColumns: 1,
    resizableColumns: true
  }}
  dataSource={dataSource}
  onCellChange={(row, col, value) => handleCellChange(row, col, value)}
/>
```

## Features

### From data-table

All ObjectTable instances now automatically get:

- ✅ **Multi-column sorting** - Click headers to sort (asc/desc/none)
- ✅ **Real-time search** - Search across all columns
- ✅ **Pagination** - Navigate large datasets
- ✅ **Row selection** - Single or multi-select
- ✅ **CSV export** - Export filtered/sorted data
- ✅ **Column resizing** - Drag to resize columns
- ✅ **Column reordering** - Drag to reorder columns

### From ObjectQL Integration

- ✅ **Auto-generated columns** - From ObjectQL schema
- ✅ **Type-aware rendering** - 20+ specialized field renderers
- ✅ **Permission handling** - Field-level read/write permissions
- ✅ **CRUD operations** - Edit/Delete actions
- ✅ **Data fetching** - Automatic data loading from DataSource

### object-grid Specific

When `type: 'object-grid'`:
- Column freezing (via `frozenColumns`)
- Inline editing (via `editable`)
- Keyboard navigation (via `keyboardNavigation`)
- Resizable columns (via `resizableColumns`)

## Migration Guide

### From ObjectGrid to ObjectTable

**Before:**
```typescript
import { ObjectGrid } from '@object-ui/views';

<ObjectGrid
  schema={{
    type: 'object-grid',
    // ...
  }}
/>
```

**After:**
```typescript
import { ObjectTable } from '@object-ui/views';

<ObjectTable
  schema={{
    type: 'object-grid', // same schema type
    // ...
  }}
/>
```

## Schema Types

### ObjectTableSchema

```typescript
{
  type: 'object-grid',
  objectName: string,
  fields?: string[],
  columns?: TableColumn[],
  data?: any[], // inline data mode
  operations?: {
    create?: boolean,
    read?: boolean,
    update?: boolean,
    delete?: boolean,
    export?: boolean
  },
  defaultFilters?: Record<string, any>,
  defaultSort?: { field: string; order: 'asc' | 'desc' },
  pageSize?: number,
  selectable?: boolean | 'single' | 'multiple',
  showSearch?: boolean,
  showFilters?: boolean,
  showPagination?: boolean
}
```

### ObjectGridSchema

```typescript
{
  type: 'object-grid',
  objectName: string,
  fields?: string[],
  columns?: TableColumn[],
  data?: any[],
  editable?: boolean,
  keyboardNavigation?: boolean,
  resizableColumns?: boolean,
  frozenColumns?: number,
  selectable?: boolean | 'single' | 'multiple',
  pageSize?: number
}
```

## Examples

### Complete CRM Table

```typescript
<ObjectTable
  schema={{
    type: 'object-grid',
    objectName: 'contacts',
    title: 'Contact Management',
    fields: [
      'fullName',
      'email',
      'phone',
      'company',
      'status',
      'tags',
      'lifetimeValue',
      'owner'
    ],
    operations: {
      create: true,
      update: true,
      delete: true,
      export: true
    },
    showSearch: true,
    showPagination: true,
    pageSize: 25,
    selectable: 'multiple',
    defaultSort: {
      field: 'fullName',
      order: 'asc'
    }
  }}
  dataSource={myDataSource}
  onEdit={(record) => openEditModal(record)}
  onDelete={(record) => confirmDelete(record)}
  onRowSelect={(selected) => console.log('Selected:', selected.length)}
/>
```

### Inline Editing Grid

```typescript
<ObjectTable
  schema={{
    type: 'object-grid',
    objectName: 'inventory',
    fields: ['sku', 'name', 'quantity', 'price', 'status'],
    editable: true,
    keyboardNavigation: true,
    frozenColumns: 2, // Freeze SKU and Name columns
    resizableColumns: true,
    pageSize: 50
  }}
  dataSource={myDataSource}
  onCellChange={(row, col, value) => {
    // Save to backend
    updateInventory(row, col, value);
  }}
/>
```

## Benefits of the Refactoring

1. **Code Reuse** - Leverages battle-tested data-table component
2. **Feature Rich** - All data-table features available out-of-the-box
3. **Consistency** - Same UX across regular and ObjectQL tables
4. **Maintainability** - Single component to maintain
5. **Performance** - Optimized rendering from data-table
6. **Smaller Bundle** - Reduced code duplication

## See Also

- [data-table Component](../../packages/components/src/renderers/complex/data-table.tsx)
- [Field Types Reference](./field-types.md)
- [Field Renderers](../../packages/views/src/field-renderers.tsx)
