import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      compilerOptions: { rootDir: resolve(__dirname, '../..') },
      include: ['src'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', 'node_modules'],
      skipDiagnostics: true,
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
      '@object-ui/plugin-grid': resolve(__dirname, '../plugin-grid/src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIPluginDashboard',
      fileName: 'index',
    },
    rollupOptions: {
      // External: any subpath of react/react-dom, all @object-ui packages,
      // and CJS deps that internally `require("react")` — letting them
      // through would inline a CJS wrapper whose require() calls hit
      // rolldown's runtime stub and throw at runtime.
      external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname),
      output: {
        inlineDynamicImports: true,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-grid-layout': 'ReactGridLayout',
          '@object-ui/components': 'ObjectUIComponents',
          '@object-ui/core': 'ObjectUICore',
          '@object-ui/react': 'ObjectUIReact',
          '@object-ui/types': 'ObjectUITypes',
          '@object-ui/i18n': 'ObjectUII18n',
          '@object-ui/fields': 'ObjectUIFields',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.tsx'],
    passWithNoTests: true,
  },
});
