#!/usr/bin/env node
/**
 * TWO predicates over one walk, because there are two ways a source file can go
 * unjudged and only one of them was visible here before:
 *
 *   1. Every file ESLint WALKS must resolve at least one rule (objectui#7908).
 *   2. Every source file ESLint does NOT walk must be walked for a reason other
 *      than its EXTENSION (objectui#8337).
 *
 * Each has its own ledger, and both ledgers are shrink-only.
 *
 * ⚠️ Predicate 2 is a deliberate WIDENING of this gate's subject, added by the
 * PR that fixes objectui#8337. Until then this file's subject was the walked
 * population alone, and it said so in this line. The subject moved on purpose:
 * predicate 1 cannot see predicate 2's population BY CONSTRUCTION -- it reports
 * files ESLint walks, and those files are not walked at all.
 *
 * Run:  node scripts/check-lint-rule-coverage.mjs   (also `pnpm check:lint-rule-coverage`)
 * Exit: 0 = every walked file resolves rules or is ledgered AND every unwalked
 *       source file is unwalked for some reason other than its extension or is
 *       ledgered, 1 = any of those is violated, a ledger row has gone stale, or
 *       a census/probe control collapsed
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
 * ## Predicate 2: the extensions ESLint reaches for NEITHER reason (objectui#8337)
 *
 * The section above ends on `{ files: ['**\/*.mts'] }` ENTERING the walk. The
 * neighbouring state is the one where nothing puts `.mts` in the walk at all,
 * and predicate 1 is blind to it by construction: it reports files ESLint
 * walks.
 *
 * Re-measured on `868e825012` (this branch's base) with a real install, ESLint
 * v10.8.1, via the Node API -- three controls in one run, three DISTINCT
 * states, which is what makes any of them a reading:
 *
 *   vitest.config.mts        -> isPathIgnored: true,  config undefined   NOT WALKED
 *   playwright.config.ts     -> isPathIgnored: false, 116 rules          walked + ruled
 *   scripts/github-slug.mjs  -> isPathIgnored: false,   0 rules          predicate 1's class
 *
 * ⭐ `undefined` is not "zero rules" -- it is ESLint declining to look. Collapse
 * the three states into one and the finding disappears.
 *
 * In flat config a file is linted only if some config object's `files` matches
 * it, PLUS the default set ESLint always lints (`.js` / `.cjs` / `.mjs`). Every
 * rule-bearing object here is scoped TS-and-TSX, so an extension in neither
 * place falls through both.
 *
 * ## Why this predicate is over EXTENSIONS and not over `.mts`
 *
 * A predicate that knows only about `.mts` reproduces the blind spot one size
 * smaller. So the unreachable set is DERIVED from the live config on every run
 * -- {@link extensionReach} probes a synthetic path per source extension -- and
 * the measurement immediately paid for itself. On `868e825012` it is:
 *
 *   reachable    js cjs mjs (default set)  ts tsx (the rule-bearing globs)
 *   unreachable  jsx  cts  mts
 *
 * ⭐ THREE, not one. `.jsx` is unreachable here for exactly the same reason as
 * `.mts` and neither the card nor its triage names it; there are no `.jsx`
 * files today, so nothing reported it and nothing would have. Deriving the set
 * rather than listing it is also what makes the ledger shrink-only in the right
 * direction: widen a rule-bearing glob to cover `.mts` and the extension leaves
 * the unreachable set, its ledger row stops matching, and the row goes STALE.
 *
 * ## Why the per-file test substitutes an extension instead of trusting the walk
 *
 * `isPathIgnored` is true for `packages/core/dist/x.mts` as well, and that file
 * is ignored for a completely legitimate reason -- its LOCATION. Measured, same
 * run: inside `**\/dist` and `**\/.source` every one of the eight source
 * extensions comes back ignored, while at the repository root, under
 * `scripts/`, and under `packages/core/src/` the answer is identical and
 * extension-shaped. So the discrimination is per file and mechanical: take the
 * candidate's own path, substitute a REACHABLE extension onto it, and ask
 * again. If some substitution is walked, then the extension -- and nothing else
 * about that path -- is why ESLint declines to look. If every substitution is
 * still ignored, the path is excluded by location or by name and this gate has
 * nothing to say about it.
 *
 * ## Why predicate 2 has a ledger at all, and why its rows are PATHS
 *
 * There is one file in the population today, repo-wide, and it is
 * `vitest.config.mts` (`.cts` and `.jsx` have no files). Reaching it means
 * widening a rule-bearing `files` glob, whose red set is UNMEASURED -- a rule
 * STRENGTH decision that objectui#8337's triage deliberately kept OUT of the
 * gate that reports it. So the file is declared, exactly as predicate 1
 * declares `eslint.config.js`, and the first run is green with it counted.
 *
 * ⚠️ Its rows are exact PATHS where {@link VACUOUS_GROUPS}'s rows are
 * population globs, and the difference is not an inconsistency. There, a new
 * `scripts/check-foo.mjs` adds no new information -- the row already declares
 * that whole class, and 38 such files landed in 14 days. Here, the entire point
 * is that the NEXT `.mts` or `.cts` gets reported: a `**\/*.mts` row would
 * waive precisely the thing this predicate exists to catch, turning a gate into
 * a permanent exemption.
 *
 * ## What keeps predicate 2 from passing vacuously
 *
 * A gate that would be green on an empty population is not a gate, and this one
 * CAN reach an empty population legitimately -- that is what fixing it looks
 * like. So the non-vacuity control is on the INSTRUMENT rather than on the
 * population, and it survives the fix: {@link extensionProbeCollapse} requires
 * the probe to answer BOTH ways in the same run -- at least one source
 * extension reachable (so the config loaded and the rule-bearing globs are
 * live), and a synthetic extension no config object can name coming back
 * unreachable (so the probe is able to say "no" at all). If those two hold and
 * the unreachable set is empty, the emptiness is a reading.
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
import { extname, join, matchesGlob, relative, sep } from 'node:path';
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
 * The JS/TS module extensions ESLint could lint here, as the CLOSED set Node
 * and TypeScript between them define: the three Node module extensions and
 * their JSX form, and the same four for TypeScript. Anything else is not source
 * this toolchain can parse, so it is not a coverage gap when ESLint skips it.
 *
 * This is the candidate set, never the answer. Which of these ESLint actually
 * reaches is derived from the live config on every run -- see
 * {@link extensionReach}.
 */
export const SOURCE_EXTENSIONS = ['js', 'cjs', 'mjs', 'jsx', 'ts', 'cts', 'mts', 'tsx'];

/**
 * Basename stem for the synthetic per-extension probe. Never written to disk:
 * `isPathIgnored` answers about a path, and the path need not exist, which is
 * what lets the question be asked about an extension that has no files yet.
 */
export const EXTENSION_PROBE_STEM = 'eslint-extension-reach-probe';

/**
 * The negative half of the probe's own control: an extension no config object
 * in any repository would name and that is not in ESLint's default set, so a
 * probe that can say "no" at all must say it here. See
 * {@link extensionProbeCollapse}.
 */
export const UNREACHABLE_CONTROL_EXTENSION = 'eslint-reach-control';

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
 * The declared population of predicate 2: source files ESLint declines to look
 * at BECAUSE OF THEIR EXTENSION, as a path and the reason it is here.
 *
 * Like {@link VACUOUS_GROUPS} this is an EXEMPTION list that can only be
 * narrowed or deleted -- but its rows are exact PATHS rather than population
 * globs, and the header says why: a `**\/*.mts` row would waive the next
 * `.mts` file, which is the only thing this predicate exists to catch.
 *
 * @type {{ glob: string, reason: string, card: string }[]}
 */
export const UNREACHED_GROUPS = [
  {
    glob: 'vitest.config.mts',
    reason:
      'The entire population of this predicate today, and the file objectui#8337 was filed about. It ' +
      'defines every project, include glob and setup file the whole test run uses, and it is the one ' +
      'config in this repository no lint run has ever read. Declared rather than repaired because ' +
      'reaching it means widening a rule-bearing `files` glob, whose red set is UNMEASURED -- a rule ' +
      'STRENGTH decision that objectui#8337 triage deliberately kept out of the gate that reports it.',
    card: 'objectui#8337',
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
 * Which source extensions the live config lets ESLint reach, derived rather
 * than listed.
 *
 * The probe is a path that need not exist, taken at the repository root -- a
 * location with no directory ignore over it, so the only thing the answer can
 * be about is the extension. Measured on `868e825012`: the answer is identical
 * at the root, under `scripts/`, and under `packages/core/src/`.
 *
 * @param {ESLint} eslint
 * @param {string} root absolute
 * @returns {Promise<{ reachable: string[], unreachable: string[], controlUnreachable: boolean }>}
 */
export async function extensionReach(eslint, root) {
  /** @type {string[]} */
  const reachable = [];
  /** @type {string[]} */
  const unreachable = [];
  for (const ext of SOURCE_EXTENSIONS) {
    const probe = join(root, `${EXTENSION_PROBE_STEM}.${ext}`);
    if (await eslint.isPathIgnored(probe)) unreachable.push(ext);
    else reachable.push(ext);
  }
  const controlUnreachable = await eslint.isPathIgnored(
    join(root, `${EXTENSION_PROBE_STEM}.${UNREACHABLE_CONTROL_EXTENSION}`),
  );
  return { reachable, unreachable, controlUnreachable };
}

/**
 * The non-vacuity control for predicate 2, on the INSTRUMENT rather than on the
 * population -- because an empty population is what fixing this defect looks
 * like, and a control that dies at the fix would be a control that only ever
 * guarded the broken state.
 *
 * @param {{ reachable: string[], controlUnreachable: boolean }} reach
 * @returns {string | null} the collapse message, or null when the probe discriminates
 */
export function extensionProbeCollapse(reach) {
  if (!reach.reachable.length) {
    return (
      'The extension probe collapsed: ESLint reaches NONE of ' +
      `${SOURCE_EXTENSIONS.join(', ')} at the repository root. The default lint set alone should make ` +
      'js/cjs/mjs reachable, so the config did not load or the probe path is wrong. Every source file ' +
      'would be reported, which is loud -- but the reading is still not one.'
    );
  }
  if (!reach.controlUnreachable) {
    return (
      `The extension probe collapsed: a synthetic '.${UNREACHABLE_CONTROL_EXTENSION}' path came back ` +
      'REACHABLE. The probe cannot answer "no", so an empty unreachable set would mean nothing rather ' +
      'than meaning every source extension is covered.'
    );
  }
  return null;
}

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
 * One walk, two populations: the files ESLint walks, and the source files it
 * does NOT walk. Both are what the two predicates need, and they are the same
 * traversal -- `isPathIgnored` is 1.9s of this gate's ~2s, so walking twice
 * would double the whole cost to re-answer a question already asked.
 *
 * Directories ESLint ignores wholesale are pruned for BOTH populations, which
 * is why `packages/core/dist/x.mts` never reaches predicate 2: a build output
 * is not an extension gap.
 *
 * @param {string} root absolute
 * @param {ESLint} eslint an instance whose `cwd` is `root`
 * @returns {Promise<{ walked: string[], unwalkedSource: string[] }>}
 */
export async function walkTree(root, eslint) {
  /** @type {string[]} */
  const walked = [];
  /** @type {string[]} */
  const unwalkedSource = [];
  const sourceExtensions = new Set(SOURCE_EXTENSIONS);

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
        const rel = relative(root, full).split(sep).join('/');
        if (await eslint.isPathIgnored(full)) {
          if (sourceExtensions.has(extname(entry.name).slice(1))) unwalkedSource.push(rel);
          continue;
        }
        walked.push(rel);
      }
    }
  }

  await descend(root);
  walked.sort();
  unwalkedSource.sort();
  return { walked, unwalkedSource };
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
  return (await walkTree(root, eslint)).walked;
}

/**
 * Of `candidates` -- source files ESLint does not walk -- the ones it declines
 * to look at BECAUSE OF THEIR EXTENSION and nothing else.
 *
 * The test is a substitution on the candidate's OWN path: swap in a reachable
 * extension and ask again. Walked under some substitution means the path is
 * fine and only the extension is not; still ignored under every substitution
 * means the exclusion is by location or by name, which is somebody's deliberate
 * choice and none of this gate's business.
 *
 * @param {ESLint} eslint
 * @param {string} root absolute
 * @param {string[]} candidates paths relative to `root`
 * @param {string[]} reachable extensions, without the dot
 * @returns {Promise<string[]>}
 */
export async function unreachedByExtension(eslint, root, candidates, reachable) {
  /** @type {string[]} */
  const out = [];
  for (const file of candidates) {
    const stem = file.slice(0, file.length - extname(file).length);
    for (const ext of reachable) {
      if (!(await eslint.isPathIgnored(join(root, `${stem}.${ext}`)))) {
        out.push(file);
        break;
      }
    }
  }
  return out;
}

/**
 * Judge one ledger against one measured population. Shared by both predicates:
 * the three directions a row can be wrong are identical, only the populations
 * differ -- `matches` is what the row claims and found, `counterMatches` is
 * what it claims and should not have.
 *
 * @template {{ glob: string }} Row
 * @param {Row[]} groups
 * @param {string[]} positives the population the ledger is allowed to declare
 * @param {string[]} negatives the population a row must never match
 * @returns {{ rows: (Row & { matches: string[], counterMatches: string[] })[], unledgered: string[] }}
 */
export function judgeLedger(groups, positives, negatives) {
  const rows = groups.map((group) => ({
    ...group,
    matches: positives.filter((f) => matchesGlob(f, group.glob)),
    counterMatches: negatives.filter((f) => matchesGlob(f, group.glob)),
  }));
  const unledgered = positives.filter((f) => !groups.some((g) => matchesGlob(f, g.glob)));
  return { rows, unledgered };
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
 * Walk `root` once and judge both predicates against their ledgers.
 *
 * @param {object} options
 * @param {string} options.root absolute repository root
 * @param {typeof VACUOUS_GROUPS} [options.groups] predicate 1's ledger
 * @param {typeof UNREACHED_GROUPS} [options.unreachedGroups] predicate 2's ledger
 * @returns {Promise<{
 *   walked: string[],
 *   vacuous: string[],
 *   ruleBearing: string[],
 *   unwalkedSource: string[],
 *   reach: { reachable: string[], unreachable: string[], controlUnreachable: boolean },
 *   unreached: string[],
 *   rows: { glob: string, reason: string, card: string, vacuousMatches: string[], ruleBearingMatches: string[] }[],
 *   unreachedRows: { glob: string, reason: string, card: string, unreachedMatches: string[], walkedMatches: string[] }[],
 *   findings: {
 *     kind: 'unledgered' | 'over-broad' | 'stale'
 *       | 'unreached-unledgered' | 'unreached-over-broad' | 'unreached-stale',
 *     glob?: string,
 *     files: string[],
 *   }[],
 * }>}
 */
export async function analyze({ root, groups = VACUOUS_GROUPS, unreachedGroups = UNREACHED_GROUPS }) {
  if (typeof matchesGlob !== 'function') {
    throw new Error(
      "node:path does not export matchesGlob on this runtime. It arrived in Node 22.5 and package.json " +
        'declares `engines.node: ">=22.11"`, so reaching this line means the floor moved or the runtime is ' +
        'not the declared one. Failing loudly rather than matching nothing.',
    );
  }

  const eslint = new ESLint({ cwd: root });
  const { walked, unwalkedSource } = await walkTree(root, eslint);
  const reach = await extensionReach(eslint, root);
  const unreached = await unreachedByExtension(eslint, root, unwalkedSource, reach.reachable);

  /** @type {string[]} */
  const vacuous = [];
  /** @type {string[]} */
  const ruleBearing = [];
  for (const file of walked) {
    if ((await ruleCountFor(eslint, join(root, file))) === 0) vacuous.push(file);
    else ruleBearing.push(file);
  }

  const vacuity = judgeLedger(groups, vacuous, ruleBearing);
  const rows = vacuity.rows.map(({ matches, counterMatches, ...group }) => ({
    ...group,
    vacuousMatches: matches,
    ruleBearingMatches: counterMatches,
  }));

  // Predicate 2's counter-population is the WALKED set: a row here over-claims
  // when the file it declares unreachable has since been reached.
  const reachJudgement = judgeLedger(unreachedGroups, unreached, walked);
  const unreachedRows = reachJudgement.rows.map(({ matches, counterMatches, ...group }) => ({
    ...group,
    unreachedMatches: matches,
    walkedMatches: counterMatches,
  }));

  /**
   * @type {{
   *   kind: 'unledgered' | 'over-broad' | 'stale'
   *     | 'unreached-unledgered' | 'unreached-over-broad' | 'unreached-stale',
   *   glob?: string,
   *   files: string[],
   * }[]}
   */
  const findings = [];

  if (vacuity.unledgered.length) findings.push({ kind: 'unledgered', files: vacuity.unledgered });

  for (const row of rows) {
    if (row.ruleBearingMatches.length) {
      findings.push({ kind: 'over-broad', glob: row.glob, files: row.ruleBearingMatches });
    }
    if (row.vacuousMatches.length === 0) {
      findings.push({ kind: 'stale', glob: row.glob, files: [] });
    }
  }

  if (reachJudgement.unledgered.length) {
    findings.push({ kind: 'unreached-unledgered', files: reachJudgement.unledgered });
  }

  for (const row of unreachedRows) {
    if (row.walkedMatches.length) {
      findings.push({ kind: 'unreached-over-broad', glob: row.glob, files: row.walkedMatches });
    }
    if (row.unreachedMatches.length === 0) {
      findings.push({ kind: 'unreached-stale', glob: row.glob, files: [] });
    }
  }

  return { walked, vacuous, ruleBearing, unwalkedSource, reach, unreached, rows, unreachedRows, findings };
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

  const collapse = censusCollapse(result) ?? extensionProbeCollapse(result.reach);
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
      `\n    ESLint reaches ${result.reach.reachable.map((e) => `.${e}`).join(' ')} and NOT ` +
        `${result.reach.unreachable.map((e) => `.${e}`).join(' ') || '(nothing)'} -- ` +
        `${result.unreached.length} source file(s) on disk carry an unreached extension, every one ` +
        `declared by ${result.unreachedRows.length} ledger row(s):`,
    );
    for (const row of result.unreachedRows) {
      console.log(`      ${String(row.unreachedMatches.length).padStart(3)}  ${row.glob}  (${row.card})`);
    }
    console.log(
      '\n    A zero-rule file is one ESLint parses and has nothing to say about. It is not clean; it is\n' +
        '    unjudged, and every exit code downstream reads it as clean. An unreached file is one step\n' +
        '    further out: ESLint never opened it, and `undefined` is not zero rules -- it is ESLint\n' +
        '    declining to look.',
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
    } else if (finding.kind === 'stale') {
      console.error(`    the ledger row '${finding.glob}' matches no file ESLint walks with zero rules.`);
      console.error(
        '\n      The vacuity this row declares is gone -- the files gained rules, moved, or were deleted.\n' +
          '      A row that waives nothing is a live waiver for nothing. Delete it.\n',
      );
    } else if (finding.kind === 'unreached-unledgered') {
      console.error(
        `    ${finding.files.length} source file(s) ESLint does NOT walk, purely because of their extension,\n` +
          '    and no ledger row declares them:',
      );
      for (const file of finding.files) console.error(`      ${file}`);
      console.error(
        '\n      These are not linted vacuously -- they are not linted at all. `calculateConfigForFile`\n' +
          '      returns `undefined` for them, which is ESLint declining to look, and no lint run in this\n' +
          '      repository reports on them in either direction. The same path with a reachable extension\n' +
          '      WOULD be walked, so the extension is the whole reason. Either add the extension to a\n' +
          '      rule-bearing `files` glob in eslint.config.js -- a rule-STRENGTH change, measure its red\n' +
          '      set first -- or add a row to UNREACHED_GROUPS in scripts/check-lint-rule-coverage.mjs with\n' +
          '      the card that owns the decision.\n',
      );
    } else if (finding.kind === 'unreached-over-broad') {
      console.error(
        `    the unreached-ledger row '${finding.glob}' also matches ${finding.files.length} file(s) ESLint DOES walk:`,
      );
      for (const file of finding.files.slice(0, 20)) console.error(`      ${file}`);
      if (finding.files.length > 20) console.error(`      ... and ${finding.files.length - 20} more`);
      console.error(
        '\n      The row over-claims: it declares files unreachable that ESLint now reaches. Narrow it to\n' +
          '      what is still outside every run. This ledger only ever shrinks.\n',
      );
    } else {
      console.error(
        `    the unreached-ledger row '${finding.glob}' matches no source file ESLint declines to look at.`,
      );
      console.error(
        '\n      Either the file was reached -- a rule-bearing `files` glob grew to cover its extension --\n' +
          '      or it moved or was deleted. Either way the waiver waives nothing. Delete the row.\n',
      );
    }
  }
  console.error(
    `    census: ${result.walked.length} walked, ${result.ruleBearing.length} rule-bearing, ` +
      `${result.vacuous.length} zero-rule; ${result.unwalkedSource.length} source file(s) not walked, ` +
      `${result.unreached.length} of them only because of their extension ` +
      `(unreached: ${result.reach.unreachable.map((e) => `.${e}`).join(' ') || 'none'}).\n` +
      '    See https://github.com/objectstack-ai/objectui/issues/7908 (predicate 1) and\n' +
      '    https://github.com/objectstack-ai/objectui/issues/8337 (predicate 2) for why this gate exists.',
  );
  process.exit(1);
}

if (isEntrypoint(import.meta.url)) {
  await main();
}
