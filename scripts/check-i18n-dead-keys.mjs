#!/usr/bin/env node
/**
 * Reverse i18n sweep (objectui#4658): pack key set MINUS referenced key set.
 *
 * `scripts/check-i18n-call-site-keys.mjs` (objectui#3530) answers "does the key
 * a component ASKS FOR exist in `en`?" — call site -> pack. This file asks the
 * mirror question: "does a key the pack DEFINES have any call site at all?" —
 * pack -> call site. Ten packs identically defining a key nobody asks for is
 * full `all-locales-key-parity`, so that gate cannot see this class either; see
 * that gate's own header for the full five-gate division of labour this is the
 * sixth member of.
 *
 * REPORT-ONLY BY DEFAULT — exit 0 whatever it finds, `--strict` makes a
 * non-empty CONFIRMED list exit 1. Not wired into any CI workflow: a reverse
 * sweep over free-form dynamic-key construction is structurally capable of
 * false positives (a key referenced only through an indirect variable, a
 * template head this parser cannot read, a consumer outside `packages/`+`apps/`),
 * and a gate that cries wolf gets deleted rather than trusted (objectui#4658's
 * own dispatch ruling). This script exists to PRODUCE the candidate list and
 * measure how often it is wrong — see the PR body for that measurement — not to
 * enforce anything today.
 *
 * ## Reuses check-i18n-call-site-keys.mjs's OWN walk, not a second parser
 *
 * `collectEnKeys()` supplies the pack side (`leaves` — every dotted key path,
 * assumed identical across all ten packs, which is what
 * `all-locales-key-parity.test.ts` separately enforces; this script reads only
 * `en`, matching that gate's own premise).
 *
 * `analyze()` supplies the call-site side. It was extended (not duplicated) to
 * also collect, during the SAME AST walk that already classifies every `t()`/
 * `tt()` call as PACK/LOCAL/OTHER and reads its literal key(s):
 *
 *   - `referencedKeys`  — every literal key any PACK call site asks for, PLUS
 *     every plural-suffixed spelling (`key + '_one'`, `+ '_other'`, …) so a
 *     base key that resolves through a suffix does not read as unreferenced.
 *   - `referencedBranches` — every key consumed WHOLESALE via
 *     `t(key, { returnObjects: true })`; every leaf under such a branch is
 *     live, not just the branch key itself.
 *   - `dynamicHeads` — the static HEAD of every template-built key
 *     (`` t(`marketplace.category.${c}`) `` -> `'marketplace.category.'`).
 *     Any pack leaf sharing that prefix is a POSSIBLE runtime target of the
 *     substitution, so it counts as live. This is the call-site gate's own
 *     `missing-prefix` class read in reverse: there "a substitution could hit
 *     a key nothing defines" is the defect; here "a substitution could hit
 *     this key" is exactly why the key must NOT be called dead. Deliberately
 *     recall-over-precision — a namespace nothing dynamically reaches costs
 *     nothing extra to keep live, and marking it dead when it is not would be
 *     the wrong direction to be wrong in for a deletion sweep.
 *
 * A key not covered by any of the three is a CANDIDATE. Two things this
 * mechanism does NOT see, both false-positive sources by construction, both
 * closed by the text safety net below rather than by widening the AST walk:
 *
 *   1. `collectSourceFiles()` (reused unchanged) walks only `packages/` and
 *      `apps/` — same scope as the call-site gate. `examples/` and `e2e/` are
 *      OUT of scope for the AST pass. Measured on this run (see the PR body):
 *      neither directory contains a single `t(`/`tt(` call site today, so the
 *      gap is provably empty right now — but it is a gap, not a guarantee, and
 *      a future example app or e2e helper that starts calling `t()` would
 *      widen it silently. Flagged rather than fixed: matching the call-site
 *      gate's own scope is what makes the two directions comparable, and
 *      widening the walk is a decision for that gate first (its false-positive
 *      cost — `examples/`/`e2e/` code is not what it audits today — is not
 *      this script's to accept unilaterally).
 *   2. A key referenced only INDIRECTLY — assigned to a variable/object
 *      property elsewhere in source (`{ i18nKey: 'console.objectView.new' }`)
 *      and passed to `t()` through that variable rather than as a literal
 *      argument. `literalKeysOf()` (and therefore `referencedKeys`) only reads
 *      the call's OWN argument; a key that reaches `t()` this way is invisible
 *      to the AST pass and would misreport as a candidate.
 *
 * ## The text safety net
 *
 * For every AST candidate, `textFootprint()` greps the WHOLE repository
 * (`packages/`, `apps/`, `examples/`, `e2e/`, `content/`, `scripts/` — everything
 * except the standard build/dep noise and the locale packs themselves, which by
 * definition contain every candidate's defining line and would make every
 * candidate "referenced") for the literal dotted key string. A hit means the
 * key's exact spelling appears somewhere this script's AST pass does not look —
 * closing gap 1 (an `examples/`/`e2e/` call site would spell the key as a plain
 * string there too) and softening gap 2 (an `i18nKey: 'console.objectView.new'`
 * property literal IS a plain-text occurrence of the key, even though it is not
 * an argument of `t()`).
 *
 *   - CONFIRMED — no call site (AST) and no textual occurrence anywhere else in
 *     the repo. The strongest tier; still sample-verify before deleting
 *     (objectui#4658's own dispatch ruling), because a key can still be built by
 *     concatenation this grep cannot fold (`'console.' + 'objectView.' + 'new'`)
 *     or documented only in a form this script does not scan.
 *   - NEEDS-REVIEW — no call site, but the literal string appears somewhere
 *     (a comment, a doc, a fixture, an indirect `i18nKey:`-style property). The
 *     candidate might still be genuinely dead; the hit just means a human has to
 *     look at it before deleting, which is exactly what "AST-dead" alone cannot
 *     tell you.
 *
 * ## Usage
 *
 *   node scripts/check-i18n-dead-keys.mjs             # report, exit 0 always
 *   node scripts/check-i18n-dead-keys.mjs --strict     # exit 1 if CONFIRMED is non-empty
 *   node scripts/check-i18n-dead-keys.mjs --json       # machine-readable, same tiers
 *
 * `--strict` is not called by any workflow today; it exists so a future PR can
 * flip this into a real gate without a rewrite, once the false-positive rate
 * measured here is judged low enough (see the PR body for objectui#4658).
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyze, collectEnKeys } from './check-i18n-call-site-keys.mjs';
import { isEntrypoint } from './invoked-as.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

/** Directories the text safety net never descends into — build output, deps,
 *  VCS metadata. Deliberately NOT the same (smaller) list as the AST walk's
 *  `SKIP_DIRS`: this pass covers the whole repo, so it also needs the
 *  top-level noise the AST walk never reaches in the first place. */
const TEXT_SWEEP_SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo',
  '.changeset',
]);

/** The locale pack directory — every candidate's DEFINITION lives here, so a
 *  hit inside it is not evidence of a reference and must not count as one. */
const LOCALES_DIR = 'packages/i18n/src/locales/';

/**
 * Whether the literal dotted string of each `key` in `keys` occurs anywhere in
 * the repo outside `LOCALES_DIR`.
 *
 * One `grep -rF` pass over the whole tree, not one subprocess per candidate —
 * a repo this size makes per-key greps the slow path. `-F` (fixed string) is
 * load-bearing: the keys contain `.`, which is regex metasyntax, and treating
 * `ns.example.field` as a pattern would also match `ns-exampleXfield`,
 * silently widening the search. NOTE: this docstring deliberately avoids
 * spelling any REAL candidate key as an example — doing so would make this
 * file itself a false textual hit for that key the moment this script scans
 * its own source (measured: an earlier draft named a real objectui#4658
 * target key here and self-polluted that key's report entry).
 *
 * @returns {Map<string, string[]>} key -> repo-relative file paths that
 *   mention it outside the locale packs (deduped, sorted). A key absent from
 *   the map, or mapped to `[]`, has no textual footprint at all.
 */
export function textFootprint(root, keys) {
  const result = new Map(keys.map((key) => [key, []]));
  if (keys.length === 0) return result;

  const patternsFile = join(mkdtempSync(join(tmpdir(), 'i18n-dead-keys-')), 'patterns.txt');
  writeFileSync(patternsFile, keys.join('\n') + '\n');

  const args = [
    '-rFn', // recursive, fixed-string, line-numbered
    '-I', // skip binary files rather than reporting "binary file matches"
    ...[...TEXT_SWEEP_SKIP_DIRS].flatMap((dir) => ['--exclude-dir', dir]),
    '-f', patternsFile,
    '--', root,
  ];

  let output = '';
  try {
    output = execFileSync('grep', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // grep exits 1 when NO line matches at all — a real "nothing found", not a
    // failure. Any other exit code (2 = usage/IO error) must not be swallowed.
    if (error.status === 1) {
      rmSync(dirname(patternsFile), { recursive: true, force: true });
      return result;
    }
    rmSync(dirname(patternsFile), { recursive: true, force: true });
    throw error;
  }
  rmSync(dirname(patternsFile), { recursive: true, force: true });

  for (const line of output.split('\n')) {
    if (!line) continue;
    // `file:line:content` — content itself may contain further `:`, so split
    // only the first two.
    const firstColon = line.indexOf(':');
    const secondColon = line.indexOf(':', firstColon + 1);
    if (firstColon === -1 || secondColon === -1) continue;
    const file = line.slice(0, firstColon);
    const content = line.slice(secondColon + 1);
    const relFile = relative(root, file).split('\\').join('/');
    if (relFile.startsWith(LOCALES_DIR)) continue;
    for (const key of keys) {
      if (content.includes(key)) result.get(key).push(relFile);
    }
  }

  for (const [key, files] of result) result.set(key, [...new Set(files)].sort());
  return result;
}

/** The namespace bucket a key reports under: two segments once the key is at
 *  least three deep (`console.objectView.new` -> `console.objectView`),
 *  else the key's own top-level segment (`common.save` -> `common`). Two
 *  levels is what separates `console`'s ~40 sub-namespaces from each other;
 *  one level would bucket the whole `console.*` sprawl as a single namespace. */
function namespaceOf(key) {
  const parts = key.split('.');
  return parts.length >= 3 ? parts.slice(0, 2).join('.') : parts[0];
}

/**
 * @returns {{
 *   totalPackKeys: number,
 *   referencedKeyCount: number,
 *   candidateCount: number,
 *   confirmed: string[],
 *   needsReview: Array<{ key: string, hits: string[] }>,
 *   byNamespace: Map<string, { confirmed: string[], needsReview: string[] }>,
 * }}
 */
export function sweep(root) {
  const { leaves } = collectEnKeys(root);
  const { referencedKeys, referencedBranches, dynamicHeads } = analyze(root);

  // No collapse guard here, deliberately — unlike the CLI block below, `sweep()`
  // itself is exercised directly against small synthetic fixtures in this
  // file's own test suite, where "a few keys" is the correct, intended shape.
  // The guard belongs where a collapsed REAL scan would otherwise pass
  // silently, which is the CLI entry point below (same split the call-site
  // gate uses: `analyze()` is unguarded, its `invokedDirectly` block checks).

  const branchPrefixes = [...referencedBranches].map((branch) => `${branch}.`);
  const heads = [...dynamicHeads];

  const candidates = [...leaves]
    .filter((key) => {
      if (referencedKeys.has(key)) return false;
      if (branchPrefixes.some((prefix) => key.startsWith(prefix))) return false;
      if (heads.some((head) => key.startsWith(head))) return false;
      return true;
    })
    .sort();

  const footprints = textFootprint(root, candidates);
  const confirmed = candidates.filter((key) => footprints.get(key).length === 0);
  const needsReview = candidates
    .filter((key) => footprints.get(key).length > 0)
    .map((key) => ({ key, hits: footprints.get(key) }));

  const byNamespace = new Map();
  for (const key of confirmed) {
    const ns = namespaceOf(key);
    if (!byNamespace.has(ns)) byNamespace.set(ns, { confirmed: [], needsReview: [] });
    byNamespace.get(ns).confirmed.push(key);
  }
  for (const { key } of needsReview) {
    const ns = namespaceOf(key);
    if (!byNamespace.has(ns)) byNamespace.set(ns, { confirmed: [], needsReview: [] });
    byNamespace.get(ns).needsReview.push(key);
  }

  return {
    totalPackKeys: leaves.size,
    referencedKeyCount: referencedKeys.size,
    candidateCount: candidates.length,
    confirmed,
    needsReview,
    byNamespace,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const invokedDirectly = isEntrypoint(import.meta.url);

if (invokedDirectly) {
  const root = resolve(scriptDir, '..');
  const strict = process.argv.includes('--strict');
  const asJson = process.argv.includes('--json');
  const result = sweep(root);

  // Same collapse guard as the call-site gate's own CLI block: on the REAL
  // repo, an empty or near-empty comparison means the extractor or file walk
  // broke, and would otherwise report every key "dead" while proving nothing.
  if (result.totalPackKeys < 2000 || result.referencedKeyCount < 2000) {
    console.error(
      `The scan collapsed: ${result.totalPackKeys} en keys, ${result.referencedKeyCount} referenced.` +
        ' Expected thousands of both — the extractor or the file walk is broken, and an empty' +
        ' comparison would report everything as dead.',
    );
    process.exit(1);
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          totalPackKeys: result.totalPackKeys,
          referencedKeyCount: result.referencedKeyCount,
          candidateCount: result.candidateCount,
          confirmed: result.confirmed,
          needsReview: result.needsReview,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `Pack keys (en, assumed parity-identical across all ten): ${result.totalPackKeys}. ` +
        `Referenced by a t()/tt() call site (literal + plural-suffixed + returnObjects branch + ` +
        `dynamic-template-reachable): ${result.referencedKeyCount}.`,
    );
    console.log(
      `\n${result.candidateCount} candidate(s) with no call site this pass can see, across ` +
        `${result.byNamespace.size} namespace(s): ${result.confirmed.length} CONFIRMED (no textual ` +
        `footprint anywhere else in the repo either), ${result.needsReview.length} NEEDS-REVIEW ` +
        '(the AST pass sees no call site, but the literal key string appears somewhere else in the ' +
        'repo — read that occurrence before treating the key as dead).',
    );

    const sortedNamespaces = [...result.byNamespace.entries()].sort(
      (a, b) => b[1].confirmed.length + b[1].needsReview.length - (a[1].confirmed.length + a[1].needsReview.length),
    );
    for (const [ns, bucket] of sortedNamespaces) {
      console.log(`\n  ${ns} (${bucket.confirmed.length} confirmed, ${bucket.needsReview.length} needs-review):`);
      for (const key of bucket.confirmed) console.log(`    [confirmed]     ${key}`);
      for (const key of bucket.needsReview) console.log(`    [needs-review]  ${key}`);
    }

    if (result.needsReview.length > 0) {
      console.log('\nneeds-review textual hits:');
      for (const { key, hits } of result.needsReview) {
        console.log(`  ${key}:`);
        for (const hit of hits.slice(0, 5)) console.log(`    ${hit}`);
        if (hits.length > 5) console.log(`    … and ${hits.length - 5} more`);
      }
    }

    console.log(
      '\nThis is a REPORT, not a gate (see the header of scripts/check-i18n-dead-keys.mjs). Every ' +
        'CONFIRMED hit still needs a sampled human check before deletion — see objectui#4658.',
    );
  }

  if (strict && result.confirmed.length > 0) process.exit(1);
  process.exit(0);
}
