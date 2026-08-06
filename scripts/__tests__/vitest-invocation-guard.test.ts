import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494. (On a
// multi-line import the directive never worked anyway: TS reports the missing
// declaration at the SPECIFIER line, not at the `import {` the comment guards.)
import {
  cliHasTestFilters,
  evaluateVitestInvocation,
  parseVitestArgv,
} from '../vitest-invocation-guard.mjs';

/**
 * Two invocations of this repo's Vitest passed while running none of the tests
 * the caller asked for:
 *
 *  - objectui#3378: `pnpm --filter @object-ui/app-shell test` — i.e. `vitest
 *    run` with the cwd inside the package — printed `Test Files 22 passed (22)`
 *    where all 22 files belong to `@object-ui/console` and app-shell's own 281
 *    never ran. The root-level projects glob `packages/**` RELATIVE to the
 *    cwd-derived root, so from inside a package they match nothing; only the
 *    `apps/console` project, brought in by absolute path, still resolves.
 *
 *  - objectui#3288: `pnpm --filter <pkg> test -- --run <paths>` — pnpm forwards
 *    the `--` verbatim, Vitest's parser stops there, and the path filter is
 *    discarded before Vitest ever sees a path.
 *
 * Neither warned, and neither counted zero: both summaries said 22. These tests
 * pin the guard that now refuses them, and the wiring in `vitest.config.mts`
 * that makes it unskippable.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Paths that cannot exist, so `realpath()` falls back to a plain resolve and the
// verdict is decided by the injected inputs alone.
const FAKE_ROOT = '/nonexistent-objectui-repo';
const FAKE_PKG = `${FAKE_ROOT}/packages/fields`;

const argvFor = (...args: string[]) => ['/usr/bin/node', `${FAKE_ROOT}/bin/vitest`, ...args];

const judge = (
  args: string[],
  {
    cwd = FAKE_ROOT,
    exists = () => true,
    env = {},
  }: { cwd?: string; exists?: (p: string) => boolean; env?: Record<string, string> } = {}
) => evaluateVitestInvocation({ argv: argvFor(...args), cwd, repoRoot: FAKE_ROOT, exists, env });

describe('parseVitestArgv', () => {
  it('reads the subcommand, positionals and flags apart', () => {
    const parsed = parseVitestArgv(
      argvFor('run', '--project', 'unit', '--shard=1/4', 'packages/fields/src/a.test.ts')
    );

    expect(parsed.subcommand).toBe('run');
    expect(parsed.positionals).toEqual(['packages/fields/src/a.test.ts']);
    expect(parsed.flags['--project']).toBe('unit');
    expect(parsed.flags['--shard']).toBe('1/4');
    expect(parsed.afterDoubleDash).toEqual([]);
  });

  it('does not mistake a value-taking flag value for a file filter', () => {
    // `unit` and `verbose` are values, not paths. Reading them as filters would
    // make `pnpm test:unit` look like a filtered run and flip passWithNoTests
    // underneath it.
    expect(parseVitestArgv(argvFor('run', '--project', 'unit')).positionals).toEqual([]);
    expect(parseVitestArgv(argvFor('run', '--reporter', 'verbose')).positionals).toEqual([]);
  });

  it('collects everything after a bare `--` separately', () => {
    const parsed = parseVitestArgv(argvFor('run', '--', '--run', 'packages/fields/src/a.test.ts'));

    // Exactly the shape pnpm builds for
    // `pnpm --filter @object-ui/fields test -- --run <path>`.
    expect(parsed.positionals).toEqual([]);
    expect(parsed.afterDoubleDash).toEqual(['--run', 'packages/fields/src/a.test.ts']);
  });

  it('treats a leading subcommand as the subcommand, not a filter', () => {
    expect(parseVitestArgv(argvFor('run')).positionals).toEqual([]);
    expect(parseVitestArgv(argvFor('list')).subcommand).toBe('list');
  });
});

describe('cliHasTestFilters — what switches passWithNoTests off', () => {
  it('is true when the CLI names files', () => {
    expect(cliHasTestFilters(argvFor('run', 'packages/fields/src/a.test.ts'))).toBe(true);
    // A bare substring filter counts too: "I asked for a subset and got zero"
    // is the failure, whether or not the subset was spelled as a path.
    expect(cliHasTestFilters(argvFor('run', 'useRecordQuery'))).toBe(true);
  });

  it('is false for the unfiltered runs CI makes', () => {
    expect(cliHasTestFilters(argvFor('run'))).toBe(false);
    expect(cliHasTestFilters(argvFor('run', '--shard=1/4'))).toBe(false);
    expect(cliHasTestFilters(argvFor('run', '--project', 'unit'))).toBe(false);
    expect(cliHasTestFilters(argvFor('run', '--coverage.reporter=json'))).toBe(false);
  });

  it('is false for `related` and `--changed`, which may legitimately match nothing', () => {
    expect(cliHasTestFilters(argvFor('related', 'packages/fields/src/index.ts'))).toBe(false);
    expect(cliHasTestFilters(argvFor('run', '--changed', 'HEAD~1'))).toBe(false);
  });
});

describe('evaluateVitestInvocation — the invocations CI and humans get right', () => {
  it('passes an unfiltered run from the repo root', () => {
    expect(judge(['run'])).toBeNull();
  });

  it('passes CI shapes (sharded, coverage) unchanged', () => {
    expect(judge(['run', '--shard=1/4'])).toBeNull();
    expect(judge(['run', '--coverage.reporter=json', '--coverage.reporter=text'])).toBeNull();
  });

  it('passes the canonical path-filtered run from the repo root', () => {
    expect(judge(['run', 'packages/fields/src/a.test.ts'])).toBeNull();
  });

  it('passes a package-cwd run that points --root back at the repo root', () => {
    // The one legitimate way to launch from inside a package: Vitest's root —
    // and therefore every project `include` — is the repo root again.
    expect(judge(['run', '--root', '../..', 'packages/fields/'], { cwd: FAKE_PKG })).toBeNull();
  });
});

describe('evaluateVitestInvocation — objectui#3378, the package-cwd false green', () => {
  it('refuses a run whose Vitest root is inside a package', () => {
    const verdict = judge(['run'], { cwd: FAKE_PKG });

    expect(verdict?.code).toBe('package-cwd');
    expect(verdict?.message).toContain('objectui#3378');
    // The message has to carry the mechanism, not just "don't do that": the
    // 22-file console collection is the fingerprint the reader already saw.
    expect(verdict?.message).toContain('22');
    expect(verdict?.message).toContain('apps/console');
    // ...and the replacement command, spelled with the caller's own package.
    expect(verdict?.message).toContain('pnpm exec vitest run packages/fields/');
  });

  it('refuses `vitest list` from a package directory too, not only `run`', () => {
    // `cd packages/app-shell && pnpm exec vitest list` is the reproduction in
    // objectui#3378; a guard covering only `run` would leave it lying.
    expect(judge(['list'], { cwd: `${FAKE_ROOT}/packages/app-shell` })?.code).toBe('package-cwd');
  });

  it('refuses a --root pointing somewhere other than this repo root', () => {
    expect(judge(['run', '--root', '/somewhere/else'], { cwd: FAKE_ROOT })?.code).toBe(
      'package-cwd'
    );
  });
});

describe('evaluateVitestInvocation — objectui#3288, the filter that never lands', () => {
  it('refuses arguments parked after a bare `--`', () => {
    const verdict = judge(['run', '--', '--run', 'packages/fields/src/a.test.ts']);

    expect(verdict?.code).toBe('double-dash-args');
    expect(verdict?.message).toContain('objectui#3288');
    expect(verdict?.message).toContain('--run packages/fields/src/a.test.ts');
  });

  it('names BOTH traps when the `--` run also came from a package directory', () => {
    // `pnpm --filter <pkg> test -- --run <paths>` trips #3288 and #3378 at once.
    // Reporting only the first would send the caller back for a second lap.
    const verdict = judge(['run', '--', '--run', 'packages/fields/src/a.test.ts'], {
      cwd: FAKE_PKG,
    });

    expect(verdict?.code).toBe('double-dash-args');
    expect(verdict?.message).toContain('objectui#3288');
    expect(verdict?.message).toContain('objectui#3378');
  });

  it('refuses a concrete test path that does not exist from the Vitest root', () => {
    const verdict = judge(['run', 'packages/fields/src/typo.test.ts'], { exists: () => false });

    expect(verdict?.code).toBe('missing-path-filter');
    expect(verdict?.message).toContain('packages/fields/src/typo.test.ts');
  });

  it('leaves non-path substring filters to passWithNoTests, not to the path check', () => {
    // `vitest run useRecordQuery` is a legitimate substring filter — it names no
    // file, so "does this path exist" has nothing to say about it. Zero matches
    // still fails, via passWithNoTests being off for filtered runs.
    expect(judge(['run', 'useRecordQuery'], { exists: () => false })).toBeNull();
  });

  it('does not read a directory filter as a missing file', () => {
    expect(judge(['run', 'packages/fields/'], { exists: () => false })).toBeNull();
  });
});

describe('evaluateVitestInvocation — the escape hatch', () => {
  it('stands down for OBJECTUI_VITEST_GUARD=off', () => {
    expect(judge(['run'], { cwd: FAKE_PKG, env: { OBJECTUI_VITEST_GUARD: 'off' } })).toBeNull();
  });

  it('is on by default (unset, or an unrelated value, does not disable it)', () => {
    expect(judge(['run'], { cwd: FAKE_PKG, env: {} })?.code).toBe('package-cwd');
    expect(judge(['run'], { cwd: FAKE_PKG, env: { OBJECTUI_VITEST_GUARD: 'on' } })?.code).toBe(
      'package-cwd'
    );
  });
});

describe('the root config actually wires the guard', () => {
  // Without this, the guard is a well-tested module nothing calls — the shape
  // objectui#2879 hit when eslint-rules shipped tests no project globbed.
  const config = fs.readFileSync(path.join(repoRoot, 'vitest.config.mts'), 'utf8');

  it('calls the guard from vitest.config.mts', () => {
    expect(config).toContain('assertCanonicalVitestInvocation({ repoRoot: __dirname })');
  });

  it('derives passWithNoTests from the CLI instead of hard-coding true', () => {
    expect(config).toContain('passWithNoTests: !cliHasTestFilters(process.argv)');
    expect(config).not.toContain('passWithNoTests: true');
  });
});
