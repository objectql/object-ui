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
    alias: {
      '@': resolve(__dirname, './src'),
      // The table must cover every `@object-ui/*` specifier the aliased-to-source
      // trees themselves reach, not just this package's own imports: `test.setupFiles`
      // pulls in the root `vitest.setup.tsx`, which imports the components / fields /
      // plugin-dashboard / plugin-grid barrels, and those sources import further
      // workspace packages. An entry missing here falls through to the workspace
      // package's `exports` (i.e. `dist`), which either fails outright when that
      // package is not in this one's `^build` closure (`Failed to resolve import
      // "@object-ui/providers"`, objectui#4194) or silently tests `dist` where the
      // canonical root Vitest run tests `src`. Ordering mirrors the root
      // `vitest.config.mts` alias table.
      '@object-ui/i18n': resolve(__dirname, '../i18n/src'),
      '@object-ui/core': resolve(__dirname, '../core/src'),
      '@object-ui/sdui-parser': resolve(__dirname, '../sdui-parser/src'),
      '@object-ui/types': resolve(__dirname, '../types/src'),
      '@object-ui/react': resolve(__dirname, '../react/src'),
      '@object-ui/components': resolve(__dirname, '../components/src'),
      '@object-ui/providers': resolve(__dirname, '../providers/src'),
      '@object-ui/fields': resolve(__dirname, '../fields/src'),
      '@object-ui/plugin-dashboard': resolve(__dirname, '../plugin-dashboard/src'),
      '@object-ui/plugin-grid': resolve(__dirname, '../plugin-grid/src'),
      '@object-ui/data-objectstack': resolve(__dirname, '../data-objectstack/src'),
      '@object-ui/mobile': resolve(__dirname, '../mobile/src'),
      '@object-ui/permissions': resolve(__dirname, '../permissions/src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIPluginEditor',
      fileName: 'index',
    },
    rollupOptions: {
      external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname),
      output: {
        inlineDynamicImports: true,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@object-ui/components': 'ObjectUIComponents',
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
  },
});
