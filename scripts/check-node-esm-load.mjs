#!/usr/bin/env node
/**
 * Every published ESM package must be loadable by Node's own resolver.
 *
 * Run:  node scripts/check-node-esm-load.mjs --specifiers-only  (`pnpm check:esm-specifiers`)
 *       node scripts/check-node-esm-load.mjs                    (`pnpm check:node-esm-load`)
 * Exit: 0 = no un-ledgered package emits an unresolvable relative specifier,
 *           and (full mode) every entry the gate imported evaluated,
 *       1 = a finding, OR the gate could not build, OR it inspected too little
 *           to be asserting anything.
 *
 * ## The defect (objectui#4538)
 *
 * `packages/react/dist/index.js` re-exported through EXTENSIONLESS relative
 * specifiers — `export * from './SchemaRenderer'`. Node's ESM resolver does not
 * extension-search relative specifiers (that is a CommonJS behaviour), so
 * importing the published entry under plain Node failed:
 *
 *     code: 'ERR_MODULE_NOT_FOUND',
 *     url:  'file:///.../packages/react/dist/SchemaRenderer'
 *
 * Nothing caught it because every consumer this repository exercises goes
 * through a bundler, and bundlers extension-search happily. The unbundled paths
 * — plain Node ESM, an SSR host importing the package directly, a consumer
 * running the published tarball without a build step — are the ones that break.
 *
 * ## Why it is a SOURCE defect, and what that buys the cheap leg
 *
 * The card was triaged as "a build/emit setting". It is not: `packages/react`
 * builds with a bare `tsc`, and **TypeScript never rewrites import
 * specifiers** — there is no emit flag that appends `.js`. What the source
 * writes is exactly what `dist` ships. The extensionless form was permitted
 * only because the root tsconfig sets `"moduleResolution": "bundler"`.
 *
 * That is what makes a CHEAP, per-pull-request criterion possible at all: for a
 * package whose build preserves specifiers, the emitted specifier IS the source
 * specifier, so the source can be judged without building anything. The
 * expensive artifact-level leg then exists to check that the cheap criterion is
 * the right one — see the two legs below.
 *
 * ## Two legs, because neither one alone is honest
 *
 *   1. SPECIFIER leg (`--specifiers-only`, no build, runs per pull request).
 *      For every published `"type": "module"` package whose build preserves
 *      specifiers, every relative specifier in a file the build emits must
 *      carry an explicit extension. Complete over the whole repository and
 *      instant, so a regression is caught the moment it is written.
 *
 *   2. LOAD leg (full mode, builds). Actually `import()`s each published entry
 *      in a child `node`, through the package's own `exports` map, with no
 *      bundler and no loader hooks. This is the leg objectui#4538 asked for by
 *      name, and the reason is measured rather than assumed: `plugin-charts`'
 *      own emitted entry was CLEAN, and the failure appeared only once
 *      evaluation crossed into `@object-ui/react`. A check that stops at
 *      RESOLUTION passes while the tree is broken, so this one evaluates.
 *
 * The legs disagree by construction, and that is the point. Leg 1 cannot see a
 * defect that reaches a package through a dependency; leg 2 cannot see a
 * defect on a code path evaluation does not take. Leg 1 is the ratchet; leg 2
 * is the proof that the ratchet guards the right property.
 *
 * ## The vacuous forms this gate must never take
 *
 *   - "Scan `dist/` if it exists." With no per-PR full-repo build `dist/` is
 *     usually absent, so such a gate passes because it looked at NOTHING. Leg 1
 *     therefore reads SOURCES, which are always present, and leg 2 BUILDS
 *     rather than hoping someone else did (`--no-build` exists for callers that
 *     just built, and is wired into nothing).
 *   - "Resolve the entry." Measured and rejected above: resolution succeeded on
 *     the very package the card was filed from.
 *   - "Import it and count the successes." A run where every package failed for
 *     an unrelated reason would report no findings of the gated class. So both
 *     legs assert their own SIZE — see MIN_PACKAGES / MIN_LOADED.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SKIP_DIRS, TOOLING_FILE, discoverPackages } from './check-phantom-dependencies.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

/**
 * Below this many published packages the scan is broken, not empty.
 *
 * The `fixed` group holds 40 entries today. A collapse to a handful means the
 * release config or the manifest walk stopped answering, and every assertion
 * below would pass while reading nothing.
 */
export const MIN_PACKAGES = 30;

/**
 * Below this many SUCCESSFUL imports the load leg proved nothing.
 *
 * Without it, a run in which every single entry failed to build would report
 * "no findings of the gated class" and exit 0 — the exact green-having-imported-
 * nothing result objectui#4538 called the failure mode to look for.
 */
export const MIN_LOADED = 3;

// ── which builds preserve specifiers ─────────────────────────────────────────

/** Parse a tsconfig, tolerating the comments this repository writes in them. */
export function readTsconfig(path) {
  const raw = readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(raw);
}

/**
 * A tsconfig's EFFECTIVE `noEmit`, following `extends`.
 *
 * Following the chain is load-bearing rather than thorough: the root tsconfig
 * sets `"noEmit": true` and each emitting package overrides it to `false`, so
 * reading only the leaf answers "undefined" for exactly the configs whose
 * answer decides this gate's scope.
 */
export function effectiveNoEmit(configPath, seen = new Set()) {
  if (!existsSync(configPath) || seen.has(configPath)) return true;
  seen.add(configPath);
  let config;
  try {
    config = readTsconfig(configPath);
  } catch {
    // An unreadable config is graded as emitting, so a parse failure widens the
    // scan rather than silently dropping a package out of it.
    return false;
  }
  if (typeof config.compilerOptions?.noEmit === 'boolean') return config.compilerOptions.noEmit;
  if (typeof config.extends === 'string') {
    const parent = config.extends.startsWith('.')
      ? resolve(dirname(configPath), config.extends)
      : null;
    if (parent) {
      return effectiveNoEmit(parent.endsWith('.json') ? parent : `${parent}.json`, seen);
    }
  }
  return false;
}

/**
 * Whether a package's build copies import specifiers through unchanged.
 *
 * A bare `tsc` does: TypeScript emits the specifier the source wrote. A bundler
 * (`vite build`, `tsup`) RESOLVES relative specifiers while bundling, so an
 * extensionless one in its source never reaches the artifact — measured:
 * `@object-ui/data-objectstack` has 10 extensionless specifiers in `src/` and 0
 * in its `dist/`.
 *
 * A `tsc` step that does not EMIT is excluded, and the emit question is settled
 * by reading the tsconfig rather than the command line. That distinction is not
 * academic: `@object-ui/console`'s build is `tsc && vite build && pnpm
 * build:plugin`, whose `tsc` step carries `"noEmit": true` — it type-checks, and
 * the artifact comes from the two steps after it. Grading it on the command
 * alone reported 124 findings against a package that emits none of them.
 *
 * A pipeline that runs an EMITTING `tsc` and a bundler (`@object-ui/fields`)
 * counts as preserving: the `tsc` half still writes files, and judging it is the
 * conservative direction — a false positive lands in the ledger with a reason, a
 * false negative ships.
 *
 * @param {string} buildScript the package's `scripts.build`, or ''
 * @param {string} pkgDir absolute path to the package, for resolving `-p`
 */
export function buildPreservesSpecifiers(buildScript, pkgDir) {
  if (!buildScript) return false;
  return buildScript
    .split(/&&|\|\||;/)
    .map((step) => step.trim())
    .some((step) => {
      if (!/^tsc\b/.test(step)) return false;
      if (/\B--noEmit\b/.test(step)) return false;
      const project = /\s-(?:p|-project)\s+(\S+)/.exec(step)?.[1] ?? 'tsconfig.json';
      return !effectiveNoEmit(join(pkgDir, project));
    });
}

// ── the ledger ───────────────────────────────────────────────────────────────

/**
 * Packages measured to carry this defect that objectui#4538 did NOT fix.
 *
 * objectui#4538's own scope was `@object-ui/react` plus the dependency closure
 * its entry evaluates through (`types`, `core`, `i18n`) — without those three
 * the card's own package stayed unloadable, so they were in scope by necessity
 * rather than by choice. The packages below carry the identical defect and are
 * left for their own cards: two of them (`app-shell`, `fields`) were held by
 * other sessions when this landed and could not have been touched.
 *
 * This is a RATCHET, not a mute button. A package named here that is now clean
 * is a FINDING — the entry must be deleted in the commit that fixes it, so the
 * ledger cannot outlive the debt it records.
 *
 * Deliberately no per-package counts. This repository has been bitten by
 * hand-maintained numbers that nothing recomputes (see the note in
 * `.github/workflows/lint.yml`); a count here would go stale on its own clock
 * and still read as authoritative. The consequence is stated rather than
 * hidden: growth INSIDE an already-ledgered package is not caught. Those
 * packages are red-listed already, and the entry is removed only when the
 * package reaches zero.
 */
export const SPECIFIER_DEBT = new Map([
  ['@object-ui/app-shell', 'objectui#4538 follow-up; held by another session when #4538 landed'],
  ['@object-ui/auth', 'objectui#4538 follow-up'],
  ['@object-ui/collaboration', 'objectui#4538 follow-up'],
  ['@object-ui/fields', 'objectui#4538 follow-up; held by another session when #4538 landed'],
  ['@object-ui/mobile', 'objectui#4538 follow-up'],
  ['@object-ui/permissions', 'objectui#4538 follow-up'],
  ['@object-ui/providers', 'objectui#4538 follow-up'],
]);

/**
 * Packages whose published entry cannot evaluate under plain Node for a reason
 * that is NOT this defect class, with the reason each one shows.
 *
 * Kept separate from SPECIFIER_DEBT on purpose: an entry here is a statement
 * about a DIFFERENT question (is an unbundled consumer supported at all?),
 * and merging the two would let this gate become a grab-bag in which the
 * defect it exists for stops being visible.
 */
export const LOAD_DEBT = new Map([
  [
    '@object-ui/plugin-dashboard',
    "imports react-grid-layout's stylesheet; Node cannot load `.css` at all, which is a question " +
      'about whether unbundled consumers are supported, not about this defect',
  ],
  [
    '@object-ui/plugin-map',
    "imports maplibre-gl's stylesheet; same question as @object-ui/plugin-dashboard",
  ],
]);

// ── leg 1: the specifiers ────────────────────────────────────────────────────

/**
 * Relative import/export specifiers, in every form this repository writes them:
 * `from '...'`, a bare side-effect `import '...'`, and dynamic `import('...')`.
 */
export const RELATIVE_SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.\.?(?:\/[^'"]*)?)\2/g;

/**
 * Extensions Node's ESM resolver accepts as written, so the specifier is done.
 *
 * `.json` needs an import attribute to actually load and `.css` never loads at
 * all — but neither is THIS defect, and grading them here would silently widen
 * a gate whose whole value is that it names one thing precisely.
 */
export const EXPLICIT_EXTENSION = /\.(js|jsx|mjs|cjs|json|css|svg|png|woff2?)$/;

/**
 * Blank out comments that could carry a retired `import` line, PRESERVING every
 * newline so reported line numbers still address the real file.
 *
 * The newline preservation is not tidiness. Stripping a block comment outright
 * moved every finding in `packages/react/src/index.ts` up by six lines — the
 * license header — so the gate pointed at line 3 for a defect `tsc` reported at
 * line 9. A gate whose line numbers do not match the compiler's teaches the
 * reader to stop trusting them.
 */
export function withoutCommentedCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    // Only a line whose first non-space character opens a comment. A `//` in
    // the middle of a line is far more likely to be inside a URL string.
    .replace(/^([ \t]*)\/\/.*$/gm, '$1');
}

/** Every source file a specifier-preserving build emits from `srcDir`. */
export function emittedSources(srcDir, relativeTo = srcDir) {
  const files = [];
  for (const entry of readdirSync(srcDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(srcDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...emittedSources(full, relativeTo));
      continue;
    }
    if (!/\.[cm]?tsx?$/.test(entry.name)) continue;
    // Tooling material is excluded by every one of these packages' build
    // tsconfigs, so it is not part of what ships. Read from the sibling gate's
    // regex rather than re-spelled, so the two cannot drift apart.
    if (TOOLING_FILE.test(full)) continue;
    files.push(full);
  }
  return files;
}

/**
 * Whether a relative specifier names a real module, and so must carry an
 * extension.
 *
 * Existence is checked rather than assumed: a specifier that resolves to
 * nothing is either dead code the emit drops or a defect of a different class,
 * and reporting it here would be a false positive on this gate's own terms.
 */
export function resolvesToModule(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const ext of ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx']) {
    if (existsSync(base + ext)) return true;
  }
  for (const name of ['index.ts', 'index.tsx', 'index.js']) {
    if (existsSync(join(base, name))) return true;
  }
  return false;
}

/** Findings for one package's sources. */
export function scanSpecifiers(pkg) {
  const findings = [];
  if (!existsSync(pkg.srcDir)) return findings;
  for (const file of emittedSources(pkg.srcDir)) {
    const source = withoutCommentedCode(readFileSync(file, 'utf8'));
    for (const match of source.matchAll(RELATIVE_SPECIFIER)) {
      const spec = match[3];
      if (EXPLICIT_EXTENSION.test(spec)) continue;
      if (!resolvesToModule(file, spec)) continue;
      const line = source.slice(0, match.index).split('\n').length;
      findings.push({ file, line, spec });
    }
  }
  return findings;
}

// ── leg 2: the load ──────────────────────────────────────────────────────────

/**
 * The file an ESM consumer reaches through the package's own `exports` map.
 *
 * Read from the manifest rather than guessed, in the order Node consults, so
 * the gate imports what a real consumer imports.
 */
export function esmEntryOf(manifest) {
  const dot = manifest.exports?.['.'];
  const fromExports =
    typeof dot === 'string' ? dot : dot?.import ?? dot?.default ?? dot?.node;
  return fromExports ?? manifest.module ?? manifest.main ?? null;
}

/**
 * Import one entry in a CHILD `node`, and report what happened.
 *
 * A child process, because a failed import can leave the parent's module
 * registry poisoned, and because a package that calls `process.exit` on load
 * would otherwise take the gate with it. No loader hooks, no bundler, no
 * `--experimental-*`: this is the plain resolver the card measured against.
 */
export function importEntry(entryPath, timeoutMs = 60_000) {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(entryPath)});`],
    { encoding: 'utf8', timeout: timeoutMs },
  );
  if (result.status === 0) return { ok: true };
  const stderr = result.stderr ?? '';
  const code = /\b(ERR_[A-Z_]+)\b/.exec(stderr)?.[1] ?? (result.signal ? `signal:${result.signal}` : 'unknown');
  const message =
    stderr.split('\n').find((l) => /Error|Cannot find/.test(l))?.trim() ??
    stderr.trim().split('\n')[0] ??
    '';
  const missing = /Cannot find module '([^']+)'/.exec(stderr)?.[1] ?? null;
  return { ok: false, code, message: message.slice(0, 300), missing };
}

/**
 * Which workspace package OWNS the path an import could not find.
 *
 * This is objectui#4538's central observation made mechanical. The card was
 * filed from `@object-ui/plugin-charts`, whose own emitted entry is clean; the
 * failure appeared only once evaluation crossed into `@object-ui/react`. The
 * same shape dominates a full run — `plugin-grid`, `plugin-list`,
 * `plugin-timeline` and `plugin-view` all fail on
 * `packages/mobile/dist/useBreakpoint`, which is `@object-ui/mobile`'s defect,
 * not theirs.
 *
 * Reporting those against the importing package would produce a dozen findings
 * for one cause and make the ledger meaningless. Attribution puts each failure
 * on the package that has to fix it.
 *
 * @returns {string|null} the owning package's name, or null if it is not one of ours
 */
export function attributeMissingModule(missingPath, packages, root) {
  if (!missingPath) return null;
  const relative = missingPath.startsWith(root) ? missingPath.slice(root.length + 1) : missingPath;
  let best = null;
  for (const pkg of packages) {
    if (!relative.startsWith(`${pkg.dir}/`)) continue;
    if (!best || pkg.dir.length > best.dir.length) best = pkg;
  }
  return best?.name ?? null;
}

// ── the run ──────────────────────────────────────────────────────────────────

function main(argv) {
  const specifiersOnly = argv.includes('--specifiers-only');
  const noBuild = argv.includes('--no-build');
  const root = resolve(scriptDir, '..');

  const packages = discoverPackages(root).filter((p) => !p.manifest.private);
  if (packages.length < MIN_PACKAGES) {
    console.error(
      `only ${packages.length} published packages discovered (expected at least ${MIN_PACKAGES}). ` +
        'The release group or the manifest walk is broken; every assertion below would pass while reading nothing.',
    );
    return 1;
  }

  let failed = false;

  // ── leg 1 ──
  const esmPackages = packages.filter((p) => p.manifest.type === 'module');
  const preserving = esmPackages.filter((p) =>
    buildPreservesSpecifiers(p.manifest.scripts?.build ?? '', join(root, p.dir)),
  );
  console.log(
    `Specifier leg: ${preserving.length} of ${esmPackages.length} published ESM packages have a ` +
      'specifier-preserving build.',
  );
  if (preserving.length === 0) {
    console.error('no package was judged specifier-preserving — the build-script criterion has stopped matching.');
    return 1;
  }

  const dirty = new Set();
  for (const pkg of preserving) {
    const findings = scanSpecifiers(pkg);
    if (findings.length === 0) continue;
    dirty.add(pkg.name);
    if (SPECIFIER_DEBT.has(pkg.name)) {
      console.log(`  ledgered  ${pkg.name}: ${findings.length} extensionless (${SPECIFIER_DEBT.get(pkg.name)})`);
      continue;
    }
    failed = true;
    console.error(`\n✗ ${pkg.name}: ${findings.length} relative specifier(s) without an explicit extension.`);
    console.error(
      "  Node's ESM resolver does not extension-search relative specifiers, and this package's build " +
        'emits them unchanged, so its published entry cannot be imported under plain Node.',
    );
    for (const f of findings.slice(0, 10)) {
      console.error(`    ${f.file.slice(root.length + 1)}:${f.line}  '${f.spec}'  →  '${f.spec}.js'`);
    }
    if (findings.length > 10) console.error(`    … and ${findings.length - 10} more`);
  }

  for (const [name, reason] of SPECIFIER_DEBT) {
    if (dirty.has(name)) continue;
    if (!preserving.some((p) => p.name === name)) continue;
    failed = true;
    console.error(
      `\n✗ ${name} is in SPECIFIER_DEBT but is now clean (${reason}).\n` +
        '  Delete its entry in the commit that fixed it — a ledger that outlives its debt hides the next regression.',
    );
  }
  if (!failed) console.log('Specifier leg: no un-ledgered package emits an extensionless relative specifier.');

  if (specifiersOnly) {
    console.log('\n--specifiers-only: the load leg (which builds) was not run.');
    return failed ? 1 : 0;
  }

  // ── leg 2 ──
  if (!noBuild) {
    console.log('\nBuilding every published package (the load leg refuses to grade artifacts it did not produce)…');
    try {
      execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' });
    } catch (error) {
      console.error(`\n✗ the build failed, so the load leg has nothing to grade: ${error.message}`);
      return 1;
    }
  }

  let loaded = 0;
  const loadFindings = [];
  const notImportable = [];
  for (const pkg of esmPackages) {
    const entry = esmEntryOf(pkg.manifest);
    if (!entry) {
      // Not a defect: a `bin`-only CLI (`@object-ui/create-plugin`) and a built
      // web application (`@object-ui/runner`, whose dist is `index.html` plus
      // assets) declare no importable entry because they are not libraries.
      // Named on every run rather than skipped silently — an exclusion nobody
      // can see is how a gate quietly stops covering things.
      notImportable.push(`${pkg.name} (${pkg.manifest.bin ? 'bin-only CLI' : 'no importable entry declared'})`);
      continue;
    }
    const entryPath = join(root, pkg.dir, entry);
    if (!existsSync(entryPath)) {
      loadFindings.push({
        name: pkg.name,
        owner: pkg.name,
        code: 'no-build-output',
        message: `${entry} does not exist after the build`,
      });
      continue;
    }
    const outcome = importEntry(entryPath);
    if (outcome.ok) {
      loaded++;
      if (LOAD_DEBT.has(pkg.name)) {
        failed = true;
        console.error(`\n✗ ${pkg.name} is in LOAD_DEBT but now loads. Delete its entry.`);
      }
      continue;
    }
    loadFindings.push({
      name: pkg.name,
      owner: attributeMissingModule(outcome.missing, packages, root) ?? pkg.name,
      ...outcome,
    });
  }

  console.log(`\nLoad leg: ${loaded} of ${esmPackages.length} published ESM entries imported and evaluated.`);
  if (notImportable.length > 0) {
    console.log(`  not importable by design: ${notImportable.join(', ')}`);
  }
  if (loaded < MIN_LOADED) {
    console.error(
      `✗ only ${loaded} entries evaluated (expected at least ${MIN_LOADED}). This run proved nothing — ` +
        'a green verdict here would be the "imported nothing" failure objectui#4538 named.',
    );
    failed = true;
  }

  for (const f of loadFindings) {
    const ledgered =
      LOAD_DEBT.has(f.name) || (f.code === 'ERR_MODULE_NOT_FOUND' && SPECIFIER_DEBT.has(f.owner));
    const via = f.owner !== f.name ? ` (via ${f.owner})` : '';
    if (!ledgered) failed = true;
    const line = `${f.name}${via}: ${f.code} — ${f.message}`;
    if (ledgered) console.log(`  ledgered ${line}`);
    else console.error(`✗ ${line}`);
  }

  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
