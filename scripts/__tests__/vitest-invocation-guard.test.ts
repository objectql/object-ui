import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494. (On a
// multi-line import the directive never worked anyway: TS reports the missing
// declaration at the SPECIFIER line, not at the `import {` the comment guards.)
import {
  cliHasTestFilters,
  evaluateVitestInvocation,
  parseVitestArgv,
  repoRootFrom,
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
 * pin the guard that now refuses them, and the wiring that makes it
 * unskippable — which is the root config PLUS every package config that does
 * not lead back to it (objectui#5406; the last two describes below).
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

/**
 * objectui#5406 — wiring the ROOT config is not the same as wiring the repo.
 *
 * Vitest loads the config it finds in the directory it was launched from. The
 * call in `vitest.config.mts` therefore only reaches a package-cwd run when
 * that package's config resolution ends at the root file, and the guard's own
 * docstring used to assert that it always does ("Every per-package
 * `vitest.config.ts` re-exports the root config"). Measured on the tree that
 * shipped that sentence, by running `pnpm exec vitest run` from each directory
 * carrying a config:
 *
 *   REFUSED  apps/console, examples/schema-catalog, packages/components,
 *            packages/core, packages/fields, packages/plugin-dashboard,
 *            packages/react, packages/types            (8 — they import the root config)
 *   REFUSED  packages/app-shell, packages/mobile       (no config; the lookup walks up)
 *   ACCEPTED packages/plugin-{calendar,charts,detail,form,gantt,grid,kanban,
 *            list,map,timeline,view}                   (11 — standalone configs)
 *
 * The accepted set is not a technicality. Those 11 configs declare `happy-dom`
 * + `globals` + a local `vitest.setup.ts` and NO alias table, where the root
 * config maps ~40 `@object-ui/*` specifiers at a sibling package's `src/`. So a
 * run there both collects the package's own files AND resolves them
 * differently from CI — the false green this guard exists to refuse, arriving
 * through the door the guard was documented to have locked. Measured:
 *
 *   cd packages/plugin-grid
 *   pnpm exec vitest run src/__tests__/ObjectGrid.exportOptionsKeys.test.ts
 *   => RUN v4.1.10 /…/packages/plugin-grid
 *      Test Files  1 passed (1)
 *           Tests  5 passed (5)      # exit 0, no guard output at all
 *
 * The 11 now call the guard themselves. This block is what stops number 12 from
 * arriving the same way: the coverage claim is checked against the tree instead
 * of being restated in a comment. Same defect class as objectui#3944/#3904 —
 * configuration that declares a property nothing enforces.
 */
describe('objectui#5406 — every vitest config in the repo routes through the guard', () => {
  /** Directories that never hold a config we control (or hold copies of other branches). */
  const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.git',
    '.turbo',
    '.next',
    '.playwright-mcp',
    'playwright-report',
    'test-results',
    'storybook-static',
  ]);

  /** `vitest.config.ts` / `.mts` / `.js` / … — every spelling Vitest will load. */
  const CONFIG_NAME = /^vitest\.config\.(c|m)?[jt]s$/;

  function findConfigs(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // `.wt-*` are in-repo worktrees of OTHER branches (the root config
        // excludes them from every project for the same reason).
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.wt-')) continue;
        findConfigs(path.join(dir, entry.name), out);
      } else if (entry.isFile() && CONFIG_NAME.test(entry.name)) {
        out.push(path.relative(repoRoot, path.join(dir, entry.name)).split(path.sep).join('/'));
      }
    }
    return out;
  }

  const configs = findConfigs(repoRoot);
  const rootConfig = 'vitest.config.mts';
  const packageConfigs = configs.filter((c) => c !== rootConfig);

  const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

  // Match the IMPORT SPECIFIER, not a mention of the filename. A bare
  // `text.includes('vitest.config.mts')` was the first spelling here and it was
  // wrong in the direction that matters: the eleven standalone configs name the
  // root file in the comment explaining why they do NOT import it, so every one
  // of them classified as route 2 and the "no config skips the guard" case went
  // vacuously green over exactly the configs it exists to catch. Pinned below.
  const specifier = (module: string) =>
    new RegExp(String.raw`(?:from|import|require)\s*\(?\s*['"][^'"]*` + module + String.raw`['"]`);
  const ROOT_CONFIG_IMPORT = specifier(String.raw`vitest\.config\.mts`);
  const GUARD_IMPORT = specifier(String.raw`vitest-invocation-guard\.mjs`);

  /** Route 2: importing the root config runs its module scope, guard included. */
  const importsRootConfig = (rel: string) => ROOT_CONFIG_IMPORT.test(read(rel));
  /** Route 3: the config imports the guard and calls it itself. */
  const callsGuard = (rel: string) => {
    const text = read(rel);
    return GUARD_IMPORT.test(text) && text.includes('assertCanonicalVitestInvocation(');
  };

  it('finds the configs — the walk is not silently empty', () => {
    // A guard whose enumeration breaks reports success over nothing. Pin that
    // the walk reaches the root file, reaches into subdirectories, and returns
    // a count in the right order of magnitude (19 at the time of writing).
    expect(configs).toContain(rootConfig);
    expect(packageConfigs.length).toBeGreaterThanOrEqual(12);
    expect(packageConfigs.some((c) => c.startsWith('packages/'))).toBe(true);
    expect(packageConfigs.some((c) => c.startsWith('apps/'))).toBe(true);
  });

  it('leaves no config able to skip the guard', () => {
    const unguarded = packageConfigs.filter((c) => !importsRootConfig(c) && !callsGuard(c));

    expect(
      unguarded,
      `These vitest configs neither import ${rootConfig} nor call the guard, so a run launched ` +
        'from their directory skips it entirely and can go green under a config CI never uses ' +
        '(objectui#5406). Add to the top of each:\n\n' +
        "  import {\n    assertCanonicalVitestInvocation,\n    repoRootFrom,\n  } from '../../scripts/vitest-invocation-guard.mjs';\n\n" +
        '  assertCanonicalVitestInvocation({ repoRoot: repoRootFrom(import.meta.url) });\n\n' +
        'Do NOT add an exemption here — an exemption is how this guard got its hole.'
    ).toEqual([]);
  });

  it('still has both routes represented, so neither branch above is dead', () => {
    // Without this, deleting every standalone config (or every root-importing
    // one) would leave half the check above vacuously true.
    expect(packageConfigs.filter(importsRootConfig).length).toBeGreaterThan(0);
    expect(packageConfigs.filter((c) => !importsRootConfig(c)).length).toBeGreaterThan(0);
    // The two configs this card measured, one per route. If either legitimately
    // changes route, move it here rather than dropping the pin.
    expect(importsRootConfig('packages/core/vitest.config.ts')).toBe(true);
    expect(callsGuard('packages/plugin-grid/vitest.config.ts')).toBe(true);

    // …and the two routes are told apart by the IMPORT, not by the filename
    // appearing somewhere in the file. plugin-grid's comment names
    // `vitest.config.mts` while deliberately not importing it; a substring
    // check reads that as route 2 and stops looking at the very configs this
    // block exists for.
    expect(read('packages/plugin-grid/vitest.config.ts')).toContain('vitest.config.mts');
    expect(importsRootConfig('packages/plugin-grid/vitest.config.ts')).toBe(false);
  });

  it('has every self-calling config derive the repo root instead of counting `..`', () => {
    // `repoRoot: path.resolve(__dirname, '../..')` fails SILENTLY when the
    // count is wrong: the resolved directory exists, the comparison runs, and
    // the verdict is computed against the wrong root. `repoRootFrom` searches
    // for the landmark and throws when it is not there.
    const selfCalling = packageConfigs.filter((c) => !importsRootConfig(c) && callsGuard(c));
    expect(selfCalling.length).toBeGreaterThan(0);
    for (const rel of selfCalling) {
      expect(read(rel), `${rel} calls the guard with a hand-counted repo root`).toContain(
        'repoRootFrom(import.meta.url)'
      );
    }
  });
});

describe('repoRootFrom — the landmark search the standalone configs use', () => {
  it('resolves the repo root from a package config, at any depth', () => {
    for (const rel of ['packages/plugin-grid/vitest.config.ts', 'apps/console/vitest.config.ts']) {
      expect(repoRootFrom(pathToFileURL(path.join(repoRoot, rel)).href)).toBe(repoRoot);
    }
  });

  it('throws instead of returning a plausible-but-wrong directory', () => {
    // The failure this exists to avoid is a WRONG root, not a missing one: a
    // wrong root still compares, so the guard would keep issuing verdicts.
    expect(() => repoRootFrom(pathToFileURL('/nonexistent-objectui-5406/x.ts').href)).toThrow(
      /vitest\.config\.mts/
    );
  });

  it('composes with the verdict: a real package cwd is refused against the real root', () => {
    // End-to-end over real paths — the fake-path cases above cannot catch a
    // repoRoot that resolves to the wrong real directory.
    const cwd = path.join(repoRoot, 'packages/plugin-grid');
    const derived = repoRootFrom(pathToFileURL(path.join(cwd, 'vitest.config.ts')).href);

    expect(
      evaluateVitestInvocation({
        argv: ['/usr/bin/node', path.join(repoRoot, 'bin/vitest'), 'run'],
        cwd,
        repoRoot: derived,
      })?.code
    ).toBe('package-cwd');

    // …and the canonical repo-root invocation still passes through it.
    expect(
      evaluateVitestInvocation({
        argv: ['/usr/bin/node', path.join(repoRoot, 'bin/vitest'), 'run', 'packages/plugin-grid/'],
        cwd: repoRoot,
        repoRoot: derived,
      })
    ).toBeNull();
  });
});
