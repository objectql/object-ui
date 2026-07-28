#!/usr/bin/env node
/**
 * Validates that every workspace package's types are actually checked by CI.
 *
 * `pnpm type-check` runs `turbo run type-check`, and turbo silently skips any
 * package that has no `type-check` script — so a package without one is not
 * "passing", it is unchecked. That is how #2911 happened: `plugin-map` sat
 * broken on `main` for a day while build and tests were green.
 *
 * This guard makes that invisibility impossible. A package with no
 * `type-check` script must be declared below, with a reason, and the lists can
 * only shrink: once a package gains the script, its entry has to be deleted or
 * this guard fails.
 *
 * Run:  node scripts/check-type-check-coverage.mjs
 * Exit: 0 = OK, 1 = coverage regressed or the lists are stale
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Known gaps ───────────────────────────────────────────────────────────────
// Packages whose types do NOT currently compile, so they cannot carry a
// `type-check` script yet. Every entry is real debt: fix the errors, add
// `"type-check": "tsc --noEmit"`, then delete the entry. Counts are from the
// #2911 sweep (bare `tsc --noEmit` with the `paths` override its type-checked
// peers already carry, so the TS6059 rootDir noise is excluded).
const DEBT = {
  "@object-ui/runner": { errors: 14, note: "no tsconfig.json at all; also imports two exports @object-ui/core does not have" },
  "@object-ui/plugin-form": { errors: 10, note: "6x t() fallback-signature mismatch, 2x undefined index, 2x string|number" },
  "@object-ui/plugin-grid": { errors: 4, note: "importParsers.ts:352 dead branch + 2x t() call signature" },
  "@object-ui/cli": { errors: 4, note: "tsup dts:true does not fail on these" },
  "@object-ui/plugin-view": { errors: 3, note: "Record<ViewType,...> missing the 'chart' key" },
  "@object-ui/layout": { errors: 2, note: "'component' compared against a union that lacks it" },
  "@object-ui/plugin-designer": { errors: 1, note: "unused binding" },
  "object-ui": { errors: 1, note: "TS5107: moduleResolution=node10 deprecated" },
  "@object-ui/site": { errors: 7, note: "TS2304 on Next's generated LayoutProps/PageProps; needs .next/types from a prior next build" },
};

// Packages that are not compiled at all: documentation snippets with no build
// script and no tsconfig, whose sources are read rather than run. Re-validated
// on every run — the moment one gains a build script or a tsconfig it is a real
// package, the exemption dies, and the guard fails.
const NOT_COMPILED = ["@object-ui/example-hello-world"];

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
      let hasTsconfig = true;
      try {
        statSync(resolve(root, dir, "tsconfig.json"));
      } catch {
        hasTsconfig = false;
      }
      out.push({
        name: pkg.name,
        dir,
        hasScript: Boolean(pkg.scripts?.["type-check"]),
        hasBuild: Boolean(pkg.scripts?.build),
        hasTsconfig,
      });
    }
  }
  return out;
}

const packages = collect();
const byName = new Map(packages.map((p) => [p.name, p]));

const errors = [];

// 1. Undeclared gap — a package born without a type-check script.
for (const pkg of packages) {
  if (pkg.hasScript) continue;
  if (DEBT[pkg.name] || NOT_COMPILED.includes(pkg.name)) continue;
  errors.push(
    `${pkg.name} (${pkg.dir}) has no "type-check" script, so \`pnpm type-check\` skips it entirely.\n` +
      `      Add  "type-check": "tsc --noEmit"  to its package.json. If its types do not compile\n` +
      `      yet, add it to DEBT in ${"scripts/check-type-check-coverage.mjs"} with an error count.`
  );
}

// 2. Ratchet — a declared gap that has been closed must leave the list.
for (const name of Object.keys(DEBT)) {
  const pkg = byName.get(name);
  if (!pkg) {
    errors.push(`${name} is listed in DEBT but is not a workspace package any more — delete the entry.`);
  } else if (pkg.hasScript) {
    errors.push(`${name} now has a "type-check" script — delete its DEBT entry so the gap cannot reopen.`);
  }
}

// 3. Ratchet — an exemption only holds while the package really is not compiled.
for (const name of NOT_COMPILED) {
  const pkg = byName.get(name);
  if (!pkg) {
    errors.push(`${name} is listed in NOT_COMPILED but is not a workspace package any more — delete the entry.`);
    continue;
  }
  if (pkg.hasScript) {
    errors.push(`${name} now has a "type-check" script — delete its NOT_COMPILED entry.`);
    continue;
  }
  const acquired = [pkg.hasBuild && "a build script", pkg.hasTsconfig && "a tsconfig.json"].filter(Boolean);
  if (acquired.length > 0) {
    errors.push(
      `${name} is listed in NOT_COMPILED but has gained ${acquired.join(" and ")} — it is a real package now.\n` +
        `      Add  "type-check": "tsc --noEmit"  and remove the exemption.`
    );
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const checked = packages.filter((p) => p.hasScript).length;
const debtCount = Object.keys(DEBT).length;
const debtErrors = Object.values(DEBT).reduce((sum, d) => sum + d.errors, 0);

if (errors.length === 0) {
  console.log(
    `✅  type-check coverage: ${checked}/${packages.length} packages checked, ` +
      `${debtCount} known-broken (${debtErrors} errors outstanding), ` +
      `${NOT_COMPILED.length} not compiled.`
  );
  process.exit(0);
}

console.error("❌  type-check coverage regressed:\n");
for (const message of errors) {
  console.error(`    • ${message}`);
}
console.error(
  "\nA package with no `type-check` script is not passing — turbo skips it and CI sees nothing.\n" +
    "See https://github.com/objectstack-ai/objectui/issues/2911 for why this guard exists."
);
process.exit(1);
