/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      // Clear the inherited tsconfig `paths` so the dts type program resolves
      // `@object-ui/*` to each dependency's published `dist/*.d.ts` (external)
      // instead of following the workspace `src` aliases into files outside
      // this package's `rootDir` — which would emit TS6059 rootDir errors.
      compilerOptions: { rootDir: resolve(__dirname, 'src'), paths: {} },
      aliasesExclude: [/^@object-ui\//],
      include: ['src'],
    }),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: '@object-ui/core', replacement: resolve(__dirname, '../core/src') },
      { find: '@object-ui/types', replacement: resolve(__dirname, '../types/src') },
      { find: '@object-ui/react', replacement: resolve(__dirname, '../react/src') },
      { find: '@object-ui/components', replacement: resolve(__dirname, './src') }, // Self-reference for vitest.setup.tsx
      { find: '@object-ui/fields', replacement: resolve(__dirname, '../fields/src') },
      { find: '@object-ui/plugin-dashboard', replacement: resolve(__dirname, '../plugin-dashboard/src') },
      { find: '@object-ui/plugin-grid', replacement: resolve(__dirname, '../plugin-grid/src') },
      // The CJS shims use require("react") which produces a Rolldown
      // require polyfill incompatible with Next.js Turbopack SSR.
      // Alias to ESM modules that re-export from React 18+ directly.
      { find: /^use-sync-external-store\/shim\/with-selector(\.js)?$/, replacement: resolve(__dirname, 'src/lib/use-sync-external-store-with-selector-shim.ts') },
      { find: /^use-sync-external-store\/shim(\.js)?$/, replacement: resolve(__dirname, 'src/lib/use-sync-external-store-shim.ts') },
      { find: /^use-sync-external-store\/with-selector(\.js)?$/, replacement: resolve(__dirname, 'src/lib/use-sync-external-store-with-selector-shim.ts') },
    ],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ObjectUIComponents',
      fileName: 'index',
    },
    rollupOptions: {
      // Use a function to match subpath imports (e.g. react/jsx-runtime)
      // so Rolldown does not bundle CJS wrappers that use require().
      external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname),
      output: {
        inlineDynamicImports: true,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@object-ui/core': 'ObjectUICore',
          '@object-ui/react': 'ObjectUIReact',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['../../vitest.setup.tsx'],
    passWithNoTests: true,
    // Ensure dependencies are resolved properly for tests
    deps: {
      inline: ['@object-ui/core', '@object-ui/react'],
    },
  },
});
