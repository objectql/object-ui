#!/usr/bin/env node
/**
 * Rejects the two Vitest invocations that silently produce a FALSE GREEN.
 *
 * Called from the top of `vitest.config.mts` — the repo's ONE Vitest config
 * since objectui#3240 — and from every other config file Vitest can pick up
 * instead of it, so it covers EVERY entry point: `pnpm test`,
 * `pnpm --filter <pkg> test`, `turbo run test`, and a bare `pnpm exec vitest`
 * typed in any directory.
 *
 * ## How a config reaches this file
 *
 * Vitest loads the config it finds in the directory it was launched from, so
 * "the root config calls the guard" only covers a package-cwd run when that
 * directory's own config resolution ends at the root file. That is a claim
 * about the tree, and this docstring has been WRONG about it once already
 * (objectui#5406: it asserted "every per-package `vitest.config.ts`
 * re-exports the root config" while eleven standalone ones did not). It is now
 * ENFORCED instead of asserted — `scripts/__tests__/vitest-invocation-guard
 * .test.ts` walks the repo and fails on any config taking none of the routes
 * below. Read that test, not this paragraph, for what is true today.
 *
 *   1. NO config in the directory. The lookup walks up and lands on the root
 *      config, whose module scope runs the guard. This is now the common case:
 *      objectui#3240 deleted the 17 per-package `vitest.config.ts` files plus
 *      `examples/schema-catalog`'s, so no `packages/*` directory carries one.
 *   2. A config that IMPORTS the root config — `apps/console/vitest.config.ts`,
 *      the last one left, which the root `projects` array also brings in by
 *      absolute path as the `@object-ui/console` project. Importing it executes
 *      its module scope, so the guard runs as a side effect.
 *   3. A STANDALONE `vitest.config.*` that never mentions the root file. None
 *      exists today; the route is kept because the walk above cannot assume
 *      that stays true. Such a config must call this module itself:
 *
 *          import { assertCanonicalVitestInvocation, repoRootFrom }
 *            from '../../scripts/vitest-invocation-guard.mjs';
 *          assertCanonicalVitestInvocation({ repoRoot: repoRootFrom(import.meta.url) });
 *
 *   4. ⭐ NO `vitest.config.*` but a `vite.config.*` — the route objectui#3240
 *      had to close before it could delete anything. Vitest falls back to the
 *      package's VITE config, which is a build config: root becomes the package
 *      directory, and 22 of the 23 under `packages/` carried a vestigial
 *      `test` block (`passWithNoTests: true`, a partial `resolve.alias`, a
 *      setup file the root config does not use). Measured on `main` before the
 *      change, from a package with no vitest config:
 *
 *          cd packages/plugin-ai && pnpm exec vitest run
 *          => RUN v4.1.10 /…/packages/plugin-ai    <- root is the PACKAGE
 *             (no guard output at all)
 *
 *      Deleting the per-package vitest configs would have moved 14 more
 *      packages onto this route — widening the hole objectui#5406 closed, in
 *      the name of closing it. So every `packages/<pkg>/vite.config.ts` now calls
 *      this module, and the vestigial `test` blocks are gone. The call is
 *      gated on `process.env.VITEST`, which Vitest sets when it loads a config
 *      and `vite build` does not (measured both ways) — the same file has to
 *      keep working as the build config, and a build must never be refused.
 *
 * ## Not covered, deliberately
 *
 * `examples/byo-backend-console` and `examples/console-starter` carry a
 * `vite.config.ts` and no test script. They are templates a user copies out of
 * the repo, so a `../../scripts/` import would break them where it matters
 * most. Unchanged by objectui#3240 — they were on route 4 before it and after.
 *
 * ## Trap 1 — Vitest launched with the cwd inside a package (objectui#3378)
 *
 *     cd packages/app-shell && pnpm exec vitest run
 *     # identical to what `pnpm --filter @object-ui/app-shell test` runs
 *     => Test Files  22 passed (22)   <- all 22 belong to @object-ui/console;
 *                                        app-shell's own 281 files never ran
 *
 * Vitest sets its `root` to the cwd. The root-level projects (`unit`, `dom`,
 * `dom-heavy`) declare `include` relative to that root — `packages/**`,
 * `examples/**`, `scripts/**` — and from inside `packages/app-shell` those
 * globs resolve to `packages/app-shell/packages/**`, matching nothing at all.
 * The one project that still resolves is `apps/console`, because the root
 * config brings it in by ABSOLUTE path. So the run collects 22 foreign files,
 * passes them, and prints a green summary. Nothing in that output says "0 tests
 * matched" — the count is 22, not 0, so `passWithNoTests` never even enters the
 * picture. An agent verifying "this package is green" by the package-level
 * convention reports success for a package it never executed.
 *
 * ## Trap 2 — a path filter that never reaches Vitest (objectui#3288)
 *
 *     pnpm --filter @object-ui/fields test -- --run packages/fields/src/a.test.ts
 *     => Test Files  22 passed (22)   <- again @object-ui/console's files
 *
 * pnpm forwards the `--` VERBATIM into the script, so Vitest is invoked as
 * `vitest run -- --run packages/fields/src/a.test.ts`. Vitest's CLI parser
 * stops at `--` and discards everything after it, including the path. The
 * filter is not "ignored with a warning" — it is gone before Vitest sees a
 * path, and the run falls back to the default set (which, per trap 1, is
 * somebody else's package). The newly added test file executes zero times and
 * the output is green.
 *
 * The same miss one step removed: a filter that DOES reach Vitest but matches
 * nothing (a typo, or a path spelled relative to the wrong directory) also used
 * to exit 0, because the root config set `passWithNoTests: true`
 * unconditionally. `cliHasTestFilters()` below is what the root config now uses
 * to switch that off for exactly the runs that asked for specific files: "I
 * named files and zero matched" is an error, while "no filter, and one project
 * happens to hold no files" stays fine.
 *
 * ## The canonical invocation
 *
 *     pnpm exec vitest run packages/<pkg>/src/<file>.test.ts   # from the REPO ROOT
 *
 * From the repo root, and with NO `--` in front of the paths. AGENTS.md
 * (§测试纪律) carries the same lines.
 *
 * ## Deliberately strict
 *
 * Any run whose Vitest root is not the repo root is refused, rather than
 * refused only when it collects zero of its own files. "Collects zero of its
 * own files" would have been the WEAKER trigger, and objectui#5406 shows why:
 * under the 11 standalone configs a package-cwd run does collect the package's
 * own files and can go green — that green just says nothing about CI, which
 * runs those same files under the root config's aliases, project split and
 * setup files. The defect is the divergent config, not the empty collection.
 * "root == repo root" is also one comparison an agent can hold in its head,
 * unlike a heuristic that fires only sometimes. objectui#3240 has since settled
 * what the package-level `test` scripts are: every one of them names the repo
 * root explicitly (`vitest run --root ../.. packages/<pkg>/`), so they satisfy
 * this comparison instead of tripping it, and `pnpm --filter <pkg> test` /
 * `turbo run test` run the same config as CI.
 *
 * Escape hatch, documented in AGENTS.md: `OBJECTUI_VITEST_GUARD=off`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The file whose directory IS the repo root, by definition of this guard. */
const ROOT_CONFIG = 'vitest.config.mts';

/**
 * Locate the repo root from a config file's own `import.meta.url`, by walking
 * up to the directory that holds `vitest.config.mts`.
 *
 * Why the standalone package configs call this instead of spelling
 * `path.resolve(__dirname, '../..')` eleven times: that literal is a silent
 * failure waiting to happen. A wrong number of `..` yields a directory that
 * exists, `evaluateVitestInvocation` compares the cwd against it, and the
 * guard goes on reporting a verdict computed from the wrong root — no error,
 * no signal. Searching for a landmark either finds the real root or throws.
 *
 * Why `import.meta.url` of the CONFIG rather than of this module: Vite may
 * hand the config to Node's own ESM loader (`configLoader: 'native'`, the mode
 * objectui#3384 documents) or bundle it to a `…timestamp-*.mjs` written
 * ALONGSIDE the config. Both leave the config's own directory correct, while
 * only the first leaves this module's path meaningful.
 *
 * @param {string} metaUrl the caller's `import.meta.url`
 * @returns {string} absolute path of the directory holding `vitest.config.mts`
 */
export function repoRootFrom(metaUrl) {
  let dir = path.dirname(fileURLToPath(metaUrl));
  for (;;) {
    if (fs.existsSync(path.join(dir, ROOT_CONFIG))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `vitest-invocation-guard: walked up from ${fileURLToPath(metaUrl)} without finding ` +
          `${ROOT_CONFIG}. That file's directory is what defines this repo's root, so the ` +
          'guard cannot judge an invocation without it.'
      );
    }
    dir = parent;
  }
}

/**
 * Vitest's positional subcommands. The first bare word is the subcommand, not a
 * file filter — `vitest run foo` filters on `foo`; `vitest run` filters on
 * nothing.
 */
export const SUBCOMMANDS = new Set([
  'run',
  'watch',
  'dev',
  'related',
  'bench',
  'typecheck',
  'list',
  'init',
]);

/**
 * Flags whose NEXT argv token is their value, so that token is not a file
 * filter. Only the space-separated form needs listing; `--flag=value` is
 * self-delimiting and handled structurally.
 *
 * A flag missing here can only cost a false positive, and only when its value
 * also looks like a concrete `*.test.*` path that does not exist — so the list
 * covers the flags this repo actually passes plus the common Vitest ones,
 * rather than mirroring Vitest's whole CLI (which would drift).
 */
export const VALUE_FLAGS = new Set([
  '--project',
  '--config',
  '-c',
  '--root',
  '-r',
  '--dir',
  '--reporter',
  '--outputFile',
  '--shard',
  '--testNamePattern',
  '-t',
  '--testTimeout',
  '--hookTimeout',
  '--teardownTimeout',
  '--slowTestThreshold',
  '--maxWorkers',
  '--minWorkers',
  '--maxConcurrency',
  '--pool',
  '--environment',
  '--environmentOptions',
  '--retry',
  '--bail',
  '--exclude',
  '--include',
  '--changed',
  '--browser',
  '--mode',
  '--cache.dir',
  '--coverage.reporter',
  '--coverage.provider',
  '--coverage.reportsDirectory',
  '--sequence.seed',
]);

/** A positional that names one concrete test file rather than a substring. */
const CONCRETE_TEST_PATH = /[\\/].*\.(test|spec)\.(c|m)?[jt]sx?$/;

/**
 * Split a `process.argv`-shaped array into the parts this guard reasons about.
 *
 * @param {string[]} argv full `process.argv` (node binary + script + args)
 * @returns {{ subcommand: string | null, positionals: string[], afterDoubleDash: string[], flags: Record<string, string | true> }}
 */
export function parseVitestArgv(argv) {
  const args = argv.slice(2);
  /** @type {string[]} */
  const positionals = [];
  /** @type {string[]} */
  const afterDoubleDash = [];
  /** @type {Record<string, string | true>} */
  const flags = {};
  let subcommand = null;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];

    if (token === '--') {
      afterDoubleDash.push(...args.slice(i + 1));
      break;
    }

    if (token.startsWith('-')) {
      const eq = token.indexOf('=');
      if (eq !== -1) {
        flags[token.slice(0, eq)] = token.slice(eq + 1);
        continue;
      }
      const next = args[i + 1];
      if (VALUE_FLAGS.has(token) && next !== undefined && !next.startsWith('-')) {
        flags[token] = next;
        i += 1;
        continue;
      }
      flags[token] = true;
      continue;
    }

    if (subcommand === null && positionals.length === 0 && SUBCOMMANDS.has(token)) {
      subcommand = token;
      continue;
    }

    positionals.push(token);
  }

  return { subcommand, positionals, afterDoubleDash, flags };
}

/**
 * Did this invocation ask for a specific subset of test files?
 *
 * The root config feeds this into `passWithNoTests`: a filtered run that
 * matches nothing is a failed run; an unfiltered one is not.
 *
 * @param {string[]} argv full `process.argv`
 */
export function cliHasTestFilters(argv) {
  const { subcommand, positionals, flags } = parseVitestArgv(argv);
  // `vitest related <src files>` takes SOURCE paths and legitimately resolves
  // to zero tests; `--changed` likewise when the diff touches no tested file.
  if (subcommand === 'related') return false;
  if (flags['--changed'] !== undefined) return false;
  return positionals.length > 0;
}

/** Resolve symlinks when possible; fall back to a plain resolve (unit tests pass fake paths). */
function realpath(p) {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}

const RULE = '='.repeat(78);

function box(title, lines) {
  return ['', RULE, `  ${title}`, RULE, ...lines.map((l) => (l ? `  ${l}` : '')), RULE, ''].join('\n');
}

function canonicalLines(pkgDir) {
  const file = pkgDir ? `${pkgDir}/src/<file>.test.ts` : 'packages/<pkg>/src/<file>.test.ts';
  const dir = pkgDir ? `${pkgDir}/` : 'packages/<pkg>/';
  return [
    '正确跑法 —— 一律在【仓库根目录】执行,路径前【不要】加 `--`:',
    '',
    `  pnpm exec vitest run ${file}   # 只跑一个文件`,
    `  pnpm exec vitest run ${dir}   # 只跑一个包`,
    '  pnpm test   # 全量(CI 跑的就是它)',
  ];
}

/**
 * Judge one Vitest invocation. Pure: every input is injected.
 *
 * @param {object} input
 * @param {string[]} input.argv full `process.argv`
 * @param {string} input.cwd
 * @param {string} input.repoRoot directory holding `vitest.config.mts`
 * @param {(p: string) => boolean} [input.exists]
 * @param {Record<string, string | undefined>} [input.env]
 * @returns {{ code: string, message: string } | null} null = nothing wrong with this invocation
 */
export function evaluateVitestInvocation({
  argv,
  cwd,
  repoRoot,
  exists = (p) => fs.existsSync(p),
  env = {},
}) {
  const off = String(env.OBJECTUI_VITEST_GUARD ?? '').toLowerCase();
  if (off === 'off' || off === '0' || off === 'false') return null;

  const { positionals, afterDoubleDash, flags } = parseVitestArgv(argv);

  const rootFlag = typeof flags['--root'] === 'string' ? flags['--root'] : flags['-r'];
  const vitestRoot =
    typeof rootFlag === 'string' ? realpath(path.resolve(cwd, rootFlag)) : realpath(cwd);
  const root = realpath(repoRoot);
  const rootIsRepoRoot = vitestRoot === root;

  // The package directory this run stands in, so the message can name the
  // caller's own package instead of a `<pkg>` placeholder.
  const rel = path.relative(root, realpath(cwd));
  const pkgDir =
    rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : null;

  if (afterDoubleDash.length > 0) {
    const alsoWrongCwd = rootIsRepoRoot
      ? []
      : [
          '',
          `顺带:本次 cwd 不是仓库根(${cwd})—— 那是 objectui#3378 的同类陷阱。`,
          'vitest 会把 root 定成 cwd,根级 projects 的 include 匹配不到本包任何文件,',
          '只有以绝对路径引入的 apps/console project 仍解析成功,于是跑的是别人的包。',
        ];
    return {
      code: 'double-dash-args',
      message: box('vitest 调用被拒绝:`--` 之后的参数会被 vitest 静默丢弃 (objectui#3288)', [
        `被丢弃的参数: ${afterDoubleDash.join(' ')}`,
        '',
        'pnpm 把 `--` 原样转发给脚本,而 vitest 的 CLI 解析在 `--` 处停止 ——',
        '`--` 之后的一切(包括你的路径过滤)在 vitest 看到之前就没了。于是跑的是',
        '默认集合、输出一片绿,你想跑的那个文件一次都没执行。',
        ...alsoWrongCwd,
        '',
        ...canonicalLines(pkgDir),
        '',
        '确需绕过(自担风险): OBJECTUI_VITEST_GUARD=off',
      ]),
    };
  }

  if (!rootIsRepoRoot) {
    const backToRoot = path.relative(realpath(cwd), root) || '.';
    return {
      code: 'package-cwd',
      message: box('vitest 调用被拒绝:从包目录跑 vitest 会静默跑错测试集 (objectui#3378)', [
        `vitest root: ${vitestRoot}`,
        `仓库根:      ${root}`,
        '',
        'vitest 把 root 定成了上面那个目录,根级 projects(unit/dom/dom-heavy)的 include',
        '(`packages/**`、`examples/**`、`scripts/**`)相对它匹配不到任何文件;只有以',
        '【绝对路径】引入的 apps/console project 仍解析成功。结果:跑了 @object-ui/console',
        '的 22 个文件、报 `Test Files 22 passed (22)`,本包的一个都没跑 —— 而且没有任何',
        '"0 tests matched" 信号,计数是 22 不是 0。这就是所谓假绿。',
        '',
        '`cd packages/x && pnpm exec vitest` 会落进这里。`pnpm --filter <pkg> test` 与',
        '`turbo run test` 不会 —— objectui#3240 把每个包级 test 脚本改成了显式指回仓根的',
        '`vitest run --root ../.. packages/<pkg>/`,跑的和 CI 是同一份配置。',
        '',
        ...canonicalLines(pkgDir),
        '',
        '确实要从包目录启动,就把 root 显式指回仓根(路径依旧相对仓根书写):',
        `  pnpm exec vitest run --root ${backToRoot} ${pkgDir ? `${pkgDir}/` : 'packages/<pkg>/'}`,
        '',
        '确需绕过(自担风险): OBJECTUI_VITEST_GUARD=off',
      ]),
    };
  }

  const missing = positionals.filter((p) => {
    if (!CONCRETE_TEST_PATH.test(p)) return false;
    return !exists(path.resolve(vitestRoot, p)) && !exists(path.resolve(cwd, p));
  });

  if (missing.length > 0) {
    return {
      code: 'missing-path-filter',
      message: box('vitest 调用被拒绝:路径过滤指向不存在的文件 (objectui#3288)', [
        `找不到: ${missing.join(', ')}`,
        `解析基准(vitest root): ${vitestRoot}`,
        '',
        'vitest 把位置参数当作【相对 root 的】过滤串:写错的路径不会报错,它只是匹配不到。',
        '再叠上 `passWithNoTests`,整个跑就绿着退出,而你新加的覆盖一次都没执行。',
        '路径请相对【仓库根】书写。',
        '',
        ...canonicalLines(pkgDir),
        '',
        '确需绕过(自担风险): OBJECTUI_VITEST_GUARD=off',
      ]),
    };
  }

  return null;
}

/**
 * Guard entry point used by `vitest.config.mts`.
 *
 * Writes with `fs.writeSync(2, …)` rather than `console.error`: writes to a
 * PIPE are asynchronous on POSIX, and the `process.exit()` on the next line
 * would drop the message exactly when the run is piped into `grep`/`tee` —
 * which is how CI logs and agent verification runs read it.
 *
 * @param {object} input
 * @param {string} input.repoRoot
 * @param {string[]} [input.argv]
 * @param {string} [input.cwd]
 * @param {Record<string, string | undefined>} [input.env]
 * @param {(verdict: { code: string, message: string }) => void} [input.onFail]
 */
export function assertCanonicalVitestInvocation({
  repoRoot,
  argv = process.argv,
  cwd = process.cwd(),
  env = process.env,
  onFail = (verdict) => {
    fs.writeSync(2, `${verdict.message}\n`);
    process.exit(1);
  },
}) {
  const verdict = evaluateVitestInvocation({ argv, cwd, repoRoot, env });
  if (verdict) onFail(verdict);
  return verdict;
}
