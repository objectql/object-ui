# ObjectGrid Examples

Enhanced table component with Airtable-like features.

## Basic Grid with Keyboard Navigation

```typescript
import { ObjectGrid } from '@object-ui/plugin-object';

const gridSchema = {
  type: 'object-grid',
  objectName: 'contacts',
  
  // Define which fields to show
  fields: ['name', 'email', 'status', 'company'],
  
  // Enable keyboard navigation (arrow keys, Tab, Enter)
  keyboardNavigation: true,
  
  // Inline data for demo
  data: [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active',
      company: 'Acme Corp'
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      status: 'active',
      company: 'TechStart'
    }
  ]
};

<ObjectGrid schema={gridSchema} />
```

**Features:**
- ↑↓←→ arrow keys to navigate cells
- Tab/Shift+Tab to move between cells
- Enter to view/edit cell content
- Escape to cancel editing

## Editable Grid

Enable inline cell editing with double-click or Enter key:

```typescript
const editableGridSchema = {
  type: 'object-grid',
  objectName: 'contacts',
  fields: ['name', 'email', 'phone', 'status'],
  
  // Enable inline editing
  editable: true,
  keyboardNavigation: true,
  
  data: [
    { id: 1, name: 'John Doe', email: 'john@example.com', phone: '555-0100', status: 'active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '555-0101', status: 'pending' }
  ]
};

<ObjectGrid 
  schema={editableGridSchema}
  onCellChange={(row, column, newValue) => {
    console.log(`Row ${row}, Column ${column} changed to:`, newValue);
  }}
/>
```

**Editing Actions:**
- Double-click on any cell to start editing
- Press Enter on selected cell to edit
- Press Enter again or Tab to save and move to next cell
- Press Escape to cancel editing

## Grid with Frozen Columns

Pin columns to the left for better horizontal scrolling:

```typescript
const frozenGridSchema = {
  type: 'object-grid',
  objectName: 'products',
  
  fields: [
    'name',        // Column 0 - frozen
    'sku',         // Column 1 - frozen
    'description', // Column 2+
    'price',
    'stock',
    'category',
    'supplier',
    'lastUpdated'
  ],
  
  // Freeze first 2 columns (name, sku)
  frozenColumns: 2,
  
  keyboardNavigation: true
};

<ObjectGrid schema={frozenGridSchema} dataSource={myDataSource} />
```

## Grid with Column Resizing

```typescript
const resizableGridSchema = {
  type: 'object-grid',
  objectName: 'tasks',
  fields: ['title', 'description', 'assignee', 'dueDate', 'status'],
  
  // Enable column resizing
  resizableColumns: true,
  keyboardNavigation: true
};

<ObjectGrid schema={resizableGridSchema} dataSource={myDataSource} />
```

**Usage:**
- Hover over column header border
- Click and drag to resize column width
- Each column remembers its size

## Grid with Row Selection

```typescript
const selectableGridSchema = {
  type: 'object-grid',
  objectName: 'users',
  fields: ['name', 'email', 'role', 'status'],
  
  // Enable row selection
  selectable: 'multiple',
  keyboardNavigation: true,
  
  data: [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'active' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User', status: 'inactive' }
  ]
};

<ObjectGrid 
  schema={selectableGridSchema}
  onRowSelect={(selectedRows) => {
    console.log('Selected rows:', selectedRows);
  }}
/>
```

## Complete Example: Editable CRM Grid

```typescript
const crmGridSchema = {
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
    'owner',
    'lastContactDate'
  ],
  
  // Enable all features
  editable: true,
  keyboardNavigation: true,
  resizableColumns: true,
  frozenColumns: 1, // Keep name column frozen
  selectable: 'multiple',
  pageSize: 50
};

function ContactsPage() {
  const handleCellChange = (row, column, newValue) => {
    // Save to backend
    console.log(`Updating row ${row}, ${column} = ${newValue}`);
  };
  
  const handleRowSelect = (selectedRows) => {
    console.log(`Selected ${selectedRows.length} contacts`);
  };
  
  return (
    <div className="p-6">
      <ObjectGrid
        schema={crmGridSchema}
        dataSource={myDataSource}
        onCellChange={handleCellChange}
        onRowSelect={handleRowSelect}
      />
    </div>
  );
}
```

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| ↑ | Move selection up |
| ↓ | Move selection down |
| ← | Move selection left |
| → | Move selection right |
| Tab | Move to next cell (right/down) |
| Shift+Tab | Move to previous cell (left/up) |
| Enter | Start editing selected cell |
| Enter (while editing) | Save and exit edit mode |
| Escape | Cancel edit, close editor |
| Double-click | Start editing cell |

## Feature Comparison

| Feature | ObjectTable | ObjectGrid |
|---------|-------------|------------|
| Auto-generate columns | ✓ | ✓ |
| Type-aware cell rendering | ✓ | ✓ |
| Basic row selection | ✓ | ✓ |
| Keyboard navigation | - | ✓ |
| Inline cell editing | - | ✓ |
| Frozen columns | - | ✓ |
| Column resizing | - | ✓ |
| Tab/Enter navigation | - | ✓ |
| Optimized for large data | ✓ | Future |
| Virtual scrolling | - | Future |

## When to Use ObjectGrid vs ObjectTable

**Use ObjectGrid when:**
- Users need to edit data inline
- Keyboard navigation is important
- Working with spreadsheet-like data
- Need column freezing for wide tables
- Interactive data entry is the primary use case

**Use ObjectTable when:**
- Primary use is viewing/reading data
- Need CRUD operations (create, edit, delete via forms)
- Need pagination and filtering
- Simpler interaction model is preferred
- Better for mobile/responsive layouts
