---
title: "Layout System"
description: "Understanding ObjectUI's layout components for building application shells and page structures"
---

# Layout System

ObjectUI provides a comprehensive layout system through the `@object-ui/layout` package. This guide explains how to use layout components to build professional application structures.

## Overview

The layout system provides:

- **AppShell** - Full application container with header, sidebar, and content areas
- **Page** - Individual page wrapper with header and body
- **PageHeader** - Consistent page headers with title, breadcrumbs, and actions
- **SidebarNav** - Navigation sidebar with menu items

## Installation

The layout package is included in the core ObjectUI installation:

```bash
npm install @object-ui/react
```

Layout components are automatically registered when you import ObjectUI.

## AppShell Component

The `AppShell` provides a complete application structure with header, sidebar, and main content area.

### Basic Usage

```json
{
  "type": "app-shell",
  "header": {
    "type": "header-bar",
    "title": "My Application"
  },
  "sidebar": {
    "type": "sidebar-nav",
    "items": [
      { "label": "Dashboard", "href": "/dashboard", "icon": "layout-dashboard" },
      { "label": "Users", "href": "/users", "icon": "users" },
      { "label": "Settings", "href": "/settings", "icon": "settings" }
    ]
  },
  "body": {
    "type": "page",
    "title": "Dashboard",
    "body": {
      "type": "text",
      "value": "Welcome to the dashboard!"
    }
  }
}
```

### Schema API

```typescript
{
  type: 'app-shell',
  
  // Header configuration
  header?: ComponentSchema,
  
  // Sidebar configuration  
  sidebar?: ComponentSchema,
  sidebarCollapsible?: boolean,  // Allow sidebar collapse
  sidebarDefaultOpen?: boolean,  // Initial sidebar state
  
  // Main content
  body: ComponentSchema,
  
  // Styling
  className?: string,
  headerClassName?: string,
  sidebarClassName?: string,
  contentClassName?: string
}
```

### Features

- Responsive layout that adapts to mobile/tablet/desktop
- Collapsible sidebar with state management
- Sticky header
- Scroll management for content area
- Consistent spacing and structure

## Page Component

The `Page` component provides a consistent wrapper for individual pages with optional headers.

### Basic Usage

```json
{
  "type": "page",
  "title": "User Management",
  "description": "Manage users and permissions",
  "body": {
    "type": "container",
    "children": [
      { "type": "text", "value": "User list goes here" }
    ]
  }
}
```

### With Action Buttons

```json
{
  "type": "page",
  "title": "Products",
  "actions": [
    {
      "type": "button",
      "text": "Add Product",
      "variant": "default",
      "icon": "plus"
    },
    {
      "type": "button", 
      "text": "Export",
      "variant": "outline",
      "icon": "download"
    }
  ],
  "body": {
    "type": "object-grid",
    "object": "products"
  }
}
```

### Schema API

```typescript
{
  type: 'page',
  
  // Header
  title?: string,               // Page title
  description?: string,         // Page description/subtitle
  icon?: string,               // Optional icon
  breadcrumbs?: Array<{        // Breadcrumb navigation
    label: string,
    href?: string
  }>,
  actions?: ComponentSchema[], // Action buttons
  
  // Content
  body: ComponentSchema,       // Main page content
  
  // Layout options
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full',
  padding?: boolean,           // Add padding (default: true)
  
  // Styling
  className?: string,
  headerClassName?: string,
  bodyClassName?: string
}
```

### Max Width Options

Control page content width:

```json
{
  "type": "page",
  "title": "Settings",
  "maxWidth": "lg",  // Centered content with max width
  "body": {
    "type": "form",
    "fields": [...]
  }
}
```

Available values:
- `sm` - 640px
- `md` - 768px
- `lg` - 1024px
- `xl` - 1280px
- `2xl` - 1536px
- `full` - No maximum width (default)

## PageHeader Component

The `PageHeader` provides consistent page headers with title, breadcrumbs, and actions.

### Usage

```json
{
  "type": "page-header",
  "title": "Customer Details",
  "description": "View and edit customer information",
  "breadcrumbs": [
    { "label": "Home", "href": "/" },
    { "label": "Customers", "href": "/customers" },
    { "label": "John Doe" }
  ],
  "actions": [
    {
      "type": "button",
      "text": "Edit",
      "variant": "default",
      "icon": "pencil"
    },
    {
      "type": "button",
      "text": "Delete",
      "variant": "destructive",
      "icon": "trash"
    }
  ]
}
```

### Schema API

```typescript
{
  type: 'page-header',
  
  title: string,
  description?: string,
  icon?: string,
  
  breadcrumbs?: Array<{
    label: string,
    href?: string,
    icon?: string
  }>,
  
  actions?: ComponentSchema[],
  
  className?: string
}
```

## SidebarNav Component

The `SidebarNav` provides a collapsible navigation sidebar with menu items.

### Basic Usage

```json
{
  "type": "sidebar-nav",
  "items": [
    {
      "label": "Dashboard",
      "href": "/dashboard",
      "icon": "layout-dashboard"
    },
    {
      "label": "Users",
      "href": "/users", 
      "icon": "users",
      "badge": "12"
    },
    {
      "label": "Reports",
      "icon": "bar-chart",
      "items": [
        { "label": "Sales", "href": "/reports/sales" },
        { "label": "Analytics", "href": "/reports/analytics" }
      ]
    }
  ]
}
```

### Schema API

```typescript
{
  type: 'sidebar-nav',
  
  items: Array<{
    label: string,
    href?: string,
    icon?: string,
    badge?: string | number,
    items?: Array<...>,  // Nested menu items
    active?: boolean,
    disabled?: boolean
  }>,
  
  collapsible?: boolean,
  defaultOpen?: boolean,
  
  className?: string
}
```

### Features

- Nested menu items (2 levels)
- Active state highlighting
- Icon support (Lucide icons)
- Badge/counter support
- Collapse/expand animation

## Common Layout Patterns

### Full Application Layout

```json
{
  "type": "app-shell",
  "header": {
    "type": "header-bar",
    "title": "My App",
    "logo": "/logo.png",
    "actions": [
      { "type": "button", "text": "Profile", "variant": "ghost" }
    ]
  },
  "sidebar": {
    "type": "sidebar-nav",
    "items": [
      { "label": "Home", "href": "/", "icon": "home" },
      { "label": "Products", "href": "/products", "icon": "package" },
      { "label": "Orders", "href": "/orders", "icon": "shopping-cart" }
    ]
  },
  "sidebarCollapsible": true,
  "sidebarDefaultOpen": true,
  "body": {
    "type": "page",
    "title": "Dashboard",
    "body": {
      "type": "object-grid",
      "object": "orders"
    }
  }
}
```

### Landing Page (No Sidebar)

```json
{
  "type": "app-shell",
  "header": {
    "type": "header-bar",
    "title": "Welcome"
  },
  "body": {
    "type": "container",
    "className": "mx-auto py-12",
    "children": [
      { "type": "text", "value": "Landing page content" }
    ]
  }
}
```

### Settings Page with Tabs

```json
{
  "type": "page",
  "title": "Settings",
  "maxWidth": "2xl",
  "body": {
    "type": "tabs",
    "tabs": [
      {
        "label": "General",
        "value": "general",
        "content": { "type": "form", "fields": [...] }
      },
      {
        "label": "Security", 
        "value": "security",
        "content": { "type": "form", "fields": [...] }
      },
      {
        "label": "Notifications",
        "value": "notifications", 
        "content": { "type": "form", "fields": [...] }
      }
    ]
  }
}
```

### Detail Page with Actions

```json
{
  "type": "page",
  "title": "${record.name}",
  "breadcrumbs": [
    { "label": "Home", "href": "/" },
    { "label": "Customers", "href": "/customers" },
    { "label": "${record.name}" }
  ],
  "actions": [
    {
      "type": "button",
      "text": "Edit",
      "variant": "default",
      "icon": "pencil",
      "onClick": "editRecord"
    },
    {
      "type": "button",
      "text": "Delete",
      "variant": "destructive",
      "icon": "trash",
      "onClick": "deleteRecord"
    }
  ],
  "body": {
    "type": "card",
    "children": [
      { "type": "text", "value": "Record details..." }
    ]
  }
}
```

## Responsive Behavior

Layout components automatically adapt to different screen sizes:

### Desktop (≥1024px)
- Full sidebar visible
- Header spans full width
- Content area uses remaining space

### Tablet (768px - 1023px)  
- Collapsible sidebar (overlay mode)
- Full header
- Content uses most of screen

### Mobile (<768px)
- Hidden sidebar (toggle button in header)
- Compact header
- Full-width content

## Styling and Customization

### Custom Classes

Add Tailwind classes to layout components:

```json
{
  "type": "app-shell",
  "className": "custom-app",
  "headerClassName": "bg-primary text-primary-foreground",
  "sidebarClassName": "bg-muted",
  "contentClassName": "bg-background",
  "body": {...}
}
```

### Page Padding

Control page content padding:

```json
{
  "type": "page",
  "padding": false,  // Remove default padding
  "body": {
    "type": "container",
    "className": "p-8",  // Custom padding
    "children": [...]
  }
}
```

## Best Practices

### 1. Consistent Structure

Use the same layout structure across your app:

```json
// Every page should follow this pattern
{
  "type": "app-shell",
  "header": { ... },
  "sidebar": { ... },
  "body": {
    "type": "page",
    "title": "...",
    "body": { ... }
  }
}
```

### 2. Breadcrumbs for Deep Navigation

Add breadcrumbs to help users navigate:

```json
{
  "breadcrumbs": [
    { "label": "Home", "href": "/" },
    { "label": "Products", "href": "/products" },
    { "label": "Electronics", "href": "/products/electronics" },
    { "label": "Laptops" }
  ]
}
```

### 3. Action Buttons in Headers

Place primary actions in page headers:

```json
{
  "type": "page",
  "title": "Orders",
  "actions": [
    { "type": "button", "text": "New Order", "variant": "default" }
  ]
}
```

### 4. Max Width for Forms

Use constrained width for forms and reading content:

```json
{
  "type": "page",
  "maxWidth": "lg",  // Better for forms
  "body": {
    "type": "form",
    "fields": [...]
  }
}
```

### 5. Sidebar Organization

Group related items in the sidebar:

```json
{
  "items": [
    { "label": "Dashboard", "icon": "home", "href": "/" },
    { "label": "divider" },  // Visual separator
    { "label": "Sales", "icon": "dollar-sign", "items": [
      { "label": "Orders", "href": "/orders" },
      { "label": "Invoices", "href": "/invoices" }
    ]},
    { "label": "divider" },
    { "label": "Settings", "icon": "settings", "href": "/settings" }
  ]
}
```

## Related Documentation

- [Components Overview](/docs/components) - All available components
- [Schema Rendering](/docs/guide/schema-rendering) - How schemas work
- [Architecture Overview](/docs/guide/architecture) - System architecture
