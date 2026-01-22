---
title: "Interactive Component Demos"
description: "Explore all ObjectUI components and plugins with live interactive examples"
---

# Interactive Component Demos

Explore ObjectUI's comprehensive component library with **live interactive demos**. Each demo features:

- 👁️ **Live Preview** - See components in action
- 💻 **Source Code** - View and copy JSON schemas  
- 📋 **Copy Button** - One-click code copying
- 🎨 **Multiple Examples** - Various use cases

## 🧩 Components by Category

### Form Components

Build powerful forms with our comprehensive form controls:

- **[Input](/docs/components/form/input)** - Text input fields with validation
- **[Select](/docs/components/form/select)** - Dropdown selection menus
- **[Checkbox](/docs/components/form/checkbox)** - Toggle selection boxes
- **[Switch](/docs/components/form/switch)** - Binary toggle switches
- **[Textarea](/docs/components/form/textarea)** - Multi-line text input
- **[Slider](/docs/components/form/slider)** - Range selection sliders
- **[Button](/docs/components/form/button)** - Action triggers with variants

### Layout Components

Structure your UI with flexible layout containers:

- **[Stack](/docs/components/layout/stack)** - Vertical/horizontal stacking
- **[Grid](/docs/components/layout/grid)** - Responsive grid layouts
- **[Card](/docs/components/layout/card)** - Content containers
- **[Tabs](/docs/components/layout/tabs)** - Tabbed content sections
- **[Separator](/docs/components/layout/separator)** - Visual dividers

### Overlay Components

Create modal and overlay experiences:

- **[Dialog](/docs/components/overlay/dialog)** - Modal dialogs
- **[Drawer](/docs/components/overlay/drawer)** - Sliding side panels
- **[Tooltip](/docs/components/overlay/tooltip)** - Contextual hints
- **[Popover](/docs/components/overlay/popover)** - Floating content panels

### Data Display Components

Present information beautifully:

- **[Table](/docs/components/data-display/table)** - Tabular data display
- **[List](/docs/components/data-display/list)** - Ordered/unordered lists
- **[Avatar](/docs/components/data-display/avatar)** - User profile images
- **[Badge](/docs/components/data-display/badge)** - Status indicators
- **[Alert](/docs/components/data-display/alert)** - Notification messages

### Feedback Components

Provide user feedback and status:

- **[Progress](/docs/components/feedback/progress)** - Progress indicators
- **[Loading](/docs/components/feedback/loading)** - Loading spinners
- **[Skeleton](/docs/components/feedback/skeleton)** - Loading placeholders
- **[Toast](/docs/components/feedback/toast)** - Toast notifications

### Disclosure Components

Progressive content disclosure:

- **[Accordion](/docs/components/disclosure/accordion)** - Collapsible sections
- **[Collapse](/docs/components/disclosure/collapse)** - Show/hide content

### Complex Components

Advanced composite components:

- **[Command](/docs/components/complex/command)** - Command palette
- **[DatePicker](/docs/components/complex/date-picker)** - Date selection

## 🔌 Plugin Demos

Extend ObjectUI with powerful plugins:

### [Plugin Markdown](/docs/plugins/plugin-markdown)

Render GitHub Flavored Markdown with syntax highlighting:

- ✅ Basic formatting (bold, italic, links)
- ✅ Task lists with checkboxes
- ✅ Tables and code blocks
- ✅ XSS protection built-in

**Interactive Examples**: 3 live demos

### [Plugin Kanban](/docs/plugins/plugin-kanban)

Drag-and-drop Kanban boards for project management:

- ✅ Drag cards between columns
- ✅ WIP limits per column
- ✅ Card badges for status/priority
- ✅ Keyboard navigation support

**Interactive Examples**: 2 live demos

### [Plugin Charts](/docs/plugins/plugin-charts)

Beautiful data visualizations powered by Recharts:

- ✅ Bar, line, area, pie charts
- ✅ Responsive design
- ✅ Customizable colors
- ✅ Multiple data series

**Interactive Examples**: 3 live demos

### [Plugin Editor](/docs/plugins/plugin-editor)

Monaco Editor integration for code editing:

- ✅ 100+ programming languages
- ✅ IntelliSense & autocomplete
- ✅ Syntax highlighting
- ✅ Find and replace

**Interactive Examples**: 3 live demos

### [Plugin Object](/docs/plugins/plugin-object)

ObjectQL integration for CRUD operations:

- ✅ Auto-generated tables
- ✅ Smart forms with validation
- ✅ Complete CRUD views
- ✅ Schema-driven UI

**Interactive Examples**: 3 live demos

## 🚀 Quick Start

### 1. Browse Components

Click any component link above to see:
- Live interactive preview
- JSON schema code
- Multiple usage examples

### 2. Copy Code

Each demo has a **Code tab** with:
- Formatted JSON schema
- Copy button for instant use
- Syntax highlighting

### 3. Use in Your Project

```tsx
import { SchemaRenderer } from '@object-ui/react';

const schema = {
  type: "input",
  label: "Email",
  placeholder: "user@example.com"
};

<SchemaRenderer schema={schema} />
```

## 💡 How Interactive Demos Work

Each component page uses our new **InteractiveDemo** component:

```tsx
<InteractiveDemo
  schema={{
    type: "button",
    label: "Click me",
    variant: "default"
  }}
  title="Primary Button"
  description="Main action button"
/>
```

### Features

- **Tab Switching** - Toggle between Preview and Code views
- **Live Rendering** - See components rendered in real-time
- **Copy Button** - One-click code copying
- **Multi-Example** - Show related variations together
- **Responsive** - Works on all screen sizes

## 📚 Component Reference

For complete API documentation including all props, events, and advanced usage:

- **[Component Registry](/docs/concepts/component-registry)** - All available component types
- **[Schema Rendering](/docs/concepts/schema-rendering)** - How the rendering engine works
- **[Plugin System](/docs/concepts/plugins)** - Creating custom plugins

## 🎨 Design Resources

- **[Tailwind Integration](/docs/guide/components#styling)** - Using Tailwind classes
- **[Theming](/docs/guide/components#theming)** - Light/dark mode support
- **[Accessibility](/docs/guide/components#accessibility)** - WCAG 2.1 compliance

## 🔗 Next Steps

- **[Quick Start Guide](/docs/guide/quick-start)** - Get up and running in 5 minutes
- **[Try It Online](/docs/guide/try-it-online)** - Online playground
- **[GitHub Repository](https://github.com/objectstack-ai/objectui)** - Star the project

---

**Have questions?** Check out our [Getting Started Guide](/docs/guide/quick-start) or visit the [GitHub Discussions](https://github.com/objectstack-ai/objectui/discussions).
