import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared exclude list for the root-level projects below. (Project-level
// `exclude` replaces — does not merge with — the inherited one, so each
// project spells out the full list.)
const sharedExclude = [
  '**/node_modules/**',
  '**/dist/**',
  '**/cypress/**',
  '**/e2e/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/.claude/**',
  // In-repo git worktrees (`.wt-*`, per AGENTS.md / the worktree workflow)
  // are full checkouts of other branches. Without this their *.test.tsx
  // copies get globbed in and run against this tree's source — producing
  // phantom failures from another branch's code.
  '**/.wt-*/**',
  // Apps have their own '@/' alias pointing at their own src/, so they
  // can't share the root '@' alias (→ packages/components). They are
  // brought back in via the `projects` array below with their own
  // vitest.config.ts.
  'apps/**',
];

// `.test.ts` files that need a DOM environment despite the .ts suffix —
// they render hooks via @testing-library or touch window/document directly.
// Everything else in *.test.ts is pure logic and runs in the cheap `unit`
// project. If you add a test that uses renderHook/render/window, either name
// it *.test.tsx or add it here.
const domTsTests = [
  'packages/app-shell/src/hooks/__tests__/useAiSurface.test.ts',
  'packages/app-shell/src/hooks/__tests__/useAiUsage.test.ts',
  'packages/app-shell/src/hooks/__tests__/useReconcileOnError.test.ts',
  'packages/app-shell/src/observability/settleSignal.test.ts',
  'packages/core/src/actions/__tests__/ActionRunner.resultDialog.test.ts',
  'packages/core/src/theme/__tests__/ThemeEngine.test.ts',
  'packages/plugin-grid/src/importParsers.test.ts',
  'packages/fields/src/widgets/useRecordQuery.test.ts',
  'packages/mobile/src/__tests__/useBreakpoint.test.ts',
  'packages/plugin-designer/src/__tests__/useDesignerHistory.test.ts',
  'packages/plugin-grid/src/__tests__/useBulkExecutor.test.ts',
  'packages/react/src/data-invalidation.test.ts',
  'packages/react/src/hooks/__tests__/useActionEngine.test.ts',
  'packages/react/src/hooks/__tests__/useActionRunner.test.ts',
  'packages/react/src/hooks/__tests__/useDataRefresh.test.ts',
  'packages/react/src/hooks/__tests__/useExpression.test.ts',
  'packages/react/src/hooks/__tests__/useRecordSearch.test.ts',
];

// Test files that render through the ComponentRegistry and therefore need the
// heavy `vitest.setup.dom.tsx` (the four side-effect package imports + widget
// re-registrations). They run in the `dom-heavy` project; every other DOM test
// gets the trimmed `vitest.setup.dom-light.tsx` default.
//
// This list was derived empirically: run the whole `dom` project under the
// light setup and every file here is one that failed (e.g. "page:card not
// registered", or an element that never rendered). It is a small minority
// (~20 of ~310 DOM files) — the other ~290 never touch the registry and used
// to pay ~3.3s/file of setup for nothing.
//
// If a NEW test renders a schema / page:* / dashboard / grid widget and fails
// with "<type> not registered", add it here. Misfiling is self-correcting, not
// silent: a heavy test left out of this list lands in the light `dom` project
// and fails loudly in CI (it can never be skipped), so coverage cannot be lost
// — only a red build that points at the fix.
const heavyDomTests = [
  'packages/app-shell/src/console/ai/LiveCanvas.test.tsx',
  'packages/app-shell/src/console/ai/__tests__/ConversationsSidebar.test.tsx',
  'packages/app-shell/src/console/organizations/__tests__/CreateWorkspaceDialog.test.tsx',
  'packages/app-shell/src/hooks/__tests__/useConsoleActionRuntime.test.tsx',
  'packages/app-shell/src/layout/__tests__/AiUsageIndicator.test.tsx',
  'packages/app-shell/src/layout/__tests__/ChatDock.test.tsx',
  'packages/app-shell/src/preview/__tests__/DraftChangesPanel.test.tsx',
  'packages/app-shell/src/preview/__tests__/DraftPreviewBar.test.tsx',
  'packages/app-shell/src/views/metadata-admin/AccessExplainPanel.test.tsx',
  'packages/app-shell/src/views/metadata-admin/AssignedUsersSection.test.tsx',
  'packages/app-shell/src/views/metadata-admin/previews/DatasetPreview.test.tsx',
  'packages/app-shell/src/views/metadata-admin/previews/PagePreview.test.tsx',
  'packages/app-shell/src/views/metadata-admin/previews/ReportPreview.dataset.test.tsx',
  'packages/components/src/__tests__/action-bar.test.tsx',
  'packages/components/src/__tests__/page-card-i18n-title.test.tsx',
  'packages/components/src/__tests__/page-header-actions.test.tsx',
  'packages/components/src/__tests__/page-header-title.test.tsx',
  'packages/plugin-calendar/src/registration.test.tsx',
  'packages/plugin-dashboard/src/__tests__/DashboardRenderer.designMode.test.tsx',
  'packages/plugin-kanban/src/registration.test.tsx',
];

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    testTimeout: 15000, // Increase default timeout for integration tests with MSW
    exclude: sharedExclude,
    // Three root-level projects split by environment cost.
    //
    // - `unit`: pure-logic *.test.ts in node env + vitest.setup.base.ts only.
    // - `dom`: React tests in happy-dom with the LIGHT setup — jsdom polyfills,
    //   jest-dom and RTL cleanup, but none of the @object-ui/components / fields
    //   / plugin-dashboard / plugin-grid graphs.
    // - `dom-heavy`: the ~20 `heavyDomTests` that render through the
    //   ComponentRegistry, with the full `vitest.setup.dom.tsx`.
    //
    // Why the split: with `isolate: true` every setup import re-executes per
    // file. The old single DOM setup pulled the four heavy package graphs into
    // every one of ~300 DOM files (~3.3s/file of setup) even though ~290 never
    // touch the registry — a CI run spent ~20 min cumulative in setup for ~3
    // min of actual tests. Restricting that graph to the files that need it
    // leaves the common case paying only the light setup.
    //
    // (The former `environmentMatchGlobs` split silently stopped working on
    // Vitest 4 — the option was removed — so every file was paying happy-dom
    // + full DOM setup regardless of suffix.)
    //
    // Absolute paths for file entries so the project list resolves the same
    // regardless of the cwd vitest is launched from (`turbo run test` runs
    // each package's `vitest run` from that package's directory).
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          setupFiles: [path.resolve(__dirname, 'vitest.setup.base.ts')],
          include: ['packages/**/*.test.ts', 'examples/**/*.test.ts'],
          exclude: [...sharedExclude, ...domTsTests],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'happy-dom',
          setupFiles: [path.resolve(__dirname, 'vitest.setup.dom-light.tsx')],
          include: [
            'packages/**/*.test.tsx',
            'examples/**/*.test.tsx',
            ...domTsTests,
          ],
          // heavyDomTests render through the registry — they run in `dom-heavy`
          // with the full setup, so keep them out of the light project.
          exclude: [...sharedExclude, ...heavyDomTests],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom-heavy',
          environment: 'happy-dom',
          setupFiles: [path.resolve(__dirname, 'vitest.setup.dom.tsx')],
          include: [...heavyDomTests],
        },
      },
      path.resolve(__dirname, './apps/console/vitest.config.ts'),
    ],
    passWithNoTests: true,
    // Performance: use threads (lighter than forks). Isolation is enabled to
    // prevent module-graph and DOM state leakage across files (which previously
    // caused thousands of order-dependent failures).
    pool: 'threads',
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/index.ts',
        'examples/',
      ],
      // Section 3.6: Testing coverage thresholds
      // Target: 80%+ lines and functions
      // Last adjusted: 2026-05-08 - Lowered after pruning test suite from
      // 394 -> 101 essential files (core protocol/engine + one canonical test
      // per plugin). Integration coverage is now provided by Playwright e2e.
      thresholds: {
        lines: 40,
        functions: 33,
        branches: 30,
        statements: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@object-ui/i18n': path.resolve(__dirname, './packages/i18n/src'),
      '@object-ui/core': path.resolve(__dirname, './packages/core/src'),
      '@object-ui/react-runtime': path.resolve(__dirname, './packages/react-runtime/src'),
      '@object-ui/sdui-parser': path.resolve(__dirname, './packages/sdui-parser/src'),
      '@object-ui/types/zod': path.resolve(__dirname, './packages/types/src/zod/index.zod.ts'),
      '@object-ui/types': path.resolve(__dirname, './packages/types/src'),
      '@object-ui/react': path.resolve(__dirname, './packages/react/src'),
      '@object-ui/protocol': path.resolve(__dirname, './packages/core/src'),
      '@object-ui/engine': path.resolve(__dirname, './packages/engine/src'),
      '@object-ui/renderer': path.resolve(__dirname, './packages/renderer/src'),
      '@object-ui/components': path.resolve(__dirname, './packages/components/src'),
      '@object-ui/providers': path.resolve(__dirname, './packages/providers/src'),
      '@object-ui/fields': path.resolve(__dirname, './packages/fields/src'),
      '@object-ui/plugin-dashboard': path.resolve(__dirname, './packages/plugin-dashboard/src'),
      '@object-ui/plugin-grid': path.resolve(__dirname, './packages/plugin-grid/src'),
      '@object-ui/plugin-kanban': path.resolve(__dirname, './packages/plugin-kanban/src'),
      '@object-ui/plugin-charts': path.resolve(__dirname, './packages/plugin-charts/src'),
      '@object-ui/plugin-list': path.resolve(__dirname, './packages/plugin-list/src'),
      '@object-ui/data-objectstack': path.resolve(__dirname, './packages/data-objectstack/src'),
      '@object-ui/layout': path.resolve(__dirname, './packages/layout/src'),
      '@object-ui/plugin-aggrid': path.resolve(__dirname, './packages/plugin-aggrid/src'),
      '@object-ui/plugin-calendar': path.resolve(__dirname, './packages/plugin-calendar/src'),
      '@object-ui/plugin-chatbot': path.resolve(__dirname, './packages/plugin-chatbot/src'),
      '@object-ui/plugin-detail': path.resolve(__dirname, './packages/plugin-detail/src'),
      '@object-ui/plugin-editor': path.resolve(__dirname, './packages/plugin-editor/src'),
      '@object-ui/plugin-form': path.resolve(__dirname, './packages/plugin-form/src'),
      '@object-ui/plugin-gantt': path.resolve(__dirname, './packages/plugin-gantt/src'),
      '@object-ui/plugin-map': path.resolve(__dirname, './packages/plugin-map/src'),
      '@object-ui/plugin-markdown': path.resolve(__dirname, './packages/plugin-markdown/src'),
      '@object-ui/plugin-timeline': path.resolve(__dirname, './packages/plugin-timeline/src'),
      '@object-ui/plugin-view': path.resolve(__dirname, './packages/plugin-view/src'),
      '@object-ui/plugin-report': path.resolve(__dirname, './packages/plugin-report/src'),
      '@object-ui/plugin-ai': path.resolve(__dirname, './packages/plugin-ai/src'),
      '@object-ui/plugin-designer': path.resolve(__dirname, './packages/plugin-designer/src'),
      '@object-ui/runner': path.resolve(__dirname, './packages/runner/src'),
      '@object-ui/auth': path.resolve(__dirname, './packages/auth/src'),
      '@object-ui/mobile': path.resolve(__dirname, './packages/mobile/src'),
      '@object-ui/permissions': path.resolve(__dirname, './packages/permissions/src'),
      '@object-ui/collaboration': path.resolve(__dirname, './packages/collaboration/src'),
      '@object-ui/app-shell': path.resolve(__dirname, './packages/app-shell/src'),
      '@': path.resolve(__dirname, './packages/components/src'),
      '@object-ui/ui': path.resolve(__dirname, './packages/ui/src'),
    },
  },
});
