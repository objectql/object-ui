/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `src/index.css` must not scan this package's own TEST files — objectui#8446.
 *
 * ## What was wrong
 *
 * Tailwind v4 scans source TEXT, not an import graph. `src/index.css` declared
 * `@source '../src/**' + '/*.{ts,tsx}'` with no exclusion, so every one of the
 * 243 test files under `src/**' + '/__tests__/` was a source for the PUBLISHED
 * `dist/index.css`. A class-shaped token written as a test's expected value —
 * even one sitting in a prose comment — therefore compiled a real utility into
 * the shipped bundle, which means a test could create the very production
 * utility it was asserting on. Measured on #8435: `.\32 xl\:grid-cols-6` was
 * in the sheet with the UNFIXED renderer, sourced entirely from assertion
 * strings.
 *
 * ## The instrument
 *
 * A sentinel token that exists nowhere else in the repository, written in THIS
 * file — which lives under `__tests__/` and is therefore exactly the kind of
 * file the exclusion must keep out of the scan. If the exclusions are removed,
 * this file becomes a source, the sentinel compiles, and the negative
 * assertion below goes red. The probe is live only because it is self-hosted:
 * it does not depend on any other test continuing to name a fixture class.
 *
 * ## Why the positive assertion is not optional
 *
 * "No test-sourced rules" is satisfied by a stylesheet compiled from NOTHING —
 * an implementation strictly worse than the fix (delete the `@source` line
 * outright) would pass a negative-only test. The positive half pins a
 * production-sourced utility and a floor on the rule count, so an empty or
 * gutted sheet fails.
 *
 * ## Why `base` is passed explicitly
 *
 * `src/index.css` opens with a bare `@import 'tailwindcss'`, so Tailwind's
 * automatic source detection is ON and resolves against the PROCESS CWD. Vitest
 * runs from the repo root while `pnpm build` runs from this package directory,
 * and the two produce different stylesheets from the same bytes (measured:
 * 3430 rules vs 1385). Pinning `base` to the package root makes this reading
 * reproduce the artifact the BUILD produces, from either working directory.
 * The CWD dependence itself is out of scope here and reported separately.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindPostcss from '@tailwindcss/postcss';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const entry = resolve(packageRoot, 'src/index.css');

/**
 * Deliberately absent from every other file in the repository, and an
 * arbitrary-value utility so no production source can ever legitimately name
 * it. Its ONLY occurrence is this line, in a file under `__tests__/`.
 */
const SENTINEL = 'mt-[3.7331px]';

/**
 * The part of the sentinel that Tailwind's selector escaping leaves alone
 * (`.mt-\[3\.7331px\]` escapes the brackets and the dot, never the digits).
 * Asserting on THIS rather than on a hand-escaped selector is what keeps the
 * negative assertion from passing for the wrong reason.
 */
const SENTINEL_VALUE = '3.7331px';

async function compilePublishedStylesheet(): Promise<{
  css: string;
  selectors: Set<string>;
}> {
  const source = await readFile(entry, 'utf8');
  const result = await postcss([tailwindPostcss({ base: packageRoot })]).process(source, {
    from: entry,
  });
  const selectors = new Set<string>();
  postcss.parse(result.css, { from: entry }).walkRules((rule) => {
    selectors.add(rule.selector);
  });
  return { css: result.css, selectors };
}

describe('packages/components/src/index.css @source scan', () => {
  it('does not compile tokens that only test files name, and still compiles shipped ones', async () => {
    const { css, selectors } = await compilePublishedStylesheet();

    // POSITIVE — a sheet compiled from nothing must not pass.
    expect(selectors.has('.flex-col')).toBe(true);
    expect(selectors.size).toBeGreaterThan(800);

    // NEGATIVE — this file is scanned only if the exclusions are gone.
    expect(SENTINEL).toContain(SENTINEL_VALUE);
    expect(css).not.toContain(SENTINEL_VALUE);
  }, 60_000);
});
