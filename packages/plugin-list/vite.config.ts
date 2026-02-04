import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
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
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
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
