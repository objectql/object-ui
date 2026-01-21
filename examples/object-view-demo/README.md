# ObjectView Demo

A comprehensive demonstration of the `ObjectView` component, which integrates `ObjectTable` and `ObjectForm` into a complete, ready-to-use CRUD interface.

## Features

- **Integrated Table and Form**: Seamless combination of list view and create/edit forms
- **Multiple Layout Modes**: Switch between drawer and modal layouts for form display
- **Search Functionality**: Search across all records
- **Filter Builder**: Placeholder for advanced filtering capabilities
- **CRUD Operations**: Complete Create, Read, Update, Delete functionality
- **Bulk Actions**: Select multiple rows and perform bulk delete
- **Auto-refresh**: Table automatically refreshes after form submission
- **Mock Data Source**: Demonstrates with in-memory mock data

## Running the Demo

```bash
# From the root of the repository
pnpm install
pnpm --filter @examples/object-view-demo dev
```

Then open your browser to `http://localhost:5173`

## Usage

The demo showcases:

1. **Drawer Mode (Default)**: Forms slide in from the right side
2. **Modal Mode**: Forms appear in a centered modal dialog

### Actions

- **Create**: Click the "Create" button in the toolbar
- **View**: Click on any row in the table
- **Edit**: Click the "Edit" button in the actions column
- **Delete**: Click the "Delete" button (with confirmation)
- **Bulk Delete**: Select multiple rows using checkboxes and click "Delete Selected"
- **Search**: Type in the search box to filter records
- **Filters**: Click the "Filters" button to toggle the filter panel (placeholder)
- **Refresh**: Click the refresh button to reload the table

## Component Overview

The `ObjectView` component combines:

- **ObjectTable**: Auto-generated table with schema-based columns
- **ObjectForm**: Auto-generated form with schema-based fields
- **Drawer/Modal**: Configurable overlay components for form display
- **Search Bar**: Built-in search functionality
- **Filter Panel**: Placeholder for future filter builder integration
- **Toolbar**: Actions bar with create, refresh, and filter buttons

## Schema Configuration

```typescript
const schema: ObjectViewSchema = {
  type: 'object-view',
  objectName: 'users',
  layout: 'drawer', // or 'modal'
  showSearch: true,
  showFilters: true,
  showCreate: true,
  operations: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  table: {
    fields: ['name', 'email', 'status', 'role'],
    selectable: 'multiple',
  },
  form: {
    fields: ['name', 'email', 'status', 'role'],
    layout: 'vertical',
  },
};
```

## Next Steps

- Integrate real ObjectQL backend
- Implement advanced filtering with FilterBuilder
- Add pagination controls
- Add export/import functionality
- Add custom actions and bulk operations
