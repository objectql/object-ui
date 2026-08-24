import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFEATED_LAZY_FIELD_WIDGETS,
  diffIneffectiveDynamicImports,
  formatIneffectiveDynamicImportFailure,
  toRepoRelativeModuleId,
} from '../vite-ineffective-dynamic-imports.ts';

/**
 * objectui#5325 — the console build emits 43 true-but-unactionable
 * `INEFFECTIVE_DYNAMIC_IMPORT` warnings. They are pinned to a ledger rather
 * than filtered away, so the signal survives and drift in EITHER direction
 * fails the build.
 *
 * This file tests the policy half. The graph half lives in the plugin's
 * `onLog`/`closeBundle` hooks and is only exercisable by a real console build,
 * exactly as `scripts/check-eager-closure-budget.mjs` splits policy from
 * `emitEagerClosureReport`'s graph walk in `apps/console/vite.config.ts`.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

describe('the ledger itself', () => {
  it('names files that still exist', () => {
    const gone = DEFEATED_LAZY_FIELD_WIDGETS.filter(
      (rel) => !fs.existsSync(path.join(REPO_ROOT, rel)),
    );
    // A stale entry would otherwise surface as a "did not fire" build failure,
    // which is a confusing way to learn that a widget was renamed or deleted.
    expect(gone).toEqual([]);
  });

  it('is sorted and free of duplicates', () => {
    expect([...DEFEATED_LAZY_FIELD_WIDGETS]).toEqual([...DEFEATED_LAZY_FIELD_WIDGETS].sort());
    expect(new Set(DEFEATED_LAZY_FIELD_WIDGETS).size).toBe(DEFEATED_LAZY_FIELD_WIDGETS.length);
  });

  it('holds only `packages/fields` widget modules, as repo-relative POSIX paths', () => {
    for (const rel of DEFEATED_LAZY_FIELD_WIDGETS) {
      expect(rel).toMatch(/^packages\/fields\/src\/widgets\/[A-Za-z]+\.tsx$/);
    }
  });

  it('excludes MarkdownContent — the control widget whose laziness is NOT defeated', () => {
    // It has a working `React.lazy` from `widgets/richTextDisplay.tsx`, is
    // re-exported by nothing, and has no static importer in production code, so
    // it emits no warning. Its ABSENCE here is what makes the ledger a
    // measurement of defeated laziness rather than a list of every widget.
    expect(DEFEATED_LAZY_FIELD_WIDGETS).not.toContain(
      'packages/fields/src/widgets/MarkdownContent.tsx',
    );
    expect(fs.existsSync(path.join(REPO_ROOT, 'packages/fields/src/widgets/MarkdownContent.tsx')))
      .toBe(true);
  });
});

describe('toRepoRelativeModuleId', () => {
  it('makes an in-repo absolute id repo-relative and POSIX', () => {
    const abs = path.join(REPO_ROOT, 'packages/fields/src/widgets/GridField.tsx');
    expect(toRepoRelativeModuleId(abs)).toBe('packages/fields/src/widgets/GridField.tsx');
  });

  it('strips Vite query suffixes and the virtual-module prefix', () => {
    const abs = path.join(REPO_ROOT, 'packages/fields/src/widgets/GridField.tsx');
    expect(toRepoRelativeModuleId(`${abs}?used`)).toBe('packages/fields/src/widgets/GridField.tsx');
    expect(toRepoRelativeModuleId(`\0${abs}`)).toBe('packages/fields/src/widgets/GridField.tsx');
  });

  it('leaves an out-of-repo id alone rather than emitting `../` soup', () => {
    // A `node_modules` id from a pnpm store outside the worktree must never
    // relativise into something that could collide with a ledger entry.
    const outside = path.resolve(REPO_ROOT, '..', 'elsewhere', 'x.js');
    expect(toRepoRelativeModuleId(outside)).toBe(outside.split(path.sep).join('/'));
  });
});

describe('diffIneffectiveDynamicImports', () => {
  const pinned = ['a.tsx', 'b.tsx'];

  it('is clean when the build sees exactly the pinned set', () => {
    expect(diffIneffectiveDynamicImports(['b.tsx', 'a.tsx'], pinned)).toEqual({
      unpinned: [],
      missing: [],
    });
  });

  it('reports a NEW ineffective dynamic import as unpinned', () => {
    expect(diffIneffectiveDynamicImports(['a.tsx', 'b.tsx', 'c.tsx'], pinned).unpinned)
      .toEqual(['c.tsx']);
  });

  it('reports a pinned entry that stopped firing as missing', () => {
    expect(diffIneffectiveDynamicImports(['a.tsx'], pinned).missing).toEqual(['b.tsx']);
  });

  it('reports a build that emitted NOTHING as every entry missing, not as clean', () => {
    // The counter-probe. objectui#5325 recorded a console build that died on 16
    // `MISSING_EXPORT` errors and therefore reported `0` of these warnings — a
    // zero that reads exactly like "fixed" unless a positive sighting is
    // demanded of every pinned entry.
    expect(diffIneffectiveDynamicImports([], pinned)).toEqual({
      unpinned: [],
      missing: ['a.tsx', 'b.tsx'],
    });
  });
});

describe('formatIneffectiveDynamicImportFailure', () => {
  it('names the offending modules and the file to edit, in both directions', () => {
    const text = formatIneffectiveDynamicImportFailure({
      unpinned: ['packages/fields/src/widgets/NewField.tsx'],
      missing: ['packages/fields/src/widgets/OldField.tsx'],
    });
    expect(text).toContain('+ packages/fields/src/widgets/NewField.tsx');
    expect(text).toContain('- packages/fields/src/widgets/OldField.tsx');
    expect(text).toContain('scripts/vite-ineffective-dynamic-imports.ts');
  });

  it('tells the reader to distrust the zero when entries stop firing', () => {
    // The wording is the whole user interface of this gate: a maintainer who
    // reads "did not fire" as "fixed" deletes 43 lines and switches the check
    // off. Pin the sentence that stops that.
    const text = formatIneffectiveDynamicImportFailure({ unpinned: [], missing: ['a.tsx'] });
    expect(text).toContain('distrust is the zero');
  });

  it('says nothing at all when there is no drift', () => {
    expect(formatIneffectiveDynamicImportFailure({ unpinned: [], missing: [] })).toBe('');
  });
});
