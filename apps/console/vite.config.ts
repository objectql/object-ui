// `defineConfig` comes from `vitest/config`, not `vite` — this file carries a
// `test` block (consumed by `vitest.config.ts`, which merges this config), and
// `vite`'s own `UserConfigExport` has no `test` property. Importing it from
// `vite` left that whole block unchecked (objectui#3305).
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
// Relative specifiers carry their real file extension, and `__dirname` is
// spelled `import.meta.dirname` throughout this file, so the config stays
// loadable by Vite's `configLoader: 'native'` — which imports this file with
// Node's own ESM loader. Node does no extension guessing and defines no
// `__dirname` in ESM, so the pre-Vite-8 spellings would fail outright the day
// `native` becomes the default loader (objectui#3384).
import { viteCryptoStub } from '../../scripts/vite-crypto-stub.ts';
import { viteMaplibreWorker } from '../../scripts/vite-maplibre-worker.ts';
import { resolveSpecDistInjection } from '../../scripts/vite-objectstack-spec-dist.ts';
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

/**
 * Dev-only Vite plugin: serves runtime branding assets at /runtime/assets/*.
 *
 * When the console dev server runs standalone (port 5180), the backend does
 * not proxy /runtime requests.  This plugin looks for assets in the host
 * project's `runtime/assets/` directory (four levels up from apps/console)
 * so URLs like /runtime/assets/logo.png resolve.
 *
 * Non-blocking — silently skips when the directory doesn't exist.
 */
function serveRuntimeAssets(): Plugin {
  const ASSETS_DIR = path.resolve(import.meta.dirname, '../../../../runtime/assets');
  const MIME: Record<string, string> = {
    '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp',
  };

  return {
    name: 'serve-runtime-assets',
    apply: 'serve', // dev-only — prod builds include assets in the bundle
    configureServer(server) {
      if (!fs.existsSync(ASSETS_DIR)) return;
      server.middlewares.use('/runtime/assets', (req, res, next) => {
        const filename = (req.url || '').replace(/^\/+/, '').replace(/[?#].*$/, '');
        if (!filename) { next(); return; }
        const filePath = path.join(ASSETS_DIR, filename);
        if (!filePath.startsWith(ASSETS_DIR)) { next(); return; } // path traversal guard
        try {
          const content = fs.readFileSync(filePath);
          res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
          res.statusCode = 200;
          res.end(content);
        } catch {
          next();
        }
      });
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
  '@object-ui/components': path.resolve(import.meta.dirname, '../../packages/components/src'),
  '@object-ui/core': path.resolve(import.meta.dirname, '../../packages/core/src'),
  '@object-ui/react-runtime': path.resolve(import.meta.dirname, '../../packages/react-runtime/src'),
  '@object-ui/sdui-parser': path.resolve(import.meta.dirname, '../../packages/sdui-parser/src'),
  '@object-ui/fields': path.resolve(import.meta.dirname, '../../packages/fields/src'),
  '@object-ui/layout': path.resolve(import.meta.dirname, '../../packages/layout/src'),
  '@object-ui/plugin-dashboard': path.resolve(import.meta.dirname, '../../packages/plugin-dashboard/src'),
  '@object-ui/plugin-report': path.resolve(import.meta.dirname, '../../packages/plugin-report/src'),
  '@object-ui/plugin-form': path.resolve(import.meta.dirname, '../../packages/plugin-form/src'),
  '@object-ui/plugin-grid': path.resolve(import.meta.dirname, '../../packages/plugin-grid/src'),
  '@object-ui/react': path.resolve(import.meta.dirname, '../../packages/react/src'),
  // The `/zod` subpath must be aliased BEFORE the bare package: a vite string
  // alias matches by PREFIX, so `@object-ui/types/zod` would otherwise resolve to
  // the `src/zod` DIRECTORY, which has no `index.ts` (the barrel is
  // `index.zod.ts`) — UNLOADABLE_DEPENDENCY at build time. Mirrors the pairing
  // in the root `vitest.config.mts`.
  '@object-ui/types/zod': path.resolve(import.meta.dirname, '../../packages/types/src/zod/index.zod.ts'),
  '@object-ui/types': path.resolve(import.meta.dirname, '../../packages/types/src'),
  '@object-ui/data-objectstack': path.resolve(import.meta.dirname, '../../packages/data-objectstack/src'),
  '@object-ui/auth': path.resolve(import.meta.dirname, '../../packages/auth/src'),
  '@object-ui/permissions': path.resolve(import.meta.dirname, '../../packages/permissions/src'),
  '@object-ui/providers': path.resolve(import.meta.dirname, '../../packages/providers/src'),
  '@object-ui/collaboration': path.resolve(import.meta.dirname, '../../packages/collaboration/src'),
  '@object-ui/i18n': path.resolve(import.meta.dirname, '../../packages/i18n/src'),
  '@object-ui/mobile': path.resolve(import.meta.dirname, '../../packages/mobile/src'),
  '@object-ui/app-shell': path.resolve(import.meta.dirname, '../../packages/app-shell/src'),

  // Plugin Aliases
  '@object-ui/plugin-calendar': path.resolve(import.meta.dirname, '../../packages/plugin-calendar/src'),
  '@object-ui/plugin-charts': path.resolve(import.meta.dirname, '../../packages/plugin-charts/src'),
  '@object-ui/plugin-chatbot': path.resolve(import.meta.dirname, '../../packages/plugin-chatbot/src'),
  '@object-ui/plugin-detail': path.resolve(import.meta.dirname, '../../packages/plugin-detail/src'),
  '@object-ui/plugin-editor': path.resolve(import.meta.dirname, '../../packages/plugin-editor/src'),
  '@object-ui/plugin-gantt': path.resolve(import.meta.dirname, '../../packages/plugin-gantt/src'),
  '@object-ui/plugin-kanban': path.resolve(import.meta.dirname, '../../packages/plugin-kanban/src'),
  '@object-ui/plugin-list': path.resolve(import.meta.dirname, '../../packages/plugin-list/src'),
  '@object-ui/plugin-map': path.resolve(import.meta.dirname, '../../packages/plugin-map/src'),
  '@object-ui/plugin-markdown': path.resolve(import.meta.dirname, '../../packages/plugin-markdown/src'),
  '@object-ui/plugin-timeline': path.resolve(import.meta.dirname, '../../packages/plugin-timeline/src'),
  '@object-ui/plugin-tree': path.resolve(import.meta.dirname, '../../packages/plugin-tree/src'),
  '@object-ui/plugin-view': path.resolve(import.meta.dirname, '../../packages/plugin-view/src'),
  '@object-ui/plugin-designer': path.resolve(import.meta.dirname, '../../packages/plugin-designer/src'),
};

// Opt-in override of the installed `@objectstack/client`. The published client
// (11.2.0) predates the async import-job API (`data.createImportJob` et al.),
// so to exercise the full background-import + undo flow through the real
// console before that client ships, point OBJECTSTACK_CLIENT_DIST at a locally
// built client (its dist entry or package dir). Inert when unset — production
// and CI builds use the installed client unchanged.
const clientDistOverride = process.env.OBJECTSTACK_CLIENT_DIST;
// Extra dirs the dev server may read the override from — it lives outside the
// workspace root, so Vite's default `server.fs.allow` would 403 it (blank page).
const clientFsAllow: string[] = [];
if (clientDistOverride) {
  const resolved = path.resolve(clientDistOverride);
  workspaceAliases['@objectstack/client'] = resolved;
  // Allow the containing package (…/dist/index.mjs → …/<pkg>) so Vite can serve it.
  clientFsAllow.push(path.dirname(resolved), path.resolve(path.dirname(resolved), '..'));
}

// Deps pre-bundled for the dev server. Build-time pre-bundling was removed in
// Vite 5.1, so this list is read by `pnpm dev` only, never by `vite build`.
const OPTIMIZE_DEPS_INCLUDE = [
  '@objectstack/spec',
  '@objectstack/spec/data',
  '@objectstack/spec/system',
  '@objectstack/spec/ui',
  'react-map-gl',
  'react-map-gl/maplibre',
  'maplibre-gl'
];

// Baseline `vendor-objectstack` grouping: the installed spec/client, reached
// either through `node_modules/@objectstack/` or through pnpm's flattened
// `@objectstack+<pkg>` store path.
const VENDOR_OBJECTSTACK_TEST = /([\\/]node_modules[\\/]@objectstack[\\/]|[\\/]@objectstack\+)/;

// Opt-in override of the installed `@objectstack/spec` — the spec twin of
// OBJECTSTACK_CLIENT_DIST above, so a framework build can bundle the console
// against its OWN spec instead of the last published one (objectui#4854, ruled
// on objectstack#8134). Point it at a built spec package (its directory, its
// `dist/`, or an entry file inside it).
//
// It is NOT a copy of the client line: `@objectstack/spec` publishes an 18-entry
// exports map that redirects every subpath into `dist/`, and a Vite string alias
// does not consult exports maps. So the injection is derived from the OVERRIDE's
// own exports map, one alias per entry — see the module for the derivation and
// for why every failure mode throws instead of falling back.
//
// Inert when unset: `null` here leaves the alias table, the pre-bundle list, the
// vendor chunk test and the dev server's fs allow-list at their baseline values.
const specDistInjection = resolveSpecDistInjection(process.env.OBJECTSTACK_SPEC_DIST, {
  vendorChunkTest: VENDOR_OBJECTSTACK_TEST,
});
if (specDistInjection) Object.assign(workspaceAliases, specDistInjection.aliases);

const specFsAllow: string[] = specDistInjection ? specDistInjection.fsAllow : [];

// Pre-bundling an ALIASED, out-of-workspace dep is opt-in through this list and
// nothing else: Vite's pre-alias plugin only registers such a resolution as a
// dep when `optimizeDeps.include` names the specifier. Keeping the four spec
// entries while the override is live would therefore park the injected spec in
// `node_modules/.vite`, whose cache key does not move when the framework
// rebuilds its spec in place — a stale pre-bundle serving yesterday's schema is
// the same silent skew this hook exists to end. Dropping them costs a colder
// dev start and nothing else; `vite build` never reads this list.
const optimizeDepsInclude = specDistInjection
  ? OPTIMIZE_DEPS_INCLUDE.filter((specifier) => !Object.hasOwn(specDistInjection.aliases, specifier))
  : OPTIMIZE_DEPS_INCLUDE;

// An injected spec resolves OUTSIDE node_modules, so the baseline test above
// stops matching it and the biggest vendor surface in the bundle (spec is
// imported by 29 packages here) would scatter into its importers' chunks. The
// injected build should differ from a released one in spec CONTENT, not in
// chunk layout, so the override's location joins the group's test.
const vendorObjectstackTest = specDistInjection
  ? specDistInjection.vendorChunkTest
  : VENDOR_OBJECTSTACK_TEST;

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
    // maplibre-gl loads its worker as a sibling of its own chunk URL — an
    // edge no bundler can see — so the worker (and the shared module it
    // imports) must be copied into assets/ or every map page 404s
    // (objectui#3297). Asserts on drift; never silently skips.
    viteMaplibreWorker(),
    // Dev-only plugin: serve runtime assets (product logo/favicon) from the
    // host project's runtime/assets directory so branding URLs configured
    // via OS_LOGO_URL / OS_FAVICON_URL resolve without a fragile symlink.
    serveRuntimeAssets(),
    // Gzip/Brotli compression & bundle visualizer are skipped on Vercel/CI to
    // reduce memory usage — Vercel's CDN compresses assets automatically.
    ...(!isCI ? [
      // `algorithms` (plural, an array) is the key vite-plugin-compression2
      // declares. The singular `algorithm` used here before was never read: it
      // fell through to the plugin's default, which is BOTH
      // `['gzip', 'brotliCompress']` — so each of these two instances was
      // compressing every asset twice, and the `.gz`/`.br` pair that made the
      // build look correct came from the default, not from these options
      // (objectui#3305).
      compression({
        algorithms: ['gzip'],
        exclude: [/\.(br)$/, /\.(gz)$/],
        threshold: 1024,
      }),
      compression({
        algorithms: ['brotliCompress'],
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
    include: optimizeDepsInclude
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
            { name: 'vendor-objectstack', test: vendorObjectstackTest, priority: 95 },
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
            { name: 'plugin-tree', test: /[\\/]packages[\\/]plugin-tree[\\/]/, priority: 70 },
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
    // Widen the fs allow-list only when an out-of-tree override is set (see
    // OBJECTSTACK_CLIENT_DIST / OBJECTSTACK_SPEC_DIST above); otherwise keep
    // Vite's defaults. Both overrides live outside the workspace root, which
    // Vite's default `fs.allow` serves as a 403 (blank page, no build error).
    ...(clientFsAllow.length || specFsAllow.length
      ? { fs: { allow: [path.resolve(import.meta.dirname, '../..'), ...clientFsAllow, ...specFsAllow] } }
      : {}),
    proxy: {
      '/api': { target: process.env.DEV_PROXY_TARGET || 'http://localhost:3000', changeOrigin: true },
    },
  },
});
