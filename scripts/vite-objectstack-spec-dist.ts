// `OBJECTSTACK_SPEC_DIST` — resolve `@objectstack/spec` at a locally built spec
// package instead of the one the lockfile installed.
//
// ## Why the hook exists (objectui#4854, ruled on objectstack#8134)
//
// The framework's `scripts/build-console.sh` already injects its own
// `@objectstack/client` into the console build, so a framework release never
// ships a console bundled against a stale published client. The same class of
// skew exists for `@objectstack/spec` and is currently SILENT: an authorable key
// added to the framework's `packages/spec` after the last spec publish is
// accepted and round-tripped by the server, while the Studio designer — bundled
// against the published spec — rejects it as an unrecognized key. Nothing asks
// whether the vendored spec carries the surface the framework declares.
//
// ## Why the client hook does not transfer as-is
//
// The client override is one prefix alias to a package directory, which is safe
// because `@objectstack/client`'s exports map has exactly one entry and nothing
// imports a subpath. `@objectstack/spec` is a different shape — measured on the
// installed 17.0.0-rc.6: 18 exports entries, 17 of them reached by this
// repository's own imports, across 29 packages. Every entry redirects into
// `dist/`, so a bare prefix alias rewrites `@objectstack/spec/ui` to
// `SPEC_PKG/ui`, a path that does not exist. A Vite string alias is prefix
// replacement; it never consults the target's exports map.
//
// So this module reads the exports map OF THE OVERRIDE and emits one alias per
// entry. Deriving beats prescribing here, and the map itself says why: the
// obvious rule ("subpath NAME lives at dist/NAME/index.mjs") is wrong for
// `./openapi.json`, which the map redirects to `json-schema/openapi.json` — a
// hand-written table would have shipped a hook that mis-resolves it.
//
// ## Two properties this module holds on purpose
//
// - **Loud, never lenient.** Every way the override can be wrong — path absent,
//   not the spec package, an exports entry naming a file the built package does
//   not contain — throws with the offending value named. A tolerant fallback to
//   the installed spec would silently rebuild the exact skew the hook exists to
//   kill, and the framework guard could not tell the difference.
// - **Inert when unset.** `resolveSpecDistInjection(undefined, …)` returns
//   `null` and the caller's config keeps every baseline value, identity
//   included.

import fs from 'node:fs';
import path from 'node:path';

/** The package this hook overrides. Also the guard against a mis-aimed path. */
export const SPEC_PACKAGE_NAME = '@objectstack/spec';

/**
 * Export conditions a browser/ESM bundler picks, in preference order.
 *
 * `types` is deliberately absent: it sits FIRST inside each condition object in
 * the spec's map, and a resolver that walked object keys in declaration order
 * would alias every subpath at a `.d.mts` file.
 */
const IMPORT_CONDITIONS = ['import', 'module', 'browser', 'default'] as const;

/** Character class matching either path separator, for a generated `RegExp`. */
const SEPARATOR_CLASS = '[\\\\/]';

/** What the caller wires into its Vite config when the override is set. */
export interface SpecDistInjection {
  /** Absolute (realpath'd) directory of the overriding spec package. */
  packageDir: string;
  /**
   * `resolve.alias` entries, SUBPATHS FIRST and the bare specifier last.
   *
   * The order is load-bearing. Vite matches a string `find` when the specifier
   * equals it or starts with it plus a slash, first match wins, so a bare
   * `@objectstack/spec` entry placed first would swallow every subpath. Last, it
   * still catches specifiers the override's map does NOT declare and rewrites
   * them to a path that cannot exist — a resolve error naming the specifier,
   * which is the intended outcome: an undeclared subpath must not quietly fall
   * through to the installed spec.
   */
  aliases: Record<string, string>;
  /** Directories the dev server must be allowed to read (out-of-workspace). */
  fsAllow: string[];
  /** `advancedChunks` test that keeps the injected spec in the vendor chunk. */
  vendorChunkTest: RegExp;
}

/** Escapes a literal string for embedding in a `RegExp` source. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The `import`-condition leaf of one exports-map value.
 *
 * Returns `null` for an entry that resolves to nothing a bundler could take
 * (e.g. one exported only under `require`), so the caller can name it.
 */
function pickImportTarget(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const hit = pickImportTarget(candidate);
      if (hit) return hit;
    }
    return null;
  }
  const conditions = value as Record<string, unknown>;
  for (const condition of IMPORT_CONDITIONS) {
    if (!Object.hasOwn(conditions, condition)) continue;
    const hit = pickImportTarget(conditions[condition]);
    if (hit) return hit;
  }
  return null;
}

// A function DECLARATION, not a `const` arrow: TypeScript only narrows on a
// never-returning call when the callee is declared this way, and every caller
// below relies on the narrowing to keep its own return type honest.
function fail(message: string): never {
  throw new Error(`OBJECTSTACK_SPEC_DIST: ${message}`);
}

/**
 * The spec package directory a raw override value names.
 *
 * Accepts what the client hook accepts and a little more — the package dir, its
 * `dist/`, or a built entry file inside it — by walking up to the nearest
 * `package.json` and requiring it to BE the spec package. Realpath'd, because a
 * symlinked override would otherwise produce alias targets whose module ids
 * (which Vite realpaths) never match the vendor-chunk test built from them.
 */
function findSpecPackageDir(raw: string): string {
  const start = path.resolve(raw);
  if (!fs.existsSync(start)) {
    fail(`\`${raw}\` does not exist (resolved to \`${start}\`)`);
  }
  let dir = fs.statSync(start).isDirectory() ? start : path.dirname(start);
  const inspected: string[] = [];
  for (;;) {
    const manifestPath = path.join(dir, 'package.json');
    if (fs.existsSync(manifestPath)) {
      inspected.push(manifestPath);
      let name: unknown;
      try {
        name = (JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { name?: unknown }).name;
      } catch (error) {
        fail(`\`${manifestPath}\` is not readable JSON (${(error as Error).message})`);
      }
      if (name === SPEC_PACKAGE_NAME) {
        try {
          return fs.realpathSync(dir);
        } catch {
          return dir;
        }
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return fail(
    `\`${raw}\` is not inside a \`${SPEC_PACKAGE_NAME}\` package — ` +
      `walked up from \`${start}\` and found ${inspected.length ? inspected.join(', ') : 'no package.json'}`
  );
}

/**
 * Every specifier the package's exports map declares, mapped to the absolute
 * file a bundler resolves it to.
 *
 * Cross-checked in `scripts/__tests__/vite-objectstack-spec-dist.test.ts`
 * against Node's own resolver (`import.meta.resolve`) for all 18 entries, so
 * this is not a second opinion about the map — it agrees with the algorithm.
 */
export function readSpecExportTargets(packageDir: string): Map<string, string> {
  const manifestPath = path.join(packageDir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { exports?: unknown };
  const exportsMap = manifest.exports;
  if (exportsMap === null || typeof exportsMap !== 'object' || Array.isArray(exportsMap)) {
    fail(`\`${manifestPath}\` declares no exports map, so no subpath can be resolved`);
  }

  const targets = new Map<string, string>();
  for (const [key, value] of Object.entries(exportsMap as Record<string, unknown>)) {
    if (!key.startsWith('.')) {
      fail(`\`${manifestPath}\` exports key \`${key}\` is a condition, not a subpath — unsupported`);
    }
    if (key.includes('*')) {
      // A pattern cannot be expressed as one exact alias, and guessing would
      // reintroduce the silent half-injection this hook exists to prevent.
      fail(`\`${manifestPath}\` exports key \`${key}\` is a wildcard pattern — unsupported by this hook`);
    }
    const target = pickImportTarget(value);
    if (!target) {
      fail(`\`${manifestPath}\` exports key \`${key}\` resolves to nothing under ${IMPORT_CONDITIONS.join('/')}`);
    }
    const absolute = path.resolve(packageDir, target);
    if (!fs.existsSync(absolute)) {
      fail(
        `\`${manifestPath}\` exports key \`${key}\` names \`${target}\`, which the built package does not contain ` +
          `(expected \`${absolute}\`) — build the spec package before injecting it`
      );
    }
    const specifier = key === '.' ? SPEC_PACKAGE_NAME : `${SPEC_PACKAGE_NAME}/${key.slice(2)}`;
    targets.set(specifier, absolute);
  }
  if (!targets.has(SPEC_PACKAGE_NAME)) {
    fail(`\`${manifestPath}\` exports map has no \`.\` entry, so the bare specifier cannot be resolved`);
  }
  return targets;
}

/**
 * Resolve the override, or `null` when it is unset.
 *
 * @param raw            the `OBJECTSTACK_SPEC_DIST` value, unset or empty for none
 * @param vendorChunkTest the config's baseline `vendor-objectstack` group test,
 *                        widened (never replaced) with the override's location
 */
export function resolveSpecDistInjection(
  raw: string | undefined,
  { vendorChunkTest }: { vendorChunkTest: RegExp }
): SpecDistInjection | null {
  if (!raw || !raw.trim()) return null;

  const packageDir = findSpecPackageDir(raw.trim());
  const targets = readSpecExportTargets(packageDir);

  // Subpaths first (sorted for a stable, reviewable table), bare specifier last
  // — see `SpecDistInjection.aliases` for why the order decides correctness.
  const aliases: Record<string, string> = {};
  const subpaths = [...targets.keys()].filter((s) => s !== SPEC_PACKAGE_NAME).sort();
  for (const specifier of subpaths) aliases[specifier] = targets.get(specifier)!;
  aliases[SPEC_PACKAGE_NAME] = targets.get(SPEC_PACKAGE_NAME)!;

  const posixDir = packageDir.split(path.sep).join('/');
  return {
    packageDir,
    aliases,
    fsAllow: [packageDir],
    vendorChunkTest: new RegExp(`${vendorChunkTest.source}|${escapeRegExp(posixDir)}${SEPARATOR_CLASS}`),
  };
}
