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

- **[Input](/components/form/input)** - Text input fields with validation
- **[Select](/components/form/select)** - Dropdown selection menus
- **[Checkbox](/components/form/checkbox)** - Toggle selection boxes
- **[Switch](/components/form/switch)** - Binary toggle switches
- **[Textarea](/components/form/textarea)** - Multi-line text input
- **[Slider](/components/form/slider)** - Range selection sliders
- **[Button](/components/form/button)** - Action triggers with variants

### Layout Components

Structure your UI with flexible layout containers:

- **[Stack](/components/layout/stack)** - Vertical/horizontal stacking
- **[Grid](/components/layout/grid)** - Responsive grid layouts
- **[Card](/components/layout/card)** - Content containers
- **[Tabs](/components/layout/tabs)** - Tabbed content sections
- **[Separator](/components/layout/separator)** - Visual dividers

### Overlay Components

Create modal and overlay experiences:

- **[Dialog](/components/overlay/dialog)** - Modal dialogs
- **[Drawer](/components/overlay/drawer)** - Sliding side panels
- **[Tooltip](/components/overlay/tooltip)** - Contextual hints
- **[Popover](/components/overlay/popover)** - Floating content panels

### Data Display Components

Present information beautifully:

- **[Table](/components/data-display/table)** - Tabular data display
- **[List](/components/data-display/list)** - Ordered/unordered lists
- **[Avatar](/components/data-display/avatar)** - User profile images
- **[Badge](/components/data-display/badge)** - Status indicators
- **[Alert](/components/data-display/alert)** - Notification messages

### Feedback Components

Provide user feedback and status:

- **[Progress](/components/feedback/progress)** - Progress indicators
- **[Loading](/components/feedback/loading)** - Loading spinners
- **[Skeleton](/components/feedback/skeleton)** - Loading placeholders
- **[Toast](/components/feedback/toast)** - Toast notifications

### Disclosure Components

Progressive content disclosure:

- **[Accordion](/components/disclosure/accordion)** - Collapsible sections
- **[Collapse](/components/disclosure/collapse)** - Show/hide content

### Complex Components

Advanced composite components:

- **[Command](/components/complex/command)** - Command palette
- **[DatePicker](/components/complex/date-picker)** - Date selection

## 🔌 Plugin Demos

Extend ObjectUI with powerful plugins:

### [Plugin Markdown](/plugins/plugin-markdown)

Render GitHub Flavored Markdown with syntax highlighting:

- ✅ Basic formatting (bold, italic, links)
- ✅ Task lists with checkboxes
- ✅ Tables and code blocks
- ✅ XSS protection built-in

**Interactive Examples**: 3 live demos

### [Plugin Kanban](/plugins/plugin-kanban)

Drag-and-drop Kanban boards for project management:

- ✅ Drag cards between columns
- ✅ WIP limits per column
- ✅ Card badges for status/priority
- ✅ Keyboard navigation support

**Interactive Examples**: 2 live demos

### [Plugin Charts](/plugins/plugin-charts)

Beautiful data visualizations powered by Recharts:

- ✅ Bar, line, area, pie charts
- ✅ Responsive design
- ✅ Customizable colors
- ✅ Multiple data series

**Interactive Examples**: 3 live demos

### [Plugin Editor](/plugins/plugin-editor)

Monaco Editor integration for code editing:

- ✅ 100+ programming languages
- ✅ IntelliSense & autocomplete
- ✅ Syntax highlighting
- ✅ Find and replace

**Interactive Examples**: 3 live demos

### [Plugin Object](/plugins/plugin-object)

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

- **[Component Registry](/concepts/component-registry)** - All available component types
- **[Schema Rendering](/concepts/schema-rendering)** - How the rendering engine works
- **[Plugin System](/concepts/plugins)** - Creating custom plugins

## 🎨 Design Resources

- **[Tailwind Integration](/guide/components#styling)** - Using Tailwind classes
- **[Theming](/guide/components#theming)** - Light/dark mode support
- **[Accessibility](/guide/components#accessibility)** - WCAG 2.1 compliance

## 🔗 Next Steps

- **[Quick Start Guide](/guide/quick-start)** - Get up and running in 5 minutes
- **[Try It Online](/guide/try-it-online)** - Online playground
- **[GitHub Repository](https://github.com/objectstack-ai/objectui)** - Star the project

---

**Have questions?** Check out our [Getting Started Guide](/guide/quick-start) or visit the [GitHub Discussions](https://github.com/objectstack-ai/objectui/discussions).
