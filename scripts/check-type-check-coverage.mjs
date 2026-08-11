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
 * The same question applies one level down, to TESTS (objectstack#4118): a
 * package tsconfig excludes test files — correctly, it is the BUILD config and
 * they would emit into `dist` — and for most packages no other `tsc` invocation
 * read them either. Tests are where agents encode their understanding of a
 * contract, so unchecked tests let a wrong understanding accumulate silently and
 * then READ AS EVIDENCE: objectui#3009 found `spec-derived-unions.test.ts` had
 * built its whole contract on `satisfies` checks that never ran, under a header
 * calling them "the real enforcement". Reverting a derived alias produced zero
 * errors. So the second half of this guard: a package with test files either
 * type-checks them or carries a TEST_DEBT entry with a measured error count.
 *
 * How that second half asks the question matters, and objectui#3968 is why it is
 * asked the way it is now. It used to be asked with two text heuristics — count
 * the test files under `src/`, then look for a `*.test.` glob anywhere in the
 * tsconfig — and BOTH were blind to the same package. `examples/schema-catalog`
 * keeps its tests in `test/` (so the count was 0 and the whole check was skipped)
 * and keeps them out of the build by naming the DIRECTORY in `exclude` (so the
 * glob probe found nothing and reported "already covered"). Four test files were
 * read by no `tsc` invocation while this gate printed green, and the gate's own
 * stated risk — an unchecked test asserting a contract the compiler never
 * checked — was live in the one package laid out that way.
 *
 * So neither question is asked about TEXT any more. Test files are enumerated
 * from the PACKAGE ROOT, and coverage is decided by resolving each tsconfig's
 * `files`/`include`/`exclude` (through `extends`) and asking whether the program
 * really reads each test file. Directory-form excludes then fall out of correct
 * semantics rather than needing a second special case, and so does the shape one
 * step over that no glob probe could ever have caught: an `include` of
 * `["src/**\/*"]` with no `exclude` at all, which reads nothing in `test/`
 * either. `scripts/__tests__/check-type-check-coverage.test.ts` pins all of it
 * against throwaway package trees, including the exact #3968 shape, so the
 * blind spots cannot be reintroduced by a simplification.
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
// Empty, and worth keeping that way: every workspace package now either carries
// a `type-check` script or is declared in one of the exemption lists below.
export const DEBT = {};

// Packages that are not compiled at all: documentation snippets with no build
// script and no tsconfig, whose sources are read rather than run. Re-validated
// on every run — the moment one gains a build script or a tsconfig it is a real
// package, the exemption dies, and the guard fails.
export const NOT_COMPILED = ["@object-ui/example-hello-world"];

// Packages whose own `build` type-checks them, so a separate `type-check` script
// would only run the compiler twice. Unlike the `vite build` packages — which
// transpile without checking, the hole that caused #2911 — `next build` runs a
// full type-check unless `typescript.ignoreBuildErrors` is set.
//
// That escape hatch is exactly how this exemption could rot, so it is verified
// on every run rather than trusted: setting `ignoreBuildErrors` fails the guard.
export const CHECKED_BY_OWN_BUILD = {
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

// ── Known gaps: tests that nothing type-checks ───────────────────────────────
// Packages whose tests do not compile yet, so they cannot chain a
// `tsconfig.test.json` from `type-check`. Every entry is real debt: fix the
// errors, add the config, then delete the entry.
//
// Counts are MEASURED, not estimated — a temp tsconfig per package lifting only
// the test exclusion, against `main` at the time of the sweep, with the same
// template the wired-up packages use (`noEmit`, `composite: false`, `paths: {}`,
// plus `lib`/`types` where the tests need them). Errors resolvable in that
// config are excluded, so these are code-tier only.
//
// The two dominant codes are not random, and each has a playbook:
//   - TS2741/TS2739 "missing required properties" — authoring fixtures typed as
//     PARSED OUTPUT, whose `.default()` fields are required. Type them as the
//     input surface (`z.input`), the fix objectstack#4074 applied in `types`.
//   - TS2339/TS2353 "property does not exist" — implementation wider than the
//     type, the dialect problem. Declare the dialect next to the vocabulary it
//     extends (see scripts/check-spec-symbol-derivation.mjs), don't widen the
//     type to silence it.
export const TEST_DEBT = {
  // `@object-ui/core` and `@object-ui/app-shell` are partially covered already:
  // a `tsconfig.typetests.json` compiles the test files whose whole value is
  // compile-time type assertions (objectui#3181), listed one by one so the rest
  // of the debt tree stays out. Both entries stay because that REST is still
  // unchecked — each number below is that remainder, not the whole package.
  "@object-ui/core": { errors: 72, issue: 4118, note: "TS2741x32, TS2322x17 — mostly the input-vs-output fixture confusion" },
  "@object-ui/app-shell": { errors: 53, issue: 4118, note: "TS2339x24 — implementation wider than the type" },
  "@object-ui/components": { errors: 31, issue: 4118, note: "TS7006x12, TS7031x12 — untyped test callback params" },
  "@object-ui/react": { errors: 27, issue: 4118, note: "TS2769x9 — overload mismatch on render helpers" },
  "@object-ui/i18n": { errors: 13, issue: 4118, note: "TS2769x9" },
  "@object-ui/plugin-form": { errors: 12, issue: 4118, note: "TS2322x10" },
  "@object-ui/plugin-dashboard": { errors: 6, issue: 4118 },
  "@object-ui/plugin-list": { errors: 6, issue: 4118, note: "TS2353x3 — dialect keys" },
  "@object-ui/permissions": { errors: 5, issue: 4118, note: "TS2741x5" },
  "@object-ui/plugin-detail": { errors: 5, issue: 4118, note: "TS2353x3 — dialect keys" },
  "@object-ui/auth": { errors: 2, issue: 4118 },
  "@object-ui/plugin-chatbot": { errors: 2, issue: 4118 },
  "@object-ui/plugin-grid": { errors: 2, issue: 4118 },
  "@object-ui/plugin-map": { errors: 1, issue: 4118 },
};

// ── Collect workspace packages ───────────────────────────────────────────────
export const GROUPS = ["packages", "apps", "examples"];

// Directories that hold no authored test source. `dist` and `node_modules` were
// already skipped when this walk started at `src/`; recursing from the package
// root (objectui#3968) means it now also meets build caches and coverage output,
// and a copy of a test file in `dist` is not a test file anyone maintains.
export const SKIP_DIRS = new Set(["node_modules", "dist", "coverage"]);

/**
 * Every `*.test.ts(x)` file in a package, as paths relative to the package root.
 *
 * Recursing from the PACKAGE ROOT rather than `src/` is half of objectui#3968:
 * `examples/schema-catalog` keeps its tests in `test/`, so a `src/`-only walk
 * counted zero and section 5 skipped the package entirely — the check with the
 * most to say about it never ran.
 */
export function listTestFiles(dir, prefix = "", found = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Dot-directories are tool state (`.turbo`, `.vite`, `.next`), never
      // authored sources.
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      listTestFiles(join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name, found);
    } else if (/\.test\.tsx?$/.test(entry.name)) {
      found.push(prefix ? `${prefix}/${entry.name}` : entry.name);
    }
  }
  return found;
}

/**
 * A tsconfig's comments removed, string-aware.
 *
 * String-aware is the whole point: every include/exclude pattern in this repo
 * contains `/*`, so a naive comment strip eats the globs it was meant to
 * preserve and the config parses to something that never matches anything.
 */
export function stripJsonComments(source) {
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (inLine) {
      if (char === "\n") {
        inLine = false;
        out += char;
      }
      continue;
    }
    if (inBlock) {
      if (char === "*" && next === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === "/" && next === "/") {
      inLine = true;
      i++;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlock = true;
      i++;
      continue;
    }
    out += char;
  }
  return out;
}

/** Parses a tsconfig from disk. `null` when absent; `json: null` when unparseable. */
export function readTsconfig(file) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  try {
    return { file, source, json: JSON.parse(stripJsonComments(source).replace(/,(\s*[}\]])/g, "$1")) };
  } catch (error) {
    return { file, source, json: null, parseError: String(error) };
  }
}

/**
 * A tsconfig's `files` / `include` / `exclude`, resolved through `extends`.
 *
 * Each list is tagged with the directory of the config that DECLARED it, because
 * that is what its patterns are relative to — an inherited `include` in a base
 * config one directory up means something different from the same string written
 * here. A child that declares a key overrides the inherited one wholesale (TS
 * does not merge these three).
 */
export function programPatterns(file, seen = new Set()) {
  const dir = dirname(file);
  const config = readTsconfig(file);
  if (config === null) return { dir, missing: true, files: null, include: null, exclude: null };
  if (config.json === null) return { dir, parseError: config.parseError, files: null, include: null, exclude: null };
  const list = (key) => (Array.isArray(config.json[key]) ? { dir, patterns: config.json[key] } : null);
  const own = { dir, files: list("files"), include: list("include"), exclude: list("exclude") };
  const base = config.json.extends;
  // Only relative `extends` is followed: a package-specifier base lives in
  // `node_modules` and no config in this repo inherits program patterns that way.
  if (typeof base !== "string" || !base.startsWith(".") || seen.has(file)) return own;
  seen.add(file);
  let baseFile = resolve(dir, base);
  if (!/\.json$/.test(baseFile)) baseFile += ".json";
  const inherited = programPatterns(baseFile, seen);
  return {
    dir,
    files: own.files ?? inherited.files,
    include: own.include ?? inherited.include,
    exclude: own.exclude ?? inherited.exclude,
    parseError: own.parseError ?? inherited.parseError,
  };
}

// A pattern segment naming no extension and no wildcard is a DIRECTORY, and
// matches everything under it — which is what makes `"exclude": ["test"]` keep a
// whole test directory out of a program without ever spelling `*.test.`. That
// reading was the second half of objectui#3968's blindness; here it is just the
// documented behaviour of `include`/`exclude`.
const EXTENSION = /\.(?:[cm]?[jt]sx?|json)$/;

/** A TypeScript `include`/`exclude` pattern as an anchored regexp. */
export function tsPatternToRegExp(pattern) {
  let normalized = pattern.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!/[*?]/.test(normalized) && !EXTENSION.test(normalized)) normalized = `${normalized}/**/*`;
  let source = "";
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === "*") {
      if (normalized[i + 1] === "*" && normalized[i + 2] === "/") {
        // `**/` spans any number of directories, including none.
        source += "(?:[^/]*/)*";
        i += 2;
      } else if (normalized[i + 1] === "*") {
        source += ".*";
        i += 1;
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

const DEFAULT_INCLUDE = ["**/*"];
const DEFAULT_EXCLUDE = ["node_modules", "bower_components", "jspm_packages"];

/** Whether the program described by `patterns` reads `absFile`. */
export function programReads(patterns, absFile) {
  const matches = (list) =>
    Boolean(list) && list.patterns.some((pattern) => tsPatternToRegExp(resolve(list.dir, pattern)).test(absFile));
  if (matches(patterns.files)) return true;
  // `files` without `include` means the program is exactly that list.
  if (!patterns.include && patterns.files) return false;
  const include = patterns.include ?? { dir: patterns.dir, patterns: DEFAULT_INCLUDE };
  if (!matches(include)) return false;
  return !matches(patterns.exclude ?? { dir: patterns.dir, patterns: DEFAULT_EXCLUDE });
}

/** The subset of `relPaths` that the tsconfig at `file` does NOT read. */
export function unreadBy(file, packageDir, relPaths) {
  const patterns = programPatterns(file);
  if (patterns.missing || patterns.parseError) return { unread: relPaths, patterns };
  return { unread: relPaths.filter((rel) => !programReads(patterns, join(packageDir, rel))), patterns };
}

export function collect(repoRoot = root) {
  const out = [];
  for (const group of GROUPS) {
    let entries;
    try {
      entries = readdirSync(resolve(repoRoot, group));
    } catch {
      continue;
    }
    for (const entry of entries) {
      const dir = join(group, entry);
      const packageDir = resolve(repoRoot, dir);
      const manifest = resolve(packageDir, "package.json");
      try {
        statSync(manifest);
      } catch {
        continue;
      }
      const pkg = JSON.parse(readFileSync(manifest, "utf8"));
      if (!pkg.name) continue;
      let tsconfig = null;
      try {
        tsconfig = readFileSync(resolve(packageDir, "tsconfig.json"), "utf8");
      } catch {
        /* no tsconfig */
      }
      let testConfig = null;
      try {
        testConfig = readFileSync(resolve(packageDir, "tsconfig.test.json"), "utf8");
      } catch {
        /* no test config */
      }
      let typeTestsConfig = null;
      try {
        typeTestsConfig = readFileSync(resolve(packageDir, "tsconfig.typetests.json"), "utf8");
      } catch {
        /* no type-tests config */
      }
      const typeCheck = pkg.scripts?.["type-check"] ?? "";
      const testFilePaths = listTestFiles(packageDir);

      // Which test files does the BUILD program read? A package whose build
      // compiles its tests needs nothing else; one whose build skips even a
      // single test file needs a project that picks that file up.
      const build =
        tsconfig === null
          ? { unread: testFilePaths, patterns: { missing: true } }
          : unreadBy(resolve(packageDir, "tsconfig.json"), packageDir, testFilePaths);
      // And of those, which does the chained test project read?
      const test =
        testConfig === null
          ? { unread: build.unread, patterns: { missing: true } }
          : unreadBy(resolve(packageDir, "tsconfig.test.json"), packageDir, build.unread);

      out.push({
        name: pkg.name,
        dir,
        hasScript: Boolean(pkg.scripts?.["type-check"]),
        typeCheck,
        build: pkg.scripts?.build,
        hasBuild: Boolean(pkg.scripts?.build),
        hasTsconfig: tsconfig !== null,
        testFiles: testFilePaths.length,
        testFilePaths,
        // The test files the package's own build program does not read. Named
        // for the mechanism it replaced (`buildExcludesTests`, a probe for the
        // string `*.test.` anywhere in the config) but no longer text-based:
        // this is the resolved `files`/`include`/`exclude` verdict, so a
        // directory-form exclude and an `include` that simply never reaches
        // `test/` both land here (objectui#3968).
        buildSkips: build.unread,
        buildSkipsTests: build.unread.length > 0,
        hasTestConfig: testConfig !== null,
        testConfig,
        // Of the files the build skips, the ones the test project does not read
        // either. A `tsconfig.test.json` that compiles none of them passes the
        // old "does it mention a test glob" probe while checking nothing.
        testConfigSkips: test.unread,
        // The config existing is not the same as anything running it — that gap
        // IS objectui#3009. `type-check` has to chain it.
        chainsTestConfig: /-p\s+tsconfig\.test\.json/.test(typeCheck),
        hasTypeTestsConfig: typeTestsConfig !== null,
        typeTestsConfig,
        // Same question, same answer, for the narrow type-assertion project
        // (objectui#3181): `type-check` is what CI runs, so `type-check` — not
        // some sibling script CI never invokes — has to be the thing that runs it.
        chainsTypeTestsConfig: /-p\s+tsconfig\.typetests\.json/.test(typeCheck),
        // A config this gate could not parse decides nothing: say so loudly
        // rather than reporting a coverage verdict computed from a guess.
        configParseErrors: [
          build.patterns?.parseError && `tsconfig.json (${build.patterns.parseError})`,
          test.patterns?.parseError && `tsconfig.test.json (${test.patterns.parseError})`,
        ].filter(Boolean),
      });
    }
  }
  return out;
}

// ── 5. Tests are code too (objectstack#4118) ─────────────────────────────────
// Only asked of packages that are type-checked at all: one whose whole package
// is unchecked is already covered by DEBT above, and stacking a second entry on
// it would just make the same gap look like two.
export const testsCovered = (pkg) =>
  !pkg.buildSkipsTests || (pkg.hasTestConfig && pkg.chainsTestConfig && pkg.testConfigSkips.length === 0);

/** Up to `limit` of `paths`, rendered for an error message. */
const listSome = (paths, limit = 3) =>
  paths.slice(0, limit).join(", ") + (paths.length > limit ? `, +${paths.length - limit} more` : "");

export function auditPackages(packages, tables = {}) {
  const debt = tables.debt ?? DEBT;
  const notCompiled = tables.notCompiled ?? NOT_COMPILED;
  const checkedByOwnBuild = tables.checkedByOwnBuild ?? CHECKED_BY_OWN_BUILD;
  const testDebt = tables.testDebt ?? TEST_DEBT;
  const repoRoot = tables.root ?? root;

  const byName = new Map(packages.map((p) => [p.name, p]));
  const errors = [];

  // 1. Undeclared gap — a package born without a type-check script.
  for (const pkg of packages) {
    if (pkg.hasScript) continue;
    if (debt[pkg.name] || notCompiled.includes(pkg.name) || checkedByOwnBuild[pkg.name]) continue;
    errors.push(
      `${pkg.name} (${pkg.dir}) has no "type-check" script, so \`pnpm type-check\` skips it entirely.\n` +
        `      Add  "type-check": "tsc --noEmit"  to its package.json. If its types do not compile\n` +
        `      yet, add it to DEBT in scripts/check-type-check-coverage.mjs with an error count.`
    );
  }

  // 2. Ratchet — a declared gap that has been closed must leave the list.
  for (const name of Object.keys(debt)) {
    const pkg = byName.get(name);
    if (!pkg) {
      errors.push(`${name} is listed in DEBT but is not a workspace package any more — delete the entry.`);
    } else if (pkg.hasScript) {
      errors.push(
        `${name} now has a "type-check" script — delete its DEBT entry so the gap cannot reopen` +
          `${debt[name].issue ? ` (and close #${debt[name].issue} if it is done)` : ""}.`
      );
    }
  }

  // 3. Ratchet — an exemption only holds while the package really is not compiled.
  for (const name of notCompiled) {
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
  for (const [name, spec] of Object.entries(checkedByOwnBuild)) {
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
      const configPath = resolve(repoRoot, spec.verifyNoIgnoreBuildErrors);
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

  // ── 5. Tests are code too ──────────────────────────────────────────────────
  for (const pkg of packages) {
    if (!pkg.hasScript || pkg.testFiles === 0) continue;

    // 5·0. A config this gate cannot parse: every verdict below would be a guess,
    //      and a tsconfig that fails to parse falls back to including the whole
    //      repository, so it is a real defect either way (see the header of
    //      tsconfig.scripts.json — a `**/` inside a block comment did this once).
    if (pkg.configParseErrors.length > 0) {
      errors.push(
        `${pkg.name} (${pkg.dir}): cannot parse ${pkg.configParseErrors.join(" and ")}, so whether any\n` +
          `      \`tsc\` invocation reads its ${pkg.testFiles} test file(s) cannot be decided. Fix the config —\n` +
          `      a tsconfig that fails to parse silently includes the entire repository.`
      );
      continue;
    }

    // 5a. A `tsconfig.test.json` nothing runs is the objectui#3009 shape exactly:
    //     a file that looks like enforcement while no `tsc` invocation reads it.
    if (pkg.hasTestConfig && !pkg.chainsTestConfig) {
      errors.push(
        `${pkg.name} (${pkg.dir}) has a tsconfig.test.json that its "type-check" script never runs,\n` +
          `      so the file looks like enforcement while nothing compiles it — the exact shape of\n` +
          `      objectui#3009. Chain it:  "type-check": "tsc --noEmit && tsc -p tsconfig.test.json"`
      );
      continue;
    }

    // 5b. A config that emits, or that does not actually read the tests its
    //     package's build skips, would pass 5a while checking nothing.
    if (pkg.hasTestConfig && pkg.chainsTestConfig) {
      if (!/"noEmit"\s*:\s*true/.test(pkg.testConfig)) {
        errors.push(
          `${pkg.name} (${pkg.dir}): tsconfig.test.json must set "noEmit": true — it is a checking\n` +
            `      project, and emitting would put test output in the published dist.`
        );
      }
      if (pkg.testConfigSkips.length > 0) {
        errors.push(
          `${pkg.name} (${pkg.dir}): tsconfig.test.json does not read ${pkg.testConfigSkips.length} of the\n` +
            `      ${pkg.buildSkips.length} test file(s) its build program skips, so those are compiled by nothing:\n` +
            `      ${listSome(pkg.testConfigSkips)}\n` +
            `      Its resolved "files"/"include"/"exclude" have to reach them. Note "exclude" is INHERITED\n` +
            `      through "extends": a build config that excludes the whole \`test\` directory keeps this\n` +
            `      project empty too unless it overrides that (objectui#3968).`
        );
      }
      continue;
    }

    // 5c. Undeclared gap — tests exist and nothing reads them.
    if (!testsCovered(pkg) && !testDebt[pkg.name]) {
      errors.push(
        `${pkg.name} (${pkg.dir}) has ${pkg.buildSkips.length} test file${pkg.buildSkips.length === 1 ? "" : "s"} that no \`tsc\`\n` +
          `      invocation reads: its tsconfig.json program does not include them (correctly — it is the\n` +
          `      build config) and no tsconfig.test.json chains off "type-check". An unchecked test can\n` +
          `      assert a contract the compiler never checked, and then read as evidence that the contract\n` +
          `      holds. Unread: ${listSome(pkg.buildSkips)}\n` +
          `      Add a tsconfig.test.json (see packages/types/tsconfig.test.json, or\n` +
          `      examples/schema-catalog/tsconfig.test.json for tests that live outside \`src/\`) and chain\n` +
          `      it, or add a TEST_DEBT entry with the measured error count.`
      );
    }
  }

  // ── 5½. The narrow type-assertion project, if a package has one ────────────
  // Some test files exist ONLY for their COMPILE-TIME assertions (`Assert<Equal<A,
  // B>>`). Types are erased at runtime, so vitest proves nothing about those; only
  // `tsc` does. That is objectui#3181: app-shell's `spec-symbol-parity.test.ts`
  // carried a header calling its assertions a tripwire, while a provably-false
  // `Assert<Equal<1, 2>>` appended to it passed `pnpm type-check` at exit 0.
  //
  // A package whose test tree is still in TEST_DEBT can rescue those specific
  // files with a `tsconfig.typetests.json` that lists them explicitly, instead of
  // waiting for the whole backlog. This section keeps that project honest — it is
  // worth exactly as much as the gate that runs it, and nothing at all otherwise.
  for (const pkg of packages) {
    if (!pkg.hasTypeTestsConfig) continue;

    if (!pkg.chainsTypeTestsConfig) {
      errors.push(
        `${pkg.name} (${pkg.dir}) has a tsconfig.typetests.json that its "type-check" script never\n` +
          `      runs, so its compile-time assertions are erased at runtime and compiled by nothing —\n` +
          `      the exact state objectui#3181 fixed. CI runs \`pnpm type-check\` (turbo -> the package's\n` +
          `      own "type-check"), so that is the script that has to chain it:\n` +
          `      "type-check": "tsc --noEmit && tsc -p tsconfig.typetests.json"`
      );
      continue;
    }

    if (!/"noEmit"\s*:\s*true/.test(pkg.typeTestsConfig)) {
      errors.push(
        `${pkg.name} (${pkg.dir}): tsconfig.typetests.json must set "noEmit": true — it is a checking\n` +
          `      project, and emitting would put test output in the published dist.`
      );
    }

    if (!/\.test\.tsx?"/.test(pkg.typeTestsConfig)) {
      errors.push(
        `${pkg.name} (${pkg.dir}): tsconfig.typetests.json does not "include" any test file, so it\n` +
          `      compiles nothing and passes vacuously. List the files whose type assertions it exists\n` +
          `      to check, e.g. "include": ["src/__tests__/spec-symbol-parity.test.ts"]`
      );
    }
  }

  // 6. Ratchet — a declared test gap that has been closed must leave the list.
  for (const [name, spec] of Object.entries(testDebt)) {
    const pkg = byName.get(name);
    if (!pkg) {
      errors.push(`${name} is listed in TEST_DEBT but is not a workspace package any more — delete the entry.`);
      continue;
    }
    if (pkg.testFiles === 0) {
      errors.push(`${name} is listed in TEST_DEBT but has no test files any more — delete the entry.`);
      continue;
    }
    // A package that is not type-checked AT ALL is already declared in DEBT. A
    // second entry here would make one gap read as two, and would survive the day
    // DEBT is paid off, so the test gap has to be re-measured then anyway.
    if (!pkg.hasScript) {
      errors.push(
        `${name} is listed in TEST_DEBT but has no "type-check" script, so its whole package is\n` +
          `      unchecked and DEBT already declares that. Delete the TEST_DEBT entry; add it back with\n` +
          `      a fresh measurement once the package type-checks at all.`
      );
      continue;
    }
    if (testsCovered(pkg)) {
      errors.push(
        `${name} type-checks its tests now — delete its TEST_DEBT entry so the gap cannot reopen` +
          `${spec.issue ? ` (and close #${spec.issue} if the list is empty)` : ""}.`
      );
    }
  }

  return errors;
}

// ── Report ───────────────────────────────────────────────────────────────────
export function main() {
  const packages = collect();
  const errors = auditPackages(packages);

  const checked = packages.filter((p) => p.hasScript).length;
  const debtCount = Object.keys(DEBT).length;
  const debtErrors = Object.values(DEBT).reduce((sum, d) => sum + d.errors, 0);
  const byBuild = Object.keys(CHECKED_BY_OWN_BUILD).length;

  const withTests = packages.filter((p) => p.hasScript && p.testFiles > 0);
  const testsChecked = withTests.filter(testsCovered).length;
  const testDebtErrors = Object.values(TEST_DEBT).reduce((sum, d) => sum + d.errors, 0);
  const typeTestProjects = packages.filter((p) => p.hasTypeTestsConfig && p.chainsTypeTestsConfig).length;

  if (errors.length === 0) {
    console.log(
      `✅  type-check coverage: ${checked}/${packages.length} via \`type-check\`, ` +
        `${byBuild} via their own build, ` +
        `${debtCount} known-broken (${debtErrors} errors outstanding), ` +
        `${NOT_COMPILED.length} not compiled.`
    );
    console.log(
      `✅  test type-check coverage: ${testsChecked}/${withTests.length} packages compile their tests, ` +
        `${Object.keys(TEST_DEBT).length} declared debt (${testDebtErrors} errors outstanding), ` +
        `${typeTestProjects} with a narrow type-assertion project.`
    );
    process.exit(0);
  }

  console.error("❌  type-check coverage regressed:\n");
  for (const message of errors) {
    console.error(`    • ${message}`);
  }
  console.error(
    "\nA package with no `type-check` script is not passing — turbo skips it and CI sees nothing.\n" +
      "A TEST file no program reads is not passing either — nothing compiles it, so what it asserts\n" +
      "about a contract was never checked (objectstack#4118, objectui#3968).\n" +
      "See https://github.com/objectstack-ai/objectui/issues/2911 for why this guard exists."
  );
  process.exit(1);
}

// Run only when invoked directly — `scripts/__tests__/check-type-check-coverage.test.ts`
// imports `collect()` / `auditPackages()` from here and must not trigger a repo
// scan (or a `process.exit`) on import. Same guard shape as
// `scripts/check-skills-paths.mjs` and `scripts/check-control-bytes.mjs`.
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) main();
