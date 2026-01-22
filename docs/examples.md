---
title: "Examples"
description: "Learn from real-world ObjectUI examples"
---

# Examples

Learn ObjectUI by exploring real-world examples and demos.

## 🎨 Interactive Showcase

The **Showcase** is the best place to start. It demonstrates all 60+ components in an interactive environment.

```bash
# Clone and run
git clone https://github.com/objectstack-ai/objectui.git
cd objectui
pnpm install && pnpm build
pnpm showcase
```

**What's included:**
- ✨ 60+ component examples across 8 categories
- 📱 Responsive layouts (mobile, tablet, desktop)
- 🎨 Light/Dark theme support
- 🔍 Live schema inspection
- 📋 Copy-paste ready JSON examples

[**📖 Showcase Guide →**](/guide/showcase)

---

## 📂 Example Applications

### Dashboard Example

A simple single-file application demonstrating layouts and components.

**Features:**
- Grid layouts
- Stats cards
- Charts and metrics
- Responsive design

```bash
# Run from repository
pnpm dev

# Or with CLI
objectui dev examples/dashboard/index.json
```

[**View Code →**](https://github.com/objectstack-ai/objectui/tree/main/examples/dashboard)

---

### CRM Application

A complete multi-page enterprise application with routing and CRUD operations.

**Features:**
- File-system routing
- Dynamic routes (`/users/[id]`)
- Master-detail views
- Form handling
- API integration

```bash
# Run from repository
pnpm dev:crm

# Or with CLI
objectui dev examples/crm-app/app.json
```

[**View Code →**](https://github.com/objectstack-ai/objectui/tree/main/examples/crm-app)

---

### Object View Demo

Demonstrates the object view component with different layouts and patterns.

**Features:**
- Object display patterns
- Field grouping
- Layout variations
- Responsive views

```bash
objectui dev examples/object-view-demo
```

[**View Code →**](https://github.com/objectstack-ai/objectui/tree/main/examples/object-view-demo)

---

## 🧪 Component Examples

Browse component-specific examples in the documentation:

### Basic Components
- [Text](/components/basic/text)
- [Icon](/components/basic/icon)
- [Image](/components/basic/image)
- [HTML](/components/basic/html)

### Form Components
- [Button](/components/form/button)
- [Input](/components/form/input)
- [Select](/components/form/select)
- [Checkbox](/components/form/checkbox)
- [Switch](/components/form/switch)
- [Slider](/components/form/slider)
- [Textarea](/components/form/textarea)

### Layout Components
- [Container](/components/layout/container)
- [Grid](/components/layout/grid)
- [Flex](/components/layout/flex)
- [Stack](/components/layout/stack)
- [Card](/components/layout/card)
- [Tabs](/components/layout/tabs)

### Data Display
- [Alert](/components/data-display/alert)
- [Badge](/components/data-display/badge)
- [Avatar](/components/data-display/avatar)
- [List](/components/data-display/list)

### Complex Components
- [Table](/components/complex/table)

[**View All Components →**](/components)

---

## 💻 Code Snippets

### Hello World

The simplest ObjectUI application:

```json
{
  "type": "page",
  "title": "Hello World",
  "body": {
    "type": "text",
    "value": "Hello, ObjectUI!"
  }
}
```

### Contact Form

A complete contact form with validation:

```json
{
  "type": "page",
  "title": "Contact Us",
  "body": {
    "type": "form",
    "title": "Get in Touch",
    "api": "/api/contact",
    "fields": [
      {
        "type": "input",
        "name": "name",
        "label": "Your Name",
        "required": true,
        "placeholder": "John Doe"
      },
      {
        "type": "input",
        "name": "email",
        "label": "Email Address",
        "inputType": "email",
        "required": true,
        "placeholder": "john@example.com"
      },
      {
        "type": "textarea",
        "name": "message",
        "label": "Message",
        "required": true,
        "rows": 5
      }
    ],
    "actions": [
      {
        "type": "button",
        "label": "Send Message",
        "actionType": "submit",
        "variant": "default"
      }
    ]
  }
}
```

### Dashboard Layout

A responsive dashboard with metrics and charts:

```json
{
  "type": "page",
  "title": "Dashboard",
  "body": {
    "type": "container",
    "body": [
      {
        "type": "grid",
        "columns": 3,
        "gap": 4,
        "className": "mb-6",
        "items": [
          {
            "type": "card",
            "title": "Total Users",
            "body": {
              "type": "text",
              "className": "text-4xl font-bold",
              "value": "1,234"
            }
          },
          {
            "type": "card",
            "title": "Revenue",
            "body": {
              "type": "text",
              "className": "text-4xl font-bold",
              "value": "$56,789"
            }
          },
          {
            "type": "card",
            "title": "Orders",
            "body": {
              "type": "text",
              "className": "text-4xl font-bold",
              "value": "432"
            }
          }
        ]
      }
    ]
  }
}
```

### Data Table

A data table with sorting and actions:

```json
{
  "type": "table",
  "dataSource": {
    "api": "/api/users"
  },
  "columns": [
    {
      "key": "name",
      "title": "Name",
      "sortable": true
    },
    {
      "key": "email",
      "title": "Email"
    },
    {
      "key": "role",
      "title": "Role",
      "render": "badge"
    },
    {
      "key": "status",
      "title": "Status",
      "render": {
        "type": "badge",
        "variant": "${row.status === 'active' ? 'success' : 'secondary'}"
      }
    }
  ],
  "actions": [
    {
      "type": "button",
      "label": "Edit",
      "variant": "outline",
      "size": "sm",
      "onClick": {
        "action": "navigate",
        "target": "/users/${row.id}/edit"
      }
    }
  ]
}
```

---

## 🎓 Learning Resources

### Tutorials

1. **[Quick Start](/guide/quick-start)** - Build your first app in 5 minutes
2. **[Installation](/guide/installation)** - Setup and configuration
3. **[Showcase Guide](/guide/showcase)** - Explore all components

### Guides

- **[Schema Rendering](/concepts/schema-rendering)** - How the rendering system works
- **[Expressions](/concepts/expressions)** - Dynamic values and conditions
- **[Data Sources](/concepts/data-source)** - Connecting to APIs
- **[Component Registry](/concepts/component-registry)** - Registering custom components

### Reference

- **[Protocol Overview](/reference/protocol/overview)** - Complete protocol specification
- **[API Reference](/reference/api/core)** - Core API documentation
- **[Component Library](/components)** - All available components

---

## 🚀 Running Examples

### Using the CLI

```bash
# Install CLI globally
npm install -g @object-ui/cli

# Run any example
objectui dev path/to/app.json
```

### From Repository

```bash
# Clone repository
git clone https://github.com/objectstack-ai/objectui.git
cd objectui

# Install dependencies
pnpm install

# Build packages
pnpm build

# Run examples
pnpm dev              # Dashboard
pnpm dev:crm          # CRM App
pnpm showcase         # Showcase
```

---

## 📦 Example Projects

All examples are available in the [examples folder](https://github.com/objectstack-ai/objectui/tree/main/examples) of the repository:

- **[Dashboard](https://github.com/objectstack-ai/objectui/tree/main/examples/dashboard)** - Single-file app
- **[CRM App](https://github.com/objectstack-ai/objectui/tree/main/examples/crm-app)** - Multi-page app
- **[Showcase](https://github.com/objectstack-ai/objectui/tree/main/examples/showcase)** - Component gallery
- **[Object View Demo](https://github.com/objectstack-ai/objectui/tree/main/examples/object-view-demo)** - Object layouts
- **[Designer Modes](https://github.com/objectstack-ai/objectui/tree/main/examples/designer-modes)** - Designer examples

---

## 🎯 What Can You Build?

ObjectUI is perfect for:

- ✅ **Admin Panels** - Complete CRUD interfaces
- ✅ **Dashboards** - Data visualization and analytics
- ✅ **Forms** - Complex multi-step forms
- ✅ **CMS** - Content management systems
- ✅ **Internal Tools** - Business applications
- ✅ **Prototypes** - Rapid UI prototyping

---

## 💡 Contributing Examples

Have a great example to share? We'd love to include it!

1. Fork the repository
2. Create your example in the `examples/` folder
3. Add a README explaining your example
4. Submit a pull request

[**Contributing Guide →**](/community/contributing)

---

**Questions about the examples?**

- 💬 [Ask in Discussions](https://github.com/objectstack-ai/objectui/discussions)
- 📧 [Email us](mailto:hello@objectui.org)
