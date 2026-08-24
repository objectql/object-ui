// `defineConfig` comes from `vitest/config`, not `vite` — this file carries a
// `test` block (consumed by `vitest.config.ts`, which merges this config), and
// `vite`'s own `UserConfigExport` has no `test` property. Importing it from
// `vite` left that whole block unchecked (objectui#3305).
import { defineConfig } from 'vitest/config';
import type { Plugin, Rollup } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import zlib from 'node:zlib';
// Relative specifiers carry their real file extension, and `__dirname` is
// spelled `import.meta.dirname` throughout this file, so the config stays
// loadable by Vite's `configLoader: 'native'` — which imports this file with
// Node's own ESM loader. Node does no extension guessing and defines no
// `__dirname` in ESM, so the pre-Vite-8 spellings would fail outright the day
// `native` becomes the default loader (objectui#3384).
import { viteCryptoStub } from '../../scripts/vite-crypto-stub.ts';
import { viteMaplibreWorker } from '../../scripts/vite-maplibre-worker.ts';
import { resolveSpecDistInjection } from '../../scripts/vite-objectstack-spec-dist.ts';
import { viteIneffectiveDynamicImports } from '../../scripts/vite-ineffective-dynamic-imports.ts';
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
 * Build-time guard: `@objectstack/lint` must stay OUT of the eager closure.
 *
 * `packages/app-shell/src/preview/capabilityLint.ts` reaches the linter through
 * a deliberate `await import('@objectstack/lint')` — it runs only when an
 * author publishes in the metadata designer. That laziness is worth ~89 KiB
 * gzipped on every console page load, and it is defeated silently: an
 * `advancedChunks` group whose `test` matches the linter overrides the
 * module's async-only reachability and folds it in beside the synchronously
 * reached `@objectstack/spec`, whose chunk the entry imports STATICALLY
 * (objectui#5266). Nothing about the source changes, no warning is emitted,
 * and the existing bundle budget cannot see it — that budget weighs the
 * `index-*.js` entry chunk alone, and these bytes land in a vendor chunk.
 *
 * So the invariant is asserted where it is decided, on the emitted graph, in
 * the spirit of `viteMaplibreWorker` above: a regression must fail the BUILD
 * rather than ship an extra half-megabyte only a profiler would find.
 *
 * The check is deliberately two-part. Asserting "no eager chunk holds the
 * linter" alone would also pass if the walk found nothing at all — a green
 * check with no subject. The counter-probe runs first and demands a KNOWN
 * eager `@objectstack/spec`, so the linter verdict is only ever read after the
 * closure walk has proven it can see the very chunk the linter used to hide in.
 *
 * That makes both module-id tests SUBJECTS of the check, not decoration, and
 * neither may be hardcoded here. `OBJECTSTACK_SPEC_DIST` rewrites all 18
 * `@objectstack/spec` specifiers to absolute paths in the overriding tree —
 * `/…/objectstack/packages/spec/dist/…/index.mjs`, ids with no
 * `@objectstack` segment at all — so a private `/@objectstack[\\/+]spec/`
 * matched zero modules, this counter-probe correctly refused a verdict, and it
 * took every injected build down with it (objectui#5388; measured from the
 * consumer side in objectstack#10136, where it blocked the framework's Console
 * Pin Gate). The spec test is therefore a PARAMETER, fed from the same
 * `resolveSpecDistInjection` output the `vendor-objectstack` group already
 * reads: one producer, both consumers, no second opinion about where the spec
 * lives.
 *
 * `LINT` stays literal — nothing injects `@objectstack/lint` today — but it gets
 * its own counter-probe for the same reason, because its failure mode is the
 * worse one. The spec test going blind fails LOUD (this build stops). The lint
 * test going blind fails SILENT: the assertion below is negative, so zero
 * matches reads exactly like a clean bundle and the guard is green forever.
 * objectstack#9659 proposes injecting four more `@objectstack/*` packages the
 * same way and lint is a plausible member; if it ever joins, this build says so
 * instead of quietly ceasing to guard anything.
 */
function assertLazyLinterStaysLazy(specTest: RegExp): Plugin {
  const LINT = /@objectstack[\\/+]lint/;

  return {
    name: 'assert-lazy-linter-stays-lazy',
    generateBundle(_options, bundle) {
      const chunks = new Map<string, Rollup.OutputChunk>();
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'chunk') chunks.set(fileName, output);
      }

      // The eager closure: every chunk reachable from an entry chunk through
      // STATIC imports only. `dynamicImports` is deliberately not followed —
      // that edge is precisely the boundary the linter is meant to sit behind.
      const eager = new Set<string>();
      const queue = [...chunks.values()].filter((c) => c.isEntry).map((c) => c.fileName);
      while (queue.length > 0) {
        const fileName = queue.pop() as string;
        if (eager.has(fileName)) continue;
        eager.add(fileName);
        for (const imported of chunks.get(fileName)?.imports ?? []) {
          if (!eager.has(imported)) queue.push(imported);
        }
      }

      const chunksHolding = (test: RegExp): string[] =>
        [...chunks.values()]
          .filter((chunk) => Object.keys(chunk.modules).some((id) => test.test(id)))
          .map((chunk) => chunk.fileName);

      const eagerSpec = chunksHolding(specTest).filter((fileName) => eager.has(fileName));
      if (eagerSpec.length === 0) {
        this.error(
          `[assert-lazy-linter-stays-lazy] counter-probe failed: no eagerly loaded chunk ` +
            `contains an \`@objectstack/spec\` module. The spec is reached synchronously ` +
            `from the app entry, so it must be in the eager closure — its absence means ` +
            `this walk is reading the graph wrongly, not that the bundle improved. ` +
            `Fix the walk before trusting the linter assertion below. ` +
            `If \`OBJECTSTACK_SPEC_DIST\` is set, check that this test carries the ` +
            `override's location: an injected spec resolves outside node_modules and the ` +
            `baseline test cannot see it (objectui#5388). ` +
            `(spec test: ${specTest}; ` +
            `entry chunks: ${[...chunks.values()].filter((c) => c.isEntry).map((c) => c.fileName).join(', ') || 'NONE'}; ` +
            `eager chunks: ${eager.size}/${chunks.size})`,
        );
      }

      // The same refusal-to-guess, for the linter half — and it is needed MORE
      // here, not less. The assertion below is a NEGATIVE one, so a `LINT` that
      // has stopped matching the emitted ids is indistinguishable from a bundle
      // that keeps the linter properly lazy: the guard just goes green and stays
      // green. The linter is always in this bundle somewhere (app-shell's
      // `capabilityLint.ts` `await import`s it), so zero matches ANYWHERE —
      // eager or lazy — is a statement about this regex, never about the graph.
      const lintChunks = chunksHolding(LINT);
      if (lintChunks.length === 0) {
        this.error(
          `[assert-lazy-linter-stays-lazy] counter-probe failed: no chunk at all — eager or ` +
            `lazy — contains an \`@objectstack/lint\` module, so \`${LINT}\` matches nothing in ` +
            `this bundle and the assertion below can no longer fail. Two ways to get here. ` +
            `Either the lazy import in app-shell's \`capabilityLint.ts\` is gone, in which case ` +
            `retire this plugin deliberately rather than leaving a guard with no subject; or ` +
            `the linter's module ids changed shape — e.g. \`@objectstack/lint\` joined the ` +
            `\`OBJECTSTACK_SPEC_DIST\`-style injection proposed in objectstack#9659, which ` +
            `rewrites specifiers to absolute paths with no \`@objectstack\` segment. In that ` +
            `case give this test the injection's location, exactly as the spec test above is ` +
            `already parameterised (objectui#5388). (chunks: ${chunks.size})`,
        );
      }

      const eagerLint = lintChunks.filter((fileName) => eager.has(fileName));
      if (eagerLint.length > 0) {
        this.error(
          `[assert-lazy-linter-stays-lazy] \`@objectstack/lint\` is in the EAGER closure ` +
            `(${eagerLint.join(', ')}), so every console page load pays for it — ~89 KiB ` +
            `gzipped, measured in objectui#5266.\n\n` +
            `The linter is imported lazily on purpose (app-shell's capabilityLint.ts). It ` +
            `becomes eager when an \`advancedChunks\` group claims it, which overrides that ` +
            `laziness. Check \`VENDOR_OBJECTSTACK_TEST\`: under pnpm the module id is\n` +
            `  .../node_modules/.pnpm/@objectstack+lint@<v>/node_modules/@objectstack/lint/dist/index.js\n` +
            `— it matches BOTH of that regex's alternatives, so BOTH need the negative ` +
            `lookahead. Guarding one alternative alone leaves the other matching and looks ` +
            `like a fix while changing nothing.\n\n` +
            `Do NOT "fix" this by switching the import to \`@objectstack/lint/runtime\` — that ` +
            `subpath reaches 70 of the 72 modules the main entry does, is 93.6% of its size, ` +
            `and does not export \`validateCapabilityReferences\` at all (objectstack#9772).`,
        );
      }
    },
  };
}

/**
 * Emits the eager-closure size report the console performance budget weighs.
 *
 * The budget in `.github/workflows/performance-budget.yml` used to gzip one
 * file — the `index-*.js` entry chunk — and call the result "the console
 * performance budget". Measured on `77f846a8b` that chunk is 25.3 KB gzipped
 * against a 350 KB line, while the closure the browser must fetch and parse
 * before the app renders is 3,791 KB across 58 chunks. The gate therefore
 * passed on 0.67% of the payload it claimed to govern, and the 89 KiB
 * regression of objectui#5266 landed in `vendor-objectstack-*.js` where it was
 * structurally invisible (objectui#5324).
 *
 * What the page pays for is the EAGER CLOSURE: every chunk reachable from an
 * entry chunk through STATIC imports only. `dynamicImports` is deliberately not
 * followed — that edge is the lazy boundary, and following it would turn this
 * number into "the whole bundle", which no page load pays.
 *
 * This plugin only MEASURES. The ceiling and the verdict live in
 * `scripts/check-eager-closure-budget.mjs`, which the workflow runs against the
 * report written here. The split is deliberate: a size ceiling that fails
 * `vite build` would also fail every Vercel preview deploy and every local
 * build, which is how a budget gets switched off. The graph knowledge stays
 * here, where rolldown's own `chunk.imports` is authoritative; the policy stays
 * in a file with unit tests.
 *
 * The report is written INTO `dist` on purpose. A report that outlives its
 * build is worse than no report — `rm -rf dist` followed by a stale read is a
 * verdict about a bundle that no longer exists. Living in the output directory
 * makes the report and the bundle the same artifact. It carries only chunk file
 * names and byte counts, all of which are already observable in the deployed
 * bundle itself.
 *
 * Both counter-probes below refuse a verdict rather than report a number that
 * happens to be small, in the spirit of `assertLazyLinterStaysLazy` above:
 * an under-counting walk is the dangerous direction, because the budget's
 * failure mode is silent — a closure walk that finds nothing reads exactly like
 * a bundle that got smaller.
 */
function emitEagerClosureReport(reportFileName = 'eager-closure.json'): Plugin {
  // React is reached synchronously from the entry — nothing in the console
  // renders without it — and `advancedChunks` routes it to its own
  // `vendor-react` chunk, so it is a KNOWN member of the eager closure that is
  // NOT the entry chunk. If the walk cannot see it, the walk is wrong.
  const EAGER_COUNTER_PROBE = /[\\/]node_modules[\\/]react-dom[\\/]/;

  return {
    name: 'emit-eager-closure-report',
    writeBundle(options, bundle) {
      const outDir = options.dir ?? path.resolve(import.meta.dirname, 'dist');

      const chunks = new Map<string, Rollup.OutputChunk>();
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'chunk') chunks.set(fileName, output);
      }

      const entries = [...chunks.values()].filter((c) => c.isEntry).map((c) => c.fileName);
      const eager = new Set<string>();
      const queue = [...entries];
      while (queue.length > 0) {
        const fileName = queue.pop() as string;
        if (eager.has(fileName)) continue;
        eager.add(fileName);
        for (const imported of chunks.get(fileName)?.imports ?? []) {
          if (!eager.has(imported)) queue.push(imported);
        }
      }

      // Counter-probe 1 — the walk must SEE something known to be eager.
      // Asserting only "the total is under the ceiling" would also pass on a
      // walk that returned the entry chunk alone, which is the very gauge this
      // report replaces.
      const probeChunks = [...chunks.values()]
        .filter((chunk) => Object.keys(chunk.modules).some((id) => EAGER_COUNTER_PROBE.test(id)))
        .map((chunk) => chunk.fileName);
      const eagerProbe = probeChunks.filter((fileName) => eager.has(fileName));
      if (eagerProbe.length === 0) {
        this.error(
          `[emit-eager-closure-report] counter-probe failed: no eagerly loaded chunk contains ` +
            `a \`react-dom\` module. React is reached synchronously from the app entry, so it ` +
            `must be in the eager closure — its absence means this walk is reading the graph ` +
            `wrongly, not that the bundle improved. Fix the walk before trusting the size ` +
            `below; a walk that finds too little produces a SMALL number, and a budget check ` +
            `reads a small number as good news. ` +
            `(probe: ${EAGER_COUNTER_PROBE}; chunks holding it: ${probeChunks.join(', ') || 'NONE'}; ` +
            `entry chunks: ${entries.join(', ') || 'NONE'}; eager: ${eager.size}/${chunks.size})`,
        );
      }

      // Counter-probe 2 — the other direction. If EVERY chunk is eager then
      // either this bundle has no lazy boundary at all or the walk is following
      // dynamic edges; in both cases the number is not "what a page load costs"
      // and must not be published under that name.
      if (eager.size === chunks.size) {
        this.error(
          `[emit-eager-closure-report] counter-probe failed: every one of the ${chunks.size} ` +
            `chunks is in the eager closure, so this walk is not distinguishing static from ` +
            `dynamic imports. Either \`imports\` has stopped excluding \`dynamicImports\`, or ` +
            `the console genuinely has no lazy boundary left — check which before reading the ` +
            `size as a page-load cost. (entry chunks: ${entries.join(', ') || 'NONE'})`,
        );
      }

      const files = [...eager].sort().map((fileName) => {
        const filePath = path.join(outDir, fileName);

        // A closure member with no file on disk is not a missing build output —
        // it is an UNRESOLVED BARE IMPORT that the walk above swept in. Rolldown
        // lists a chunk's EXTERNAL imports in `chunk.imports` beside the file
        // names of real chunks, and the walk follows that array without asking
        // whether the name is in `chunks`, so a specifier vite could not resolve
        // joins `eager` under its own name and is then read as a path. Left
        // unguarded that is a bare `ENOENT` from `node:fs`, several frames from
        // the cause and naming neither this plugin nor the import (objectui#5996).
        if (!fs.existsSync(filePath)) {
          const importers = [...chunks.values()]
            .filter((chunk) => (chunk.imports ?? []).includes(fileName))
            .map((chunk) => chunk.fileName);
          this.error(
            `[emit-eager-closure-report] eager-closure member \`${fileName}\` has no file in ` +
              `\`${outDir}\`, so its bytes cannot be weighed. It is almost certainly an ` +
              `UNRESOLVED BARE IMPORT, not a missing build output: rolldown lists a chunk's ` +
              `EXTERNAL imports in \`chunk.imports\` beside the file names of real chunks, and ` +
              `the walk above follows that array, so a specifier vite could not resolve enters ` +
              `the closure under its own name and is then read as a path. The name is the tell — ` +
              `a real chunk here is \`assets/<name>-<hash>.js\`, and this one is not a key of the ` +
              `output bundle map at all. (imported by: ${importers.join(', ') || 'NONE'}) ` +
              `Fix the import rather than skipping the member here: a bare specifier the browser ` +
              `cannot load is a broken bundle, not a measurement gap, and dropping it from the ` +
              `walk would make this report under-count — the one direction the counter-probes ` +
              `above exist to refuse. The known source is an out-of-tree override whose own ` +
              `dependencies do not resolve from where it lives: check \`OBJECTSTACK_CLIENT_DIST\` ` +
              `and \`OBJECTSTACK_SPEC_DIST\`, and vite's own "could not be resolved" warnings ` +
              `earlier in this build.`,
          );
        }

        const raw = fs.readFileSync(filePath);
        // Level 6 — zlib's default, and the level `gzip -c` uses in the
        // workflow's entry-chunk check, so the two numbers in one PR comment
        // are measured the same way.
        return { fileName, bytes: raw.length, gzipBytes: zlib.gzipSync(raw).length };
      });

      const report = {
        // Bumped when the shape below changes; the checker refuses a report it
        // does not understand rather than reading absent fields as zero.
        reportVersion: 1,
        entryChunks: entries.sort(),
        eagerChunkCount: files.length,
        totalChunkCount: chunks.size,
        eagerGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
        eagerRawBytes: files.reduce((n, f) => n + f.bytes, 0),
        files,
      };

      fs.writeFileSync(path.join(outDir, reportFileName), `${JSON.stringify(report, null, 2)}\n`);
      const kb = (report.eagerGzipBytes / 1024).toFixed(1);
      this.info(
        `eager closure: ${report.eagerChunkCount}/${report.totalChunkCount} chunks, ` +
          `${report.eagerGzipBytes} bytes gzipped (${kb} KB) → ${reportFileName}`,
      );
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
//
// `@objectstack/lint` is excluded. It is reached from exactly one place —
// `packages/app-shell/src/preview/capabilityLint.ts`, through a deliberate
// `await import('@objectstack/lint')` that runs only when an author publishes
// in the metadata designer. Without the exclusion this group overrides that
// async-only reachability and folds the linter in beside `@objectstack/spec`
// and `@objectstack/client`, which the app entry reaches synchronously — so
// the group's chunk is a STATIC import of the entry and every console page
// load downloads and parses the whole linter (objectui#5266).
//
// BOTH alternatives need the guard, and that is not redundancy: under pnpm a
// dependency resolves through the store, so the module's id is
//   .../node_modules/.pnpm/@objectstack+lint@<v>/node_modules/@objectstack/lint/dist/index.js
// — one path containing BOTH `/@objectstack+` and `/node_modules/@objectstack/`.
// Guarding either alternative alone leaves the other one matching, and the
// linter stays in the eager chunk with no visible symptom.
//
// The lookaheads are deliberately tight: `lint[\\/]` and `lint@` match the
// `lint` package only, so a future `@objectstack/lint-*` sibling still groups
// here rather than silently scattering into its importers' chunks.
const VENDOR_OBJECTSTACK_TEST =
  /([\\/]node_modules[\\/]@objectstack[\\/](?!lint[\\/])|[\\/]@objectstack\+(?!lint@))/;

// "This module id IS `@objectstack/spec`" — the subject of the counter-probe in
// `assertLazyLinterStaysLazy` above, kept separate from the group test on
// purpose. `VENDOR_OBJECTSTACK_TEST` is the whole vendor scope minus the linter,
// so an eager `@objectstack/client` would satisfy it without proving the walk
// can see the SPEC chunk the counter-probe exists to find — reusing it there
// would keep the build green by lowering the bar, which is the one outcome
// objectui#5388 must not produce. Both spellings are covered: a plain install
// (`/node_modules/@objectstack/spec/…`) and pnpm's store (`/@objectstack+spec@…`).
const SPEC_MODULE_TEST = /@objectstack[\\/+]spec/;

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
  specModuleTest: SPEC_MODULE_TEST,
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

// The chunk grouping is not the only consumer of "where does the spec live".
// `assertLazyLinterStaysLazy`'s counter-probe asks the same question about the
// emitted module ids, and it used to answer it from a private regex that the
// injection made unmatchable — so every build with the override set died on a
// counter-probe that was right about what it saw (objectui#5388). It reads the
// override's location here, from the same producer, for the same reason.
const specModuleTest = specDistInjection
  ? specDistInjection.specModuleTest
  : SPEC_MODULE_TEST;

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
    // Fails the build if the lazily-imported linter is folded back into an
    // eagerly-loaded chunk. Runs on CI/Vercel too — it costs microseconds and
    // the regression it catches is invisible in every other signal.
    assertLazyLinterStaysLazy(specModuleTest),
    // Writes `dist/eager-closure.json` — the size of everything a page load
    // pays for before the app renders. `.github/workflows/performance-budget.yml`
    // weighs THAT against the budget; weighing the entry chunk alone measured
    // 0.67% of it (objectui#5324). Measurement only: the verdict is the
    // workflow's, so a size regression never blocks a preview deploy.
    emitEagerClosureReport(),
    // Rolldown's `INEFFECTIVE_DYNAMIC_IMPORT` warnings, pinned to a ledger
    // instead of scrolling past 43 at a time (objectui#5325). The pinned ones
    // are replaced by one summary line; an UNPINNED one keeps rolldown's own
    // warning text AND fails the build, and so does a pinned one that stops
    // firing — the counter-probe, because a build that dies before chunk
    // assignment reports zero of these and that reads exactly like "fixed".
    viteIneffectiveDynamicImports(),
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
