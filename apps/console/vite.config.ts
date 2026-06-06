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
          preloadTags.push(`<link rel="modulepreload" href="${basePath}${fileName}" />`);
        }
      }
      if (preloadTags.length === 0) return html;
      return html.replace('</head>', `    ${preloadTags.join('\n    ')}\n  </head>`);
    },
  };
}

// Base path for SPA deployment.
//
// Default: './' (relative) — makes the build path-agnostic, so the same
// dist/ works under any mount point (/_console/, /console/, /foo/bar/).
// This is required for the package to be embeddable in arbitrary
// ObjectStack servers.
//
// Demo / standalone deployments can pin an absolute base via
// VITE_BASE_PATH (e.g. '/console/') so static asset caching keys are
// stable across HTML revisions.
const basePath = process.env.VITE_BASE_PATH || './';

// On Vercel/CI we skip the compression and visualizer plugins because the
// Vercel CDN handles gzip/brotli automatically and bundle analysis is not
// needed during CI builds.  This reduces peak memory by ~1.5 GB.
//
// Workspace src/ aliases are kept in ALL environments (dev + CI) so that
// plugin side-effect imports (ComponentRegistry.register) resolve correctly.
// Without them, Vite would import pre-built dist/ bundles where the
// singleton ComponentRegistry can get duplicated across chunks, causing
// "Unknown component type" errors at runtime.
const isCI = !!(process.env.VERCEL || process.env.CI);

// Workspace src/ aliases — gives instant HMR in dev and ensures correct
// side-effect resolution (plugin registrations) in production builds.
const workspaceAliases: Record<string, string> = {
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
  '@object-ui/providers': path.resolve(__dirname, '../../packages/providers/src'),
  '@object-ui/collaboration': path.resolve(__dirname, '../../packages/collaboration/src'),
  '@object-ui/tenant': path.resolve(__dirname, '../../packages/tenant/src'),
  '@object-ui/i18n': path.resolve(__dirname, '../../packages/i18n/src'),
  '@object-ui/mobile': path.resolve(__dirname, '../../packages/mobile/src'),
  '@object-ui/app-shell': path.resolve(__dirname, '../../packages/app-shell/src'),

  // Plugin Aliases
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
  '@object-ui/plugin-designer': path.resolve(__dirname, '../../packages/plugin-designer/src'),
};

// https://vitejs.dev/config/
export default defineConfig({
  base: basePath,
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
    // Gzip/Brotli compression & bundle visualizer are skipped on Vercel/CI to
    // reduce memory usage — Vercel's CDN compresses assets automatically.
    ...(!isCI ? [
      compression({
        algorithm: 'gzip',
        exclude: [/\.(br)$/, /\.(gz)$/],
        threshold: 1024,
      }),
      compression({
        algorithm: 'brotliCompress',
        exclude: [/\.(br)$/, /\.(gz)$/],
        threshold: 1024,
      }),
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
    ] : []),
  ],
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    alias: workspaceAliases,
    // Force a SINGLE copy of these libraries. The monorepo resolves slightly
    // different React patch versions (19.2.6 vs 19.2.7) across packages, which
    // duplicates `react`/`react-dom` and, downstream, `sonner` — so
    // plugin-form's `toast()` and the console's `<Toaster>` ended up bound to
    // different sonner instances and toasts never rendered (the "click does
    // nothing — no feedback" bug). Deduping keeps one instance so context,
    // hooks, and the sonner observer all line up.
    dedupe: ['react', 'react-dom', 'sonner'],
  },
  optimizeDeps: {
    include: [
      '@objectstack/spec',
      '@objectstack/spec/data',
      '@objectstack/spec/system',
      '@objectstack/spec/ui',
      'react-map-gl',
      'react-map-gl/maplibre',
      'maplibre-gl'
    ]
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    cssCodeSplit: true,
    // Don't pre-emit `<link rel="modulepreload">` for every chunk; it
    // negates lazy-loading by pulling all 1700+ icon chunks and heavy
    // plugin chunks during the initial HTML parse.
    modulePreload: false,
    commonjsOptions: {
      include: [/node_modules/, /packages/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        // Use rolldown's `advancedChunks.groups` instead of legacy
        // `manualChunks`. Rolldown's manualChunks function is unreliable for
        // shared modules — it often merges them into the first importer's
        // chunk regardless of the function's return value. The `groups` API
        // explicitly partitions modules with priority/test/name semantics.
        advancedChunks: {
          groups: [
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/, priority: 100 },
            { name: 'vendor-radix', test: /[\\/]node_modules[\\/]@radix-ui[\\/]/, priority: 95 },
            { name: 'vendor-objectstack', test: /([\\/]node_modules[\\/]@objectstack[\\/]|[\\/]@objectstack\+)/, priority: 95 },
            { name: 'vendor-icons-core', test: /[\\/]node_modules[\\/]lucide-react[\\/]dist[\\/](lucide-react|esm[\\/](Icon|createLucideIcon|defaultAttributes|shared))/, priority: 90 },
            { name: 'vendor-ui-utils', test: /[\\/]node_modules[\\/](class-variance-authority|clsx|tailwind-merge|sonner)[\\/]/, priority: 90 },
            { name: 'vendor-zod', test: /[\\/]node_modules[\\/]zod[\\/]/, priority: 90 },
            { name: 'vendor-charts', test: /[\\/]node_modules[\\/](recharts|d3-|victory-)/, priority: 90 },
            { name: 'vendor-dndkit', test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/, priority: 90 },
            { name: 'vendor-i18n', test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/, priority: 90 },
            // Workspace packages — match by realpath, since pnpm may resolve
            // through node_modules/@object-ui/<pkg> symlinks to packages/<pkg>.
            { name: 'framework', test: /[\\/]packages[\\/](core|react|types)[\\/]/, priority: 80 },
            { name: 'ui-components', test: /[\\/]packages[\\/](components|fields)[\\/]/, priority: 80 },
            { name: 'ui-layout', test: /[\\/]packages[\\/]layout[\\/]/, priority: 80 },
            { name: 'data-adapter', test: /[\\/]packages[\\/]data-objectstack[\\/]/, priority: 80 },
            { name: 'infrastructure', test: /[\\/]packages[\\/](auth|permissions|tenant|i18n)[\\/]/, priority: 80 },
            // Plugins — one chunk per plugin so dynamic imports cleave cleanly.
            { name: 'plugin-grid', test: /[\\/]packages[\\/]plugin-grid[\\/]/, priority: 70 },
            { name: 'plugin-form', test: /[\\/]packages[\\/]plugin-form[\\/]/, priority: 70 },
            { name: 'plugin-view', test: /[\\/]packages[\\/]plugin-view[\\/]/, priority: 70 },
            { name: 'plugins-views', test: /[\\/]packages[\\/]plugin-(detail|list)[\\/]/, priority: 70 },
            { name: 'plugin-dashboard', test: /[\\/]packages[\\/]plugin-dashboard[\\/]/, priority: 70 },
            { name: 'plugin-report', test: /[\\/]packages[\\/]plugin-report[\\/]/, priority: 70 },
            { name: 'plugin-map', test: /[\\/]packages[\\/]plugin-map[\\/]/, priority: 70 },
            { name: 'plugin-charts', test: /[\\/]packages[\\/]plugin-charts[\\/]/, priority: 70 },
            { name: 'plugin-gantt', test: /[\\/]packages[\\/]plugin-gantt[\\/]/, priority: 70 },
            { name: 'plugin-markdown', test: /[\\/]packages[\\/]plugin-markdown[\\/]/, priority: 70 },
            { name: 'plugin-timeline', test: /[\\/]packages[\\/]plugin-timeline[\\/]/, priority: 70 },
            { name: 'plugin-calendar', test: /[\\/]packages[\\/]plugin-calendar[\\/]/, priority: 70 },
            { name: 'plugin-kanban', test: /[\\/]packages[\\/]plugin-kanban[\\/]/, priority: 70 },
            { name: 'plugin-chatbot', test: /[\\/]packages[\\/]plugin-chatbot[\\/]/, priority: 70 },
            // react-markdown / remark / micromark family — heavy markdown
            // pipeline pulled in only by markdown/chatbot plugins.
            { name: 'vendor-markdown', test: /[\\/]node_modules[\\/](react-markdown|remark-|rehype-|micromark|mdast-|hast-|unified|unist-|vfile|bail|trough|character-entities|decode-named-character-reference|devlop|estree-|comma-separated-tokens|space-separated-tokens|property-information|html-url-attributes|zwitch)/, priority: 85 },
            // Sentry — only loaded when VITE_SENTRY_DSN is configured at runtime
            { name: 'vendor-sentry', test: /[\\/]node_modules[\\/]@sentry[\\/]/, priority: 85 },
          ],
        },
      }
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['../../vitest.setup.tsx'],
    server: {
      deps: {
        inline: [/@objectstack/],
      },
    },
  },
  server: {
    port: 5180,
    proxy: {
      '/api': { target: process.env.DEV_PROXY_TARGET || 'http://localhost:3000', changeOrigin: true },
    },
  },
});
