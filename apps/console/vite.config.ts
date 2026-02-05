import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'process.env': {},
    'process.platform': '"browser"',
    'process.version': '"0.0.0"',
  },
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
      
      // Missing Plugin Aliases
      '@object-ui/plugin-aggrid': path.resolve(__dirname, '../../packages/plugin-aggrid/src'),
      '@object-ui/plugin-calendar': path.resolve(__dirname, '../../packages/plugin-calendar/src'),
      '@object-ui/plugin-charts': path.resolve(__dirname, '../../packages/plugin-charts/src'),
      '@object-ui/plugin-chatbot': path.resolve(__dirname, '../../packages/plugin-chatbot/src'),
      '@object-ui/plugin-detail': path.resolve(__dirname, '../../packages/plugin-detail/src'),
      '@object-ui/plugin-editor': path.resolve(__dirname, '../../packages/plugin-editor/src'),
      '@object-ui/plugin-gantt': path.resolve(__dirname, '../../packages/plugin-gantt/src'),
      '@object-ui/plugin-kanban': path.resolve(__dirname, '../../packages/plugin-kanban/src'),
      '@object-ui/plugin-list': path.resolve(__dirname, '../../packages/plugin-list/src'),
      '@object-ui/plugin-map': path.resolve(__dirname, '../../packages/plugin-map/src'),
      '@object-ui/plugin-markdown': path.resolve(__dirname, '../../packages/plugin-markdown/src'),
      '@object-ui/plugin-timeline': path.resolve(__dirname, '../../packages/plugin-timeline/src'),
      '@object-ui/plugin-view': path.resolve(__dirname, '../../packages/plugin-view/src'),
    },
  },
  optimizeDeps: {
    include: [
      'msw',
      'msw/browser',
      '@objectstack/spec',
      '@objectstack/spec/data',
      '@objectstack/spec/system',
      '@objectstack/spec/ui',
      'react-map-gl',
      'react-map-gl/maplibre',
      'maplibre-gl'
    ],
    esbuildOptions: {
      target: 'esnext',
      supported: { 
        'top-level-await': true 
      },
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
