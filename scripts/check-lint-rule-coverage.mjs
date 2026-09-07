#!/usr/bin/env node
/**
 * Every file ESLint WALKS must resolve at least one rule, or be a declared row
 * in the ledger below.
 *
 * Run:  node scripts/check-lint-rule-coverage.mjs   (also `pnpm check:lint-rule-coverage`)
 * Exit: 0 = every walked file resolves rules or is ledgered, 1 = a walked file
 *       resolves zero rules outside the ledger, a ledger row has gone stale, or
 *       the census collapsed
 *
 * ## The two truths this gate exists to separate (objectui#7908)
 *
 * Both of these sentences are true on `main` at the same time, and that is the
 * whole finding:
 *
 *   pnpm lint:coverage  ->  46/46 packages linted, 0 with outstanding errors
 *   pnpm lint:root      ->  272 files walked, 95 of them resolve ZERO rules
 *
 * `scripts/check-lint-coverage.mjs` asks whether a package RUNS ESLint. It
 * reads `package.json` for a `lint` script and nothing else, so a package that
 * runs ESLint over files ESLint has no rules for is, to that gate, fully
 * covered. It is not wrong; it answers a different question, and its answer is
 * the reason nobody looked further.
 *
 * The rule-bearing config objects in `eslint.config.js` are all scoped
 * `files: ['**\/*.{ts,tsx}']` or narrower -- including the `no-console`
 * exemption, whose `scripts/**` carve-out is spelled
 * `scripts/**\/*.{ts,tsx}`. So the entire `.js` / `.mjs` / `.cjs` family
 * resolves an EMPTY rule set. ESLint parses those files, reports nothing, and
 * exits 0; every downstream reading -- the workflow's exit code, the package's
 * `lint` script, the coverage gate above -- reads that as clean.
 *
 * Measured on `fedfa3e4a` with a real install, ESLint v10.8.1, via
 * `eslint --print-config FILE` and cross-checked with the ESLint Node API:
 *
 *   scripts/github-slug.mjs         ->    0 rules
 *   scripts/check-lint-coverage.mjs ->    0 rules
 *   eslint.config.js                ->    0 rules
 *   eslint-rules/index.js           ->    0 rules
 *   playwright.config.ts            ->  116 rules   <- control
 *   apps/console/src/__tests__/bootSplash.test.ts -> 117 rules   <- control
 *
 * The two controls are what make the zeros a READING rather than a broken
 * invocation, and they were taken in the same run on the same install.
 *
 * ## What this gate does NOT do
 *
 * It does not turn any rule on. Whether the `.js` family should get
 * `js.configs.recommended` is a gate-STRENGTH decision with an unmeasured red
 * set, and it has its own owner and its own card. This gate only makes the
 * vacuity VISIBLE: a file ESLint walks with an empty rule set is reported
 * rather than counted as covered.
 *
 * ## Why a sibling script rather than an extension of check-lint-coverage.mjs
 *
 * Different question, different input, different granularity. That gate reads
 * `package.json` files and answers per PACKAGE; this one needs an ESLint
 * instance and a tree walk and answers per FILE. Folding them together would
 * produce one gate whose failure message has to answer two unrelated questions,
 * and would falsify that file's own header, which states its subject in its
 * first line. Keeping them apart is also what keeps BOTH numbers printed on
 * every run -- `46/46 packages linted` and `123 files resolve zero rules` are
 * the pair that makes the gap legible, and a merged gate would print one
 * summary line again.
 *
 * ## Why `eslint.config.js` and `eslint-rules/**` are COUNTED, not exempted
 *
 * The obvious objection to this gate is that it reddens on its own config file
 * on day one. It does not, and the reason is the ledger: every vacuous file
 * that exists today is a declared row, so the first run is GREEN with the
 * config file counted. Once that is true, a blanket exemption for
 * "config-and-rules files" would be a SECOND mechanism doing what the ledger
 * already does -- and strictly worse, because an exemption is invisible while a
 * ledger row carries a reason and goes red when it stops applying.
 *
 * Measured both ways before choosing:
 *
 *   counting them   -> 8 rows, 123 files (124 once this file is committed --
 *                      it is a `scripts/*.mjs`, so the gate counts itself)
 *   exempting them  -> 6 rows, 103 files, and 20 files silently outside the
 *                      instrument
 *
 * The 20 are not incidental. `eslint-rules/**` is 19 hand-written files -- ten
 * rule implementations and their `.test.js` neighbours -- and they implement
 * the ratchets `eslint.config.js` sets to `error`. "The code that enforces our
 * lint rules is itself unlinted" is a finding somebody may want to act on; an
 * exemption would delete it from the output permanently and unmeasured.
 *
 * ## The ledger, and the three directions it goes red
 *
 * {@link VACUOUS_GROUPS} is an EXEMPTION list, never the population. Rows are
 * GLOBS, not paths: a row is a statement about a POPULATION ("every JS-family
 * file under `scripts/` resolves zero rules"), which is why a new
 * `scripts/check-foo.mjs` does not red this gate -- the row already declares
 * it, and nothing new is hidden. That is a measured choice, not a convenience:
 * 38 new JS-family files landed under `scripts/` and `eslint-rules/` in the 14
 * days before this gate, so an exact per-row COUNT would have reddened on
 * essentially every tooling PR with "increment a number" as its remedy. A
 * ratchet whose remedy is not the fix is a ratchet that gets switched off.
 *
 * The three reds are:
 *
 *   1. UNLEDGERED -- a walked file resolving zero rules that no row matches.
 *      This is the new-vacuity direction, and it names the file.
 *   2. OVER-BROAD -- a row that also matches a walked file which DOES resolve
 *      rules. This is the "a file left the row" direction: narrow the glob so
 *      the row keeps claiming only what is actually vacuous. It is what makes
 *      partial progress visible without pinning a count.
 *   3. STALE -- a row that matches no walked file at all, or matches only
 *      rule-bearing files. The vacuity it declares is gone; delete the row.
 *
 * A row can therefore only ever be narrowed or deleted, which is the
 * shrink-only property, and it is enforced by the gate rather than by
 * convention.
 *
 * ## How "ESLint walks it" is decided
 *
 * `ESLint#isPathIgnored` is the answer, not a re-implementation of the walk. In
 * flat config a file is "ignored" both when a global `ignores` pattern names it
 * AND when no config object's `files` matches it, which is exactly the
 * predicate wanted here -- `README.md` and `vitest.config.mts` both come back
 * ignored, and neither appears in a real run's output.
 *
 * Cross-checked against ground truth rather than assumed: the enumeration below
 * was compared with the `filePath` set of a real
 * `eslint . --ignore-pattern ... --format json` run at the `lint:root` scope on
 * `fedfa3e4a`. 272 files, 272 matches, zero difference in either direction.
 * `scripts/__tests__/check-lint-rule-coverage.test.ts` re-pins that equivalence
 * against `ESLint#lintFiles` on a fixture tree, where it costs milliseconds.
 *
 * Rule resolution is `ESLint#calculateConfigForFile`, the API half of
 * `--print-config`. Three return shapes, all three load-bearing:
 *
 *   undefined                      -> not walked (also `isPathIgnored`)
 *   an object with no `rules` key  -> WALKED, zero rules  <- the finding
 *   an object with `rules`         -> covered
 *
 * ## Why the vacuous population is exactly the JS family, and cannot be `.ts`
 *
 * Measured, because the obvious mental model is wrong. In flat config a `.ts`
 * file is walked ONLY because some config object's `files` names it, while
 * `.js` / `.cjs` / `.mjs` are linted BY DEFAULT whether or not any config
 * object mentions them. So the two extensions fail in different directions:
 *
 *   narrow every `**\/*.{ts,tsx}` to `**\/*.tsx`
 *     -> `packages/core/src/index.ts` becomes `isPathIgnored: true`, config
 *        `undefined`. 776 files leave the WALK. Zero-rule count: unchanged.
 *   add `{ files: ['**\/*.mts'] }` with no rules
 *     -> `vitest.config.mts` ENTERS the walk with an empty rule set, and this
 *        gate reds naming it.
 *
 * Narrowing a glob therefore cannot manufacture vacuity; only the default-lint
 * set, or a `files:` entry that carries no rules, can. That second shape is the
 * real-world way this defect gets ADDED to a config, and it is the fourth
 * ablation leg on this gate's PR.
 *
 * ## Cost
 *
 * Measured on `fedfa3e4a`, this branch's base: 4438 walked files out of 6699 on disk. Directory
 * walk 23ms, `isPathIgnored` 1.9s, `calculateConfigForFile` 29ms -- about two
 * seconds end to end, one process, no lint pass. Spawning `eslint
 * --print-config` once per file was never attempted at this scale: it is one
 * ESLint startup per file, seconds each. The per-file API call is 3.65ms
 * amortised, so there is no need to resolve per file-GROUP instead of per file,
 * and this gate does not.
 *
 * ## Wiring, and what actually enforces this
 *
 * `package.json` only, as `check:lint-rule-coverage`. There is no dedicated
 * `ci.yml` step, and that is the same position objectui#8301 left
 * `check:unused-deps` in: it asked for one and was closed `not planned` on
 * 2026-09-07. 15 of this repository's `check:*` scripts run in no workflow.
 *
 * What enforces this gate today is its pin test. The `this repository is green`
 * case in `scripts/__tests__/check-lint-rule-coverage.test.ts` runs the whole
 * analysis inside `pnpm test`, so a new unledgered zero-rule file fails CI in
 * the PR that adds it. The costs of that route are the ones objectui#8301
 * named and are real here too: the failure surfaces as one assertion inside a
 * 120-file scripts suite rather than as a step named after the gate, and it
 * lands in the heavy half of CI when this check is a two-second, install-only
 * run. Recorded rather than worked around -- `.github/workflows/**` was outside
 * this session's declared file surface, exactly as in objectui#8301.
 */

import { readdirSync } from 'node:fs';
import { join, matchesGlob, relative, sep } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

import { isEntrypoint } from './invoked-as.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

/**
 * Directories never descended into, whatever the config says. Both are
 * structural rather than lint policy: `.git` is not source, and `node_modules`
 * is another project's. Every OTHER pruned directory is derived from the live
 * config -- see {@link isIgnoredDirectory}.
 */
export const STRUCTURAL_SKIP_DIRS = new Set(['.git', 'node_modules']);

/**
 * The synthetic basename used to ask ESLint whether a whole DIRECTORY is
 * ignored. `isPathIgnored` takes a file, so pruning asks about a file that
 * cannot exist inside it. A pattern that ignores a directory (`**\/dist`,
 * `**\/dist/**`) ignores this probe too; a pattern that ignores only
 * certain files inside one does not, and the directory is descended as it
 * should be.
 */
export const PROBE_BASENAME = 'eslint-rule-coverage-probe.js';

/**
 * The declared vacuous population: every group of files ESLint walks today with
 * an empty rule set, as a glob and the reason it is here.
 *
 * This is an EXEMPTION list, never the population, and it can only be narrowed
 * or deleted -- see the header's "three directions it goes red". `card` names
 * the issue that owns the group, so a row is always traceable to a decision.
 *
 * @type {{ glob: string, reason: string, card: string }[]}
 */
export const VACUOUS_GROUPS = [
  {
    glob: 'scripts/**/*.{js,mjs,cjs}',
    reason:
      'Root repo tooling, and the largest single group. This is where the repository keeps its ' +
      'gate scripts, so the population with the least lint coverage is the one whose bugs are hardest to ' +
      'see from a test -- a gate that silently does nothing exits 0. Turning rules on here has an ' +
      'UNMEASURED red set and is a separate decision (objectui#7908 triage).',
    card: 'objectui#7908',
  },
  {
    glob: 'eslint-rules/**/*.js',
    reason:
      'The custom rule implementations and their .test.js neighbours. Deliberately COUNTED ' +
      'rather than exempted -- these files implement the `object-ui/*` ratchets `eslint.config.js` sets ' +
      'to `error`, so their being unlinted is a finding, not a formality. See the header.',
    card: 'objectui#7908',
  },
  {
    glob: 'eslint.config.js',
    reason:
      'The flat config itself. Also deliberately counted: the ledger is what keeps the first run green, ' +
      'so an exemption would buy nothing and hide the row.',
    card: 'objectui#7908',
  },
  {
    glob: 'lazy-test.mjs',
    reason: 'Root-level test helper, the only JS-family file at the repository root besides the config.',
    card: 'objectui#7908',
  },
  {
    glob: 'e2e/**/*.mjs',
    reason:
      'Playwright live-CI pin helpers under e2e/. Inside lint:root\'s population, and the only ' +
      'JS-family files there that are neither repo tooling nor a build-tool config.',
    card: 'objectui#7908',
  },
  {
    glob: 'packages/*/scripts/**/*.mjs',
    reason:
      'Per-package tooling, dominated by plugin-gantt verification scripts plus the build-css ' +
      'helpers. Same class as root scripts/**, one directory level down, and reached by ' +
      "each package's own `eslint .` rather than by lint:root.",
    card: 'objectui#7908',
  },
  {
    glob: '**/postcss.config.{js,mjs}',
    reason:
      'PostCSS configs at a package root. Loaded by the build tool, never imported by product ' +
      'code, and each is a handful of lines.',
    card: 'objectui#7908',
  },
  {
    glob: 'apps/site/next.config.mjs',
    reason: "The docs site's Next config, same class as the PostCSS row above.",
    card: 'objectui#7908',
  },
];

/**
 * Floors below which a green would be asserting nothing. An empty walk, or a
 * walk that reached no rule-bearing file, passes every check above it -- so the
 * census is checked before the verdict, the same shape the sibling gates use.
 *
 * Measured on `fedfa3e4a`, this branch's base: 4438 walked, 4315 rule-bearing. The floors sit far
 * below both so ordinary movement never touches them; they exist to catch a
 * collapse, not to pin a number.
 */
export const CENSUS_FLOORS = { walked: 1000, ruleBearing: 1000 };

/**
 * Is `dir` a directory ESLint ignores wholesale?
 *
 * @param {ESLint} eslint
 * @param {string} dir absolute
 * @returns {Promise<boolean>}
 */
export async function isIgnoredDirectory(eslint, dir) {
  return eslint.isPathIgnored(join(dir, PROBE_BASENAME));
}

/**
 * Every file on disk under `root` that ESLint would walk, as paths relative to
 * `root` with forward slashes.
 *
 * @param {string} root absolute
 * @param {ESLint} eslint an instance whose `cwd` is `root`
 * @returns {Promise<string[]>}
 */
export async function walkedFiles(root, eslint) {
  /** @type {string[]} */
  const out = [];

  /** @param {string} dir */
  async function descend(dir) {
    /** @type {import('node:fs').Dirent[]} */
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (STRUCTURAL_SKIP_DIRS.has(entry.name)) continue;
        if (await isIgnoredDirectory(eslint, full)) continue;
        await descend(full);
      } else if (entry.isFile()) {
        if (await eslint.isPathIgnored(full)) continue;
        out.push(relative(root, full).split(sep).join('/'));
      }
    }
  }

  await descend(root);
  out.sort();
  return out;
}

/**
 * The number of rules `file` resolves. Zero means ESLint walks it and has
 * nothing to say about it, whatever its contents.
 *
 * @param {ESLint} eslint
 * @param {string} file absolute or relative to the instance's cwd
 * @returns {Promise<number>}
 */
export async function ruleCountFor(eslint, file) {
  const config = await eslint.calculateConfigForFile(file);
  return config?.rules ? Object.keys(config.rules).length : 0;
}

/**
 * Walk `root`, resolve every walked file's rule count, and judge the ledger.
 *
 * @param {object} options
 * @param {string} options.root absolute repository root
 * @param {typeof VACUOUS_GROUPS} [options.groups] the ledger to judge against
 * @returns {Promise<{
 *   walked: string[],
 *   vacuous: string[],
 *   ruleBearing: string[],
 *   rows: { glob: string, reason: string, card: string, vacuousMatches: string[], ruleBearingMatches: string[] }[],
 *   findings: { kind: 'unledgered' | 'over-broad' | 'stale', glob?: string, files: string[] }[],
 * }>}
 */
export async function analyze({ root, groups = VACUOUS_GROUPS }) {
  if (typeof matchesGlob !== 'function') {
    throw new Error(
      "node:path does not export matchesGlob on this runtime. It arrived in Node 22.5 and package.json " +
        'declares `engines.node: ">=22.11"`, so reaching this line means the floor moved or the runtime is ' +
        'not the declared one. Failing loudly rather than matching nothing.',
    );
  }

  const eslint = new ESLint({ cwd: root });
  const walked = await walkedFiles(root, eslint);

  /** @type {string[]} */
  const vacuous = [];
  /** @type {string[]} */
  const ruleBearing = [];
  for (const file of walked) {
    if ((await ruleCountFor(eslint, join(root, file))) === 0) vacuous.push(file);
    else ruleBearing.push(file);
  }

  const rows = groups.map((group) => ({
    ...group,
    vacuousMatches: vacuous.filter((f) => matchesGlob(f, group.glob)),
    ruleBearingMatches: ruleBearing.filter((f) => matchesGlob(f, group.glob)),
  }));

  /** @type {{ kind: 'unledgered' | 'over-broad' | 'stale', glob?: string, files: string[] }[]} */
  const findings = [];

  const unledgered = vacuous.filter((f) => !groups.some((g) => matchesGlob(f, g.glob)));
  if (unledgered.length) findings.push({ kind: 'unledgered', files: unledgered });

  for (const row of rows) {
    if (row.ruleBearingMatches.length) {
      findings.push({ kind: 'over-broad', glob: row.glob, files: row.ruleBearingMatches });
    }
    if (row.vacuousMatches.length === 0) {
      findings.push({ kind: 'stale', glob: row.glob, files: [] });
    }
  }

  return { walked, vacuous, ruleBearing, rows, findings };
}

/**
 * @param {{ walked: string[], vacuous: string[], ruleBearing: string[] }} census
 * @returns {string | null} the collapse message, or null when the census stands
 */
export function censusCollapse(census) {
  if (census.walked.length < CENSUS_FLOORS.walked || census.ruleBearing.length < CENSUS_FLOORS.ruleBearing) {
    return (
      `The census collapsed: ${census.walked.length} walked file(s), ${census.ruleBearing.length} ` +
      `rule-bearing (floors ${CENSUS_FLOORS.walked} / ${CENSUS_FLOORS.ruleBearing}). ` +
      'An empty walk would pass while asserting nothing.'
    );
  }
  return null;
}

async function main() {
  const root = resolve(scriptDir, '..');
  const result = await analyze({ root });

  const collapse = censusCollapse(result);
  if (collapse) {
    console.error(collapse);
    process.exit(1);
  }

  if (!result.findings.length) {
    console.log(
      `OK  ${result.walked.length} file(s) walked by ESLint, ${result.ruleBearing.length} resolve rules, ` +
        `${result.vacuous.length} resolve ZERO rules -- every one of those declared by ` +
        `${result.rows.length} ledger row(s) in scripts/check-lint-rule-coverage.mjs:`,
    );
    for (const row of result.rows) {
      console.log(`      ${String(row.vacuousMatches.length).padStart(3)}  ${row.glob}  (${row.card})`);
    }
    console.log(
      '\n    A zero-rule file is one ESLint parses and has nothing to say about. It is not clean; it is\n' +
        '    unjudged, and every exit code downstream reads it as clean.',
    );
    process.exit(0);
  }

  console.error('x  lint rule coverage:\n');
  for (const finding of result.findings) {
    if (finding.kind === 'unledgered') {
      console.error(
        `    ${finding.files.length} file(s) ESLint walks resolve ZERO rules and no ledger row declares them:`,
      );
      for (const file of finding.files) console.error(`      ${file}`);
      console.error(
        '\n      ESLint parses these and reports nothing, so `eslint .` exits 0 over them and every\n' +
          '      downstream reading calls them clean. Either give them rules in eslint.config.js, or add a\n' +
          '      row to VACUOUS_GROUPS in scripts/check-lint-rule-coverage.mjs with the card that owns it.\n',
      );
    } else if (finding.kind === 'over-broad') {
      console.error(
        `    the ledger row '${finding.glob}' also matches ${finding.files.length} file(s) that DO resolve rules:`,
      );
      for (const file of finding.files.slice(0, 20)) console.error(`      ${file}`);
      if (finding.files.length > 20) console.error(`      ... and ${finding.files.length - 20} more`);
      console.error(
        '\n      The row over-claims: it declares files vacuous that are now covered. Narrow the glob so it\n' +
          '      keeps claiming only what is actually unjudged. The ledger only ever shrinks.\n',
      );
    } else {
      console.error(`    the ledger row '${finding.glob}' matches no file ESLint walks with zero rules.`);
      console.error(
        '\n      The vacuity this row declares is gone -- the files gained rules, moved, or were deleted.\n' +
          '      A row that waives nothing is a live waiver for nothing. Delete it.\n',
      );
    }
  }
  console.error(
    `    census: ${result.walked.length} walked, ${result.ruleBearing.length} rule-bearing, ` +
      `${result.vacuous.length} zero-rule.\n` +
      '    See https://github.com/objectstack-ai/objectui/issues/7908 for why this gate exists.',
  );
  process.exit(1);
}

if (isEntrypoint(import.meta.url)) {
  await main();
}
