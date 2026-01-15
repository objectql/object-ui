# User Management Example

A complete CRUD (Create, Read, Update, Delete) interface for managing users, built entirely with JSON schema.

## Features

This example demonstrates:

- ✅ **Complete CRUD Operations** - Create, read, update, and delete users
- ✅ **Advanced Filtering** - Filter by role, status, and date range
- ✅ **Search & Sort** - Search across multiple fields with sortable columns
- ✅ **Pagination** - Configurable page sizes with total count display
- ✅ **Batch Operations** - Activate, deactivate, or delete multiple users at once
- ✅ **Row Actions** - View details, edit, reset password, or delete individual users
- ✅ **Form Validation** - Required fields, email validation, and file upload constraints
- ✅ **Confirmation Dialogs** - Safety prompts before destructive actions
- ✅ **Success Messages** - User feedback after successful operations
- ✅ **Custom Toolbar** - Additional actions like import CSV and bulk invite
- ✅ **Empty State** - Friendly message when no users exist

## Schema Structure

The example uses the new `CRUDSchema` type which provides a complete data management interface:

```json
{
  "type": "crud",
  "resource": "user",
  "api": "/api/users",
  "columns": [...],      // Table columns configuration
  "fields": [...],       // Form fields for create/edit
  "operations": {...},   // CRUD operation settings
  "toolbar": {...},      // Toolbar configuration
  "filters": [...],      // Filter options
  "pagination": {...},   // Pagination settings
  "batchActions": [...], // Bulk operations
  "rowActions": [...]    // Per-row actions
}
```

## Running the Example

### Using Object UI CLI

```bash
# Install the CLI globally
npm install -g @object-ui/cli

# Serve the example
cd examples/user-management
objectui serve app.json
```

Visit http://localhost:3000 to see the user management interface.

### Using as a Template

You can use this as a starting point for your own CRUD interfaces:

1. Copy `app.json` to your project
2. Modify the `api` endpoints to match your backend
3. Customize the `columns` and `fields` for your data model
4. Adjust `operations`, `filters`, and `actions` as needed

## Customization

### Changing the Data Model

Edit the `columns` array to define what fields are displayed:

```json
{
  "columns": [
    {
      "name": "fieldName",
      "label": "Display Label",
      "type": "text|badge|date|image",
      "sortable": true,
      "searchable": true
    }
  ]
}
```

### Modifying Operations

Enable/disable operations or customize their behavior:

```json
{
  "operations": {
    "create": {
      "enabled": true,
      "label": "Add User",
      "api": "/api/users",
      "method": "POST",
      "successMessage": "User created!"
    },
    "delete": {
      "enabled": true,
      "confirmText": "Delete this user?",
      "successMessage": "User deleted!"
    }
  }
}
```

### Adding Custom Actions

Add custom toolbar or row actions:

```json
{
  "toolbar": {
    "actions": [
      {
        "type": "action",
        "label": "Custom Action",
        "icon": "star",
        "api": "/api/custom-endpoint",
        "method": "POST"
      }
    ]
  }
}
```

## API Integration

This example expects a REST API with the following endpoints:

- `GET /api/users` - List users (with pagination, filtering, sorting)
- `POST /api/users` - Create a new user
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update a user
- `DELETE /api/users/:id` - Delete a user
- `GET /api/users/export` - Export users
- `POST /api/users/batch/activate` - Batch activate users
- `POST /api/users/batch/deactivate` - Batch deactivate users
- `DELETE /api/users/batch/delete` - Batch delete users
- `POST /api/users/:id/reset-password` - Reset user password

### Request/Response Format

**List Users (GET /api/users)**

Query Parameters:
- `page` - Page number (default: 1)
- `pageSize` - Results per page (default: 20)
- `search` - Search query
- `sort` - Sort field
- `order` - Sort order (asc/desc)
- `role` - Filter by role
- `status` - Filter by status

Response:
```json
{
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin",
      "status": "active",
      "avatar": "https://...",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

## Learn More

- [Object UI Documentation](https://www.objectui.org)
- [CRUD Schema Reference](../../docs/protocol/crud.md)
- [API Integration Guide](../../docs/integration/api.md)
- [More Examples](../)

## License

MIT
