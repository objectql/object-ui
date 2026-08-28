import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_CONTENT_PATH,
  DECLARED_LAZY_VIEWS_STILL_EAGER,
  EAGER_WALK_CONTROL,
  bareSideEffectImport,
  diffDeclaredLazyViews,
  formatDeclaredLazyViewFailure,
  parseDeclaredLazyViews,
} from '../vite-declared-lazy-views.ts';

/**
 * objectui#6535 — six of the eight views `AppContent` declares with `lazy()`
 * were in the console's EAGER closure anyway. This file tests the POLICY half:
 * what is parsed out of AppContent, what may honestly be declared
 * side-effect-free, and which direction of ledger drift fails.
 *
 * The GRAPH half — which module ids rolldown actually reports, and whether
 * `moduleSideEffects` is honoured — is only exercisable by a real console
 * build, exactly as `scripts/check-eager-closure-budget.mjs` splits policy from
 * `emitEagerClosureReport`'s walk in `apps/console/vite.config.ts`.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const read = (repoRelative: string) => fs.readFileSync(path.join(REPO_ROOT, repoRelative), 'utf8');

describe('DECLARED_LAZY_VIEWS_STILL_EAGER', () => {
  it('is sorted and free of duplicates', () => {
    const entries = [...DECLARED_LAZY_VIEWS_STILL_EAGER];
    expect(entries).toEqual([...new Set(entries)]);
    expect(entries).toEqual([...entries].sort());
  });

  it('names files that exist', () => {
    // A ledger entry pointing at a deleted module would otherwise fail the
    // build as a `missing` sighting, which is a confusing way to learn a view
    // was renamed.
    for (const entry of DECLARED_LAZY_VIEWS_STILL_EAGER) {
      expect(fs.existsSync(path.join(REPO_ROOT, entry)), entry).toBe(true);
    }
  });

  it('only pins views that AppContent actually declares lazy', () => {
    const declared = parseDeclaredLazyViews(read(APP_CONTENT_PATH));
    for (const entry of DECLARED_LAZY_VIEWS_STILL_EAGER) {
      expect(declared, `${entry} is pinned but no longer declared lazy`).toContain(entry);
    }
  });
});

describe('parseDeclaredLazyViews', () => {
  it('finds the eight route views AppContent declares, resolved to real files', () => {
    const declared = parseDeclaredLazyViews(read(APP_CONTENT_PATH));
    // The count is the measurement objectui#6535 was filed on. It is asserted
    // rather than merely observed because a matcher that silently finds fewer
    // makes every check downstream of it pass vacuously.
    expect(declared).toHaveLength(8);
    for (const view of declared) {
      expect(fs.existsSync(path.join(REPO_ROOT, view)), view).toBe(true);
    }
    expect(declared).toContain('packages/app-shell/src/views/ObjectDataPage.tsx');
    expect(declared).toContain('packages/app-shell/src/views/ComponentNavView.tsx');
  });

  it('ignores the lazy() declarations that are not single-file route views', () => {
    // AppContent also lazily imports a directory barrel, a sibling directory
    // and a package. Sweeping those in would widen the ledger to modules whose
    // eager-closure story nobody has measured.
    const declared = parseDeclaredLazyViews(
      [
        "const A = lazy(() => import('../views/Alpha.js').then(m => ({ default: m.Alpha })));",
        "const B = lazy(() => import('../views/metadata-admin/index.js').then(m => ({ default: m.B })));",
        "const C = lazy(() => import('./marketplace/MarketplacePage.js').then(m => ({ default: m.C })));",
        "const D = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.D })));",
      ].join('\n'),
      (p) => p === 'packages/app-shell/src/views/Alpha.tsx',
    );
    expect(declared).toEqual(['packages/app-shell/src/views/Alpha.tsx']);
  });

  it('resolves the NodeNext .js specifier to the real .tsx file rather than guessing', () => {
    const seen: string[] = [];
    const declared = parseDeclaredLazyViews(
      "const A = lazy(() => import('../views/Alpha.js'));",
      (p) => {
        seen.push(p);
        return p.endsWith('.ts');
      },
    );
    expect(seen).toEqual([
      'packages/app-shell/src/views/Alpha.tsx',
      'packages/app-shell/src/views/Alpha.ts',
    ]);
    expect(declared).toEqual(['packages/app-shell/src/views/Alpha.ts']);
  });

  it('returns nothing when the declarations are re-spelled — the counter-probe case', () => {
    expect(parseDeclaredLazyViews('const A = lazyLoad("../views/Alpha.js");')).toEqual([]);
  });
});

describe('bareSideEffectImport', () => {
  it('catches a bare side-effect import, which makes a purity claim false', () => {
    expect(bareSideEffectImport("import './record-approvals-renderer.js';\n")).toBe(
      "import './record-approvals-renderer.js';",
    );
  });

  it('does not mistake a named or default import for one', () => {
    expect(bareSideEffectImport("import { RecordDetailView } from './x.js';\n")).toBeNull();
    expect(bareSideEffectImport("import React from 'react';\n")).toBeNull();
  });

  it('agrees with the real sources: every unpinned declared view is pure', () => {
    // The plugin declares `moduleSideEffects: false` for exactly the declared
    // views it has NOT pinned, so this is the claim it makes about this repo.
    const pinned = new Set(DECLARED_LAZY_VIEWS_STILL_EAGER);
    const declared = parseDeclaredLazyViews(read(APP_CONTENT_PATH));
    const unpinned = declared.filter((view) => !pinned.has(view));
    expect(unpinned.length).toBeGreaterThan(0);
    for (const view of unpinned) {
      expect(bareSideEffectImport(read(view)), view).toBeNull();
    }
  });

  it('agrees with the real source that RecordDetailView is NOT pure', () => {
    // The positive control for the assertion above: a source that DOES carry
    // one, so a matcher that had stopped matching could not pass both.
    expect(bareSideEffectImport(read('packages/app-shell/src/views/RecordDetailView.tsx'))).toBe(
      "import './record-approvals-renderer.js';",
    );
  });
});

describe('EAGER_WALK_CONTROL', () => {
  it('is a real file that AppContent imports STATICALLY', () => {
    // The plugin's counter-probe 2 asserts this module is eager. That only
    // means anything while AppContent still imports it outside a `lazy()`.
    expect(fs.existsSync(path.join(REPO_ROOT, EAGER_WALK_CONTROL))).toBe(true);
    const appContent = read(APP_CONTENT_PATH);
    expect(appContent).toContain("import { ObjectView } from '../views/ObjectView.js';");
    expect(parseDeclaredLazyViews(appContent)).not.toContain(EAGER_WALK_CONTROL);
  });
});

describe('diffDeclaredLazyViews', () => {
  const pinned = ['packages/app-shell/src/views/RecordDetailView.tsx'];

  it('is clean when the eager set is exactly the ledger', () => {
    const diff = diffDeclaredLazyViews(pinned, pinned);
    expect(diff).toEqual({ unpinned: [], missing: [] });
    expect(formatDeclaredLazyViewFailure(diff)).toBeNull();
  });

  it('reports a NEW eager view as unpinned', () => {
    const diff = diffDeclaredLazyViews([...pinned, 'packages/app-shell/src/views/PageView.tsx'], pinned);
    expect(diff.unpinned).toEqual(['packages/app-shell/src/views/PageView.tsx']);
    expect(diff.missing).toEqual([]);
    expect(formatDeclaredLazyViewFailure(diff)).toContain('views/PageView.tsx');
  });

  it('reports a pinned view that stopped being eager as missing — the counter-probe', () => {
    // The dangerous reading is ZERO. A walk that has gone blind reports no
    // eager views at all, which without this half is indistinguishable from
    // "someone fixed them".
    const diff = diffDeclaredLazyViews([], pinned);
    expect(diff.unpinned).toEqual([]);
    expect(diff.missing).toEqual(pinned);
    const message = formatDeclaredLazyViewFailure(diff);
    expect(message).toContain('NO LONGER in the eager closure');
    expect(message).toContain('gone blind');
  });

  it('defaults to the shipped ledger', () => {
    expect(diffDeclaredLazyViews(DECLARED_LAZY_VIEWS_STILL_EAGER)).toEqual({
      unpinned: [],
      missing: [],
    });
  });
});

describe('formatDeclaredLazyViewFailure', () => {
  it('carries the per-view explanation so the reader does not rebuild the graph by hand', () => {
    const diff = diffDeclaredLazyViews(['packages/app-shell/src/views/PageView.tsx'], []);
    const message = formatDeclaredLazyViewFailure(
      diff,
      new Map([['packages/app-shell/src/views/PageView.tsx', 'in eager chunk `assets/PageView-x.js`']]),
    );
    expect(message).toContain('in eager chunk `assets/PageView-x.js`');
  });

  it('reports both directions of drift at once', () => {
    const message = formatDeclaredLazyViewFailure({
      unpinned: ['packages/app-shell/src/views/PageView.tsx'],
      missing: ['packages/app-shell/src/views/RecordDetailView.tsx'],
    });
    expect(message).toContain('views/PageView.tsx');
    expect(message).toContain('views/RecordDetailView.tsx');
  });
});
