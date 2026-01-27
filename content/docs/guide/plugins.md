---
title: "Plugins"
---

Object UI supports a powerful plugin system that allows you to extend the framework with additional components. Plugins are separate packages that load on-demand, keeping your main application bundle small while providing rich functionality.

## Overview

Plugins are lazy-loaded component packages that:

- **Auto-register** components when imported
- **Lazy-load** heavy dependencies on-demand
- **Keep bundles small** - only load when needed
- **Are type-safe** with full TypeScript support
- **Follow best practices** with built-in loading states

## Official Plugins

Object UI provides 14+ official plugins for common use cases:

### Data Visualization & Dashboards

#### [@object-ui/plugin-charts](../plugins/plugin-charts.md)

Data visualization components powered by Recharts.

- Bar, line, area, and pie charts
- Responsive design
- Customizable colors
- Lazy-loaded (~80 KB)

[Read full documentation →](../plugins/plugin-charts.md)

---

#### [@object-ui/plugin-dashboard](../plugins/plugin-dashboard.md)

Dashboard layouts with metric cards and widgets.

- Dashboard grid layouts
- Metric/KPI cards with trends
- Widget system
- Lazy-loaded (~22 KB)

[Read full documentation →](../plugins/plugin-dashboard.md)

---

#### [@object-ui/plugin-timeline](../plugins/plugin-timeline.md)

Timeline component with multiple layout variants.

- Vertical, horizontal layouts
- Customizable markers
- Date formatting
- Lazy-loaded (~20 KB)

[Read full documentation →](../plugins/plugin-timeline.md)

---

#### [@object-ui/plugin-gantt](../plugins/plugin-gantt.md)

Gantt chart for project visualization.

- Task dependencies
- Progress tracking
- ObjectQL integration
- Lazy-loaded (~40 KB)

[Read full documentation →](../plugins/plugin-gantt.md)

---

#### [@object-ui/plugin-calendar](../plugins/plugin-calendar.md)

Calendar visualization for events.

- Month/week/day views
- Event management
- ObjectQL integration
- Lazy-loaded (~25 KB)

[Read full documentation →](../plugins/plugin-calendar.md)

---

#### [@object-ui/plugin-map](../plugins/plugin-map.md)

Map visualization with markers.

- Interactive maps
- Location markers
- ObjectQL integration
- Lazy-loaded (~60 KB)

[Read full documentation →](../plugins/plugin-map.md)

---

### Data Management

#### [@object-ui/plugin-grid](../plugins/plugin-grid.md)

Advanced data grid with sorting, filtering, and pagination.

- Column sorting and filtering
- Pagination controls
- Row selection
- Lazy-loaded (~45 KB)

[Read full documentation →](../plugins/plugin-grid.md)

---

#### [@object-ui/plugin-aggrid](../plugins/plugin-aggrid.md)

Enterprise data grid powered by AG Grid.

- Advanced filtering
- Row editing
- Multiple themes
- Lazy-loaded (~150 KB)

[Read full documentation →](../plugins/plugin-aggrid.md)

---

#### [@object-ui/plugin-form](../plugins/plugin-form.md)

Advanced form builder with validation.

- Multi-step forms
- Field validation
- Custom field types
- Lazy-loaded (~28 KB)

[Read full documentation →](../plugins/plugin-form.md)

---

#### [@object-ui/plugin-view](../plugins/plugin-view.md)

ObjectQL-integrated views for automatic CRUD.

- Auto-generated forms and grids
- CRUD operations
- Field mapping
- Lazy-loaded (~35 KB)

[Read full documentation →](../plugins/plugin-view.md)

---

### Content & Editing

#### [@object-ui/plugin-editor](../plugins/plugin-editor.md)

Code editor component powered by Monaco Editor.

- Syntax highlighting for 100+ languages
- IntelliSense and code completion
- Multiple themes
- Lazy-loaded (~120 KB)

[Read full documentation →](../plugins/plugin-editor.md)

---

#### [@object-ui/plugin-markdown](../plugins/plugin-markdown.md)

Markdown renderer with GitHub Flavored Markdown support.

- GitHub Flavored Markdown
- XSS protection
- Code syntax highlighting
- Lazy-loaded (~30 KB)

[Read full documentation →](../plugins/plugin-markdown.md)

---

#### [@object-ui/plugin-chatbot](../plugins/plugin-chatbot.md)

Chat interface component.

- Message history
- User and assistant roles
- Timestamps and avatars
- Lazy-loaded (~35 KB)

[Read full documentation →](../plugins/plugin-chatbot.md)

---

### Workflows & Tasks

#### [@object-ui/plugin-kanban](../plugins/plugin-kanban.md)

Kanban board component with drag-and-drop powered by @dnd-kit.

- Drag and drop cards between columns
- Column limits (WIP limits)
- Card badges for status/priority
- Lazy-loaded (~100 KB)

[Read full documentation →](../plugins/plugin-kanban.md)

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

| Plugin | Initial Load | Lazy Load | Description |
|--------|-------------|-----------|-------------|
| plugin-editor | ~0.2 KB | ~120 KB | Monaco editor |
| plugin-charts | ~0.2 KB | ~80 KB | Recharts visualization |
| plugin-kanban | ~0.2 KB | ~100 KB | Drag-and-drop board |
| plugin-markdown | ~0.2 KB | ~30 KB | Markdown rendering |
| plugin-aggrid | ~0.2 KB | ~150 KB | AG Grid data grid |
| plugin-dashboard | ~0.2 KB | ~22 KB | Dashboard layouts |
| plugin-form | ~0.2 KB | ~28 KB | Form builder |
| plugin-grid | ~0.2 KB | ~45 KB | Data grid |
| plugin-view | ~0.2 KB | ~35 KB | ObjectQL views |
| plugin-timeline | ~0.2 KB | ~20 KB | Timeline layouts |
| plugin-chatbot | ~0.2 KB | ~35 KB | Chat interface |
| plugin-calendar | ~0.2 KB | ~25 KB | Calendar views |
| plugin-gantt | ~0.2 KB | ~40 KB | Gantt charts |
| plugin-map | ~0.2 KB | ~60 KB | Map visualization |

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
import '@object-ui/plugin-dashboard'
import '@object-ui/plugin-form'
import '@object-ui/plugin-grid'
// ... import other plugins as needed
```

Now all plugin components are available in your schemas!

## Creating Custom Plugins

You can create your own plugins following the same pattern:

### 1. Create Package Structure

```bash
mkdir -p packages/plugin-myfeature/src
cd packages/plugin-myfeature
```

### 2. Create Heavy Implementation

```typescript
// src/MyFeatureImpl.tsx
import HeavyLibrary from 'heavy-library'

export default function MyFeatureImpl(props) {
  return <HeavyLibrary {...props} />
}
```

### 3. Create Lazy Wrapper

```typescript
// src/index.tsx
import React, { Suspense } from 'react'
import { ComponentRegistry } from '@object-ui/core'
import { Skeleton } from '@object-ui/components'

// Lazy load implementation
const LazyFeature = React.lazy(() => import('./MyFeatureImpl'))

// Create renderer with Suspense
export const MyFeatureRenderer = (props) => (
  <Suspense fallback={<Skeleton className="w-full h-[300px]" />}>
    <LazyFeature {...props} />
  </Suspense>
)

// Auto-register
ComponentRegistry.register('my-feature', MyFeatureRenderer)

// Export for manual use
export const myFeatureComponents = {
  'my-feature': MyFeatureRenderer
}
```

### 4. Add TypeScript Types

```typescript
// src/types.ts
import type { BaseSchema } from '@object-ui/types'

export interface MyFeatureSchema extends BaseSchema {
  type: 'my-feature'
  customProp?: string
}
```

### 5. Configure Build

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIPluginMyFeature',
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@object-ui/components',
        '@object-ui/core'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
})
```

### 6. Add Package.json

```json
{
  "name": "@object-ui/plugin-myfeature",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.umd.js",
  "module": "./dist/index.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.es.js",
      "require": "./dist/index.umd.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "vite build && tsc --emitDeclarationOnly"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "dependencies": {
    "heavy-library": "^1.0.0"
  },
  "devDependencies": {
    "@object-ui/components": "workspace:*",
    "@object-ui/core": "workspace:*",
    "@object-ui/types": "workspace:*",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

## Best Practices

### 1. Keep Entry Point Light

The main index file should only contain:
- Lazy loading wrapper
- Component registration
- Type exports

Heavy imports go in the `*Impl.tsx` file.

### 2. Provide Good Loading States

Always show a meaningful skeleton while loading:

```typescript
<Suspense fallback={
  <Skeleton className="w-full h-[400px]" />
}>
  <LazyComponent {...props} />
</Suspense>
```

### 3. Export Types

Make your plugin type-safe:

```typescript
export type { MyFeatureSchema } from './types'
```

### 4. Document Your Plugin

Include a README with:
- Installation instructions
- Usage examples
- Schema API reference
- Bundle size information

### 5. Test Lazy Loading

Verify that:
- The main bundle is small (~200 bytes)
- The lazy chunk is separate
- Components load correctly when rendered

```bash
pnpm build
ls -lh dist/
```

## Plugin vs Component Package

**Use a Plugin when:**
- The component depends on large libraries (>50 KB)
- Not all apps will use this component
- You want on-demand loading

**Use regular Components when:**
- The component is lightweight
- Most apps will use it
- It's part of core functionality

## Troubleshooting

### Plugin not loading

Check that you imported it in your app:

```typescript
import '@object-ui/plugin-myfeature'
```

### TypeScript errors

Make sure types are exported:

```typescript
export type { MyFeatureSchema } from '@object-ui/plugin-myfeature'
```

### Bundle size too large

Check that the implementation is in a separate file:

```
✅ src/index.tsx        (light, uses React.lazy)
✅ src/MyFeatureImpl.tsx (heavy, imported lazily)
```

### Component not registering

Check that ComponentRegistry.register() is called at the module level:

```typescript
// ✅ Good - runs on import
ComponentRegistry.register('my-feature', MyFeatureRenderer)

// ❌ Bad - never runs
export function registerComponents() {
  ComponentRegistry.register('my-feature', MyFeatureRenderer)
}
```

## Related Documentation

- [Component Registry](./component-registry.md) - Understanding the registry
- [Schema Rendering](./schema-rendering.md) - How schemas become UI
- [Lazy-Loaded Plugins Architecture](./lazy-loading.md) - Deep dive
- [Creating Components](/spec/component-package.md) - Component development

## Next Steps

1. Install official plugins you need
2. Try creating a custom plugin
3. Share your plugins with the community
4. Contribute new plugins to Object UI
