/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The `./zod` subpath is built as ONE module, and these are the properties of
 * `packages/types/vite.config.ts` that make that true (objectui#8598).
 *
 * ## Why the config and not the artifact
 *
 * The artifact assertion — "the shipped `dist/zod/index.zod.js` imports no
 * sibling category module" — lives in `zod-subpath-single-module-8598.dist.spec.tsx`,
 * in the `dist` project, because it needs the package BUILT. This file needs
 * nothing built, so it runs in `unit` on every pull request and catches the
 * edits that would break the build face before anyone runs it.
 *
 * ## What each assertion is protecting, in the order the damage gets worse
 *
 *  1. ⛔ `emptyOutDir: false`. `outDir` is inside the project root, so Vite's
 *     DEFAULT is to empty it — and by the time this config runs, `dist/` holds
 *     the 124 files `tsc` just emitted for the whole package. Flipping this
 *     deletes the published package and leaves one bundle behind; the build
 *     still exits 0. This is the assertion this file exists for.
 *  2. The entry is `src/zod/index.zod.ts` and the output lands on
 *     `dist/zod/index.zod.js`. Those two together are what makes this an
 *     IN-PLACE overwrite of one `tsc` output rather than a new published file:
 *     `exports['./zod'].import` already names that path, and
 *     `check:dist-completeness` counts it as one of `tsc`'s expected outputs.
 *     Move either and the package publishes a bundle nobody resolves while the
 *     barrel it was meant to replace ships unchanged — green, and inert.
 *  3. Exactly one format, `es`. A second format would write a second file into
 *     `dist/zod/`, which is not in `tsc`'s expected set and not in `exports`.
 *  4. Bare specifiers stay external. `zod` and `@objectstack/spec` are declared
 *     `dependencies`; inlining either would ship a second copy of zod inside a
 *     types package and break the identity `instanceof` checks a shared zod
 *     gives consumers.
 *
 * ⚠️ The config is IMPORTED, not read as text. A `toContain('emptyOutDir: false')`
 * is satisfied by the string appearing in a comment — which is the exact shape of
 * a setting somebody disabled and explained.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * `defineConfig` passes an object literal straight through, so what is imported
 * below is the config itself. Vite's own `BuildOptions` types every field as
 * optional, which would make each assertion read through a `?.` and pass on
 * `undefined` — so the shape is spelled here as what this config MUST declare.
 */
interface ZodBundleBuild {
  outDir: string;
  emptyOutDir: boolean;
  lib: { entry: string; formats: string[]; fileName: (format: string) => string };
  rollupOptions: { external: (id: string) => boolean };
}

/**
 * ⚠️ The specifier is held in a variable, and that is load-bearing rather than
 * stylistic — the same mechanism `page-header-action-ids.dist.spec.tsx` uses,
 * for a second reason on top of its one.
 *
 * A LITERAL specifier puts `vite.config.ts` into this package's type program:
 * `tsconfig.test.json` compiles every `src/**` test (deliberately — see its
 * header), and an import pulls its target in with it. That config imports
 * `scripts/vitest-invocation-guard.mjs`, which ships no typings anywhere in this
 * repo, so `pnpm --filter @object-ui/types type-check` fails with TS7016 —
 * measured, not predicted. No other package hits it because no other package's
 * checked program has ever imported a `vite.config.ts`.
 *
 * ⛔ The alternatives were weighed and rejected: reading the config as TEXT is
 * the `toContain` weakness this file's header exists to refuse; a
 * `@ts-expect-error` suppresses a real diagnostic; and a repo-wide `.d.mts` for
 * the guard is a change to a file 24 vite configs share, for one test's benefit.
 * TypeScript cannot resolve a non-literal specifier, so the config stays out of
 * the type program while the RUNTIME import — and every assertion below — is
 * exactly as strong as before.
 *
 * ⚠️ ⭐ IMPORTING THE CONFIG RUNS ITS GUARD, and that is worth stating because the
 * same gate went on to break CI. `vite.config.ts` opens with
 * `if (process.env.VITEST) { assertCanonicalVitestInvocation(...) }`, and vitest
 * sets `VITEST`, so the import below EXECUTES that guard. It passes here for one
 * reason only: this file is reached through the canonical root invocation, which
 * is exactly what the guard checks for. ⛔ Run this suite from
 * `packages/types/` and the guard refuses — correctly, and loudly.
 *
 * That is the benign face of the class. Its harmful face is objectui#8598's
 * `Test (shard 2/4)` failure: `VITEST` is inherited by CHILD processes too, so a
 * test that spawns `pnpm --filter PKG run build` handed the same guard a cwd of
 * `packages/PKG` and it killed the build before the bundler started. The repair
 * landed at the spawn (`BUILD_ENV` in `packages/cli/src/__tests__/cli-bin.test.ts`)
 * and is kept there by `scripts/__tests__/spawned-build-vitest-env-8598.test.ts`.
 * ⛔ Not repaired by loosening the gate in this config: that would diverge 1 of 24
 * identical guard blocks, and `scripts/__tests__/vitest-invocation-guard.test.ts`
 * refuses the divergence mechanically.
 */
const CONFIG_SPECIFIER = '../../vite.config.ts';
const viteConfig = ((await import(CONFIG_SPECIFIER)) as { default?: { build?: Partial<ZodBundleBuild> } })
  .default;

const build = (viteConfig?.build ?? {}) as ZodBundleBuild;

describe('objectui#8598 — the `./zod` subpath build config', () => {
  it('reads a real config — an empty object would satisfy every negative below', () => {
    // Non-vacuity. Every assertion in this file is about `build`, so a config
    // that failed to load and left `{}` behind would pass the `toBe(false)` and
    // `toEqual([...])` cases by having nothing to judge.
    expect(Object.keys(build).length).toBeGreaterThan(0);
    expect(build.lib).toBeTruthy();
  });

  it('⛔ never empties the out dir — `dist/` holds the whole published package by then', () => {
    expect(
      build.emptyOutDir,
      '`outDir` is inside the project root, so Vite empties it by DEFAULT. `tsc` has ' +
        'already written all of `dist/` when this build runs, so the default deletes the ' +
        'published package and exits 0.',
    ).toBe(false);
  });

  it('overwrites `dist/zod/index.zod.js` in place, from `src/zod/index.zod.ts`', () => {
    expect(path.resolve(build.lib.entry)).toBe(
      path.join(PACKAGE_DIR, 'src', 'zod', 'index.zod.ts'),
    );
    expect(path.resolve(build.outDir)).toBe(path.join(PACKAGE_DIR, 'dist', 'zod'));
    expect(build.lib.fileName('es')).toBe('index.zod.js');
  });

  it('emits exactly one format, `es`', () => {
    expect(build.lib.formats).toEqual(['es']);
  });

  it('keeps every bare specifier external', () => {
    const { external } = build.rollupOptions;
    // Declared `dependencies` — resolved by the consumer, never inlined.
    expect(external('zod')).toBe(true);
    expect(external('@objectstack/spec')).toBe(true);
    // ...and the package's own sources are the thing being bundled. Both
    // spellings a module graph produces reach this predicate.
    expect(external('./layout.zod.js')).toBe(false);
    expect(external(path.join(PACKAGE_DIR, 'src/zod/layout.zod.ts'))).toBe(false);
  });
});
