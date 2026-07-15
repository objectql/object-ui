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
      outDir: 'dist',
      tsconfigPath: './tsconfig.json',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@object-ui/core': resolve(__dirname, '../core/src'),
      '@object-ui/types': resolve(__dirname, '../types/src'),
      '@object-ui/react': resolve(__dirname, '../react/src'),
      '@object-ui/components': resolve(__dirname, '../components/src'),
      '@object-ui/fields': resolve(__dirname, '../fields/src'),
      '@object-ui/plugin-dashboard': resolve(__dirname, '../plugin-dashboard/src'),
      '@object-ui/plugin-grid': resolve(__dirname, '../plugin-grid/src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIPluginList',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'umd.cjs'}`,
    },
    rollupOptions: {
      // IMPORTANT: do NOT inline @object-ui/* runtime packages.
      // Each plugin must share the same ComponentRegistry singleton from
      // @object-ui/core; bundling core into every plugin creates per-plugin
      // private registries and breaks cross-plugin component lookup.
      external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname),
      output: {
        inlineDynamicImports: true,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
          '@object-ui/core': 'ObjectUICore',
          '@object-ui/types': 'ObjectUITypes',
          '@object-ui/react': 'ObjectUIReact',
          '@object-ui/components': 'ObjectUIComponents',
          '@object-ui/fields': 'ObjectUIFields',
          '@object-ui/i18n': 'ObjectUIi18n',
          '@object-ui/mobile': 'ObjectUIMobile',
          'lucide-react': 'LucideReact',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['../../vitest.setup.tsx'],
    passWithNoTests: true,
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },
});
