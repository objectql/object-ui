/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Retirement pin, STAGE 1 of 2 — `PluginComponentInput` is deprecated, not yet
 * removed (objectui#5674; maintainer ruling 2026-08-22: deprecate for a
 * release, then delete).
 *
 * ## What is being retired, and why it needed a window
 *
 * `index.ts` publishes `ComponentInput as PluginComponentInput`. Before
 * objectui#4972 that alias pointed at a genuinely different declaration —
 * `plugin-scope.ts` restated its own nine-key `ComponentInput`. objectui#5671
 * converged that onto `base.ts`, so the alias became a second published name
 * for the SAME type, carrying no information the first does not.
 *
 * In-repo the name has zero importers (measured across every root, with a
 * control — see the PR body). The claim that could NOT be measured from here is
 * the one that licenses deleting an export from a PUBLISHED package: whether
 * anything outside this repository imports it. The deprecation window IS the
 * answer to that unmeasurable half — it turns a silent break into a warned one.
 * That is why this stage adds a tag and removes nothing.
 *
 * ## What this test pins, and what it deliberately does not
 *
 * Two things, because a deprecation has two failure modes and they are
 * opposite:
 *
 *   1. the tag is PRESENT and names the replacement — otherwise the window is
 *      cosmetic, consumers get no warning, and stage 2 deletes with no notice
 *      given;
 *   2. the export is STILL THERE and still the same type — otherwise stage 1
 *      quietly became stage 2, which is exactly the irreversible step the
 *      ruling declined to take yet.
 *
 * A test asserting only (1) would pass on a tree where the alias had been
 * deleted outright; a test asserting only (2) would pass on a tree where the
 * tag never shipped. Both are needed to pin "deprecated, not removed".
 *
 * ## Why this reads SOURCE TEXT rather than `dist/`
 *
 * Same constraint `package-exports-manifest.test.ts` records: this repo's
 * per-PR `test` job runs `pnpm test` with NO build of the package under test
 * ahead of it (turbo's `test` task `dependsOn: ["^build"]` — the DEPENDENCY
 * closure, never the package's own build). A test requiring a fresh `dist/`
 * would be vacuously absent-or-red on a cold cache, not a signal.
 *
 * The artifact-level fact — that a JSDoc block on an export SPECIFIER survives
 * `tsc`'s declaration emit and lands attached to that specifier in
 * `dist/index.d.ts` — is not assumed here. It was measured for this change (a
 * probe tag was injected, built, and located in the emitted `.d.ts`; the
 * before/after emit is quoted in the PR body). It is a property of the
 * compiler, not of this repo, so it is not re-derived on every CI run.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type { ComponentInput, PluginComponentInput } from '../index.js';

const INDEX_SRC = readFileSync(
  fileURLToPath(new URL('../index.ts', import.meta.url)),
  'utf8',
);

/** The published alias specifier, exactly as `index.ts` spells it. */
const SPECIFIER = 'ComponentInput as PluginComponentInput,';

/**
 * The JSDoc block immediately preceding the alias specifier, or `null` when the
 * specifier is not preceded by one. Deliberately anchored to the specifier
 * rather than searching the file for `@deprecated`: this package has many
 * unrelated deprecations, and a file-wide search would go green on any of them.
 */
function docBlockBefore(specifier: string): string | null {
  const at = INDEX_SRC.indexOf(specifier);
  if (at === -1) return null;
  const before = INDEX_SRC.slice(0, at);
  const close = before.lastIndexOf('*/');
  // Only whitespace may sit between the block and the specifier, otherwise the
  // block belongs to some earlier specifier and says nothing about this one.
  if (close === -1 || before.slice(close + 2).trim() !== '') return null;
  const open = before.lastIndexOf('/**', close);
  if (open === -1) return null;
  return before.slice(open, close + 2);
}

describe('PluginComponentInput — stage 1: the deprecation is real and reaches consumers', () => {
  it('is still published (deprecating is not deleting)', () => {
    expect(INDEX_SRC).toContain(SPECIFIER);
  });

  it('carries a JSDoc block attached to the alias specifier itself', () => {
    expect(docBlockBefore(SPECIFIER)).not.toBeNull();
  });

  it('tags that block `@deprecated`', () => {
    expect(docBlockBefore(SPECIFIER)).toContain('@deprecated');
  });

  it('names the replacement, so the warning is actionable', () => {
    // A bare `@deprecated` tells a consumer to stop, not what to do instead.
    expect(docBlockBefore(SPECIFIER)).toMatch(/`ComponentInput`/);
  });

  it('does not deprecate its neighbours in the same export block', () => {
    // Control: the tag must be attached to ONE specifier. If a future edit
    // widened the block comment to cover the whole `export type { ... }` group,
    // every plugin-scope name would silently read as deprecated.
    expect(docBlockBefore('PluginEventHandler,')).toBeNull();
    expect(docBlockBefore('AppMetadataPlugin,')).toBeNull();
  });
});

describe('PluginComponentInput — stage 1: the type is unchanged', () => {
  it('is still mutually assignable with ComponentInput', () => {
    // Type-level, and real enforcement: `tsconfig.test.json` is chained from
    // this package's `type-check` script, so these two conditionals are
    // compiled. If the alias stopped naming `ComponentInput` — or stopped
    // being exported at all — this stops compiling.
    const bothWays: [
      PluginComponentInput extends ComponentInput ? true : false,
      ComponentInput extends PluginComponentInput ? true : false,
    ] = [true, true];

    expect(bothWays).toEqual([true, true]);
  });
});
