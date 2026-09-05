---
title: "Schema Type Reference"
description: "Complete API reference for all ObjectUI schema types with annotated examples"
---

# Schema Type Reference

This reference documents every ObjectUI schema type with annotated JSON examples. Each schema extends `BaseSchema` and can be rendered by the ObjectUI engine from pure JSON.

> **Import:** All types are available from `@object-ui/types`.
>
> ```typescript
> import type { PageNodeSchema, FormSchema, TableSchema, /* ... */ } from '@object-ui/types';
> ```

---

## Base Schema

### SchemaNode

The foundational building block of ObjectUI. Every component in the system is described by a `SchemaNode`. It can be a full schema object, or a primitive value rendered as text.

```typescript
import type { BaseSchema } from '@object-ui/types';

// The definition `@object-ui/types` declares
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

One row per declared member, in declaration order, so the list can be checked against `BaseSchema` by reading the two side by side.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | **Required.** Component type identifier (e.g. `"page"`, `"form"`, `"table"`). |
| `id` | `string` | Unique instance identifier. |
| `name` | `string` | Component name, used for form fields and data binding. |
| `label` | `string \| I18nLabel` | Human-readable display label. `I18nLabel` is the spec's **inline locale map** (`string \| Record<string, string>`, keyed by BCP-47 locale tag such as `en` or `zh-CN`), resolved against the display locale by `resolveI18nLabel`. |
| `description` | `string \| I18nLabel` | Help text or tooltip content. Same inline-locale-map vocabulary and resolver as `label`. |
| `placeholder` | `string` | Hint text for input components. |
| `className` | `string` | Tailwind CSS utility classes. |
| `style` | `Record<string, string \| number>` | Inline CSS styles. Use sparingly — prefer `className`. |
| `data` | `any` | Arbitrary data attached to the node. `any` because the shape is defined by the consuming component rather than by `BaseSchema`. |
| `bind` | `string` | Data-scope path this node draws its rows or value from, resolved by `useDataScope()`. Honoured only by components that call it. |
| `body` | `SchemaNode \| SchemaNode[]` | Child components rendered inside this component. |
| `children` | `SchemaNode \| SchemaNode[]` | Alias for `body`. |
| `visible` | `boolean \| string` | Visibility control. Accepts a boolean **or** a predicate expression string — the renderer evaluates this key rather than reading it as a boolean. |
| `visibleWhen` | `string` | Canonical conditional-visibility predicate (ADR-0089); the element is shown when it evaluates truthy. Evaluated **before** `visible` and `visibleOn`, and outranks both. |
| `visibleOn` | `string` | Expression for conditional visibility. **Deprecated** (ADR-0089) — use `visibleWhen`. |
| `hidden` | `boolean \| string` | Inverse of `visible` — the node is not rendered. Accepts a boolean **or** a predicate expression string, which the renderer evaluates rather than reading as a boolean; `hiddenOn` remains the sibling spelling. |
| `hiddenOn` | `string` | Expression for conditional hiding. |
| `disabled` | `boolean \| string` | Disabled state. Accepts a boolean **or** a predicate expression string, on the same evaluated path as `visible`. |
| `disabledOn` | `string` | Expression for conditional disabling. |
| `testId` | `string` | Test identifier, rendered as `data-testid`. |
| `ariaLabel` | `string \| KeyedI18nLabel` | Accessibility label, rendered as `aria-label`. `KeyedI18nLabel` is the **keyed** form (`{ key, defaultValue?, params? }`), resolved by `resolveKeyedI18nLabel` — **not** the `I18nLabel` that `label` and `description` carry. The two are structurally confusable and each returns nothing useful for the other's input. |

Two things the table cannot show in a cell:

- **A concrete schema may narrow an inherited member, and its own declaration wins.** Many component schemas restate `label`, `description` or `disabled` more narrowly than `BaseSchema` declares them, so the unions above are what a node gets when its own schema does not restate the key. Check the component's own property table before writing a predicate string or a locale map into an inherited slot.
- **This list is exhaustive for *declared* members, not for *accepted* keys.** `BaseSchema` carries an index signature (`[key: string]: any`) and its Zod mirror is `.passthrough()`, so an undeclared key — a misspelling included — is still accepted by both halves. Absence from this table does not mean a key is rejected.

---

## Layout Schemas

### PageNodeSchema

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

**Related:** [DivSchema](#divschema), [CardSchema](#cardschema), [DashboardComponentSchema](#dashboardcomponentschema)

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

**Related:** [CardSchema](#cardschema), [PageNodeSchema](#pagenodeschema)

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

A simple static table: it renders inline `data` against `columns`, nothing
more. For row hover highlighting, striping, sorting, filtering, selection or
inline editing use the interactive `data-table` — the static `table` deliberately
does not implement those (objectui#5474 retired the keys that once suggested it
did; authoring them is now refused by validation instead of silently ignored).

```json
{
  "type": "table",
  "caption": "Recent Orders",
  "columns": [
    { "accessorKey": "id", "header": "#", "width": 60 },
    { "accessorKey": "customer", "header": "Customer" },
    { "accessorKey": "amount", "header": "Amount", "cellClassName": "text-right" },
    { "accessorKey": "status", "header": "Status" }
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
| `columns` | `StaticTableColumn[]` | Column definitions — the static subset: `accessorKey` (the row key to read) and `header` (heading text) are required; `width`, `className`, and `cellClassName` are the only other keys this renderer honours. Interactive column keys (`align`, `sortable`, `filterable`, `resizable`, `editable`, `cell`, `fixed`, `minWidth`, `type`) belong to `data-table`'s rich `TableColumn` and are refused here. |
| `data` | `any[]` | Array of row data objects. |
| `footer` | `SchemaNode \| string` | Footer content below the table. |

**Related:** [ObjectGridSchema](#objectgridschema)

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
  "xAxisKey": "month",
  "data": [
    { "month": "Jan", "Revenue": 4200, "Expenses": 3100 },
    { "month": "Feb", "Revenue": 5100, "Expenses": 3400 },
    { "month": "Mar", "Revenue": 4800, "Expenses": 3200 },
    { "month": "Apr", "Revenue": 6200, "Expenses": 3800 },
    { "month": "May", "Revenue": 5800, "Expenses": 3600 },
    { "month": "Jun", "Revenue": 7100, "Expenses": 4000 }
  ],
  "series": [
    {
      "name": "Revenue",
      "color": "#3b82f6"
    },
    {
      "name": "Expenses",
      "color": "#ef4444"
    }
  ]
}
```

The rows live on the chart node's own `data`, one object per row keyed by column
name. Each series' `name` (or `dataKey`) selects the column it plots within those
rows, and `xAxisKey` names the column on the category axis. A series carries no
numbers of its own: `ChartDataSeries.data` is a retirement tombstone
(objectui#6896) and an authored array is refused by name at parse.

| Property | Type | Description |
|----------|------|-------------|
| `chartType` | `ChartType` | **Required.** `"bar"`, `"line"`, `"area"`, `"pie"`, `"donut"`, `"radar"`, `"scatter"`, `"heatmap"`. |
| `title` | `string` | Chart title. |
| `description` | `string` | Chart description / subtitle. |
| `categories` | `string[]` | An **alternative series list** — column names to plot, read only when `series` is absent, and ignored outright when it is present. Not axis labels: the category axis comes from `xAxisKey`. |
| `series` | `ChartDataSeries[]` | Data series. Each entry's `name` (or `dataKey`) names the column it plots within a `data` row; optional `color` and a per-series `type` (`"bar"`, `"line"`, `"area"`) for combo charts. |
| `data` | `Array<Record<string, any>>` | Rows to plot — one object per row, keyed by column name. |
| `xAxisKey` | `string` | Row key holding the category (x) axis. The bare-string `xAxis: "month"` spelling folds onto this key at parse. |
| `height` / `width` | `string \| number` | Chart dimensions. |
| `showLegend` | `boolean` | Display the legend. |
| `showGrid` | `boolean` | Display grid lines. |
| `animate` | `boolean` | Enable entry animations. |
| `config` | `Record<string, any>` | Additional chart library configuration. |

**Related:** [DashboardComponentSchema](#dashboardcomponentschema), [CardSchema](#cardschema)

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
| `nodes` | `TreeNode[]` | Optional. Nested tree data — the spelling the renderer reads FIRST, and the one the component's own `inputs` and `defaultProps` use. Each node has `id`, `label`, optional `icon` and `children`. |
| `data` | `TreeNode[]` | Optional. Nested tree data, read only when `nodes` is absent (the renderer reads `nodes` first — objectui#6939). |
| `defaultExpandedIds` | `string[]` | Node IDs expanded on initial render. |
| `defaultSelectedIds` | `string[]` | Node IDs selected on initial render. |
| `expandedIds` | `string[]` | Controlled expanded state. |
| `selectedIds` | `string[]` | Controlled selection state. |
| `multiSelect` | `boolean` | Allow selecting multiple nodes. |
| `showLines` | `boolean` | Show tree connector lines. |

**Related:** [TableSchema](#tableschema)

---

## CRUD Schemas

### CRUDSchema — retired

`CRUDSchema` and the `crud` node type were **removed** in objectui#5373 under
ADR-0049 (enforce-or-remove). The type had four declaration faces — a TypeScript
interface, a zod mirror, a branch in the schema validator and a `CRUDBuilder` —
and no registered renderer, for the whole life of the key. A node that spelled it
painted the OBJUI-001 "Unknown component type" panel, so this page was teaching a
shape that could not render.

There is no drop-in replacement, because a CRUD screen is a composition rather
than one node. Build it from the shapes that do render:

| What `CRUDSchema` promised | What to author instead |
|---|---|
| The record table, with toolbar, filters, pagination and row/batch actions | [ObjectGridSchema](#objectgridschema) |
| The create/edit form | [ObjectFormSchema](#objectformschema) |
| The single-record read view | [DetailSchema](#detailschema) / [DetailViewSchema](#detailviewschema) |
| Whole-object screens that bundle the above | [ObjectViewSchema](#objectviewschema) |

The `defaultSort` and `defaultSortOrder` keys documented here were `CRUDSchema`'s
own — a flat field name plus a separate direction. They are gone with it.
[ObjectGridSchema](#objectgridschema) declares its own, differently shaped
`defaultSort` (an object with `field` and `order`); that key is unaffected.

Authoring `crud` is now refused by name: `validateSchema` from `@object-ui/core`
returns a `RETIRED_TYPE` error on `schema.type` naming the migration above, and
`objectui check` reports the type as unknown.

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
  "confirmText": "This will send the order to the warehouse.",
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
  "condition": "${data.items.length > 0}",
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
| `confirmText` | `string` | Confirmation message shown before executing — the one confirm spelling, addressed by the translation bundle. (A structured `confirm` object was retired in objectui#4314.) |
| `dialog` | `object` | Modal dialog with `title`, `content`, `size`, `actions`. |
| `chain` | `ActionSchema[]` | Actions to execute after this action completes. |
| `chainMode` | `"sequential" \| "parallel"` | How chained actions execute. |
| `condition` | `boolean \| string \| { dialect?, source }` | Execution gate — the action runs only while this predicate holds (boolean, bare CEL, `${...}` template, or the normalized envelope). Declared and false skips the action; absent executes it. It is a **gate, not a branch**: express a branch as separate actions with mutually exclusive `condition`s. (The `{ expression, then, else }` branch shape was retired in objectui#3917 — nothing read it, so it ran unconditionally.) |
| `successMessage` / `errorMessage` | `string` | Toast messages on success/failure. |
| `reload` | `boolean` | Reload data after action completes. |
| `redirect` | `string` | URL to navigate to after action. |
| `retry` | `object` | Retry config with `maxAttempts` and `delay`. |

**Related:** [DetailSchema](#detailschema), [ButtonSchema](#buttonschema)

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
        { "name": "email", "label": "Email", "type": "email" },
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

**Related:** [DetailViewSchema](#detailviewschema), [ObjectGridSchema](#objectgridschema)

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
    { "field": "name" },
    { "field": "email" },
    { "field": "company" },
    { "field": "phone" },
    { "field": "status", "label": "Status", "sortable": true }
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
| `columns` | `string[] \| ListColumn[]` | Columns to display. Either a plain array of field names (`["name", "email"]`), which auto-resolve from object metadata, or an array of `ListColumn` objects whose identity key is `field` (`{ "field": "status", "label": "Status" }`) — never `name`. **Do not mix the two forms in one array:** the array is dispatched on its first entry, so column objects sitting behind a bare string are dropped. |
| `filter` | `any[]` | Pre-applied filter conditions. |
| `sort` | `string \| SortConfig[]` | Default sort configuration. |
| `searchableFields` | `string[]` | Fields included in search. |
| `selection` | `SelectionConfig` | Row selection configuration. |
| `pagination` | `PaginationConfig` | Pagination settings. |
| `operations` | `object` | Enabled CRUD operations. |
| `rowActions` / `bulkActions` | `string[]` | Action identifiers for rows and batch selection. `bulkActions` is the spec-aligned key; `batchActions` is a legacy alias that takes precedence when both are set. |
| `editable` | `boolean` | Enable inline cell editing. |
| `grouping` | `GroupingConfig` | Row grouping configuration. **Page-scoped**: the grid groups the rows it has fetched, so group counts are page slices and a group beyond the page is absent — the grid marks the grouping partial when it can tell. |
| `frozenColumns` | `number` | Number of columns frozen on scroll. |
| `navigation` | `ViewNavigationConfig` | SPA navigation configuration. |

**Related:** [ObjectViewSchema](#objectviewschema), [TableSchema](#tableschema)

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
      "label": "Basic Info",
      "fields": ["firstName", "lastName", "email"]
    },
    {
      "label": "Details",
      "fields": ["phone", "company", "address"]
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
| `formType` | `string` | Layout type: `"simple"`, `"tabbed"`, `"wizard"`, `"split"`, `"drawer"`, `"modal"`. Aligned with `@objectstack/spec` `FormViewSchema.type`. |
| `recordId` | `string \| number` | Record ID for edit/view modes. |
| `fields` | `string[]` | Field API names to include (auto-resolved from object metadata). |
| `customFields` | `FormField[]` | Manually defined fields that override auto-generated ones. |
| `sections` | `ObjectFormSection[]` | Field sections (simple groups, tabs, or wizard steps depending on `formType`). Spec-aligned key. |
| `groups` | `array` | **Deprecated.** Legacy alias of `sections` (spec defines `groups` as an alias); normalized into `sections` when `sections` is absent. Legacy shape: `title`→`label`, `defaultCollapsed`→`collapsed`. |
| `layout` | `string` | Label layout: `"vertical"`, `"horizontal"`, `"inline"`, `"grid"`. |
| `columns` | `number` | Number of form columns. |
| `submitText` / `cancelText` | `string` | Button labels. |
| `showSubmit` / `showCancel` / `showReset` | `boolean` | Toggle action buttons. |
| `drawerSide` | `string` | Drawer position: `"top"`, `"bottom"`, `"left"`, `"right"`. |
| `modalSize` | `string` | Modal size: `"sm"`, `"default"`, `"lg"`, `"xl"`, `"full"`. |

#### Spec alignment & extension keys

`ObjectFormSchema` keys fall into three classes (#2545):

- **Spec-aligned** — same name and semantics as `@objectstack/spec` `FormViewSchema`: `title`, `description`, `layout`, `columns`, `sections`, `defaultTab`, `tabPosition`, `allowSkip`, `showStepIndicator`, `splitDirection`/`splitSize`/`splitResizable`, `drawerSide`/`drawerWidth`, `modalSize`, `subforms`, `submitBehavior` (plus `formType` ↔ spec `type`).
- **ObjectUI extensions** — serializable extras with no spec backing yet: `showSubmit`/`submitText`, `showCancel`/`cancelText`, `showReset`, `nextText`/`prevText`, `successMessage`, `navigateOnSuccess`, `resetOnSuccess`, `modalCloseButton`, `className`, `initialValues`, `fields`, `customFields`. Sanctioned and documented here; candidates for upstreaming into the spec are tracked in #2545.
- **Runtime-only** — non-serializable renderer concerns that never appear in view metadata: `mode`, `recordId`, `open`/`onOpenChange`, `readOnly`, and all callbacks (`onSuccess`, `onError`, `onCancel`, `onStepChange`, `submitHandler`).

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
| `showSearch` / `showFilters` / `showCreate` | `boolean` | Toggle toolbar features. |
| `showViewSwitcher` | `boolean` | Show view type toggle (grid, kanban, etc.). |
| `operations` | `object` | Enabled CRUD operations. |
| `navigation` | `ViewNavigationConfig` | SPA-aware navigation. |

**Related:** [ObjectGridSchema](#objectgridschema), [ObjectFormSchema](#objectformschema), [ViewSwitcherSchema](#viewswitcherschema)

---

## Complex Schemas

### DeclarativeKanbanSchema

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
| `columns` | `DeclarativeKanbanColumn[]` | **Required.** Board columns, each with `id`, `title`, `color`, and `cards`. |
| `draggable` | `boolean` | Enable drag-and-drop between columns. |
| `onCardMove` | `function` | Callback when a card is moved: `(cardId, fromColumn, toColumn, position)`. |
| `onCardClick` | `function` | Callback when a card is clicked. |

**Related:** [ObjectViewSchema](#objectviewschema), [ObjectGridSchema](#objectgridschema)

---

### DashboardComponentSchema

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
        "xAxisKey": "day",
        "data": [
          { "day": "Mon", "Sales": 120 },
          { "day": "Tue", "Sales": 180 },
          { "day": "Wed", "Sales": 150 },
          { "day": "Thu", "Sales": 210 },
          { "day": "Fri", "Sales": 190 }
        ],
        "series": [{ "name": "Sales" }]
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

A multi-view calendar computed from the node's `data` records. There is no
authorable `events` key: the renderer builds one event per record in `data`,
reading the fields the field-name properties point at (objectui#5667; an
authored `events` is dropped by design, objectui#4433).

```json
{
  "type": "calendar-view",
  "view": "month",
  "currentDate": "2024-03-15T12:00:00.000Z",
  "data": [
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
  ],
  "allowCreate": true,
  "className": "h-[600px] border rounded-lg"
}
```

| Property | Type | Description |
|----------|------|-------------|
| `data` | `any` | Records rendered as events — an array, or a binding expression that resolves to one. |
| `titleField` | `string` | Record field for the event title. Default `"title"`. |
| `startDateField` | `string` | Record field for the event start date/time. Default `"start"`. |
| `endDateField` | `string` | Record field for the event end date/time. Default `"end"`. |
| `allDayField` | `string` | Record field for the all-day flag. Default `"allDay"`. |
| `colorField` | `string` | Record field for the event color. Default `"color"`. |
| `view` | `CalendarViewMode` | View mode: `"month"`, `"week"`, `"day"` — the full union. `"agenda"` was retired in objectui#5740 and now fails validation. Default `"month"`. |
| `currentDate` | `string \| Date` | Initial calendar date — an ISO date string when authored as JSON. |
| `allowCreate` | `boolean` | Show the "New event" affordance; clicking it dispatches a `create` action. Default `false`. |
| `onEventClick` | `function` | Host-only: forwarded when a React host supplies a function; authored JSON cannot produce one. |
| `onViewChange` | `function` | Host-only: same rule as `onEventClick`. |

Nine formerly declared keys — `events` (was required, and dropped by the
renderer), `defaultView`, `defaultDate`, `date`, `views`, `editable`,
`onEventCreate`, `onEventUpdate`, `onDateChange` — were retired in
objectui#5667: nothing read them on the authored-node path.

**Related:** [ObjectViewSchema](#objectviewschema), [DashboardComponentSchema](#dashboardcomponentschema)

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
        { "name": "email", "label": "Email", "type": "email" },
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

**Related:** [ObjectViewSchema](#objectviewschema), [DeclarativeKanbanSchema](#declarativekanbanschema), [CalendarViewSchema](#calendarviewschema)

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
import type { PageNodeSchema, DivSchema, CardSchema, GridSchema, TabsSchema } from '@object-ui/types';

// Forms
import type { FormSchema, InputSchema, SelectSchema, ButtonSchema } from '@object-ui/types';

// Data Display
import type { TableSchema, ChartSchema, TreeViewSchema } from '@object-ui/types';

// CRUD
import type { ActionSchema, DetailSchema } from '@object-ui/types';

// ObjectQL
import type { ObjectGridSchema, ObjectFormSchema, ObjectViewSchema } from '@object-ui/types';

// Complex
import type { DeclarativeKanbanSchema, DashboardComponentSchema, CalendarViewSchema } from '@object-ui/types';

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
