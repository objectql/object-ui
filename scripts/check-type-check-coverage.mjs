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
  "@object-ui/plugin-form": { errors: 10, issue: 2919, note: "6x t() fallback-signature mismatch, 2x undefined index, 2x string|number" },
  "@object-ui/plugin-grid": { errors: 4, issue: 2919, note: "2x t() call signature + 2x TS2367 that are closure-mutation narrowing artifacts, NOT a logic bug" },
  "@object-ui/cli": { errors: 4, issue: 2919, note: "tsup dts:true does not fail on these" },
  "@object-ui/plugin-view": { errors: 3, issue: 2916, note: "Record<ViewType,...> missing the 'chart' key" },
  "@object-ui/layout": { errors: 2, issue: 2918, note: "nav type 'component' is implemented but absent from NavigationItemType and its zod enum" },
  "@object-ui/plugin-designer": { errors: 1, issue: 2919, note: "unused parameter" },
  "object-ui": { errors: 1, issue: 2919, note: "TS5107: moduleResolution=node10 deprecated, stops working in TS 7" },
};

// Packages that are not compiled at all: documentation snippets with no build
// script and no tsconfig, whose sources are read rather than run. Re-validated
// on every run — the moment one gains a build script or a tsconfig it is a real
// package, the exemption dies, and the guard fails.
const NOT_COMPILED = ["@object-ui/example-hello-world"];

// Packages whose own `build` type-checks them, so a separate `type-check` script
// would only run the compiler twice. Unlike the `vite build` packages — which
// transpile without checking, the hole that caused #2911 — `next build` runs a
// full type-check unless `typescript.ignoreBuildErrors` is set.
//
// That escape hatch is exactly how this exemption could rot, so it is verified
// on every run rather than trusted: setting `ignoreBuildErrors` fails the guard.
const CHECKED_BY_OWN_BUILD = {
  "@object-ui/site": {
    build: "next build",
    // Caveat worth knowing: the `docs` CI job runs this build only when
    // `apps/site/` or `content/` changed (plus every push to main). A PR that
    // only touches a workspace package in `transpilePackages` therefore does
    // not re-check the site until it lands. Closing that would mean paying a
    // Next build on many more PRs — a cost/coverage call, not a silent gap.
    verifyNoIgnoreBuildErrors: "apps/site/next.config.mjs",
  },
};

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
        build: pkg.scripts?.build,
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
  if (DEBT[pkg.name] || NOT_COMPILED.includes(pkg.name) || CHECKED_BY_OWN_BUILD[pkg.name]) continue;
  errors.push(
    `${pkg.name} (${pkg.dir}) has no "type-check" script, so \`pnpm type-check\` skips it entirely.\n` +
      `      Add  "type-check": "tsc --noEmit"  to its package.json. If its types do not compile\n` +
      `      yet, add it to DEBT in scripts/check-type-check-coverage.mjs with an error count.`
  );
}

// 2. Ratchet — a declared gap that has been closed must leave the list.
for (const name of Object.keys(DEBT)) {
  const pkg = byName.get(name);
  if (!pkg) {
    errors.push(`${name} is listed in DEBT but is not a workspace package any more — delete the entry.`);
  } else if (pkg.hasScript) {
    errors.push(
      `${name} now has a "type-check" script — delete its DEBT entry so the gap cannot reopen` +
        `${DEBT[name].issue ? ` (and close #${DEBT[name].issue} if it is done)` : ""}.`
    );
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

// 4. Ratchet — "its own build checks it" only holds while that stays true.
for (const [name, spec] of Object.entries(CHECKED_BY_OWN_BUILD)) {
  const pkg = byName.get(name);
  if (!pkg) {
    errors.push(`${name} is listed in CHECKED_BY_OWN_BUILD but is not a workspace package any more — delete the entry.`);
    continue;
  }
  if (pkg.hasScript) {
    errors.push(`${name} now has a "type-check" script — delete its CHECKED_BY_OWN_BUILD entry.`);
    continue;
  }
  if (pkg.build !== spec.build) {
    errors.push(
      `${name} is exempt because its build is \`${spec.build}\`, which type-checks — but the build\n` +
        `      script is now \`${pkg.build}\`. Re-confirm it still type-checks, then update or drop the entry.`
    );
    continue;
  }
  // `next build` type-checks by default; `ignoreBuildErrors` silently disables
  // it, which would turn this exemption into exactly the hole #2911 was about.
  if (spec.verifyNoIgnoreBuildErrors) {
    const configPath = resolve(root, spec.verifyNoIgnoreBuildErrors);
    let config;
    try {
      config = readFileSync(configPath, "utf8");
    } catch {
      errors.push(
        `${name}: cannot read ${spec.verifyNoIgnoreBuildErrors}, so the exemption cannot be verified.\n` +
          `      Point verifyNoIgnoreBuildErrors at the real config, or drop the exemption.`
      );
      continue;
    }
    if (/ignoreBuildErrors\s*:\s*true/.test(config)) {
      errors.push(
        `${name} sets \`ignoreBuildErrors: true\` in ${spec.verifyNoIgnoreBuildErrors}, so \`${spec.build}\`\n` +
          `      no longer type-checks it and nothing else does either. Remove that flag, or add a\n` +
          `      "type-check" script and delete this exemption.`
      );
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const checked = packages.filter((p) => p.hasScript).length;
const debtCount = Object.keys(DEBT).length;
const debtErrors = Object.values(DEBT).reduce((sum, d) => sum + d.errors, 0);
const byBuild = Object.keys(CHECKED_BY_OWN_BUILD).length;

if (errors.length === 0) {
  console.log(
    `✅  type-check coverage: ${checked}/${packages.length} via \`type-check\`, ` +
      `${byBuild} via their own build, ` +
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
