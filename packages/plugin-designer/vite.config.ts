import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
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
      '@object-ui/i18n': resolve(__dirname, '../i18n/src'),
      '@object-ui/fields': resolve(__dirname, '../fields/src'),
      '@object-ui/plugin-grid': resolve(__dirname, '../plugin-grid/src'),
      '@object-ui/plugin-form': resolve(__dirname, '../plugin-form/src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIPluginDesigner',
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@object-ui/components',
        '@object-ui/core',
        '@object-ui/fields',
        '@object-ui/plugin-grid',
        '@object-ui/plugin-form',
        '@object-ui/react',
        '@object-ui/types',
        'tailwind-merge',
        'clsx',
        'lucide-react'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@object-ui/components': 'ObjectUIComponents',
          '@object-ui/core': 'ObjectUICore',
          '@object-ui/react': 'ObjectUIReact',
          '@object-ui/types': 'ObjectUITypes',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});
