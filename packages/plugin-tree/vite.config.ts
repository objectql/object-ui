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

import { createDtsFailOnTypeErrors } from '../../scripts/vite-dts-fail-on-type-errors.ts';

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
      exclude: ['**/*.test.ts', '**/*.test.tsx', 'node_modules'],
      // A type error the declaration program already found and printed used to
      // leave `vite build` exiting 0 — objectui#5370 / #5483. This makes it fatal.
      ...createDtsFailOnTypeErrors({ packageDir: __dirname }),
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@object-ui/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIPluginTree',
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
          '@object-ui/i18n': 'ObjectUII18n',
          '@object-ui/react': 'ObjectUIReact',
          '@object-ui/types': 'ObjectUITypes',
          'lucide-react': 'LucideReact',
        },
      },
    },
  },
  test: {
    passWithNoTests: true,
    environment: 'jsdom',
  },
});
