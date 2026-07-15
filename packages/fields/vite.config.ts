import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      // Clear the inherited tsconfig `paths` so the dts type program resolves
      // `@object-ui/*` to each dependency's published `dist/*.d.ts` (external)
      // instead of following the workspace `src` aliases into files outside
      // this package's `rootDir` — which would emit TS6059 rootDir errors.
      compilerOptions: { rootDir: path.resolve(__dirname, 'src'), paths: {} },
      aliasesExclude: [/^@object-ui\//],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@object-ui/core': path.resolve(__dirname, '../core/src'),
      '@object-ui/types': path.resolve(__dirname, '../types/src'),
      '@object-ui/react': path.resolve(__dirname, '../react/src'),
      '@object-ui/components': path.resolve(__dirname, '../components/src'),
      '@object-ui/fields': path.resolve(__dirname, './src'), // Self-reference for vitest.setup.tsx
      '@object-ui/plugin-dashboard': path.resolve(__dirname, '../plugin-dashboard/src'),
      '@object-ui/plugin-grid': path.resolve(__dirname, '../plugin-grid/src'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIFields',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname),
      output: {
        inlineDynamicImports: true,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
          '@object-ui/components': 'ObjectUIComponents',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../vitest.setup.tsx'],
    passWithNoTests: true,
  },
});
