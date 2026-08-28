/**
 * Pins `@object-ui/types`' `package.json` `exports` map to the shape its
 * bare-`tsc` build can actually produce (objectui#4896).
 *
 * ## The defect this guards against
 *
 * The shipped `exports["."].require` condition used to point at
 * `dist/index.cjs` — a file the package's `"build": "tsc"` script structurally
 * never emits (`tsc` alone writes `.js` + `.d.ts`, never `.cjs`; a second
 * output format needs a bundler or an explicit dual-emit step, and this
 * package has neither). Any CJS consumer resolving the `require` condition
 * therefore hit `MODULE_NOT_FOUND` against a published tarball that declared
 * an entry point it never shipped.
 *
 * Measured directly against a clean rebuild before this fix (`rm -rf dist
 * tsconfig.tsbuildinfo && tsc`): zero `.cjs` files under `dist/`, and
 * `require.resolve('.../packages/types/dist/index.cjs')` throws
 * `MODULE_NOT_FOUND`. The package declares `"type": "module"` and is
 * types-first (no bundler in its build), so ESM-only — dropping the dead
 * `require` condition rather than adding a second build format — is the
 * contract-honest fix; see the PR body for the full premise verification
 * (nothing in-repo `require()`s this package, and the one in-repo CJS-format
 * bundle consumer, `packages/vscode-extension` via `tsup --format cjs` with
 * `noExternal: ['@object-ui/types', ...]`, builds byte-identically with the
 * condition present or absent — it resolves the value imports it re-exports
 * via the `import` condition regardless of its own output format).
 *
 * ## What this test is, and is not
 *
 * This is a MANIFEST-level pin — it reads `package.json` as text and asserts
 * on its shape. It does NOT build the package or inspect `dist/`: this
 * repo's per-PR `test` job (`ci.yml`) runs `pnpm test` with no build step
 * ahead of it (turbo's `test` task only `dependsOn: ["^build"]` — the
 * DEPENDENCY closure, never the package's own build — see
 * `scripts/check-package-self-import.mjs`'s header for the same trap hitting
 * a different gate), so a test that required a fresh `dist/` to exist would
 * be vacuously absent-or-red on a cold CI cache, not a meaningful signal.
 * The artifact-level claim (a clean `tsc` build never emits `.cjs`) was
 * verified by hand for this fix and is not expected to regress silently: the
 * package's `"build": "tsc"` script and lack of any bundler/dual-emit step
 * are exactly the two other things this test pins, so a future edit that
 * reintroduces a `require` condition without ALSO reintroducing the emit step
 * would still need to touch this file's expectations to pass CI.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const pkg = JSON.parse(
  readFileSync(require.resolve('../../package.json'), 'utf8'),
) as {
  type?: string;
  scripts?: Record<string, string>;
  exports?: Record<string, Record<string, string> | string>;
};

describe('@object-ui/types package.json exports map (objectui#4896)', () => {
  it('declares "type": "module" — the premise for an ESM-only exports map', () => {
    expect(pkg.type).toBe('module');
  });

  it('builds with bare tsc — no bundler that could emit a second (CJS) format', () => {
    // If this ever changes to a bundler/dual-emit build, the `require`-less
    // exports map below should be revisited rather than assumed to still be
    // correct.
    expect(pkg.scripts?.build).toBe('tsc');
  });

  it('the root "." export carries exactly {types, import} — no "require" condition', () => {
    const rootExport = pkg.exports?.['.'];
    expect(rootExport).toEqual({
      types: './dist/index.d.ts',
      import: './dist/index.js',
    });
  });

  it('no export condition anywhere in the map points at a bare-tsc build never emits (*.cjs)', () => {
    const offenders: string[] = [];
    for (const [subpath, conditions] of Object.entries(pkg.exports ?? {})) {
      if (typeof conditions === 'string') continue;
      for (const [condition, target] of Object.entries(conditions)) {
        if (typeof target === 'string' && target.endsWith('.cjs')) {
          offenders.push(`${subpath} -> ${condition}: ${target}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
