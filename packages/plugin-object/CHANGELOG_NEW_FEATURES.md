# New Features: ObjectTable and ObjectForm ObjectStack Integration

## Overview

This document describes the new features added to ObjectTable and ObjectForm components for complete ObjectStack integration.

## ObjectTable Enhancements

### 1. Field-Level Permissions

ObjectTable now respects field-level permissions from ObjectStack metadata:

```typescript
// Object metadata with permissions
{
  fields: {
    name: {
      type: 'text',
      permissions: { read: true }  // Visible in table
    },
    salary: {
      type: 'currency',
      permissions: { read: false }  // Hidden from table
    }
  }
}
```

- Fields with `read: false` are automatically excluded from column generation
- No manual configuration needed
- Works automatically based on metadata

### 2. Row Actions (Edit/Delete)

Add CRUD operations directly in the table:

```typescript
<ObjectTable
  schema={{
    type: 'object-table',
    objectName: 'users',
    operations: { update: true, delete: true }
  }}
  dataSource={dataSource}
  onEdit={(record) => openEditModal(record)}
  onDelete={(record) => console.log('Deleted:', record)}
/>
```

- Automatically adds "Actions" column
- Edit and Delete buttons per row
- Delete with confirmation dialog
- Optimistic UI updates

### 3. Batch Operations

Select multiple rows for bulk operations:

```typescript
<ObjectTable
  schema={{
    type: 'object-table',
    objectName: 'users',
    selectable: 'multiple'
  }}
  dataSource={dataSource}
  onBulkDelete={(records) => console.log('Bulk delete:', records)}
/>
```

- Row selection with checkboxes
- Toolbar appears when rows selected
- "Delete Selected" button
- Confirmation before bulk delete

### 4. Optimistic Updates

Delete operations update UI immediately:

- Remove row from table instantly
- Call API in background
- Revert on error with alert
- Better user experience

### 5. Enhanced Column Generation

Improved type-specific rendering:

- **Relationship fields**: Display name/label properties
- **File/Image fields**: Show count or filename
- **Boolean fields**: Proper boolean display
- **Date fields**: Formatted dates
- **Custom columns**: Override auto-generation

## ObjectForm Enhancements

### 1. Metadata-Driven Validation

Validation rules automatically from metadata:

```typescript
// Metadata
{
  name: {
    type: 'text',
    required: true,
    min_length: 2,
    max_length: 100
  },
  email: {
    type: 'email',
    required: true,
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
  },
  age: {
    type: 'number',
    min: 18,
    max: 65
  }
}
```

Automatically generates:
- Required field validation
- Min/max length validation
- Pattern validation (regex)
- Email/URL format validation
- Number range validation

### 2. Field-Level Permissions

Form fields respect write permissions:

```typescript
{
  fields: {
    name: {
      type: 'text',
      permissions: { write: true }  // Editable in form
    },
    created_at: {
      type: 'datetime',
      permissions: { write: false }  // Excluded from form
    }
  }
}
```

- Fields with `write: false` excluded in create/edit modes
- Read-only fields for computed types (formula, auto_number)
- View mode disables all fields

### 3. Conditional Field Visibility

Show/hide fields based on other field values:

```typescript
{
  company_name: {
    type: 'text',
    label: 'Company Name',
    visible_on: {
      field: 'account_type',
      operator: '=',
      value: 'business'
    }
  },
  tax_id: {
    type: 'text',
    visible_on: {
      and: [
        { field: 'account_type', operator: '=', value: 'business' },
        { field: 'country', operator: 'in', value: ['US', 'CA'] }
      ]
    }
  }
}
```

Supports:
- Simple conditions: `=`, `!=`, `>`, `>=`, `<`, `<=`, `in`
- Complex logic: `and`, `or`
- Dynamic evaluation on form changes

### 4. Enhanced Field Type Mapping

Comprehensive field type support:

| ObjectStack Type | Form Control | Features |
|------------------|--------------|----------|
| text, textarea, markdown, html | input/textarea | Length validation |
| number, currency, percent | input | Range validation |
| date, datetime | date-picker | Date validation |
| time | time input | Time validation |
| boolean | switch | Toggle control |
| select, lookup, master_detail | select | Options from metadata |
| email, phone, url | input | Format validation |
| file, image | file-upload | Size/type validation |
| password | password input | Secure input |
| formula, auto_number | input (readonly) | Computed fields |

## CRUD Operations

### Create Operation

```typescript
<ObjectForm
  schema={{
    type: 'object-form',
    objectName: 'users',
    mode: 'create',
    onSuccess: (data) => {
      console.log('Created:', data);
      refreshTable();
    }
  }}
  dataSource={dataSource}
/>
```

- Automatic field generation
- Validation before submit
- Success/error callbacks

### Update Operation

```typescript
<ObjectForm
  schema={{
    type: 'object-form',
    objectName: 'users',
    mode: 'edit',
    recordId: '123',
    onSuccess: (data) => {
      console.log('Updated:', data);
      refreshTable();
    }
  }}
  dataSource={dataSource}
/>
```

- Loads existing record data
- Pre-fills form fields
- Optimistic updates

### Delete Operation

```typescript
// Single delete
<ObjectTable
  onDelete={async (record) => {
    // Confirmation dialog shown automatically
    // Optimistic UI update
    // API call in background
  }}
/>

// Bulk delete
<ObjectTable
  onBulkDelete={async (records) => {
    // Confirmation for multiple records
    // Batch API call
    // UI updates optimistically
  }}
/>
```

## Testing

Comprehensive test suite with 51%+ coverage:

- 8 ObjectTable tests
- 15 ObjectForm tests
- 16 validation helper tests
- All tests passing

Run tests:
```bash
cd packages/plugin-object
pnpm test
pnpm test --coverage
```

## Example Usage

See `/examples/showcase/pages/objectql/crud-example.json` for a complete CRUD example demonstrating all features.

## Migration Guide

Existing ObjectTable/ObjectForm usage continues to work. New features are opt-in:

```typescript
// Before (still works)
<ObjectTable
  schema={{ type: 'object-table', objectName: 'users' }}
  dataSource={dataSource}
/>

// After (with new features)
<ObjectTable
  schema={{
    type: 'object-table',
    objectName: 'users',
    operations: { update: true, delete: true },
    selectable: 'multiple'
  }}
  dataSource={dataSource}
  onEdit={(record) => handleEdit(record)}
  onDelete={(record) => handleDelete(record)}
  onBulkDelete={(records) => handleBulkDelete(records)}
/>
```

## Breaking Changes

None. All changes are backward compatible.

## Future Enhancements

- Export/import operations
- Advanced filtering UI
- Inline editing
- Custom action buttons
- Drag and drop row reordering
