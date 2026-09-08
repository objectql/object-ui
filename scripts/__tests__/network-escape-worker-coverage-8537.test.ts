import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * objectui#8537 — the network-escape guard covers EVERY test file in a worker
 * of the `unit` project, not only the first.
 *
 * ## What this guards
 *
 * The `unit` project runs `isolate: false`. Vitest re-executes each
 * `setupFiles` entry per test file, but a module a setup file IMPORTS is
 * evaluated once per worker — so an `afterEach` registered in that module's
 * body attaches to the first test file of the worker and to no other.
 * `vitest.setup.network-escape-guard.ts` is such a module, and that is exactly
 * where its `afterEach` used to be registered. Measured on `1cca4415e` with
 * three byte-identical escaping files: one worker, `1 failed | 2 passed`; three
 * workers, `3 failed`; each alone, red. Coverage was one file per worker, and
 * a green suite read as "no escapes".
 *
 * The repair registers the hook from `vitest.setup.base.ts` through the guard's
 * exported `installNetworkEscapeGuard()`, so it is per file.
 *
 * ## Why a spawn, and why two files
 *
 * An in-process assertion cannot see this defect: whichever file holds the
 * assertion, its own hook state says nothing about the NEXT file's. The fact
 * has to be measured across a file boundary, inside one worker, on the real
 * `unit` project — so a real vitest is spawned with the two fixtures beside
 * this file, forced into one worker, and BOTH must go red naming themselves.
 *
 * ## The caricature this also rejects
 *
 * A repair that re-registers the hook per file but loses the detection — every
 * file "covered", nothing caught — passes any "the hook ran in file 2"
 * assertion. Here it reads `0 failed`, which is as red as the defect's
 * `1 failed | 1 passed`. Both were run against this pin before it landed.
 *
 * ## The live controls
 *
 * A spawn-based pin fails silently in two ways: the fixtures might not have
 * escaped at all (skipped, or the marker never reached the child), or they
 * might have landed in two workers, where the defect is invisible. So each
 * fixture prints a line when its escape RUNS, and reports whether it found the
 * other fixture's mark on the shared global object — which is only possible in
 * one worker, for the file that ran second. Exactly one `saw_other=yes` is the
 * reading that says "one worker, and one of these was not first in it".
 *
 * ## Recursion
 *
 * The child runs only the two fixtures, never this file, so it cannot spawn a
 * grandchild; `OBJECTUI_ESCAPE_PIN_CHILD` is what un-skips the fixtures' escape
 * there and is never set in the ordinary suite.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const here = path.dirname(fileURLToPath(import.meta.url));

const FIXTURES = ['a', 'b'].map((tag) =>
  path.relative(repoRoot, path.join(here, `network-escape-worker-coverage-8537.escape-${tag}.test.ts`)),
);

const IS_CHILD = process.env.OBJECTUI_ESCAPE_PIN_CHILD === '1';

/** The vitest CLI entry, resolved rather than assumed at a `node_modules` path. */
const vitestCli = (() => {
  const require = createRequire(path.join(repoRoot, 'noop.js'));
  const pkgPath = require.resolve('vitest/package.json');
  const bin = (JSON.parse(fs.readFileSync(pkgPath, 'utf8')).bin as { vitest: string }).vitest;
  return path.resolve(path.dirname(pkgPath), bin);
})();

describe('objectui#8537 — the network-escape guard covers every file in a worker', () => {
  it('the two fixtures are byte-identical apart from their tag', () => {
    // The floor under the spawn below: if the fixtures differed in anything
    // but position, a difference in their outcome would not be about coverage.
    const [a, b] = FIXTURES.map((f) => fs.readFileSync(path.join(repoRoot, f), 'utf8'));
    const normalise = (s: string) => s.replace(/\bfixture [ab]\b/g, 'fixture X').replace(/\b[ab]\b/g, 'X');
    expect(a.length).toBeGreaterThan(500);
    expect(a).not.toBe(b);
    expect(normalise(a)).toBe(normalise(b));
    // And they are inert outside the child: the escape is behind the marker.
    for (const src of [a, b]) expect(src).toContain("it.skipIf(!IS_CHILD)");
  });

  it.skipIf(IS_CHILD)(
    'a deliberate escape reds in a file that is NOT first in its worker',
    () => {
      const env: NodeJS.ProcessEnv = { ...process.env };
      // A fresh CLI, not a nested worker of this run.
      for (const key of Object.keys(env)) if (key.startsWith('VITEST')) delete env[key];
      env.OBJECTUI_ESCAPE_PIN_CHILD = '1';

      const child = spawnSync(
        process.execPath,
        [vitestCli, 'run', '--project', 'unit', '--maxWorkers=1', '--fileParallelism=false', ...FIXTURES],
        { cwd: repoRoot, encoding: 'utf8', env, timeout: 300_000 },
      );
      const output = `${child.stdout ?? ''}${child.stderr ?? ''}`;

      // Live control 1: both escapes RAN (not skipped, not filtered out).
      expect(output, 'fixture a never ran its escape').toContain('ESCAPE_PIN_8537 file=a');
      expect(output, 'fixture b never ran its escape').toContain('ESCAPE_PIN_8537 file=b');
      // Live control 2: ONE worker, and one of the two was not first in it.
      // Under `isolate: false` the second file sees the first file's mark on
      // the shared global; in two workers neither would.
      const sawOther = output.match(/saw_other=yes/g) ?? [];
      expect(sawOther, 'the fixtures did not share a worker, so the defect could not show').toHaveLength(1);

      // The claim: every file in the worker is covered — BOTH red, each
      // attributed to itself. The defect reads `1 failed | 1 passed`; the
      // caricature (hook per file, detection lost) reads `2 passed`.
      expect(output).toMatch(/Test Files\s+2 failed \(2\)/);
      const escapes = output.match(/Network escape: this test reached a REAL socket/g) ?? [];
      expect(escapes.length, 'fewer Network escape verdicts than files').toBeGreaterThanOrEqual(2);
      for (const fixture of FIXTURES) {
        expect(output, `${fixture} was not named by the guard`).toContain(`  file: ${fixture}`);
      }
      expect(child.status, 'an escape must fail the child run').toBe(1);
    },
    360_000,
  );
});
