import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode !== 'test' && tailwindcss(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Monorepo Aliases (Development)
      '@object-ui/core': path.resolve(__dirname, '../../packages/core/src'),
      '@object-ui/types': path.resolve(__dirname, '../../packages/types/src'),
      '@object-ui/react': path.resolve(__dirname, '../../packages/react/src'),
      '@object-ui/components': path.resolve(__dirname, '../../packages/components/src'),
      '@object-ui/layout': path.resolve(__dirname, '../../packages/layout/src'),
      '@object-ui/fields': path.resolve(__dirname, '../../packages/fields/src'),
      '@object-ui/plugin-dashboard': path.resolve(__dirname, '../../packages/plugin-dashboard/src'),
      '@object-ui/plugin-form': path.resolve(__dirname, '../../packages/plugin-form/src'),
      '@object-ui/plugin-grid': path.resolve(__dirname, '../../packages/plugin-grid/src'),
      '@object-ui/data-objectstack': path.resolve(__dirname, '../../packages/data-objectstack/src'),
      '@object-ui/example-crm': path.resolve(__dirname, '../../examples/crm/src'),
    },
  },
  optimizeDeps: {
    include: [
      'msw',
      'msw/browser',
      '@objectstack/spec',
      '@objectstack/spec/data',
      '@objectstack/spec/system',
      '@objectstack/spec/ui'
    ]
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      // Suppress warnings for optional dynamic imports in runtime
      onwarn(warning, warn) {
        // Ignore unresolved import warnings for @objectstack/driver-memory
        // This is an optional fallback dynamic import in the runtime kernel.
        // It's safe to suppress because the driver is explicitly imported in src/mocks/browser.ts
        if (
          warning.code === 'UNRESOLVED_IMPORT' &&
          warning.message.includes('@objectstack/driver-memory')
        ) {
          return;
        }
        warn(warning);
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/mocks/test-setup.ts'],
  },
}));
