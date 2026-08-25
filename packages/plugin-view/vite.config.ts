import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

import { createDtsFailOnTypeErrors } from '../../scripts/vite-dts-fail-on-type-errors.ts';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
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
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      // A type error the declaration program already found and printed used to
      // leave `vite build` exiting 0 — objectui#5370 / #5483. This makes it fatal.
      ...createDtsFailOnTypeErrors({ packageDir: __dirname }),
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIPluginView',
      fileName: 'index',
    },
    rollupOptions: {
      external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname),
      output: {
        inlineDynamicImports: true,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  test: {
    passWithNoTests: true,
  },
});
