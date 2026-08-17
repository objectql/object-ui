import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  SPEC_PACKAGE_NAME,
  readSpecExportTargets,
  resolveSpecDistInjection,
} from '../vite-objectstack-spec-dist';

/**
 * objectui#4854 — `apps/console/vite.config.ts` honours `OBJECTSTACK_SPEC_DIST`,
 * so a framework build can bundle the console against ITS OWN `@objectstack/spec`
 * instead of the last published one (mechanism ruled on objectstack#8134).
 *
 * Two facts are pinned here, and they pull in opposite directions on purpose:
 *
 *   1. **Set → every subpath is mapped.** The client hook this mirrors is one
 *      prefix alias, which is safe only because `@objectstack/client` exports a
 *      single entry. The spec's map has 18 and redirects each into `dist/`, so a
 *      copied client line rewrites `@objectstack/spec/ui` to a path that does not
 *      exist — measured as 214 broken import sites for `/ui` alone. The
 *      reconciliation case below therefore checks the derivation against Node's
 *      OWN resolver, entry by entry, and separately sweeps every spec specifier
 *      this repository actually imports.
 *   2. **Unset → nothing moves.** Each of the four surfaces the hook can touch
 *      (`resolve.alias`, `optimizeDeps.include`, the `vendor-objectstack` chunk
 *      test, `server.fs.allow`) is pinned at its baseline value, read off the
 *      REAL console config rather than off the helper, so a hook that stopped
 *      being conditional turns these red rather than shipping a silently
 *      different production bundle.
 *
 * Reverse verification, direction predicted BEFORE running (both plain RED — the
 * derivation is the sole input to case 1, and the `null` branch the sole input to
 * case 2, so a mutation in either can only add findings):
 *
 *   - Delete one subpath from the derived table (`subpaths.filter(s => s !==
 *     '@objectstack/spec/ui')`) → the reconciliation case fails naming the
 *     missing specifier, and the repo sweep fails on the 214 `/ui` sites.
 *   - Make the hook unconditional (drop the `if (!raw …) return null` guard, or
 *     read a hardcoded dir) → the four laziness cases fail, each naming the
 *     surface that moved.
 *
 * Both were run; the recorded direction is what happened.
 */

const require_ = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The baseline `vendor-objectstack` group test, as the console config spells it. */
const BASE_VENDOR_TEST = /([\\/]node_modules[\\/]@objectstack[\\/]|[\\/]@objectstack\+)/;

/** The installed spec package — a real, fully built override target. */
const installedSpecDir = path.dirname(require_.resolve('@objectstack/spec/package.json'));

const inject = (raw: string | undefined) =>
  resolveSpecDistInjection(raw, { vendorChunkTest: BASE_VENDOR_TEST });

/**
 * A fresh evaluation of the console's Vite config, keyed by `query`.
 *
 * The specifier is assembled at runtime on purpose. A literal one would pull
 * `apps/console/vite.config.ts` into THIS program, where it does not belong —
 * `tsconfig.scripts.json` leaves `allowImportingTsExtensions` off, so its own
 * `.ts` imports become TS5097 in a project that never compiled them before.
 * Vitest resolves the runtime specifier relative to this file identically.
 */
async function loadConsoleConfig(query = ''): Promise<any> {
  const specifier = `../../apps/console/vite.config.ts${query}`;
  return (await import(/* @vite-ignore */ specifier)).default;
}

/**
 * Vite's own alias matcher, transcribed from `node_modules/vite` (`matches()` in
 * the alias plugin): exact hit, or the specifier continues past a separator.
 * First match wins, which is why the table's key ORDER decides correctness.
 */
function resolveThroughAliases(aliases: Record<string, string>, specifier: string): string | null {
  for (const [find, replacement] of Object.entries(aliases)) {
    if (specifier === find || specifier.startsWith(`${find}/`)) {
      return specifier.replace(find, replacement);
    }
  }
  return null;
}

describe('objectui#4854: OBJECTSTACK_SPEC_DIST is subpath-aware', () => {
  it('maps every exports-map entry to the file Node itself resolves', async () => {
    const injection = inject(installedSpecDir);
    expect(injection).not.toBeNull();

    const manifest = JSON.parse(
      fs.readFileSync(path.join(installedSpecDir, 'package.json'), 'utf8')
    ) as { exports: Record<string, unknown> };
    const declared = Object.keys(manifest.exports);

    // Anti-vacuity: the map this is reconciled against is the measured 18-entry
    // one, not an empty object a silently-changed reader would also "cover".
    expect(declared.length).toBe(18);
    expect(Object.keys(injection!.aliases).length).toBe(declared.length);

    const missing: string[] = [];
    const mismatched: string[] = [];
    for (const key of declared) {
      const specifier = key === '.' ? SPEC_PACKAGE_NAME : `${SPEC_PACKAGE_NAME}/${key.slice(2)}`;
      const aliased = resolveThroughAliases(injection!.aliases, specifier);
      if (!aliased) {
        missing.push(specifier);
        continue;
      }
      // The oracle: what Node's ESM resolver returns for the same specifier
      // under the `import` condition — the algorithm, not a second reading of
      // the map.
      const expected = fs.realpathSync(fileURLToPath(import.meta.resolve(specifier)));
      if (fs.realpathSync(aliased) !== expected) {
        mismatched.push(`${specifier}: alias -> ${aliased}, node -> ${expected}`);
      }
    }
    expect(missing, 'exports-map entries with no alias — these keep resolving to the INSTALLED spec').toEqual([]);
    expect(mismatched, 'aliases disagreeing with Node').toEqual([]);
  });

  it('does not assume `dist/<name>/index.mjs` — `./openapi.json` is the counterexample', () => {
    const injection = inject(installedSpecDir)!;
    // The obvious hand-written rule the issue sketched would emit
    // `dist/openapi.json/index.mjs` here. The map says otherwise, and the map wins.
    expect(injection.aliases[`${SPEC_PACKAGE_NAME}/openapi.json`]).toBe(
      path.join(installedSpecDir, 'json-schema/openapi.json')
    );
    expect(injection.aliases[`${SPEC_PACKAGE_NAME}/package.json`]).toBe(
      path.join(installedSpecDir, 'package.json')
    );
    expect(injection.aliases[`${SPEC_PACKAGE_NAME}/ui`]).toBe(
      path.join(installedSpecDir, 'dist/ui/index.mjs')
    );
  });

  it('orders the bare specifier LAST so subpaths win the prefix match', () => {
    const keys = Object.keys(inject(installedSpecDir)!.aliases);
    expect(keys[keys.length - 1]).toBe(SPEC_PACKAGE_NAME);
    expect(keys.filter((k) => k === SPEC_PACKAGE_NAME)).toHaveLength(1);

    // The consequence, stated as behaviour: a subpath resolves to its own entry…
    const injection = inject(installedSpecDir)!;
    expect(resolveThroughAliases(injection.aliases, `${SPEC_PACKAGE_NAME}/ui`)).toBe(
      injection.aliases[`${SPEC_PACKAGE_NAME}/ui`]
    );
    // …and a subpath the override does NOT declare is rewritten to a path that
    // cannot exist, i.e. a loud resolve error naming the specifier, rather than
    // quietly falling through to the installed spec.
    const undeclared = resolveThroughAliases(injection.aliases, `${SPEC_PACKAGE_NAME}/not-a-real-subpath`);
    expect(undeclared).toBe(`${injection.aliases[SPEC_PACKAGE_NAME]}/not-a-real-subpath`);
    expect(fs.existsSync(undeclared!)).toBe(false);
  });

  it('covers every spec specifier this repository imports', () => {
    const injection = inject(installedSpecDir)!;
    const specifiers = collectSpecSpecifiers();

    // Anti-vacuity: the sweep found the measured surface (17 distinct
    // specifiers, `/ui` and `/data` the heaviest), not an empty scan.
    expect(specifiers.size).toBeGreaterThanOrEqual(17);
    expect([...specifiers]).toContain(`${SPEC_PACKAGE_NAME}/ui`);
    expect([...specifiers]).toContain(SPEC_PACKAGE_NAME);

    const unresolved: string[] = [];
    for (const specifier of specifiers) {
      const aliased = resolveThroughAliases(injection.aliases, specifier);
      if (!aliased || !fs.existsSync(aliased)) unresolved.push(`${specifier} -> ${aliased ?? '(no alias)'}`);
    }
    expect(unresolved, 'specifiers the injected spec cannot serve').toEqual([]);
  });

  it('allows the dev server to read the injected package', () => {
    const injection = inject(installedSpecDir)!;
    expect(injection.fsAllow).toEqual([fs.realpathSync(installedSpecDir)]);
    expect(injection.packageDir).toBe(fs.realpathSync(installedSpecDir));
  });

  it('keeps the injected spec inside the `vendor-objectstack` chunk', () => {
    const injection = inject(installedSpecDir)!;
    const outOfTree = '/framework/packages/spec';
    const outOfTreeInjection = resolveSpecDistInjection(installedSpecDir, {
      vendorChunkTest: BASE_VENDOR_TEST,
    })!;

    // The baseline test cannot see an injected package: that is the whole
    // reason the group test is widened rather than left alone.
    expect(BASE_VENDOR_TEST.test(`${outOfTree}/dist/ui/index.mjs`)).toBe(false);
    expect(injection.vendorChunkTest.test(`${injection.packageDir}/dist/ui/index.mjs`)).toBe(true);
    // Widened, never replaced — the installed-package arms still match.
    expect(outOfTreeInjection.vendorChunkTest.test('/repo/node_modules/@objectstack/client/dist/index.mjs')).toBe(true);
    expect(outOfTreeInjection.vendorChunkTest.test('/repo/node_modules/.pnpm/@objectstack+spec@1/x.mjs')).toBe(true);
    // And it stays a spec-shaped test, not a catch-all.
    expect(injection.vendorChunkTest.test('/repo/packages/core/src/index.ts')).toBe(false);
  });

  it('accepts a `dist/` or entry-file spelling of the same package', () => {
    const fromDir = inject(installedSpecDir)!;
    const fromDist = inject(path.join(installedSpecDir, 'dist'))!;
    const fromEntry = inject(path.join(installedSpecDir, 'dist/index.mjs'))!;
    expect(fromDist.aliases).toEqual(fromDir.aliases);
    expect(fromEntry.aliases).toEqual(fromDir.aliases);
  });
});

describe('objectui#4854: the override fails loudly, never leniently', () => {
  it('is inert when unset, empty, or blank', () => {
    for (const raw of [undefined, '', '   ']) {
      expect(inject(raw)).toBeNull();
    }
  });

  it('throws when the path does not exist', () => {
    expect(() => inject('/nope/objectstack-spec-4854')).toThrow(/does not exist/);
  });

  it('throws when the path is not the spec package', () => {
    // The repo root has a `package.json`, so this fails on IDENTITY rather than
    // on absence — the case a name-blind walk-up would accept.
    expect(() => inject(repoRoot)).toThrow(/is not inside a `@objectstack\/spec` package/);
  });

  it('throws when the built package is missing a file its exports map names', () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-dist-4854-'));
    try {
      fs.writeFileSync(
        path.join(fixture, 'package.json'),
        JSON.stringify({
          name: SPEC_PACKAGE_NAME,
          exports: {
            '.': { import: { types: './dist/index.d.mts', default: './dist/index.mjs' } },
          },
        })
      );
      // A half-built override is exactly how a silent skew would return: the
      // bundle would keep resolving `@objectstack/spec` from the lockfile while
      // the build reported success.
      expect(() => inject(fixture)).toThrow(/does not contain/);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('throws on a wildcard exports pattern rather than guessing', () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-dist-4854-'));
    try {
      fs.mkdirSync(path.join(fixture, 'dist'));
      fs.writeFileSync(path.join(fixture, 'dist/index.mjs'), 'export {};\n');
      fs.writeFileSync(
        path.join(fixture, 'package.json'),
        JSON.stringify({
          name: SPEC_PACKAGE_NAME,
          exports: { '.': './dist/index.mjs', './*': './dist/*/index.mjs' },
        })
      );
      expect(() => inject(fixture)).toThrow(/wildcard pattern/);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('never picks the `types` condition, which sits first in the real map', () => {
    for (const target of readSpecExportTargets(installedSpecDir).values()) {
      expect(target.endsWith('.d.ts') || target.endsWith('.d.mts')).toBe(false);
    }
  });
});

describe('objectui#4854: the four flagged surfaces in the console config', () => {
  // Read off the REAL config, not the helper: a correct helper wired into
  // nothing is the failure this repo has paid for before.
  it('leaves all four flagged surfaces at their baseline values', async () => {
    expect(process.env.OBJECTSTACK_SPEC_DIST ?? '').toBe('');
    const config = await loadConsoleConfig();

    // 1. resolve.alias — no `@objectstack` entry at all.
    const aliasKeys = Object.keys(config.resolve.alias);
    expect(aliasKeys.filter((k: string) => k.startsWith('@objectstack'))).toEqual([]);

    // 2. optimizeDeps.include — byte-identical to the baseline list.
    expect(config.optimizeDeps.include).toEqual([
      '@objectstack/spec',
      '@objectstack/spec/data',
      '@objectstack/spec/system',
      '@objectstack/spec/ui',
      'react-map-gl',
      'react-map-gl/maplibre',
      'maplibre-gl',
    ]);

    // 3. the vendor-objectstack chunk test — the literal, unwidened.
    const groups = config.build.rollupOptions.output.advancedChunks.groups as { name: string; test: RegExp }[];
    const vendor = groups.find((g) => g.name === 'vendor-objectstack');
    expect(vendor).toBeDefined();
    expect(vendor!.test.source).toBe(BASE_VENDOR_TEST.source);

    // 4. server.fs — absent, so Vite keeps its own default allow-list.
    expect(config.server.fs).toBeUndefined();
  });

  it('moves all four surfaces — and only those — once the override IS set', async () => {
    // A second evaluation of the same config under a distinct module id (the
    // query suffix), so the unset instance above stays intact and the two can be
    // compared. `vi.resetModules()` was rejected: the `unit` project runs
    // `isolate: false`, so resetting the registry reaches other files' modules.
    const baseline = await loadConsoleConfig();
    process.env.OBJECTSTACK_SPEC_DIST = installedSpecDir;
    let injected: any;
    try {
      injected = await loadConsoleConfig('?objectstack-spec-dist=4854');
    } finally {
      delete process.env.OBJECTSTACK_SPEC_DIST;
    }

    // 1. alias — one entry per exports-map entry, subpaths before the bare name.
    const injectedSpecKeys = Object.keys(injected.resolve.alias).filter((k: string) =>
      k === SPEC_PACKAGE_NAME || k.startsWith(`${SPEC_PACKAGE_NAME}/`)
    );
    expect(injectedSpecKeys).toHaveLength(18);
    expect(injectedSpecKeys[injectedSpecKeys.length - 1]).toBe(SPEC_PACKAGE_NAME);
    expect(injected.resolve.alias[`${SPEC_PACKAGE_NAME}/ui`]).toBe(
      path.join(fs.realpathSync(installedSpecDir), 'dist/ui/index.mjs')
    );
    // The `@object-ui/*` workspace aliases are untouched by the injection.
    const objectUiKeys = (alias: Record<string, string>) =>
      Object.keys(alias).filter((k) => k.startsWith('@object-ui/'));
    expect(objectUiKeys(injected.resolve.alias)).toEqual(objectUiKeys(baseline.resolve.alias));

    // 2. optimizeDeps.include — the four spec entries drop out, the rest stay.
    expect(injected.optimizeDeps.include).toEqual(['react-map-gl', 'react-map-gl/maplibre', 'maplibre-gl']);

    // 3. the vendor chunk test — widened with the override, baseline arms kept.
    const vendorOf = (config: any) =>
      (config.build.rollupOptions.output.advancedChunks.groups as { name: string; test: RegExp }[]).find(
        (g) => g.name === 'vendor-objectstack'
      )!.test;
    expect(vendorOf(injected).source.startsWith(BASE_VENDOR_TEST.source)).toBe(true);
    expect(vendorOf(injected).test(`${fs.realpathSync(installedSpecDir)}/dist/ui/index.mjs`)).toBe(true);

    // 4. server.fs.allow — the workspace root plus the injected package.
    expect(injected.server.fs.allow).toEqual([repoRoot, fs.realpathSync(installedSpecDir)]);

    // …and nothing else moved: the unset instance is untouched by the second
    // evaluation, which is what makes the laziness case above meaningful.
    expect(baseline.optimizeDeps.include).toHaveLength(7);
    expect(baseline.server.fs).toBeUndefined();
  });

  it('declares the var in turbo.json, which strict env mode would otherwise strip', () => {
    const turbo = JSON.parse(fs.readFileSync(path.join(repoRoot, 'turbo.json'), 'utf8')) as {
      tasks: { build: { env: string[] } };
    };
    // Turbo v2 runs tasks in strict env mode: an undeclared var never reaches
    // the task, so the hook would read `undefined` and stay inert while the
    // caller believed it had injected a spec.
    expect(turbo.tasks.build.env).toContain('OBJECTSTACK_SPEC_DIST');
    expect(turbo.tasks.build.env).toContain('OBJECTSTACK_CLIENT_DIST');
  });
});

/* -------------------------------------------------------------------------- */
/* Repo sweep — the consumption radius, derived rather than listed.            */
/* -------------------------------------------------------------------------- */

const SCAN_ROOTS = ['packages', 'apps', 'examples'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo', '.next', 'coverage', '.git']);
const SPEC_SPECIFIER_RE = /['"](@objectstack\/spec(?:\/[a-zA-Z0-9._-]+)?)['"]/g;

/** Every `@objectstack/spec` specifier written in the workspace's source. */
function collectSpecSpecifiers(): Set<string> {
  const found = new Set<string>();
  const stack = SCAN_ROOTS.map((r) => path.join(repoRoot, r)).filter((d) => fs.existsSync(d));
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(path.join(dir, entry.name));
        continue;
      }
      if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) continue;
      const source = fs.readFileSync(path.join(dir, entry.name), 'utf8');
      if (!source.includes(SPEC_PACKAGE_NAME)) continue;
      for (const match of source.matchAll(SPEC_SPECIFIER_RE)) found.add(match[1]);
    }
  }
  return found;
}
