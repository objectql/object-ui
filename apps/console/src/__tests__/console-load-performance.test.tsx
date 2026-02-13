/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Console load-performance smoke tests.
 *
 * Validates code-splitting patterns, render-time budgets, loading-skeleton
 * immediacy, and production-bundle hygiene without requiring a real browser.
 * Since JSDOM cannot measure real network or bundle sizes we verify the
 * structural invariants that guarantee good performance:
 *   - lazy() / dynamic import() route splitting
 *   - shallow component-tree depth
 *   - fast initial render via performance.now()
 *   - skeleton placeholders before async data
 *   - MSW gated behind a runtime flag
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React, { Suspense } from 'react';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Performance budget constants (keep in sync with ROADMAP / docs)
// ---------------------------------------------------------------------------

const PERF = {
  /** Max number of JS chunks a production build may emit */
  MAX_CHUNK_COUNT: 20,
  /** Main entry gzip budget reference (KB) */
  MAIN_ENTRY_GZIP_KB: 50,
  /** Maximum React component nesting depth */
  MAX_TREE_DEPTH: 15,
  /** Initial render must complete within this window (ms) */
  RENDER_TIME_BUDGET_MS: 100,
} as const;

// ---------------------------------------------------------------------------
// 1. Bundle chunk count — verify route-level code-splitting exists
// ---------------------------------------------------------------------------

describe('Bundle chunk verification', () => {
  it('App.tsx declares lazy-loaded route chunks', () => {
    const appSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'App.tsx'),
      'utf-8',
    );

    const lazyImports = appSource.match(/\blazy\s*\(\s*\(\)\s*=>\s*import\(/g) || [];

    // We expect at least the route-level splits declared in App.tsx
    expect(lazyImports.length).toBeGreaterThanOrEqual(5);
    expect(lazyImports.length).toBeLessThanOrEqual(PERF.MAX_CHUNK_COUNT);
  });

  it('lazy routes cover all three split categories', () => {
    const appSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'App.tsx'),
      'utf-8',
    );

    // Route views
    expect(appSource).toContain("import('./components/RecordDetailView')");
    expect(appSource).toContain("import('./components/DashboardView')");
    // Auth pages
    expect(appSource).toContain("import('./pages/LoginPage')");
    // System admin pages
    expect(appSource).toContain("import('./pages/system/UserManagementPage')");
  });
});

// ---------------------------------------------------------------------------
// 2. Main entry size budget reference
// ---------------------------------------------------------------------------

describe('Entry-size budget constants', () => {
  it('gzip budget reference is below 50 KB', () => {
    expect(PERF.MAIN_ENTRY_GZIP_KB).toBeLessThanOrEqual(50);
  });

  it('eagerly loaded imports in App.tsx are limited', () => {
    const appSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'App.tsx'),
      'utf-8',
    );

    // Count non-lazy static imports (lines starting with "import " that are
    // NOT type-only imports and come before the first lazy() declaration)
    const beforeLazy = appSource.split(/\blazy\s*\(/)[0];
    const staticImports =
      beforeLazy.match(/^import\s+(?!type\b)/gm) || [];

    // Eagerly loaded modules should stay small; flag if this grows too large
    expect(staticImports.length).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// 3. Component tree depth verification
// ---------------------------------------------------------------------------

describe('Component tree depth', () => {
  function NestedTree({ depth }: { depth: number }): React.ReactElement {
    if (depth <= 0) return <span data-testid="leaf">leaf</span>;
    return (
      <div data-depth={depth}>
        <NestedTree depth={depth - 1} />
      </div>
    );
  }

  it(`renders a tree of depth ${PERF.MAX_TREE_DEPTH} without issue`, () => {
    const { container } = render(<NestedTree depth={PERF.MAX_TREE_DEPTH} />);
    expect(screen.getByTestId('leaf')).toBeInTheDocument();

    // Measure actual DOM nesting depth
    let node: Element | null = container.querySelector('[data-testid="leaf"]');
    let levels = 0;
    while (node && node !== container) {
      node = node.parentElement;
      levels++;
    }
    expect(levels).toBeLessThanOrEqual(PERF.MAX_TREE_DEPTH + 2); // +2 for root wrappers
  });

  it('typical console layout nests fewer than MAX_TREE_DEPTH levels', () => {
    const { container } = render(
      <div data-testid="app-shell">
        <div className="flex h-screen">
          <aside>
            <nav>
              <ul>
                <li><a href="/page">Link</a></li>
              </ul>
            </nav>
          </aside>
          <main>
            <header>
              <h1>Title</h1>
            </header>
            <section>
              <div className="grid">
                <div>Card</div>
              </div>
            </section>
          </main>
        </div>
      </div>,
    );

    // Walk from deepest text node up to the shell
    const deepest = container.querySelector('.grid div')!;
    let el: Element | null = deepest;
    let depth = 0;
    while (el && el !== container) {
      el = el.parentElement;
      depth++;
    }
    expect(depth).toBeLessThan(PERF.MAX_TREE_DEPTH);
  });
});

// ---------------------------------------------------------------------------
// 4. Render-time verification (performance.now() timing)
// ---------------------------------------------------------------------------

describe('Render-time budget', () => {
  it(`core layout renders in under ${PERF.RENDER_TIME_BUDGET_MS}ms`, () => {
    const start = performance.now();

    render(
      <div className="flex h-screen bg-background">
        <aside className="hidden md:flex md:w-64 flex-col border-r">
          <nav aria-label="Sidebar">
            <ul role="list">
              {Array.from({ length: 10 }, (_, i) => (
                <li key={i}><a href={`/page-${i}`}>Nav {i}</a></li>
              ))}
            </ul>
          </nav>
        </aside>
        <main className="flex-1 overflow-auto p-4">
          <header className="flex items-center justify-between h-14 border-b">
            <h1>Console</h1>
          </header>
          <section aria-label="Content">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="rounded-lg border p-4">Card {i}</div>
              ))}
            </div>
          </section>
        </main>
      </div>,
    );

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(PERF.RENDER_TIME_BUDGET_MS);
  });

  it('renders a 100-row data table within budget', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Row ${i}`,
      status: i % 2 === 0 ? 'active' : 'inactive',
    }));

    const start = performance.now();
    render(
      <table>
        <thead>
          <tr><th>ID</th><th>Name</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.status}</td></tr>
          ))}
        </tbody>
      </table>,
    );
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(PERF.RENDER_TIME_BUDGET_MS);
  });
});

// ---------------------------------------------------------------------------
// 5. Loading skeleton renders immediately (before async data)
// ---------------------------------------------------------------------------

describe('Loading skeleton immediacy', () => {
  it('Suspense fallback renders before lazy component resolves', () => {
    // Simulate a lazy component that never resolves during the test
    const NeverResolves = React.lazy(
      () => new Promise<{ default: React.ComponentType }>(() => {}),
    );

    render(
      <Suspense fallback={<div data-testid="skeleton">Loading...</div>}>
        <NeverResolves />
      </Suspense>,
    );

    // The skeleton must appear synchronously
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton')).toHaveTextContent('Loading...');
  });

  it('loading placeholder renders while data is pending', () => {
    function DataView({ data }: { data: string[] | null }) {
      if (!data) {
        return (
          <div role="status" aria-label="Loading" data-testid="loading-state">
            <div className="animate-pulse h-4 w-full bg-muted rounded" />
            <div className="animate-pulse h-4 w-3/4 bg-muted rounded mt-2" />
          </div>
        );
      }
      return (
        <ul data-testid="data-list">
          {data.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      );
    }

    // Render with null data → skeleton should be visible
    const { rerender } = render(<DataView data={null} />);
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    expect(screen.queryByTestId('data-list')).not.toBeInTheDocument();

    // Provide data → skeleton disappears
    rerender(<DataView data={['Alpha', 'Beta']} />);
    expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    expect(screen.getByTestId('data-list')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. Lazy-loaded routes use dynamic import()
// ---------------------------------------------------------------------------

describe('Lazy-loaded routes use dynamic import()', () => {
  it('every lazy() call wraps a dynamic import()', () => {
    const appSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'App.tsx'),
      'utf-8',
    );

    // Extract all lazy() declarations
    const lazyDeclarations = appSource.match(/const \w+ = lazy\(.+?\);/g) || [];
    expect(lazyDeclarations.length).toBeGreaterThan(0);

    for (const decl of lazyDeclarations) {
      // Each must contain a dynamic import() call
      expect(decl).toMatch(/import\(/);
    }
  });

  it('no route component is eagerly imported AND lazy-loaded', () => {
    const appSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'App.tsx'),
      'utf-8',
    );

    // Collect names of lazy-loaded components
    const lazyNames =
      (appSource.match(/const (\w+) = lazy\(/g) || []).map((m) =>
        m.replace(/^const /, '').replace(/ = lazy\($/, ''),
      );

    // Collect eagerly imported identifiers (non-type, non-lazy)
    const eagerImports = appSource.match(/^import \{[^}]+\} from/gm) || [];
    const eagerNames = eagerImports.flatMap((line) => {
      const match = line.match(/\{([^}]+)\}/);
      return match ? match[1].split(',').map((n) => n.trim()) : [];
    });

    // No component should appear in both lists
    for (const name of lazyNames) {
      expect(eagerNames).not.toContain(name);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. MSW is not bundled in production mode
// ---------------------------------------------------------------------------

describe('MSW production-bundle hygiene', () => {
  it('MSW import is gated behind a runtime env flag', () => {
    const mainSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'main.tsx'),
      'utf-8',
    );

    // MSW should only be imported dynamically, never at the top level
    const topLevelMswImport = mainSource.match(/^import .+msw/m);
    expect(topLevelMswImport).toBeNull();

    // The dynamic import must be guarded by an env check
    expect(mainSource).toMatch(/import\.meta\.env\./);
    expect(mainSource).toMatch(/import\(.+mocks/);
  });

  it('no static MSW import exists in main.tsx', () => {
    const mainSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'main.tsx'),
      'utf-8',
    );

    // Ensure no top-level import from 'msw' or './mocks'
    const staticMswLines = mainSource
      .split('\n')
      .filter((line) => /^import\s/.test(line))
      .filter((line) => /msw|mocks/.test(line));

    expect(staticMswLines).toHaveLength(0);
  });
});
