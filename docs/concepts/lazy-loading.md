---
title: "Lazy-Loaded Plugins Architecture"
---

This document details the architecture for lazy-loading heavy components (like code editors or charts) in Object UI to optimize the application bundle size.

## Overview

Object UI encapsulates heavy dependencies into separate plugin packages. The architecture ensures that these dependencies are only downloaded by the browser when the specific component is actually rendered on the screen.

## Architecture Evolution

### 1. Traditional Approach (Bad ❌)

Directly importing heavy libraries causes them to be included in the main bundle, slowing down the initial load for all users, even those who never use the component.

```typescript
// The heavy library is bundled immediately
import Editor from '@monaco-editor/react';

function CodeEditor() {
  return <Editor {...props} />;
}
```

### 2. Host-Side Lazy Loading (Not Ideal ⚠️)

Forcing the application developer to handle lazy loading leaks implementation details and creates repetitive boilerplate code.

```typescript
// Forces every consumer to implement Suspense logic manually
const CodeEditor = React.lazy(() => import('./CodeEditor'));

function App() {
  return (
    <Suspense fallback={<Skeleton />}>
      <CodeEditor />
    </Suspense>
  );
}
```

### 3. Internal Lazy Loading (Best ✅)

The plugin package handles lazy loading internally. Consumers import it normally, but the browser only fetches the heavy code when needed.

```typescript
// Import the plugin to register it
import '@object-ui/plugin-editor';

// The heavy specific code is NOT loaded yet.
// It will be fetched automatically ONLY when this schema is rendered:
const schema = { type: 'code-editor', value: '...' };
```

## Implementation Pattern

Every plugin package follows a strict separation of concerns to ensure code splitting works correctly.

### 1. Heavy Implementation File (`XxxImpl.tsx`)

This file contains the actual heavy dependencies.

```typescript
// packages/plugin-editor/src/MonacoImpl.tsx
// 🔴 Heavy dependencies are isolated here. 
// This file becomes a separate chunk during build.
import Editor from '@monaco-editor/react'; 

export default function MonacoImpl(props) {
  return <Editor {...props} />;
}
```

### 2. Lazy Wrapper (`index.tsx`)

The entry point uses `React.lazy` and `Suspense` to wrap the implementation. This is the only file that gets included in the initial bundle.

```typescript
// packages/plugin-editor/src/index.tsx
import React, { Suspense } from 'react';
import { ComponentRegistry } from '@object-ui/core'; 
import { Skeleton } from '@object-ui/components';

// 🟢 Lazy load the implementation file
const LazyMonacoEditor = React.lazy(() => import('./MonacoImpl'));

export const CodeEditorRenderer = (props) => (
  <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
    <LazyMonacoEditor {...props} />
  </Suspense>
);

// Register directly with the core engine
ComponentRegistry.register('code-editor', CodeEditorRenderer);

// Export for manual integration if needed
export const editorComponents = {
  'code-editor': CodeEditorRenderer
};
```

### 3. Type Definitions (`types.ts`)

Types are owned by the plugin to maintain decoupling.

```typescript
// packages/plugin-editor/src/types.ts
import type { BaseSchema } from '@object-ui/types';

/**
 * Code Editor component schema.
 * Defined locally to avoid polluting the core package.
 */
export interface CodeEditorSchema extends BaseSchema {
  type: 'code-editor';
  value?: string;
  language?: string;
  theme?: 'vs-dark' | 'light';
  // ... specific props
}
```

### 4. Build Configuration (`vite.config.ts`)

Configure Rollup/Vite to correctly bundle the library while externalizing core dependencies.

```typescript
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIPluginEditor',
    },
    rollupOptions: {
      // Ensure core libraries and React are not bundled into the plugin
      external: ['react', 'react-dom', '@object-ui/components', '@object-ui/core'],
    },
  },
});
```

## Type System Strategy

### Plugin-Owned Types (✅ Recommended)

Each plugin package is responsible for exporting its own interfaces. This allows plugins to evolve independently of the core framework.

```typescript
import type { CodeEditorSchema } from '@object-ui/plugin-editor';
```

### Platform-Owned Types (❌ Avoid)

Defining plugin types in `@object-ui/types` creates tight coupling and forces core updates for every plugin change.

## Bundle Analysis

The build output demonstrates the separation:

*   **`dist/index.js`**: Lightweight wrapper (~1-2kb).
*   **`dist/MonacoImpl-xxxx.js`**: Heavy chunk (only loaded on demand).

When an application uses the plugin, Vite's bundler respects this split, preserving the heavy chunk as a separate file in the final `dist/assets` folder.

## Creating a New Plugin

1.  **Structure**: Create `packages/plugin-yourfeature`.
2.  **Isolate**: Put heavy code in a default exported file (e.g., `HeavyImpl.tsx`).
3.  **Wrap**: Create a wrapper in `index.tsx` using `React.lazy(() => import('./HeavyImpl'))`.
4.  **Register**: Call `ComponentRegistry.register` in the wrapper.
5.  **Build**: Set up `vite.config.ts` to externalize `@object-ui/core` and `@object-ui/components`.

## Verification

To verify lazy loading works in your application:

1.  Run `pnpm build` in your app.
2.  Inspect `dist/assets`. You should see separate files for the plugin implementations (e.g., `MonacoImpl-....js`).
3.  Open the app in a browser with the **Network** tab open.
4.  Navigate to a page *without* the plugin component. The heavy chunk should **not** load.
5.  Navigate to a page *with* the component. The heavy chunk should load immediately.
