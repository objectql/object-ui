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

Object UI provides four official plugins for common use cases:

### [@object-ui/plugin-editor](../plugins/plugin-editor.md)

Code editor component powered by Monaco Editor (VS Code's editor).

- Syntax highlighting for 100+ languages
- IntelliSense and code completion
- Multiple themes
- Lazy-loaded (~20 KB)

[Read full documentation →](../plugins/plugin-editor.md)

---

### [@object-ui/plugin-charts](../plugins/plugin-charts.md)

Data visualization components powered by Recharts.

- Bar, line, area, and pie charts
- Responsive design
- Customizable colors
- Lazy-loaded (~540 KB)

[Read full documentation →](../plugins/plugin-charts.md)

---

### [@object-ui/plugin-kanban](../plugins/plugin-kanban.md)

Kanban board component with drag-and-drop powered by @dnd-kit.

- Drag and drop cards between columns
- Column limits (WIP limits)
- Card badges for status/priority
- Lazy-loaded (~100-150 KB)

[Read full documentation →](../plugins/plugin-kanban.md)

---

### [@object-ui/plugin-markdown](../plugins/plugin-markdown.md)

Markdown renderer with GitHub Flavored Markdown support.

- GitHub Flavored Markdown
- XSS protection
- Code syntax highlighting
- Lazy-loaded (~100-200 KB)

[Read full documentation →](../plugins/plugin-markdown.md)

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
