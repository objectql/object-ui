# Plugin Editor - Lazy-Loaded Monaco Editor

A lazy-loaded code editor component for Object UI based on Monaco Editor.

## Features

- **Internal Lazy Loading**: The Monaco Editor is loaded on-demand using `React.lazy()` and `Suspense`
- **Zero Configuration**: Just import the package and use `type: 'code-editor'` in your schema
- **Automatic Registration**: Components auto-register with the ComponentRegistry
- **Skeleton Loading**: Shows a skeleton while Monaco loads

## Installation

```bash
pnpm add @object-ui/plugin-editor
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-editor';

// Now you can use code-editor type in your schemas
const schema = {
  type: 'code-editor',
  value: 'console.log("Hello, World!");',
  language: 'javascript',
  theme: 'vs-dark',
  height: '400px'
};
```

### Manual Integration

```typescript
import { editorComponents } from '@object-ui/plugin-editor';
import { ComponentRegistry } from '@object-ui/core';

// Manually register if needed
Object.entries(editorComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

### TypeScript Support

The plugin exports TypeScript types for full type safety:

```typescript
import type { CodeEditorSchema } from '@object-ui/plugin-editor';

const schema: CodeEditorSchema = {
  type: 'code-editor',
  value: 'console.log("Hello, World!");',
  language: 'javascript',
  theme: 'vs-dark',
  height: '400px'
};
```

## Schema API

```typescript
{
  type: 'code-editor',
  value?: string,              // Code content
  language?: string,           // 'javascript' | 'typescript' | 'python' | 'json' | 'html' | 'css'
  theme?: 'vs-dark' | 'light', // Editor theme
  height?: string,             // e.g., '400px'
  readOnly?: boolean,          // Read-only mode
  className?: string           // Tailwind classes
}
```

## Lazy Loading Architecture

The plugin uses a two-file pattern for optimal code splitting:

1. **`MonacoImpl.tsx`**: Contains the actual Monaco Editor import (heavy)
2. **`index.tsx`**: Entry point with `React.lazy()` wrapper (light)

When bundled, Vite automatically creates separate chunks:
- `index.js` (~200 bytes) - The entry point
- `MonacoImpl-xxx.js` (~15-20 KB) - The lazy-loaded implementation

The Monaco Editor library is only downloaded when a `code-editor` component is actually rendered, not on initial page load.

## Build Output Example

```
dist/index.js                 0.19 kB  # Entry point
dist/MonacoImpl-DCiwKyYW.js  19.42 kB  # Lazy chunk (loaded on demand)
dist/index.umd.cjs           30.37 kB  # UMD bundle
```

## Development

```bash
# Build the plugin
pnpm build

# The package will generate proper ESM and UMD builds with lazy loading preserved
```
