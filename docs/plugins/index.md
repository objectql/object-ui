---
title: "Plugin Gallery"
description: "Explore all ObjectUI plugins for extended functionality"
---

# Plugin Gallery

ObjectUI plugins are lazy-loaded component packages that extend the framework with additional functionality. They load on-demand, keeping your main application bundle small while providing rich features.

## Quick Navigation

Browse available plugins:

### [Charts Plugin](/docs/plugins/plugin-charts)
Data visualization with Recharts - Bar, Line, Area, and Pie charts

### [Editor Plugin](/docs/plugins/plugin-editor)
Code editor powered by Monaco Editor (VS Code's editor)

### [Kanban Plugin](/docs/plugins/plugin-kanban)
Kanban board with drag-and-drop functionality

### [Markdown Plugin](/docs/plugins/plugin-markdown)
Markdown renderer with GitHub Flavored Markdown support

### [Object Plugin](/docs/plugins/plugin-object)
Advanced object data management and visualization

## Official Plugins

### Charts Plugin

**[@object-ui/plugin-charts](/docs/plugins/plugin-charts)** - Data visualization components powered by Recharts.

- Bar, line, area, and pie charts
- Responsive design
- Customizable colors and themes
- Lazy-loaded (~540 KB)

```bash
npm install @object-ui/plugin-charts
```

[Read full documentation →](/docs/plugins/plugin-charts)

---

### Editor Plugin

**[@object-ui/plugin-editor](/docs/plugins/plugin-editor)** - Code editor component powered by Monaco Editor (VS Code's editor).

- Syntax highlighting for 100+ languages
- IntelliSense and code completion
- Multiple themes (VS Dark, Light, etc.)
- Lazy-loaded (~20 KB)

```bash
npm install @object-ui/plugin-editor
```

[Read full documentation →](/docs/plugins/plugin-editor)

---

### Kanban Plugin

**[@object-ui/plugin-kanban](/docs/plugins/plugin-kanban)** - Kanban board component with drag-and-drop powered by @dnd-kit.

- Drag and drop cards between columns
- Column limits (WIP limits)
- Card badges for status/priority
- Lazy-loaded (~100-150 KB)

```bash
npm install @object-ui/plugin-kanban
```

[Read full documentation →](/docs/plugins/plugin-kanban)

---

### Markdown Plugin

**[@object-ui/plugin-markdown](/docs/plugins/plugin-markdown)** - Markdown renderer with GitHub Flavored Markdown support.

- GitHub Flavored Markdown
- XSS protection
- Code syntax highlighting
- Lazy-loaded (~100-200 KB)

```bash
npm install @object-ui/plugin-markdown
```

[Read full documentation →](/docs/plugins/plugin-markdown)

---

### Object Plugin

**[@object-ui/plugin-object](/docs/plugins/plugin-object)** - Advanced object data management and visualization.

- Object data rendering
- Complex data structures support
- Flexible visualization options

```bash
npm install @object-ui/plugin-object
```

[Read full documentation →](/docs/plugins/plugin-object)

---

## How Plugins Work

### Lazy Loading Architecture

Plugins use React's `lazy()` and `Suspense` to load heavy dependencies on-demand:

```typescript
// The plugin structure
import React, { Suspense } from 'react'
import { Skeleton } from '@object-ui/components'

// Lazy load the heavy implementation
const LazyEditor = React.lazy(() => import('./MonacoImpl'))

export const CodeEditorRenderer = (props) => (
  <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
    <LazyEditor {...props} />
  </Suspense>
)
```

**Benefits:**
- **Smaller initial bundle**: Main app loads faster
- **Progressive loading**: Components load when needed
- **Better UX**: Loading skeletons while chunks download
- **Automatic code splitting**: Vite handles chunking

### Bundle Impact

| Plugin | Initial Load | Lazy Load |
|--------|-------------|-----------|
| plugin-editor | ~0.2 KB | ~20 KB |
| plugin-charts | ~0.2 KB | ~540 KB |
| plugin-kanban | ~0.2 KB | ~100-150 KB |
| plugin-markdown | ~0.2 KB | ~100-200 KB |

Without lazy loading, all this code would be in your main bundle!

### Auto-Registration

Plugins automatically register their components when imported:

```typescript
// In the plugin's index.tsx
import { ComponentRegistry } from '@object-ui/core'

ComponentRegistry.register('code-editor', CodeEditorRenderer)
```

You just need to import the plugin once:

```typescript
// In your App.tsx or main.tsx
import '@object-ui/plugin-editor'
import '@object-ui/plugin-charts'
import '@object-ui/plugin-kanban'
import '@object-ui/plugin-markdown'
```

Now all plugin components are available in your schemas!

## Usage Pattern

All ObjectUI plugins follow the same usage pattern:

```json
{
  "type": "plugin-component-name",
  "className": "tailwind-classes",
  "props": {
    // Plugin-specific properties
  }
}
```

### Example: Code Editor

```json
{
  "type": "code-editor",
  "language": "typescript",
  "value": "const greeting = 'Hello World';",
  "className": "h-96",
  "theme": "vs-dark"
}
```

### Example: Bar Chart

```json
{
  "type": "bar-chart",
  "data": [
    { "name": "Jan", "value": 400 },
    { "name": "Feb", "value": 300 },
    { "name": "Mar", "value": 600 }
  ],
  "dataKey": "value",
  "xAxisKey": "name",
  "height": 300,
  "color": "#8884d8"
}
```

## Features

All ObjectUI plugins share these characteristics:

- ✅ **Lazy Loaded** - Load on-demand, not upfront
- ✅ **Auto-Register** - Import once, use everywhere
- ✅ **Type-Safe** - Full TypeScript support
- ✅ **Schema-Driven** - Define with JSON, not code
- ✅ **Tailwind CSS** - Use utility classes directly
- ✅ **Loading States** - Built-in skeletons while loading
- ✅ **Small Footprint** - Minimal initial bundle impact

## Next Steps

- **[Plugin Concepts](/docs/concepts/plugins)** - Learn how plugins work in detail
- **[Quick Start Guide](/docs/guide/quick-start)** - Build your first ObjectUI app
- **[Component Gallery](/docs/components)** - Explore core components
- **[Schema Rendering](/docs/concepts/schema-rendering)** - Learn how the engine works

## Need Help?

Can't find what you're looking for? Check out:

- [Concepts](/docs/concepts) - Core concepts and architecture
- [Advanced](/docs/reference) - API documentation and protocol specs
- [GitHub](https://github.com/objectstack-ai/objectui) - Report issues or contribute
