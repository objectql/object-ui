import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      '@object-ui/components': path.resolve(__dirname, '../../packages/components/src'),
      '@object-ui/core': path.resolve(__dirname, '../../packages/core/src'),
      '@object-ui/fields': path.resolve(__dirname, '../../packages/fields/src'),
      '@object-ui/layout': path.resolve(__dirname, '../../packages/layout/src'),
      '@object-ui/plugin-dashboard': path.resolve(__dirname, '../../packages/plugin-dashboard/src'),
      '@object-ui/plugin-form': path.resolve(__dirname, '../../packages/plugin-form/src'),
      '@object-ui/plugin-grid': path.resolve(__dirname, '../../packages/plugin-grid/src'),
      '@object-ui/react': path.resolve(__dirname, '../../packages/react/src'),
      '@object-ui/types': path.resolve(__dirname, '../../packages/types/src'),
      '@object-ui/data-objectstack': path.resolve(__dirname, '../../packages/data-objectstack/src'),
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
    ],
    esbuildOptions: {
      resolveExtensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
    }
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      onwarn(warning, warn) {
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
    environment: 'happy-dom',
    setupFiles: ['../../vitest.setup.tsx'],
    server: {
      deps: {
        inline: [/@objectstack/]
      }
    }
  }
});
