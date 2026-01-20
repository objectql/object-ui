---
title: "CRUD Protocol Specification"
---

The CRUD (Create, Read, Update, Delete) protocol provides a complete data management interface through JSON schema.

## Overview

The CRUD protocol simplifies building data management interfaces by providing a declarative way to define tables, forms, filters, and operations. Instead of writing hundreds of lines of React code, you can define a complete CRUD interface in a single JSON schema.

## Basic Structure

```json
{
  "type": "crud",
  "resource": "user",
  "api": "/api/users",
  "columns": [...],
  "fields": [...],
  "operations": {...},
  "toolbar": {...},
  "filters": [...],
  "pagination": {...}
}
```

## Schema Properties

### Core Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | ✅ | Must be `"crud"` |
| `resource` | `string` | ❌ | Resource name (e.g., "user", "product") |
| `api` | `string` | ✅ | Base API endpoint |
| `title` | `string` | ❌ | Table title |
| `description` | `string` | ❌ | Table description |

### Columns Configuration

Defines how data is displayed in the table:

```typescript
interface TableColumn {
  name: string;           // Field name
  label?: string;         // Display label
  type?: string;          // Column type (text, badge, date, image, etc.)
  width?: number;         // Column width in pixels
  sortable?: boolean;     // Enable sorting
  searchable?: boolean;   // Include in search
  format?: string;        // Format string (for dates, numbers)
  render?: SchemaNode;    // Custom render schema
}
```

**Example:**

```json
{
  "columns": [
    {
      "name": "id",
      "label": "ID",
      "type": "text",
      "width": 80,
      "sortable": true
    },
    {
      "name": "avatar",
      "label": "Avatar",
      "type": "image",
      "width": 60
    },
    {
      "name": "name",
      "label": "Name",
      "type": "text",
      "sortable": true,
      "searchable": true
    },
    {
      "name": "status",
      "label": "Status",
      "type": "badge",
      "sortable": true
    },
    {
      "name": "createdAt",
      "label": "Created",
      "type": "date",
      "format": "YYYY-MM-DD HH:mm",
      "sortable": true
    }
  ]
}
```

### Fields Configuration

Defines form fields for create/edit operations:

```json
{
  "fields": [
    {
      "name": "name",
      "label": "Full Name",
      "type": "input",
      "required": true,
      "placeholder": "Enter name"
    },
    {
      "name": "email",
      "label": "Email",
      "type": "input",
      "inputType": "email",
      "required": true
    },
    {
      "name": "role",
      "label": "Role",
      "type": "select",
      "options": [
        { "label": "Admin", "value": "admin" },
        { "label": "User", "value": "user" }
      ]
    }
  ]
}
```

### Operations Configuration

Controls which CRUD operations are enabled:

```typescript
interface CRUDOperation {
  enabled?: boolean;
  label?: string;
  icon?: string;
  api?: string;
  method?: HTTPMethod;
  confirmText?: string;
  successMessage?: string;
}
```

**Example:**

```json
{
  "operations": {
    "create": {
      "enabled": true,
      "label": "Add User",
      "icon": "plus",
      "api": "/api/users",
      "method": "POST",
      "successMessage": "User created successfully!"
    },
    "update": {
      "enabled": true,
      "label": "Edit",
      "api": "/api/users/${id}",
      "method": "PUT",
      "successMessage": "User updated!"
    },
    "delete": {
      "enabled": true,
      "label": "Delete",
      "api": "/api/users/${id}",
      "method": "DELETE",
      "confirmText": "Delete this user?",
      "successMessage": "User deleted!"
    },
    "export": {
      "enabled": true,
      "label": "Export",
      "api": "/api/users/export"
    }
  }
}
```

### Toolbar Configuration

Customizes the toolbar appearance and actions:

```json
{
  "toolbar": {
    "showCreate": true,
    "showRefresh": true,
    "showExport": true,
    "showImport": false,
    "showFilter": true,
    "showSearch": true,
    "actions": [
      {
        "type": "action",
        "label": "Import CSV",
        "icon": "upload",
        "variant": "outline"
      }
    ]
  }
}
```

### Filters Configuration

Defines available filters:

```json
{
  "filters": [
    {
      "name": "role",
      "label": "Role",
      "type": "select",
      "operator": "equals",
      "options": [
        { "label": "All", "value": "" },
        { "label": "Admin", "value": "admin" },
        { "label": "User", "value": "user" }
      ]
    },
    {
      "name": "status",
      "label": "Status",
      "type": "select",
      "operator": "equals",
      "options": [...]
    },
    {
      "name": "createdAt",
      "label": "Created Date",
      "type": "date-range",
      "operator": "between"
    }
  ]
}
```

### Pagination Configuration

Controls pagination behavior:

```json
{
  "pagination": {
    "enabled": true,
    "pageSize": 20,
    "pageSizeOptions": [10, 20, 50, 100],
    "showTotal": true,
    "showSizeChanger": true
  }
}
```

### Batch Actions

Actions that can be performed on multiple selected rows:

```json
{
  "selectable": "multiple",
  "batchActions": [
    {
      "type": "action",
      "label": "Activate Selected",
      "icon": "check",
      "level": "success",
      "api": "/api/users/batch/activate",
      "method": "POST",
      "confirmText": "Activate ${count} users?",
      "successMessage": "${count} users activated!"
    },
    {
      "type": "action",
      "label": "Delete Selected",
      "icon": "trash",
      "level": "danger",
      "api": "/api/users/batch/delete",
      "method": "DELETE",
      "confirmText": "Delete ${count} users?"
    }
  ]
}
```

### Row Actions

Actions available for individual rows:

```json
{
  "rowActions": [
    {
      "type": "action",
      "label": "View",
      "icon": "eye",
      "redirect": "/users/${id}"
    },
    {
      "type": "action",
      "label": "Edit",
      "icon": "edit"
    },
    {
      "type": "action",
      "label": "Delete",
      "icon": "trash",
      "level": "danger",
      "confirmText": "Delete this user?"
    }
  ]
}
```

## Display Modes

The CRUD component supports multiple display modes:

### Table Mode (Default)

```json
{
  "mode": "table"
}
```

Traditional table view with columns and rows.

### Grid Mode

```json
{
  "mode": "grid",
  "gridColumns": 3,
  "cardTemplate": {
    "type": "card",
    "body": [
      { "type": "text", "content": "${item.name}" },
      { "type": "text", "content": "${item.email}" }
    ]
  }
}
```

Card-based grid layout.

### List Mode

```json
{
  "mode": "list",
  "cardTemplate": {
    "type": "div",
    "className": "p-4 border-b",
    "body": [...]
  }
}
```

Vertical list layout.

### Kanban Mode

```json
{
  "mode": "kanban",
  "kanbanGroupField": "status",
  "kanbanColumns": [
    { "id": "todo", "title": "To Do", "color": "gray" },
    { "id": "in_progress", "title": "In Progress", "color": "blue" },
    { "id": "done", "title": "Done", "color": "green" }
  ]
}
```

Kanban board layout with draggable cards.

## API Contract

The CRUD component expects specific API endpoints and response formats:

### List Endpoint

**Request:** `GET /api/users?page=1&pageSize=20&search=john&sort=name&order=asc`

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      ...
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

### Create Endpoint

**Request:** `POST /api/users`
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  ...
}
```

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  ...
}
```

### Read Endpoint

**Request:** `GET /api/users/1`

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  ...
}
```

### Update Endpoint

**Request:** `PUT /api/users/1`
```json
{
  "name": "John Smith",
  ...
}
```

**Response:**
```json
{
  "id": 1,
  "name": "John Smith",
  ...
}
```

### Delete Endpoint

**Request:** `DELETE /api/users/1`

**Response:**
```json
{
  "success": true
}
```

## Variable Substitution

URLs and messages support variable substitution using `${}` syntax:

- `${id}` - Current record ID
- `${count}` - Selected items count (for batch actions)
- `${item.field}` - Field value from current record

**Examples:**

```json
{
  "api": "/api/users/${id}",
  "confirmText": "Delete ${item.name}?",
  "successMessage": "${count} users activated!"
}
```

## Complete Example

See [examples/user-management](../../examples/user-management) for a complete working example.

## Related

- [Action Schema](./action.md)
- [Detail Schema](./detail.md)
- [API Integration](../integration/api.md)
- [Event Handling](./events.md)
