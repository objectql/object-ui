# Quick Start Guide - ObjectAgGrid

## Installation

The ObjectAgGrid component is already installed as part of the @object-ui/plugin-aggrid package.

## Basic Usage

### Step 1: Import Required Packages

```typescript
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import '@object-ui/plugin-aggrid';  // Auto-registers the component
```

### Step 2: Create a Data Source

```typescript
const dataSource = new ObjectStackAdapter({
  baseUrl: 'https://your-api.example.com',
  token: 'your-auth-token'  // Optional
});
```

### Step 3: Define Your Schema

```typescript
const gridSchema = {
  type: 'object-aggrid',
  objectName: 'contacts',  // The object to fetch from your backend
  dataSource: dataSource,
  pagination: true,
  pageSize: 20,
  theme: 'quartz',
  height: 600
};
```

### Step 4: Use in Your Component

```typescript
import { SchemaRenderer } from '@object-ui/components';

function MyComponent() {
  return (
    <div>
      <h1>My Contacts</h1>
      <SchemaRenderer schema={gridSchema} />
    </div>
  );
}
```

## Common Use Cases

### Show Only Specific Fields

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'contacts',
  dataSource: dataSource,
  fieldNames: ['name', 'email', 'phone', 'company'],  // Only show these
  pagination: true
};
```

### Enable Inline Editing

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'tasks',
  dataSource: dataSource,
  editable: true,
  singleClickEdit: true,  // Single-click to edit
  callbacks: {
    onCellValueChanged: (event) => {
      console.log('Updated:', event.data);
      // Changes are automatically saved to backend!
    }
  }
};
```

### Add Filters and Sorting

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'products',
  dataSource: dataSource,
  filters: {
    category: 'Electronics',
    price: { $lt: 1000 }
  },
  sort: {
    price: 'asc'
  }
};
```

### Enable CSV Export

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'sales',
  dataSource: dataSource,
  exportConfig: {
    enabled: true,
    fileName: 'sales-report.csv'
  }
};
```

## What Happens Automatically

When you use ObjectAgGrid, it automatically:

1. ✅ Fetches the object schema (field definitions) from your backend
2. ✅ Generates appropriate column definitions based on field types
3. ✅ Applies proper formatters (currency, dates, percentages, etc.)
4. ✅ Loads data with pagination
5. ✅ Saves edits back to the backend (when `editable: true`)

## Field Types Automatically Formatted

- **Currency**: `$1,234.56`
- **Percent**: `45.5%`
- **Date**: Localized date format
- **Boolean**: ✓ Yes / ✗ No
- **Email**: Clickable mailto links
- **Phone**: Clickable tel links
- **URL**: Clickable external links
- **Color**: Color swatches
- **Rating**: Star ratings ⭐⭐⭐⭐⭐
- And 20+ more field types!

## Backend Requirements

Your ObjectStack backend should provide:

1. **Metadata Endpoint**: Returns object schema with field definitions
   ```typescript
   GET /api/v1/metadata/object/{objectName}
   ```

2. **Data Endpoint**: Returns paginated data
   ```typescript
   GET /api/data/{objectName}?$top=20&$skip=0
   ```

3. **Update Endpoint** (for editable grids):
   ```typescript
   PATCH /api/data/{objectName}/{id}
   ```

## Next Steps

- See `OBJECT_AGGRID_CN.md` for Chinese documentation
- See `examples/object-aggrid-demo.tsx` for complete examples
- See `README.md` for full API reference

## Troubleshooting

**Data not loading?**
- Check that your `dataSource` is properly initialized
- Verify the `objectName` exists in your backend
- Check browser console for errors

**Columns not showing?**
- Verify your object schema has field definitions
- Check that fields have `name` and `type` properties

**Editing not working?**
- Make sure `editable: true` is set
- Verify fields are not marked as `readonly`
- Check that your backend update endpoint is working

## Support

For issues or questions, please refer to:
- Full documentation in `README.md`
- Chinese documentation in `OBJECT_AGGRID_CN.md`
- Implementation details in `IMPLEMENTATION_SUMMARY.md`
