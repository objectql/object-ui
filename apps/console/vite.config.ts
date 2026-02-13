import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { viteCryptoStub } from '../../scripts/vite-crypto-stub';
import { compression } from 'vite-plugin-compression2';
import { visualizer } from 'rollup-plugin-visualizer';

// Critical chunks that should be preloaded for faster initial page render.
// These are the chunks needed on every page load (framework + vendor-react).
const CRITICAL_CHUNK_PREFIXES = ['vendor-react', 'framework', 'ui-components', 'vendor-radix'];

/**
 * Vite plugin that injects <link rel="modulepreload"> hints for critical chunks
 * into the built HTML, enabling the browser to fetch them in parallel with the
 * main entry script.
 */
function preloadCriticalChunks(): Plugin {
  return {
    name: 'preload-critical-chunks',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      const preloadTags: string[] = [];
      for (const [fileName] of Object.entries(ctx.bundle)) {
        if (
          fileName.endsWith('.js') &&
          CRITICAL_CHUNK_PREFIXES.some((prefix) => fileName.includes(prefix))
        ) {
          preloadTags.push(`<link rel="modulepreload" href="/${fileName}" />`);
        }
      }
      if (preloadTags.length === 0) return html;
      return html.replace('</head>', `    ${preloadTags.join('\n    ')}\n  </head>`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  define: {
    'process.env': {},
    'process.platform': '"browser"',
    'process.version': '"0.0.0"',
  },

  plugins: [
    viteCryptoStub(),
    react(),
    // Inject <link rel="modulepreload"> for critical chunks
    preloadCriticalChunks(),
    // Gzip compression for production assets
    compression({
      algorithm: 'gzip',
      exclude: [/\.(br)$/, /\.(gz)$/],
      threshold: 1024,
    }),
    // Brotli compression for modern browsers
    compression({
      algorithm: 'brotliCompress',
      exclude: [/\.(br)$/, /\.(gz)$/],
      threshold: 1024,
    }),
    // Bundle analysis (generates stats.html in dist/)
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
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
      '@object-ui/collaboration': path.resolve(__dirname, '../../packages/collaboration/src'),
      '@object-ui/tenant': path.resolve(__dirname, '../../packages/tenant/src'),
      '@object-ui/i18n': path.resolve(__dirname, '../../packages/i18n/src'),
      
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

      // HotCRM submodule: stub @hotcrm/ai (AI utilities not needed for UI metadata)
      '@hotcrm/ai': path.resolve(__dirname, '../../examples/hotcrm-stubs/ai.ts'),
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
    sourcemap: false,
    cssCodeSplit: true,
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
      },
      output: {
        manualChunks(id) {
          // Vendor: React ecosystem
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Vendor: Radix UI primitives
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          // Vendor: Lucide icons
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          // Vendor: UI utilities (cva, clsx, tailwind-merge, sonner)
          if (id.includes('node_modules/class-variance-authority/') ||
              id.includes('node_modules/clsx/') ||
              id.includes('node_modules/tailwind-merge/') ||
              id.includes('node_modules/sonner/')) {
            return 'vendor-ui-utils';
          }
          // ObjectStack SDK
          if (id.includes('node_modules/@objectstack/')) {
            return 'vendor-objectstack';
          }
          // Zod (validation)
          if (id.includes('node_modules/zod/')) {
            return 'vendor-zod';
          }
          // MSW + related (mock server — dev/demo only)
          if (id.includes('node_modules/msw/') ||
              id.includes('node_modules/mswjs/') ||
              id.includes('node_modules/@mswjs/') ||
              id.includes('node_modules/strict-event-emitter/') ||
              id.includes('node_modules/outvariant/') ||
              id.includes('node_modules/headers-polyfill/') ||
              id.includes('node_modules/@bundled-es-modules/')) {
            return 'vendor-msw';
          }
          // Recharts (charts)
          if (id.includes('node_modules/recharts/') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-')) {
            return 'vendor-charts';
          }
          // DnD Kit
          if (id.includes('node_modules/@dnd-kit/')) {
            return 'vendor-dndkit';
          }
          // i18next
          if (id.includes('node_modules/i18next') ||
              id.includes('node_modules/react-i18next/')) {
            return 'vendor-i18n';
          }
          // @object-ui/core + @object-ui/react (framework)
          if (id.includes('/packages/core/') ||
              id.includes('/packages/react/') ||
              id.includes('/packages/types/')) {
            return 'framework';
          }
          // @object-ui/components + @object-ui/fields (UI atoms)
          if (id.includes('/packages/components/') ||
              id.includes('/packages/fields/')) {
            return 'ui-components';
          }
          // @object-ui/layout
          if (id.includes('/packages/layout/')) {
            return 'ui-layout';
          }
          // Infrastructure: auth, permissions, tenant, i18n
          if (id.includes('/packages/auth/') ||
              id.includes('/packages/permissions/') ||
              id.includes('/packages/tenant/') ||
              id.includes('/packages/i18n/')) {
            return 'infrastructure';
          }
          // Plugins: grid, form, view (core views — always needed)
          if (id.includes('/packages/plugin-grid/') ||
              id.includes('/packages/plugin-form/') ||
              id.includes('/packages/plugin-view/')) {
            return 'plugins-core';
          }
          // Plugins: detail, list, dashboard, report
          if (id.includes('/packages/plugin-detail/') ||
              id.includes('/packages/plugin-list/') ||
              id.includes('/packages/plugin-dashboard/') ||
              id.includes('/packages/plugin-report/')) {
            return 'plugins-views';
          }
          // Data adapter
          if (id.includes('/packages/data-objectstack/')) {
            return 'data-adapter';
          }
        }
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
