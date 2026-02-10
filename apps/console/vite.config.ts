import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  define: {
    'process.env': {},
    'process.platform': '"browser"',
    'process.version': '"0.0.0"',
  },

  // @objectstack/core@2.0.4 statically imports Node.js crypto (for plugin hashing).
  // The code already has a browser fallback, so we provide an empty stub instead of
  // marking it as external (which emits a bare `import 'crypto'` that browsers reject).
  // enforce: 'pre' ensures this runs before Vite's built-in browser-external resolve.
  plugins: [
    {
      name: 'stub-crypto',
      enforce: 'pre',
      resolveId(id: string) {
        if (id === 'crypto') return '\0crypto-stub';
      },
      load(id: string) {
        if (id === '\0crypto-stub') {
          return [
            'export function createHash() { return { update() { return this; }, digest() { return ""; } }; }',
            'export function createVerify() { return { update() { return this; }, end() {}, verify() { return false; } }; }',
            'export default {};',
          ].join('\n');
        }
      },
    },
    react(),
  ],
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      '@object-ui/components': path.resolve(__dirname, '../../packages/components/src'),
      '@object-ui/core': path.resolve(__dirname, '../../packages/core/src'),
      '@object-ui/fields': path.resolve(__dirname, '../../packages/fields/src'),
      '@object-ui/layout': path.resolve(__dirname, '../../packages/layout/src'),
      '@object-ui/plugin-dashboard': path.resolve(__dirname, '../../packages/plugin-dashboard/src'),
      '@object-ui/plugin-report': path.resolve(__dirname, '../../packages/plugin-report/src'),
      '@object-ui/plugin-form': path.resolve(__dirname, '../../packages/plugin-form/src'),
      '@object-ui/plugin-grid': path.resolve(__dirname, '../../packages/plugin-grid/src'),
      '@object-ui/react': path.resolve(__dirname, '../../packages/react/src'),
      '@object-ui/types': path.resolve(__dirname, '../../packages/types/src'),
      '@object-ui/data-objectstack': path.resolve(__dirname, '../../packages/data-objectstack/src'),
      '@object-ui/auth': path.resolve(__dirname, '../../packages/auth/src'),
      '@object-ui/permissions': path.resolve(__dirname, '../../packages/permissions/src'),
      '@object-ui/tenant': path.resolve(__dirname, '../../packages/tenant/src'),
      
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
    target: 'esnext',
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
  },
  server: {
    // Proxy API requests to the real ObjectStack server when running in server mode.
    // In MSW mode, MSW intercepts requests at the service worker level before they
    // reach the network, so these proxies are effectively bypassed.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/.well-known/objectstack': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  }
});
