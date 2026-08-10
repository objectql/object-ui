#!/usr/bin/env node
/**
 * Validates that every workspace package is actually linted by CI.
 *
 * The sibling of scripts/check-type-check-coverage.mjs, for the same reason:
 * `pnpm lint` runs `turbo run lint`, and turbo silently skips any package with
 * no `lint` script — so a package without one is not "clean", it is unlinted.
 * That is how `apps/console`, the largest surface in the repo, went unlinted
 * while carrying 14 ESLint errors that nobody had ever seen (#2923).
 *
 * The stakes are concrete: every `object-ui/*` rule that `eslint.config.js`
 * sets to `error` is a ratchet — added specifically so a new violation fails
 * CI. Those ratchets are worthless in a package that never runs ESLint.
 *
 * That sentence deliberately neither counts those rules nor lists where they
 * came from. It used to do both, and it was wrong on the day it was written: a
 * verbatim copy of the enumeration #3261 removed from
 * `.github/workflows/lint.yml`, short by the same rule, left behind because
 * that fix only touched the workflow (#3279). A hand-copied enumeration drifts
 * by construction, and a stale one still reads as authoritative — so the next
 * person deciding whether their new rule is inside this gate gets a confident,
 * wrong answer. `eslint.config.js` is the only honest list, each rule carrying
 * its own ADR/issue in the comment beside it, and
 * `scripts/__tests__/lint-workflow.test.ts` fails if a count or a rule name
 * reappears here.
 *
 * Run:  node scripts/check-lint-coverage.mjs
 * Exit: 0 = OK, 1 = coverage regressed or the list is stale
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Known gaps ───────────────────────────────────────────────────────────────
// Packages with outstanding ESLint *errors*, so they cannot carry a `lint`
// script without turning CI red. Warnings do not matter here — ESLint only
// fails on errors unless `--max-warnings` is set, and it deliberately is not
// (warnings repo-wide run into the thousands, dominated by `no-explicit-any`;
// see #2923). No exact count on purpose: this line and the matching paragraph
// in `.github/workflows/lint.yml` used to quote the same hand-maintained
// figure, which every added `any` aged and nothing ever recomputed — two copies
// free to drift apart, and apart from reality (#3274).
//
// Every entry is real debt: fix the errors, add `"lint": "eslint ."`, then
// delete the entry.
//
// Empty since #2927 closed the last two (`@object-ui/console`, 14 errors, and
// `@object-ui/runner`, 3). Every workspace package now runs ESLint. Adding an
// entry here is a deliberate admission that a package ships known errors — do
// it with an issue number, and treat it as temporary.
const DEBT = {};

// ── Collect workspace packages ───────────────────────────────────────────────
const GROUPS = ["packages", "apps", "examples"];

function collect() {
  const out = [];
  for (const group of GROUPS) {
    let entries;
    try {
      entries = readdirSync(resolve(root, group));
    } catch {
      continue;
    }
    for (const entry of entries) {
      const dir = join(group, entry);
      const manifest = resolve(root, dir, "package.json");
      try {
        statSync(manifest);
      } catch {
        continue;
      }
      const pkg = JSON.parse(readFileSync(manifest, "utf8"));
      if (!pkg.name) continue;
      out.push({
        name: pkg.name,
        dir,
        hasScript: Boolean(pkg.scripts?.lint),
      });
    }
  }
  return out;
}

const packages = collect();
const byName = new Map(packages.map((p) => [p.name, p]));

const errors = [];

// 1. Undeclared gap — a package that never runs ESLint.
for (const pkg of packages) {
  if (pkg.hasScript) continue;
  if (DEBT[pkg.name]) continue;
  errors.push(
    `${pkg.name} (${pkg.dir}) has no "lint" script, so \`pnpm lint\` skips it entirely.\n` +
      `      Add  "lint": "eslint ."  to its package.json. If it still has ESLint errors,\n` +
      `      add it to DEBT in scripts/check-lint-coverage.mjs with an error count.`
  );
}

// 2. Ratchet — a declared gap that has been closed must leave the list.
for (const name of Object.keys(DEBT)) {
  const pkg = byName.get(name);
  if (!pkg) {
    errors.push(`${name} is listed in DEBT but is not a workspace package any more — delete the entry.`);
  } else if (pkg.hasScript) {
    errors.push(
      `${name} now has a "lint" script — delete its DEBT entry so the gap cannot reopen` +
        `${DEBT[name].issue ? ` (and close #${DEBT[name].issue} if it is done)` : ""}.`
    );
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const linted = packages.filter((p) => p.hasScript).length;
const debtCount = Object.keys(DEBT).length;
const debtErrors = Object.values(DEBT).reduce((sum, d) => sum + d.errors, 0);

if (errors.length === 0) {
  console.log(
    `✅  lint coverage: ${linted}/${packages.length} packages linted, ` +
      `${debtCount} with outstanding errors (${debtErrors} total).`
  );
  process.exit(0);
}

console.error("❌  lint coverage regressed:\n");
for (const message of errors) {
  console.error(`    • ${message}`);
}
console.error(
  "\nA package with no `lint` script is not clean — turbo skips it and CI sees nothing.\n" +
    "See https://github.com/objectstack-ai/objectui/issues/2923 for why this guard exists."
);
process.exit(1);
