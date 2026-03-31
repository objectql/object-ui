import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
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
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@object-ui/components',
        '@object-ui/core',
        '@object-ui/react',
        '@object-ui/types',
        'lucide-react',
      ],
      output: {
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
