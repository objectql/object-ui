---
title: "Schema Type Reference"
description: "Complete API reference for all ObjectUI schema types with annotated examples"
---

# Schema Type Reference

This reference documents every ObjectUI schema type with annotated JSON examples. Each schema extends `BaseSchema` and can be rendered by the ObjectUI engine from pure JSON.

> **Import:** All types are available from `@object-ui/types`.
>
> ```typescript
> import type { PageSchema, FormSchema, TableSchema, /* ... */ } from '@object-ui/types';
> ```

---

## Base Schema

### SchemaNode

The foundational building block of ObjectUI. Every component in the system is described by a `SchemaNode`. It can be a full schema object, or a primitive value rendered as text.

```typescript
// Type definition
type SchemaNode = BaseSchema | string | number | boolean | null | undefined;
```

### BaseSchema

All schema types extend `BaseSchema`. These shared properties are available on every component.

```json
{
  "type": "div",
  "id": "my-component",
  "name": "wrapper",
  "label": "Wrapper",
  "description": "A container element",
  "className": "p-4 bg-white rounded-lg",
  "visible": true,
  "visibleOn": "${data.showWrapper}",
  "disabled": false,
  "disabledOn": "${data.isLocked}",
  "testId": "wrapper-element",
  "ariaLabel": "Content wrapper",
  "body": []
}
```

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | **Required.** Component type identifier (e.g. `"page"`, `"form"`, `"table"`). |
| `id` | `string` | Unique instance identifier. |
| `name` | `string` | Component name, used for form fields and data binding. |
| `label` | `string` | Human-readable display label. |
| `description` | `string` | Help text or tooltip content. |
| `className` | `string` | Tailwind CSS utility classes. |
| `style` | `Record<string, string \| number>` | Inline styles (prefer `className`). |
| `body` | `SchemaNode \| SchemaNode[]` | Child components rendered inside this component. |
| `children` | `SchemaNode \| SchemaNode[]` | Alias for `body`. |
| `visible` / `visibleOn` | `boolean` / `string` | Control visibility. `visibleOn` accepts expression strings. |
| `hidden` / `hiddenOn` | `boolean` / `string` | Inverse of visible. |
| `disabled` / `disabledOn` | `boolean` / `string` | Control disabled state. |
| `testId` | `string` | Test identifier for automated testing. |
| `ariaLabel` | `string` | Accessibility label. |

---

## Layout Schemas

### PageSchema

Top-level page container. Defines a full page with optional regions (header, sidebar, footer).

```json
{
  "type": "page",
  "title": "User Dashboard",
  "icon": "LayoutDashboard",
  "description": "Overview of user activity",
  "pageType": "detail",
  "object": "User",
  "variables": [
    { "name": "userId", "type": "string", "defaultValue": "current" }
  ],
  "regions": [
    {
      "name": "header",
      "body": [{ "type": "text", "body": "Welcome back" }]
    }
  ],
  "body": [
    { "type": "card", "title": "Activity", "body": [] }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Page title displayed in the header. |
| `icon` | `string` | Lucide icon name for the page. |
| `pageType` | `PageType` | Page purpose: `"list"`, `"detail"`, `"form"`, `"dashboard"`, `"report"`, `"custom"`. |
| `object` | `string` | ObjectQL object name this page operates on. |
| `template` | `string` | Template name for page layout. |
| `variables` | `PageVariable[]` | Page-level variables with types and defaults. |
| `regions` | `PageRegion[]` | Named layout regions (header, sidebar, footer). |
| `body` | `SchemaNode[]` | Main page content. |
| `isDefault` | `boolean` | Whether this is the default page for the object. |
| `assignedProfiles` | `string[]` | Security profiles that can access this page. |

**Related:** [AppSchema](/docs/core/app-schema), [DivSchema](#divschema), [GridSchema](#gridschema)

---

### DivSchema

A generic container element. The simplest layout primitive.

```json
{
  "type": "div",
  "className": "flex items-center gap-4 p-6",
  "children": [
    { "type": "text", "body": "Hello World" },
    { "type": "button", "label": "Click me" }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `children` | `SchemaNode \| SchemaNode[]` | Child elements to render inside the div. |

**Related:** [GridSchema](#gridschema), [CardSchema](#cardschema)

---

### CardSchema

A styled container with optional header, body, and footer regions.

```json
{
  "type": "card",
  "title": "Revenue Summary",
  "description": "Monthly revenue breakdown",
  "variant": "outline",
  "hoverable": true,
  "header": [
    { "type": "badge", "label": "Live", "variant": "success" }
  ],
  "body": [
    { "type": "statistic", "label": "Total Revenue", "value": "$12,400" }
  ],
  "footer": [
    { "type": "button", "label": "View Details", "variant": "ghost" }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Card title text. |
| `description` | `string` | Subtitle / description text. |
| `variant` | `"default" \| "outline" \| "ghost"` | Visual style variant. |
| `hoverable` | `boolean` | Add hover elevation effect. |
| `clickable` | `boolean` | Make the entire card a click target. |
| `header` | `SchemaNode \| SchemaNode[]` | Content rendered in the card header. |
| `body` | `SchemaNode \| SchemaNode[]` | Main card content. |
| `footer` | `SchemaNode \| SchemaNode[]` | Content rendered in the card footer. |

**Related:** [DivSchema](#divschema), [GridSchema](#gridschema)

---

### GridSchema

A responsive grid layout. Columns can be a fixed number or responsive breakpoints.

```json
{
  "type": "grid",
  "columns": { "sm": 1, "md": 2, "lg": 3 },
  "gap": 6,
  "children": [
    { "type": "card", "title": "Card 1", "body": [] },
    { "type": "card", "title": "Card 2", "body": [] },
    { "type": "card", "title": "Card 3", "body": [] }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `columns` | `number \| Record<string, number>` | Number of columns, or responsive map (e.g. `{ sm: 1, md: 2, lg: 3 }`). |
| `gap` | `number` | Gap between grid items (Tailwind spacing scale). |
| `children` | `SchemaNode \| SchemaNode[]` | Grid items. |

**Related:** [DivSchema](#divschema), [CardSchema](#cardschema), [DashboardSchema](#dashboardschema)

---

### TabsSchema

A tabbed interface for organizing content into switchable panels.

```json
{
  "type": "tabs",
  "defaultValue": "overview",
  "orientation": "horizontal",
  "items": [
    {
      "value": "overview",
      "label": "Overview",
      "icon": "Info",
      "content": { "type": "div", "body": [{ "type": "text", "body": "Overview content" }] }
    },
    {
      "value": "settings",
      "label": "Settings",
      "icon": "Settings",
      "content": { "type": "form", "fields": [] }
    }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `defaultValue` | `string` | Initially active tab value. |
| `value` | `string` | Controlled active tab value. |
| `orientation` | `"horizontal" \| "vertical"` | Tab bar orientation. |
| `items` | `TabItem[]` | Tab definitions, each with `value`, `label`, `icon`, `content`, and optional `disabled`. |

**Related:** [CardSchema](#cardschema), [PageSchema](#pageschema)

---

## Form Schemas

### FormSchema

A complete form with fields, validation, layout, and actions.

```json
{
  "type": "form",
  "layout": "horizontal",
  "columns": 2,
  "validationMode": "onBlur",
  "submitLabel": "Save Changes",
  "showCancel": true,
  "cancelLabel": "Discard",
  "defaultValues": {
    "name": "",
    "email": "",
    "role": "viewer"
  },
  "fields": [
    { "name": "name", "label": "Full Name", "type": "text", "required": true },
    { "name": "email", "label": "Email", "type": "email", "required": true },
    { "name": "role", "label": "Role", "type": "select", "options": [
      { "label": "Admin", "value": "admin" },
      { "label": "Editor", "value": "editor" },
      { "label": "Viewer", "value": "viewer" }
    ]}
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `fields` | `FormField[]` | Field definitions for the form. |
| `defaultValues` | `Record<string, any>` | Initial form values. |
| `layout` | `"vertical" \| "horizontal"` | Field label placement. |
| `columns` | `number` | Number of columns for field layout. |
| `validationMode` | `"onSubmit" \| "onBlur" \| "onChange" \| "onTouched" \| "all"` | When validation triggers. |
| `submitLabel` | `string` | Text for the submit button. |
| `cancelLabel` | `string` | Text for the cancel button. |
| `showCancel` | `boolean` | Whether to show a cancel button. |
| `showActions` | `boolean` | Whether to show the action buttons row. |
| `resetOnSubmit` | `boolean` | Reset form after successful submit. |
| `mode` | `"edit" \| "read" \| "disabled"` | Form interaction mode. |
| `actions` | `SchemaNode[]` | Custom action buttons to replace defaults. |

**Related:** [InputSchema](#inputschema), [SelectSchema](#selectschema), [ObjectFormSchema](#objectformschema)

---

### InputSchema

A text input field supporting multiple input types with validation.

```json
{
  "type": "input",
  "name": "email",
  "label": "Email Address",
  "inputType": "email",
  "placeholder": "you@example.com",
  "required": true,
  "description": "We'll never share your email",
  "maxLength": 255
}
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Field name for form data binding. |
| `inputType` | `string` | HTML input type: `"text"`, `"email"`, `"password"`, `"number"`, `"tel"`, `"url"`, `"search"`, `"date"`, `"time"`, `"datetime-local"`. |
| `placeholder` | `string` | Placeholder text. |
| `required` | `boolean` | Whether the field is required. |
| `readOnly` | `boolean` | Render as read-only. |
| `error` | `string` | Error message to display. |
| `min` / `max` | `number` | Numeric range constraints. |
| `step` | `number` | Step increment for number inputs. |
| `maxLength` | `number` | Maximum character length. |
| `pattern` | `string` | Regex pattern for validation. |

**Related:** [FormSchema](#formschema), [SelectSchema](#selectschema)

---

### SelectSchema

A dropdown select field with predefined options.

```json
{
  "type": "select",
  "name": "priority",
  "label": "Priority",
  "placeholder": "Choose priority...",
  "required": true,
  "options": [
    { "label": "🔴 Critical", "value": "critical" },
    { "label": "🟠 High", "value": "high" },
    { "label": "🟡 Medium", "value": "medium" },
    { "label": "🟢 Low", "value": "low" }
  ],
  "defaultValue": "medium"
}
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Field name for form data binding. |
| `options` | `SelectOption[]` | Array of `{ label, value }` objects. |
| `placeholder` | `string` | Placeholder text when no value selected. |
| `required` | `boolean` | Whether selection is required. |
| `defaultValue` | `string` | Initial selected value. |
| `error` | `string` | Error message to display. |

**Related:** [FormSchema](#formschema), [InputSchema](#inputschema)

---

### ButtonSchema

An interactive button with variants, icons, and loading states.

```json
{
  "type": "button",
  "label": "Deploy to Production",
  "variant": "default",
  "size": "lg",
  "icon": "Rocket",
  "iconPosition": "left",
  "loading": false,
  "buttonType": "submit"
}
```

| Property | Type | Description |
|----------|------|-------------|
| `label` | `string` | Button text. |
| `variant` | `"default" \| "secondary" \| "destructive" \| "outline" \| "ghost" \| "link"` | Visual style. |
| `size` | `"default" \| "sm" \| "lg" \| "icon"` | Button size. |
| `icon` | `string` | Lucide icon name. |
| `iconPosition` | `"left" \| "right"` | Icon placement relative to label. |
| `loading` | `boolean` | Show loading spinner and disable interaction. |
| `buttonType` | `"button" \| "submit" \| "reset"` | HTML button type. |

**Related:** [ActionSchema](#actionschema), [FormSchema](#formschema)

---

## Data Display Schemas

### TableSchema

A data table with columns, optional striping, and hover effects.

```json
{
  "type": "table",
  "caption": "Recent Orders",
  "hoverable": true,
  "striped": true,
  "columns": [
    { "name": "id", "label": "#", "width": 60 },
    { "name": "customer", "label": "Customer" },
    { "name": "amount", "label": "Amount", "align": "right" },
    { "name": "status", "label": "Status" }
  ],
  "data": [
    { "id": 1, "customer": "Acme Corp", "amount": "$1,200", "status": "Paid" },
    { "id": 2, "customer": "Globex Inc", "amount": "$3,400", "status": "Pending" }
  ],
  "footer": { "type": "text", "body": "Showing 2 of 156 orders" }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `caption` | `string` | Table caption / title text. |
| `columns` | `TableColumn[]` | Column definitions with `name`, `label`, `width`, `align`, `sortable`, `render`. |
| `data` | `any[]` | Array of row data objects. |
| `footer` | `SchemaNode \| string` | Footer content below the table. |
| `hoverable` | `boolean` | Highlight rows on hover. |
| `striped` | `boolean` | Alternate row background colors. |

**Related:** [CRUDSchema](#crudschema), [ObjectGridSchema](#objectgridschema)

---

### ChartSchema

A chart visualization supporting multiple chart types.

```json
{
  "type": "chart",
  "chartType": "bar",
  "title": "Monthly Revenue",
  "description": "Revenue by month for 2024",
  "height": 350,
  "showLegend": true,
  "showGrid": true,
  "animate": true,
  "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  "series": [
    {
      "name": "Revenue",
      "data": [4200, 5100, 4800, 6200, 5800, 7100],
      "color": "#3b82f6"
    },
    {
      "name": "Expenses",
      "data": [3100, 3400, 3200, 3800, 3600, 4000],
      "color": "#ef4444"
    }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `chartType` | `ChartType` | **Required.** `"bar"`, `"line"`, `"area"`, `"pie"`, `"donut"`, `"radar"`, `"scatter"`, `"heatmap"`. |
| `title` | `string` | Chart title. |
| `description` | `string` | Chart description / subtitle. |
| `categories` | `string[]` | X-axis category labels. |
| `series` | `ChartSeries[]` | Data series, each with `name`, `data` array, and optional `color`. |
| `height` / `width` | `string \| number` | Chart dimensions. |
| `showLegend` | `boolean` | Display the legend. |
| `showGrid` | `boolean` | Display grid lines. |
| `animate` | `boolean` | Enable entry animations. |
| `config` | `Record<string, any>` | Additional chart library configuration. |

**Related:** [DashboardSchema](#dashboardschema), [CardSchema](#cardschema)

---

### TreeViewSchema

A hierarchical tree component for nested data with expand/collapse and selection.

```json
{
  "type": "tree-view",
  "multiSelect": false,
  "showLines": true,
  "defaultExpandedIds": ["root", "src"],
  "data": [
    {
      "id": "root",
      "label": "project",
      "icon": "Folder",
      "children": [
        {
          "id": "src",
          "label": "src",
          "icon": "Folder",
          "children": [
            { "id": "app", "label": "App.tsx", "icon": "FileCode" },
            { "id": "index", "label": "index.ts", "icon": "FileCode" }
          ]
        },
        { "id": "readme", "label": "README.md", "icon": "FileText" }
      ]
    }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `data` | `TreeNode[]` | **Required.** Nested tree data. Each node has `id`, `label`, optional `icon` and `children`. |
| `defaultExpandedIds` | `string[]` | Node IDs expanded on initial render. |
| `defaultSelectedIds` | `string[]` | Node IDs selected on initial render. |
| `expandedIds` | `string[]` | Controlled expanded state. |
| `selectedIds` | `string[]` | Controlled selection state. |
| `multiSelect` | `boolean` | Allow selecting multiple nodes. |
| `showLines` | `boolean` | Show tree connector lines. |

**Related:** [TableSchema](#tableschema)

---

## CRUD Schemas

### CRUDSchema

A complete CRUD (Create, Read, Update, Delete) interface with table, toolbar, filters, pagination, and batch/row actions.

```json
{
  "type": "crud",
  "title": "Products",
  "resource": "products",
  "api": "/api/products",
  "selectable": "multiple",
  "defaultSort": "name",
  "defaultSortOrder": "asc",
  "columns": [
    { "name": "name", "label": "Product Name", "sortable": true },
    { "name": "price", "label": "Price", "align": "right" },
    { "name": "stock", "label": "Stock", "sortable": true },
    { "name": "status", "label": "Status" }
  ],
  "fields": [
    { "name": "name", "label": "Product Name", "type": "text", "required": true },
    { "name": "price", "label": "Price", "type": "number", "required": true },
    { "name": "stock", "label": "Stock", "type": "number" },
    { "name": "status", "label": "Status", "type": "select", "options": [
      { "label": "Active", "value": "active" },
      { "label": "Draft", "value": "draft" }
    ]}
  ],
  "operations": {
    "create": true,
    "read": true,
    "update": true,
    "delete": true,
    "export": true
  },
  "toolbar": {
    "showSearch": true,
    "showFilters": true,
    "showExport": true,
    "actions": [
      { "type": "action", "label": "Add Product", "level": "primary", "icon": "Plus" }
    ]
  },
  "filters": [
    { "name": "status", "label": "Status", "type": "select", "options": [
      { "label": "Active", "value": "active" },
      { "label": "Draft", "value": "draft" }
    ]}
  ],
  "pagination": {
    "pageSize": 20,
    "pageSizeOptions": [10, 20, 50, 100]
  },
  "rowActions": [
    { "type": "action", "label": "Edit", "icon": "Pencil", "actionType": "dialog" },
    { "type": "action", "label": "Delete", "icon": "Trash2", "level": "danger", "actionType": "confirm" }
  ],
  "batchActions": [
    { "type": "action", "label": "Delete Selected", "level": "danger", "actionType": "confirm" }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | CRUD view title. |
| `resource` | `string` | Resource identifier for API calls. |
| `api` | `string` | Base API endpoint URL. |
| `columns` | `TableColumn[]` | **Required.** Column definitions for the table view. |
| `fields` | `FormField[]` | Field definitions for create/edit forms. |
| `operations` | `object` | Toggle CRUD operations: `create`, `read`, `update`, `delete`, `export`, `import`. |
| `toolbar` | `CRUDToolbar` | Toolbar configuration with search, filters, and custom actions. |
| `filters` | `CRUDFilter[]` | Filter definitions. |
| `pagination` | `CRUDPagination` | Pagination settings with `pageSize` and `pageSizeOptions`. |
| `selectable` | `boolean \| "single" \| "multiple"` | Row selection mode. |
| `rowActions` | `ActionSchema[]` | Actions available on each row. |
| `batchActions` | `ActionSchema[]` | Actions for selected rows. |
| `defaultSort` / `defaultSortOrder` | `string` / `"asc" \| "desc"` | Default sort field and direction. |
| `mode` | `"table" \| "grid" \| "list" \| "kanban"` | Display mode for the CRUD view. |
| `emptyState` | `SchemaNode` | Custom empty state content. |

**Related:** [ActionSchema](#actionschema), [TableSchema](#tableschema), [ObjectGridSchema](#objectgridschema)

---

### ActionSchema

A powerful action definition supporting API calls, confirmations, dialogs, chaining, and conditional execution.

```json
{
  "type": "action",
  "label": "Submit Order",
  "level": "primary",
  "icon": "Send",
  "actionType": "ajax",
  "api": "/api/orders",
  "method": "POST",
  "data": { "status": "submitted" },
  "confirm": {
    "title": "Submit Order?",
    "message": "This will send the order to the warehouse.",
    "confirmText": "Yes, Submit",
    "confirmVariant": "default"
  },
  "successMessage": "Order submitted successfully",
  "errorMessage": "Failed to submit order",
  "chain": [
    {
      "type": "action",
      "label": "Refresh",
      "actionType": "button",
      "reload": true
    }
  ],
  "chainMode": "sequential",
  "condition": {
    "expression": "${data.items.length > 0}"
  },
  "retry": {
    "maxAttempts": 3,
    "delay": 1000
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `label` | `string` | **Required.** Action display text. |
| `level` | `string` | Semantic level: `"primary"`, `"secondary"`, `"success"`, `"warning"`, `"danger"`, `"info"`. |
| `icon` | `string` | Lucide icon name. |
| `actionType` | `string` | Action kind: `"button"`, `"link"`, `"dropdown"`, `"ajax"`, `"confirm"`, `"dialog"`. |
| `api` | `string` | API endpoint for `ajax` actions. |
| `method` | `string` | HTTP method: `"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, `"PATCH"`. |
| `data` | `any` | Request body data. |
| `confirm` | `object` | Confirmation dialog with `title`, `message`, `confirmText`, `cancelText`. |
| `dialog` | `object` | Modal dialog with `title`, `content`, `size`, `actions`. |
| `chain` | `ActionSchema[]` | Actions to execute after this action completes. |
| `chainMode` | `"sequential" \| "parallel"` | How chained actions execute. |
| `condition` | `ActionCondition` | Conditional execution with `expression`, `then`, `else`. |
| `successMessage` / `errorMessage` | `string` | Toast messages on success/failure. |
| `reload` | `boolean` | Reload data after action completes. |
| `redirect` | `string` | URL to navigate to after action. |
| `retry` | `object` | Retry config with `maxAttempts` and `delay`. |

**Related:** [CRUDSchema](#crudschema), [ButtonSchema](#buttonschema)

---

### DetailSchema

A single-record detail view with grouped fields, actions, and tabs.

```json
{
  "type": "detail",
  "title": "Order #1042",
  "api": "/api/orders/1042",
  "showBack": true,
  "groups": [
    {
      "title": "Customer Info",
      "fields": [
        { "name": "customer", "label": "Customer", "type": "text" },
        { "name": "email", "label": "Email", "type": "link" },
        { "name": "created", "label": "Created", "type": "date", "format": "MMM d, yyyy" }
      ]
    },
    {
      "title": "Order Details",
      "fields": [
        { "name": "total", "label": "Total", "type": "text" },
        { "name": "status", "label": "Status", "type": "badge" }
      ]
    }
  ],
  "actions": [
    { "type": "action", "label": "Edit", "icon": "Pencil", "level": "primary" },
    { "type": "action", "label": "Delete", "icon": "Trash2", "level": "danger", "actionType": "confirm" }
  ],
  "tabs": [
    {
      "key": "items",
      "label": "Line Items",
      "content": { "type": "table", "columns": [], "data": [] }
    },
    {
      "key": "history",
      "label": "History",
      "content": { "type": "timeline", "events": [] }
    }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Detail page title. |
| `api` | `string` | API endpoint to fetch record data. |
| `resourceId` | `string \| number` | ID of the record to display. |
| `groups` | `array` | Field groups, each with `title`, `description`, and `fields`. |
| `actions` | `ActionSchema[]` | Available actions (edit, delete, etc.). |
| `tabs` | `array` | Additional tabbed content with `key`, `label`, and `content`. |
| `showBack` | `boolean` | Show a back navigation button. |
| `loading` | `boolean` | Show loading state. |

**Related:** [DetailViewSchema](#detailviewschema), [CRUDSchema](#crudschema)

---

## ObjectQL Schemas

These schemas integrate with [ObjectStack](https://objectstack.ai) for automatic data fetching, but work with any backend through the `data` prop.

### ObjectGridSchema

A data grid that auto-fetches from an ObjectQL object definition. Includes search, filters, pagination, grouping, and inline editing.

```json
{
  "type": "object-grid",
  "objectName": "Contact",
  "title": "All Contacts",
  "description": "Manage your contacts",
  "showSearch": true,
  "showFilters": true,
  "showPagination": true,
  "pageSize": 25,
  "resizableColumns": true,
  "striped": true,
  "columns": [
    "name",
    "email",
    "company",
    "phone",
    { "name": "status", "label": "Status", "sortable": true }
  ],
  "defaultSort": { "field": "name", "order": "asc" },
  "operations": {
    "create": true,
    "read": true,
    "update": true,
    "delete": true,
    "export": true
  },
  "rowActions": ["edit", "delete"],
  "selection": {
    "enabled": true,
    "mode": "multiple"
  },
  "pagination": {
    "enabled": true,
    "pageSize": 25,
    "pageSizeOptions": [10, 25, 50, 100]
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `objectName` | `string` | **Required.** ObjectQL object API name. |
| `columns` | `string[] \| ListColumn[]` | Columns to display. Strings auto-resolve from object metadata. |
| `filter` | `any[]` | Pre-applied filter conditions. |
| `sort` | `string \| SortConfig[]` | Default sort configuration. |
| `searchableFields` | `string[]` | Fields included in search. |
| `selection` | `SelectionConfig` | Row selection configuration. |
| `pagination` | `PaginationConfig` | Pagination settings. |
| `operations` | `object` | Enabled CRUD operations. |
| `rowActions` / `batchActions` | `string[]` | Action identifiers for rows and batch selection. |
| `editable` | `boolean` | Enable inline cell editing. |
| `grouping` | `GroupingConfig` | Row grouping configuration. |
| `frozenColumns` | `number` | Number of columns frozen on scroll. |
| `navigation` | `ViewNavigationConfig` | SPA navigation configuration. |

**Related:** [ObjectViewSchema](#objectviewschema), [CRUDSchema](#crudschema), [TableSchema](#tableschema)

---

### ObjectFormSchema

A smart form that auto-generates fields from an ObjectQL object. Supports simple, tabbed, wizard, split, drawer, and modal layouts.

```json
{
  "type": "object-form",
  "objectName": "Contact",
  "mode": "create",
  "formType": "tabbed",
  "title": "New Contact",
  "layout": "vertical",
  "columns": 2,
  "fields": ["firstName", "lastName", "email", "phone", "company"],
  "sections": [
    {
      "title": "Basic Info",
      "fields": ["firstName", "lastName", "email"]
    },
    {
      "title": "Details",
      "fields": ["phone", "company", "address"]
    }
  ],
  "groups": [
    {
      "title": "Contact Information",
      "fields": ["firstName", "lastName", "email"],
      "collapsible": true
    }
  ],
  "showSubmit": true,
  "submitText": "Create Contact",
  "showCancel": true,
  "cancelText": "Cancel"
}
```

| Property | Type | Description |
|----------|------|-------------|
| `objectName` | `string` | **Required.** ObjectQL object API name. |
| `mode` | `"create" \| "edit" \| "view"` | **Required.** Form interaction mode. |
| `formType` | `string` | Layout type: `"simple"`, `"tabbed"`, `"wizard"`, `"split"`, `"drawer"`, `"modal"`. |
| `recordId` | `string \| number` | Record ID for edit/view modes. |
| `fields` | `string[]` | Field API names to include (auto-resolved from object metadata). |
| `customFields` | `FormField[]` | Manually defined fields that override auto-generated ones. |
| `sections` | `ObjectFormSection[]` | Tabbed/wizard sections. |
| `groups` | `array` | Collapsible field groups. |
| `layout` | `string` | Label layout: `"vertical"`, `"horizontal"`, `"inline"`, `"grid"`. |
| `columns` | `number` | Number of form columns. |
| `submitText` / `cancelText` | `string` | Button labels. |
| `showSubmit` / `showCancel` / `showReset` | `boolean` | Toggle action buttons. |
| `drawerSide` | `string` | Drawer position: `"top"`, `"bottom"`, `"left"`, `"right"`. |
| `modalSize` | `string` | Modal size: `"sm"`, `"default"`, `"lg"`, `"xl"`, `"full"`. |

**Related:** [FormSchema](#formschema), [ObjectViewSchema](#objectviewschema)

---

### ObjectViewSchema

A complete object management interface combining grid, form, search, filters, and view switching.

```json
{
  "type": "object-view",
  "objectName": "Deal",
  "title": "Sales Pipeline",
  "description": "Manage your deals",
  "defaultViewType": "kanban",
  "showSearch": true,
  "showFilters": true,
  "showCreate": true,
  "showRefresh": true,
  "showViewSwitcher": true,
  "operations": {
    "create": true,
    "read": true,
    "update": true,
    "delete": true
  },
  "searchableFields": ["name", "company", "owner"],
  "filterableFields": ["stage", "owner", "value"],
  "listViews": {
    "all": {
      "label": "All Deals",
      "filter": [],
      "sort": [{ "field": "value", "order": "desc" }]
    },
    "my-deals": {
      "label": "My Deals",
      "filter": [["owner", "=", "${currentUser.id}"]],
      "default": true
    }
  },
  "table": {
    "columns": ["name", "stage", "value", "owner", "closeDate"],
    "pageSize": 25
  },
  "form": {
    "formType": "drawer",
    "drawerSide": "right",
    "fields": ["name", "stage", "value", "owner", "closeDate", "notes"]
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `objectName` | `string` | **Required.** ObjectQL object API name. |
| `title` | `string` | View title. |
| `defaultViewType` | `string` | Initial view: `"grid"`, `"kanban"`, `"gallery"`, `"calendar"`, `"timeline"`, `"gantt"`, `"map"`. |
| `listViews` | `Record<string, NamedListView>` | Named list views with filters and sort. |
| `defaultListView` | `string` | Key of the default list view. |
| `table` | `Partial<ObjectGridSchema>` | Grid configuration overrides. |
| `form` | `Partial<ObjectFormSchema>` | Form configuration overrides. |
| `showSearch` / `showFilters` / `showCreate` / `showRefresh` | `boolean` | Toggle toolbar features. |
| `showViewSwitcher` | `boolean` | Show view type toggle (grid, kanban, etc.). |
| `operations` | `object` | Enabled CRUD operations. |
| `navigation` | `ViewNavigationConfig` | SPA-aware navigation. |

**Related:** [ObjectGridSchema](#objectgridschema), [ObjectFormSchema](#objectformschema), [ViewSwitcherSchema](#viewswitcherschema)

---

## Complex Schemas

### KanbanSchema

A drag-and-drop Kanban board with columns and cards.

```json
{
  "type": "kanban",
  "draggable": true,
  "columns": [
    {
      "id": "todo",
      "title": "To Do",
      "color": "#6366f1",
      "cards": [
        { "id": "task-1", "title": "Design mockups", "description": "Create wireframes for new feature" },
        { "id": "task-2", "title": "Write tests", "description": "Unit tests for auth module" }
      ]
    },
    {
      "id": "in-progress",
      "title": "In Progress",
      "color": "#f59e0b",
      "cards": [
        { "id": "task-3", "title": "API integration", "description": "Connect to payment gateway" }
      ]
    },
    {
      "id": "done",
      "title": "Done",
      "color": "#22c55e",
      "cards": []
    }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `columns` | `KanbanColumn[]` | **Required.** Board columns, each with `id`, `title`, `color`, and `cards`. |
| `draggable` | `boolean` | Enable drag-and-drop between columns. |
| `onCardMove` | `function` | Callback when a card is moved: `(cardId, fromColumn, toColumn, position)`. |
| `onCardClick` | `function` | Callback when a card is clicked. |
| `onColumnAdd` | `function` | Callback when a new column is added. |
| `onCardAdd` | `function` | Callback when a new card is added to a column. |

**Related:** [ObjectViewSchema](#objectviewschema), [CRUDSchema](#crudschema)

---

### DashboardSchema

A widget-based dashboard with configurable grid layout and auto-refresh.

```json
{
  "type": "dashboard",
  "columns": 4,
  "gap": 6,
  "refreshInterval": 30000,
  "widgets": [
    {
      "id": "revenue",
      "title": "Total Revenue",
      "description": "Monthly revenue",
      "colSpan": 1,
      "rowSpan": 1,
      "body": {
        "type": "statistic",
        "label": "Revenue",
        "value": "$48,200",
        "trend": { "value": 12, "direction": "up" }
      }
    },
    {
      "id": "chart",
      "title": "Sales Trend",
      "colSpan": 2,
      "rowSpan": 1,
      "body": {
        "type": "chart",
        "chartType": "area",
        "categories": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "series": [{ "name": "Sales", "data": [120, 180, 150, 210, 190] }]
      }
    },
    {
      "id": "tasks",
      "title": "Recent Tasks",
      "colSpan": 1,
      "rowSpan": 1,
      "body": {
        "type": "list",
        "items": []
      }
    }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `columns` | `number` | Number of grid columns. |
| `gap` | `number` | Gap between widgets (Tailwind spacing scale). |
| `widgets` | `DashboardWidgetSchema[]` | **Required.** Widget definitions with `id`, `title`, `colSpan`, `rowSpan`, and `body`. |
| `refreshInterval` | `number` | Auto-refresh interval in milliseconds. |

Each widget supports `colSpan` and `rowSpan` to control its size in the grid. The `body` can be any `SchemaNode`.

**Related:** [GridSchema](#gridschema), [ChartSchema](#chartschema), [CardSchema](#cardschema)

---

### CalendarViewSchema

A multi-view calendar for displaying and managing events.

```json
{
  "type": "calendar-view",
  "defaultView": "month",
  "views": ["month", "week", "day", "agenda"],
  "editable": true,
  "events": [
    {
      "id": "evt-1",
      "title": "Team Standup",
      "start": "2024-03-15T09:00:00",
      "end": "2024-03-15T09:30:00",
      "color": "#3b82f6"
    },
    {
      "id": "evt-2",
      "title": "Sprint Review",
      "start": "2024-03-15T14:00:00",
      "end": "2024-03-15T15:00:00",
      "color": "#8b5cf6",
      "allDay": false
    }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `events` | `CalendarEvent[]` | **Required.** Events with `id`, `title`, `start`, `end`, optional `color` and `allDay`. |
| `defaultView` | `CalendarViewMode` | Initial view: `"month"`, `"week"`, `"day"`, `"agenda"`. |
| `views` | `CalendarViewMode[]` | Available view modes the user can switch between. |
| `editable` | `boolean` | Allow creating and modifying events. |
| `defaultDate` | `string \| Date` | Initial calendar date. |
| `onEventClick` | `function` | Callback when an event is clicked. |
| `onEventCreate` | `function` | Callback for new event creation: `(start, end)`. |
| `onEventUpdate` | `function` | Callback when an event is modified. |
| `onDateChange` | `function` | Callback when the visible date range changes. |

**Related:** [ObjectViewSchema](#objectviewschema), [DashboardSchema](#dashboardschema)

---

## View Schemas

### DetailViewSchema

An enhanced detail view for a single record with sections, tabs, related records, and navigation.

```json
{
  "type": "detail-view",
  "title": "Contact Details",
  "objectName": "Contact",
  "resourceId": "contact-123",
  "layout": "grid",
  "columns": 2,
  "showBack": true,
  "backUrl": "/contacts",
  "showEdit": true,
  "editUrl": "/contacts/contact-123/edit",
  "showDelete": true,
  "deleteConfirmation": "Are you sure you want to delete this contact?",
  "sections": [
    {
      "title": "Personal Information",
      "icon": "User",
      "columns": 2,
      "collapsible": true,
      "fields": [
        { "name": "firstName", "label": "First Name", "type": "text" },
        { "name": "lastName", "label": "Last Name", "type": "text" },
        { "name": "email", "label": "Email", "type": "link" },
        { "name": "avatar", "label": "Photo", "type": "image" }
      ]
    }
  ],
  "tabs": [
    {
      "key": "activities",
      "label": "Activities",
      "icon": "Activity",
      "badge": 5,
      "content": { "type": "timeline", "events": [] }
    }
  ],
  "related": [
    {
      "title": "Recent Orders",
      "type": "table",
      "api": "/api/contacts/contact-123/orders",
      "columns": [
        { "name": "id", "label": "Order #" },
        { "name": "total", "label": "Total" },
        { "name": "status", "label": "Status" }
      ]
    }
  ],
  "actions": [
    { "type": "action", "label": "Send Email", "icon": "Mail", "level": "primary" }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Detail page title. |
| `objectName` | `string` | ObjectQL object name for data binding. |
| `resourceId` | `string \| number` | Record ID to display. |
| `api` | `string` | API endpoint to fetch record data. |
| `data` | `any` | Static data (if not fetching from API). |
| `layout` | `"vertical" \| "horizontal" \| "grid"` | Field layout mode. |
| `columns` | `number` | Grid columns (for grid layout). |
| `sections` | `DetailViewSection[]` | Field groups with `title`, `icon`, `fields`, `collapsible`. |
| `fields` | `DetailViewField[]` | Direct fields (without sections). |
| `tabs` | `DetailViewTab[]` | Tabbed content with `key`, `label`, `icon`, `badge`, `content`. |
| `related` | `array` | Related record sections with `title`, `type`, `api`, `columns`. |
| `actions` | `ActionSchema[]` | Available actions. |
| `showBack` / `backUrl` | `boolean` / `string` | Back navigation. |
| `showEdit` / `editUrl` | `boolean` / `string` | Edit navigation. |
| `showDelete` / `deleteConfirmation` | `boolean` / `string` | Delete with confirmation message. |
| `header` / `footer` | `SchemaNode` | Custom header/footer content. |

**Related:** [DetailSchema](#detailschema), [ObjectViewSchema](#objectviewschema)

---

### ViewSwitcherSchema

A toggle control that switches between different view types (list, grid, kanban, calendar, etc.).

```json
{
  "type": "view-switcher",
  "defaultView": "list",
  "variant": "tabs",
  "position": "top",
  "persistPreference": true,
  "storageKey": "contacts-view-pref",
  "views": [
    {
      "type": "list",
      "label": "List View",
      "icon": "List",
      "schema": {
        "type": "object-grid",
        "objectName": "Contact",
        "columns": ["name", "email", "phone"]
      }
    },
    {
      "type": "grid",
      "label": "Card View",
      "icon": "LayoutGrid",
      "schema": {
        "type": "grid",
        "columns": 3,
        "children": []
      }
    },
    {
      "type": "kanban",
      "label": "Kanban",
      "icon": "Kanban",
      "schema": {
        "type": "kanban",
        "columns": []
      }
    }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `views` | `array` | **Required.** Available views, each with `type`, `label`, `icon`, and `schema`. |
| `defaultView` | `ViewType` | Initially active view: `"list"`, `"detail"`, `"grid"`, `"kanban"`, `"calendar"`, `"timeline"`, `"map"`. |
| `activeView` | `ViewType` | Controlled active view. |
| `variant` | `"tabs" \| "buttons" \| "dropdown"` | Switcher UI style. |
| `position` | `"top" \| "bottom" \| "left" \| "right"` | Switcher position relative to content. |
| `persistPreference` | `boolean` | Save the user's view preference to storage. |
| `storageKey` | `string` | Storage key for persisting the preference. |
| `onViewChange` | `string` | Expression or callback invoked on view change. |

**Related:** [ObjectViewSchema](#objectviewschema), [KanbanSchema](#kanbanschema), [CalendarViewSchema](#calendarviewschema)

---

## Schema Composition

Schemas are designed to compose. Nest any `SchemaNode` inside another to build complex interfaces:

```json
{
  "type": "page",
  "title": "CRM Dashboard",
  "body": [
    {
      "type": "grid",
      "columns": { "sm": 1, "lg": 2 },
      "gap": 6,
      "children": [
        {
          "type": "card",
          "title": "Quick Stats",
          "body": {
            "type": "dashboard",
            "columns": 2,
            "widgets": [
              { "id": "w1", "title": "Leads", "body": { "type": "statistic", "value": "142" } },
              { "id": "w2", "title": "Revenue", "body": { "type": "statistic", "value": "$24k" } }
            ]
          }
        },
        {
          "type": "card",
          "title": "Recent Activity",
          "body": {
            "type": "tabs",
            "items": [
              { "value": "deals", "label": "Deals", "content": { "type": "table", "columns": [], "data": [] } },
              { "value": "tasks", "label": "Tasks", "content": { "type": "table", "columns": [], "data": [] } }
            ]
          }
        }
      ]
    },
    {
      "type": "object-grid",
      "objectName": "Lead",
      "title": "All Leads",
      "showSearch": true,
      "columns": ["name", "company", "status", "value"]
    }
  ]
}
```

## Type Imports

Import only the types you need:

```typescript
// Layout
import type { PageSchema, DivSchema, CardSchema, GridSchema, TabsSchema } from '@object-ui/types';

// Forms
import type { FormSchema, InputSchema, SelectSchema, ButtonSchema } from '@object-ui/types';

// Data Display
import type { TableSchema, ChartSchema, TreeViewSchema } from '@object-ui/types';

// CRUD
import type { CRUDSchema, ActionSchema, DetailSchema } from '@object-ui/types';

// ObjectQL
import type { ObjectGridSchema, ObjectFormSchema, ObjectViewSchema } from '@object-ui/types';

// Complex
import type { KanbanSchema, DashboardSchema, CalendarViewSchema } from '@object-ui/types';

// Views
import type { DetailViewSchema, ViewSwitcherSchema } from '@object-ui/types';

// Base
import type { BaseSchema, SchemaNode } from '@object-ui/types';
```

## Next Steps

- **[Schema Overview](/docs/guide/schema-overview)** — High-level guide to ObjectUI schemas
- **[Quick Start](/docs/guide/quick-start)** — Build your first ObjectUI application
- **[Expressions](/docs/guide/expressions)** — Dynamic expressions with `visibleOn`, `disabledOn`
- **[Fields Guide](/docs/guide/fields)** — Deep dive into form fields
- **[Plugin Development](/docs/guide/plugin-development)** — Build custom schema renderers
