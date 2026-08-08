/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Pins the manifests the two app generators write (objectui#3827).
 *
 * `createTempAppWithRouting` generated a layout that imported `lucide-react`
 * twice — `import * as LucideIcons` plus a named `{ Moon, Sun }`, both live —
 * while the `package.json` beside it declared neither, and the same manifest
 * asked for `@object-ui/react`/`@object-ui/components` at `^0.1.0` for packages
 * published at 17.x (the registry has no 0.1.0 at all). Measuring it turned up
 * five more of the same kind: the seven `@object-ui/plugin-*` side-effect
 * imports in `src/App.tsx` were undeclared in BOTH generators.
 *
 * Nothing was red, because the temp app is created under `<cwd>` and every
 * missing package happened to be hoisted into this repo's root
 * `node_modules` — and because `commands/dev.ts` had been papering over the
 * lucide half in the consumer, aliasing it to a path resolved out of
 * `packages/components`.
 *
 * The three structural gates below are ports of the ones the sibling generator
 * grew (objectui#3733 / objectui#3826). They assert over the SAME file map the
 * CLI writes (`buildAppFiles` / `buildRoutedAppFiles`), never over this repo's
 * source text:
 *
 * - every bare import in every generated source must be declared by the
 *   generated manifest (the objectui#3827 defect, generalised);
 * - no versioned runtime dependency may be declared that no generated source
 *   imports (the reverse direction, from objectui#3755);
 * - no generated `src/**` file may be unreachable from `src/main.tsx`, the one
 *   module `index.html` loads (from objectui#3759).
 *
 * Each is paired with a self-test that plants the defect back, because a gate
 * that is green by producing nothing is not a gate (objectui#3826). Two notes
 * where this port differs from its model, both load-bearing:
 *
 * 1. `create-plugin`'s import scanner matches single-quoted specifiers only —
 *    every template it guards is single-quoted. These templates are NOT: the
 *    generated layout writes `from "lucide-react"` and `from "./theme-provider"`
 *    with double quotes, and `src/theme-provider.tsx` imports `"react"` the same
 *    way. Copying that regex verbatim would have left the gate blind to one of
 *    the exact two lines objectui#3827 reports, so `importedPackagesOf` is
 *    quote-agnostic and a test below pins that it sees both forms.
 * 2. Neither the unused-declaration gate nor the reachability gate is vacuous
 *    here (13 runtime ranges and 6 generated files are really judged), unlike
 *    `create-plugin` where both passed over empty sets. The self-tests are kept
 *    anyway — a non-empty input proves the rule ran, not that it has teeth.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildAppFiles,
  buildAppPackageJson,
  buildRoutedAppFiles,
  buildRoutedAppPackageJson,
  createTempApp,
  createTempAppWithRouting,
  type AppGeneratorContext,
  type RouteInfo
} from '../utils/app-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** packages/cli/src/__tests__ -> repo root */
const REPO_ROOT = resolve(__dirname, '../../../..');
const CLI_MANIFEST_PATH = resolve(REPO_ROOT, 'packages/cli/package.json');

/**
 * The context of a generated app that must really install its dependencies.
 *
 * `isMonorepo: false` is the case the manifests exist FOR. Inside a workspace
 * `createTempApp` writes both maps empty and `commands/dev.ts` skips
 * `npm install` altogether, so the ranges are inert there — which is precisely
 * why they fossilised unnoticed (objectui#3742's second cost: the declared
 * version is never the tested one). Every gate below judges the installable
 * manifest.
 */
const STANDALONE: AppGeneratorContext = { cwd: '/tmp/objectui-app', isMonorepo: false };
const IN_WORKSPACE: AppGeneratorContext = { cwd: REPO_ROOT, isMonorepo: true };

const SCHEMA = { type: 'page', body: [{ type: 'text', text: 'hello' }] };

const ROUTES: RouteInfo[] = [
  { path: '/', filePath: '/app/pages/index.json', schema: SCHEMA, isDynamic: false },
  {
    path: '/users/:id',
    filePath: '/app/pages/users/[id].json',
    schema: { type: 'page', body: [] },
    isDynamic: true,
    paramName: 'id'
  }
];

/** An `app.json` that makes the routed generator emit `src/Layout.tsx`. */
const APP_CONFIG = {
  title: 'Demo',
  logo: 'Flame',
  menu: [{ label: 'Home', path: '/' }, { label: 'Users', children: [{ label: 'All', path: '/users' }] }]
};

type Manifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, 'utf-8')) as Manifest;
}

/**
 * Package names a generated source file imports, excluding relative specifiers.
 *
 * Quote-agnostic on purpose — see note 1 in the file header. Covers the
 * side-effect form (`import '@object-ui/plugin-grid';`), which is how all seven
 * plugins enter, and folds a subpath back onto its package so
 * `react-dom/client` is checked against `react-dom`. Builtins are dropped.
 */
function importedPackagesOf(source: string): string[] {
  const packages = new Set<string>();
  for (const match of source.matchAll(
    /(?:^|\n)\s*(?:import|export)\s+(?:[^;'"]*?from\s+)?['"]([^'"]+)['"]/g
  )) {
    const specifier = match[1];
    if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
    if (isBuiltin(specifier)) continue;
    const segments = specifier.split('/');
    packages.add(specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]);
  }
  return [...packages].sort();
}

const isGeneratedSource = (path: string) => /^src\/.*\.tsx?$/.test(path);

/** Packages imported by generated sources but absent from the manifest. */
function undeclaredImports(
  manifest: Record<string, unknown>,
  files: Record<string, string>
): string[] {
  const declared = new Set([
    ...Object.keys((manifest.dependencies ?? {}) as Record<string, string>),
    ...Object.keys((manifest.devDependencies ?? {}) as Record<string, string>)
  ]);
  const missing = new Set<string>();
  for (const [path, contents] of Object.entries(files)) {
    if (!isGeneratedSource(path)) continue;
    for (const pkg of importedPackagesOf(contents)) {
      if (!declared.has(pkg)) missing.add(pkg);
    }
  }
  return [...missing].sort();
}

/**
 * Runtime dependencies pinned to a version that no generated source imports.
 *
 * The other direction of the gate above, ported from objectui#3755. There are
 * no `workspace:*` ranges here to exempt — a temp app is not a workspace
 * member — so every runtime declaration is judged.
 */
function unusedVersionedDependencies(
  dependencies: Record<string, string>,
  files: Record<string, string>
): string[] {
  const imported = new Set<string>();
  for (const [path, contents] of Object.entries(files)) {
    if (!isGeneratedSource(path)) continue;
    for (const pkg of importedPackagesOf(contents)) imported.add(pkg);
  }
  return Object.entries(dependencies)
    .filter(([name, range]) => !range.startsWith('workspace:') && !imported.has(name))
    .map(([name]) => name)
    .sort();
}

/**
 * Generated `src/**` files not reachable from `src/main.tsx`.
 *
 * objectui#3759's criterion, retargeted: `index.html` loads exactly one module
 * (`/src/main.tsx`), so that is the app's only entry and anything the entry
 * graph does not reach is dead weight shipped into the temp dir. Judged over
 * every `src/**` file rather than just modules — a schema JSON written but
 * never imported would be a routed page that does not exist.
 */
function unreachableGeneratedFiles(files: Record<string, string>): string[] {
  const resolveRelative = (fromPath: string, specifier: string): string | undefined => {
    const fromDir = fromPath.slice(0, fromPath.lastIndexOf('/'));
    const stack: string[] = [];
    for (const segment of `${fromDir}/${specifier}`.split('/')) {
      if (segment === '.' || segment === '') continue;
      if (segment === '..') stack.pop();
      else stack.push(segment);
    }
    const base = stack.join('/');
    return [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`].find(
      (candidate) => files[candidate] !== undefined
    );
  };

  const reached = new Set<string>();
  const queue = ['src/main.tsx'];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    if (reached.has(current) || files[current] === undefined) continue;
    reached.add(current);
    for (const match of files[current].matchAll(
      /(?:^|\n)\s*(?:import|export)\s+(?:[^;'"]*?from\s+)?['"](\.[^'"]*)['"]/g
    )) {
      const target = resolveRelative(current, match[1]);
      if (target !== undefined) queue.push(target);
    }
  }

  return Object.keys(files)
    .filter((path) => path.startsWith('src/') && !reached.has(path))
    .sort();
}

/** Every in-repo manifest: the root plus every direct child of the three groups. */
function inRepoManifestPaths(): string[] {
  const paths = [resolve(REPO_ROOT, 'package.json')];
  for (const group of ['packages', 'apps', 'examples']) {
    const dir = resolve(REPO_ROOT, group);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = join(dir, entry.name, 'package.json');
      if (existsSync(candidate)) paths.push(candidate);
    }
  }
  return paths;
}

/** The range `name` is declared at in the root manifest, if at all. */
function rootRangeOf(name: string): string | undefined {
  const manifest = readManifest(resolve(REPO_ROOT, 'package.json'));
  return manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
}

/**
 * Ranges every non-root in-repo manifest declares for `name`, keyed by range.
 *
 * `peerDependencies` are excluded deliberately: a peer says what a library
 * ACCEPTS (`react` at `^18.0.0 || ^19.0.0`, `react-router-dom` at
 * `^6.0.0 || ^7.0.0`), which is a different fact from the single version this
 * repo installs and tests with — and a generated app has to name the latter.
 */
function inRepoRangesOf(name: string): Record<string, string[]> {
  const byRange: Record<string, string[]> = {};
  const rootPath = resolve(REPO_ROOT, 'package.json');
  for (const path of inRepoManifestPaths()) {
    if (path === rootPath) continue;
    const manifest = readManifest(path);
    const range = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
    if (range === undefined) continue;
    (byRange[range] ??= []).push(relative(REPO_ROOT, path));
  }
  return byRange;
}

/**
 * Where each range in the two generated manifests must come from.
 *
 * The anchoring discipline objectui#3742/objectui#3754 established: one range
 * per dependency in this repo, quoted rather than invented, so bumping an
 * in-repo manifest and leaving a generator behind fails a test instead of
 * shipping. These literals live in `.ts` source, outside the objectui#3711
 * version-claims gate's scan face, so this map is the only gate they have.
 *
 * - `root` — the repo root declares it; the generated range must match.
 * - `in-repo` — the root does not, but sibling manifests do, unanimously.
 * - `cli-version` — derived from this CLI's own version at generation time, not
 *   a literal at all (see `platformPackageRange` in `app-generator.ts`).
 * - `deferred-tailwind-v4` — see `TAILWIND_V3_DEFERRED` below.
 */
const DEPENDENCY_ANCHORS: Record<
  string,
  'root' | 'in-repo' | 'cli-version' | 'deferred-tailwind-v4'
> = {
  '@object-ui/components': 'cli-version',
  '@object-ui/plugin-charts': 'cli-version',
  '@object-ui/plugin-editor': 'cli-version',
  '@object-ui/plugin-form': 'cli-version',
  '@object-ui/plugin-grid': 'cli-version',
  '@object-ui/plugin-kanban': 'cli-version',
  '@object-ui/plugin-markdown': 'cli-version',
  '@object-ui/plugin-view': 'cli-version',
  '@object-ui/react': 'cli-version',
  '@types/react': 'root',
  '@types/react-dom': 'root',
  '@vitejs/plugin-react': 'in-repo',
  autoprefixer: 'root',
  'lucide-react': 'in-repo',
  postcss: 'in-repo',
  react: 'root',
  'react-dom': 'root',
  'react-router-dom': 'root',
  tailwindcss: 'deferred-tailwind-v4',
  typescript: 'root',
  vite: 'root'
};

/**
 * The Tailwind entries this PR deliberately does NOT re-anchor, and why.
 *
 * This repo is on Tailwind 4 (`^4.3.3` at the root, `@tailwindcss/postcss` in
 * every in-repo `postcss.config.js`) and `@object-ui/components` declares
 * `tailwindcss: ^4.2.1` as a PEER — so `^3.4.19` here is not merely drift, it
 * conflicts with a peer of a package the generated app depends on.
 *
 * Anchoring it is still not a version edit: the generated `src/index.css` uses
 * v3 directives (`@tailwind base;`), the generated `postcss.config.js` names
 * the `tailwindcss` plugin key that v4 moved to `@tailwindcss/postcss`, and the
 * generated `tailwind.config.js` is a v3 config whose `content` globs became
 * `@source` in v4. Bumping the range without rewriting those three files
 * produces an app that installs and renders unstyled — a worse failure than the
 * honest v3 trio, because it looks fixed. Filed as objectui#3852 with the
 * measurements; kept internally consistent at v3 until then.
 */
const TAILWIND_V3_DEFERRED = ['tailwindcss'];

function dependenciesOf(manifest: Record<string, unknown>): Record<string, string> {
  return (manifest.dependencies ?? {}) as Record<string, string>;
}

function allRangesOf(manifest: Record<string, unknown>): Record<string, string> {
  return {
    ...((manifest.dependencies ?? {}) as Record<string, string>),
    ...((manifest.devDependencies ?? {}) as Record<string, string>)
  };
}

const plainFiles = () => buildAppFiles(SCHEMA, STANDALONE);
const routedFiles = () => buildRoutedAppFiles(ROUTES, APP_CONFIG, STANDALONE);
const routedFilesNoConfig = () => buildRoutedAppFiles(ROUTES, undefined, STANDALONE);

describe('generated app manifests', () => {
  it('declares every package the generated sources import', () => {
    // objectui#3827, generalised over both generators and every generated file.
    //
    // One assertion over all three shapes rather than three in a row: a failing
    // `expect` ends the test, so sequential assertions would report only the
    // first shape and hide the rest. Reverting the fix has to name `lucide-react`
    // — the reported defect, which lives in the routed layout — and not just
    // whichever shape happens to be checked first.
    expect({
      plain: undeclaredImports(buildAppPackageJson(STANDALONE), plainFiles()),
      routed: undeclaredImports(buildRoutedAppPackageJson(), routedFiles()),
      routedWithoutAppConfig: undeclaredImports(
        buildRoutedAppPackageJson(),
        routedFilesNoConfig()
      )
    }).toEqual({ plain: [], routed: [], routedWithoutAppConfig: [] });
  });

  it('names every dependency the pre-fix routed manifest was missing', () => {
    // The reverse verification, direction predicted before running: restoring
    // the exact `dependencies` map that shipped before objectui#3827 must make
    // the gate RED, naming all eight undeclared packages — `lucide-react` (the
    // reported defect, imported twice in `src/Layout.tsx`) plus the seven
    // plugin side-effect imports in `src/App.tsx` that the issue had not
    // noticed. Eight, not one, is the measured size of the defect.
    const preFix = {
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        'react-router-dom': '^7.12.0',
        '@object-ui/react': '^0.1.0',
        '@object-ui/components': '^0.1.0'
      },
      devDependencies: {}
    };
    expect(undeclaredImports(preFix, routedFiles())).toEqual([
      '@object-ui/plugin-charts',
      '@object-ui/plugin-editor',
      '@object-ui/plugin-form',
      '@object-ui/plugin-grid',
      '@object-ui/plugin-kanban',
      '@object-ui/plugin-markdown',
      '@object-ui/plugin-view',
      'lucide-react'
    ]);
  });

  it('sees double-quoted and side-effect imports, not only the single-quoted form', () => {
    // Note 1 in the file header, pinned. `create-plugin`'s scanner is
    // single-quote-only because its templates are; the generated layout here
    // writes `from "lucide-react"` — one of the two lines objectui#3827
    // reports — and `src/theme-provider.tsx` imports `"react"` the same way.
    // A single-quote-only port would have been blind to exactly the defect.
    const layout = routedFiles()['src/Layout.tsx'];
    expect(layout).toContain(`import * as LucideIcons from 'lucide-react';`);
    expect(layout).toContain(`import { Moon, Sun } from "lucide-react"`);
    expect(importedPackagesOf(layout)).toContain('lucide-react');
    expect(importedPackagesOf(routedFiles()['src/theme-provider.tsx'])).toEqual(['react']);
    // The side-effect form the seven plugins arrive by.
    expect(importedPackagesOf(`import '@object-ui/plugin-grid';\n`)).toEqual([
      '@object-ui/plugin-grid'
    ]);
  });

  it('declares no versioned runtime dependency the generated sources never import', () => {
    // objectui#3755's direction. Not vacuous here: 13 routed runtime ranges and
    // 9 plain ones are judged, all of them really imported.
    expect(unusedVersionedDependencies(dependenciesOf(buildRoutedAppPackageJson()), routedFiles()))
      .toEqual([]);
    expect(
      unusedVersionedDependencies(dependenciesOf(buildAppPackageJson(STANDALONE)), plainFiles())
    ).toEqual([]);
  });

  it('catches an unused versioned runtime dependency when one is present', () => {
    // Self-test. `lucide-react` is live in the ROUTED app (icons in the
    // layout) and imported nowhere in the plain one, so planting it into the
    // plain manifest is the real shape of the objectui#3755 defect rather than
    // an invented one — and it is why the fix here DECLARES lucide instead of
    // deleting the import the way the sibling generator did.
    const withUnused = {
      ...dependenciesOf(buildAppPackageJson(STANDALONE)),
      'lucide-react': '^1.28.0'
    };
    expect(unusedVersionedDependencies(withUnused, plainFiles())).toEqual(['lucide-react']);
  });

  it('keeps both generated dependency maps under one anchor table', () => {
    // Completeness: a range added to either generator without naming its anchor
    // fails here, which is what kept the eight fossils invisible before.
    const declared = new Set([
      ...Object.keys(allRangesOf(buildAppPackageJson(STANDALONE))),
      ...Object.keys(allRangesOf(buildRoutedAppPackageJson()))
    ]);
    expect([...declared].sort()).toEqual(Object.keys(DEPENDENCY_ANCHORS).sort());
  });

  it('sources every range from this repo instead of inventing one', () => {
    const routed = allRangesOf(buildRoutedAppPackageJson());
    const plain = allRangesOf(buildAppPackageJson(STANDALONE));
    const cliVersion = readManifest(CLI_MANIFEST_PATH).version as string;

    for (const [name, anchor] of Object.entries(DEPENDENCY_ANCHORS)) {
      const generated = routed[name] ?? plain[name];
      expect(generated, `${name} must be declared by at least one generator`).toBeTruthy();

      if (anchor === 'deferred-tailwind-v4') {
        expect(TAILWIND_V3_DEFERRED).toContain(name);
        continue;
      }

      if (anchor === 'cli-version') {
        expect(generated, `${name} must track this CLI's own version`).toBe(`^${cliVersion}`);
        continue;
      }

      if (anchor === 'root') {
        const rootRange = rootRangeOf(name);
        expect(rootRange, `${name} must exist in the root manifest`).toBeTruthy();
        expect(generated, `${name} must match the repo root`).toBe(rootRange);
        continue;
      }

      const byRange = inRepoRangesOf(name);
      const ranges = Object.keys(byRange);
      expect(ranges.length, `${name} must be declared in-repo to anchor to`).toBeGreaterThan(0);
      expect(
        ranges.sort(),
        `in-repo manifests disagree on ${name}: ${JSON.stringify(byRange)} — settle on one range first`
      ).toHaveLength(1);
      expect(generated, `${name} must match its in-repo range`).toBe(ranges[0]);
    }
  });

  it('keeps the root and in-repo anchors consistent wherever both declare one', () => {
    // Makes the anchor CHOICE non-load-bearing, as objectui#3826 did: anything
    // declared both places must already agree, so reading one instead of the
    // other cannot hide a drift.
    for (const [name, anchor] of Object.entries(DEPENDENCY_ANCHORS)) {
      if (anchor === 'cli-version' || anchor === 'deferred-tailwind-v4') continue;
      const rootRange = rootRangeOf(name);
      if (rootRange === undefined) continue;
      for (const [range, manifests] of Object.entries(inRepoRangesOf(name))) {
        expect(
          range,
          `${name} is ${rootRange} at the root but ${range} in ${manifests.join(', ')}`
        ).toBe(rootRange);
      }
    }
  });

  it('pins the release lockstep that lets the platform range be derived', () => {
    // The premise `cli-version` rests on. `@object-ui/cli` and every platform
    // package the generated app declares sit in ONE `fixed` changeset group, so
    // they always publish at the same version and `^<own version>` is both
    // current and guaranteed to exist on the registry. If that group were ever
    // split, deriving the range would silently start naming versions that were
    // never published — so the premise is asserted, not assumed.
    const changesetConfig = JSON.parse(
      readFileSync(resolve(REPO_ROOT, '.changeset/config.json'), 'utf-8')
    ) as { fixed?: string[][] };
    const cliVersion = readManifest(CLI_MANIFEST_PATH).version as string;
    const platformPackages = Object.entries(DEPENDENCY_ANCHORS)
      .filter(([, anchor]) => anchor === 'cli-version')
      .map(([name]) => name);

    const group = (changesetConfig.fixed ?? []).find((entry) => entry.includes('@object-ui/cli'));
    expect(group, '@object-ui/cli must belong to a fixed group').toBeTruthy();
    for (const name of platformPackages) {
      expect(group, `${name} must be released in lockstep with the CLI`).toContain(name);
      // And the lockstep is real today, not merely configured.
      const dir = name.replace('@object-ui/', '');
      expect(
        readManifest(resolve(REPO_ROOT, 'packages', dir, 'package.json')).version,
        `${name} must currently sit at the CLI's version`
      ).toBe(cliVersion);
    }
  });

  it('declares the tailwind trio at v3 deliberately, not by drift', () => {
    // The deferral is an explicit, reviewed act: the generated CSS pipeline is
    // v3 end to end, so the range matches the files beside it. Re-anchoring it
    // means migrating those files (objectui#3852). Adding a second deferred
    // entry has to edit this list.
    expect(TAILWIND_V3_DEFERRED).toEqual(['tailwindcss']);
    expect(allRangesOf(buildRoutedAppPackageJson()).tailwindcss).toBe('^3.4.19');
    expect(routedFiles()['src/index.css']).toContain('@tailwind base;');
    expect(routedFiles()['postcss.config.js']).toContain('tailwindcss: {}');
    // And the conflict this leaves standing, named rather than hidden: the
    // components package the generated app depends on peers Tailwind 4.
    const components = JSON.parse(
      readFileSync(resolve(REPO_ROOT, 'packages/components/package.json'), 'utf-8')
    ) as { peerDependencies?: Record<string, string> };
    expect(components.peerDependencies?.tailwindcss).toBe('^4.2.1');
  });

  it('writes both maps empty inside a workspace, as before', () => {
    // Pre-existing behaviour, pinned so it cannot quietly become a partial
    // list: a half-declared manifest would be the objectui#3827 defect again.
    // Note the routed generator has no such branch — it always writes the full
    // manifest, which is why its missing declarations were missing everywhere.
    expect(buildAppPackageJson(IN_WORKSPACE).dependencies).toEqual({});
    expect(buildAppPackageJson(IN_WORKSPACE).devDependencies).toEqual({});
    expect(dependenciesOf(buildRoutedAppPackageJson())['@object-ui/react']).toBeTruthy();
  });
});

describe('generated app file maps', () => {
  it('writes no file unreachable from the entry index.html loads', () => {
    expect(unreachableGeneratedFiles(plainFiles())).toEqual([]);
    expect(unreachableGeneratedFiles(routedFiles())).toEqual([]);
    expect(unreachableGeneratedFiles(routedFilesNoConfig())).toEqual([]);
  });

  it('pins that src/main.tsx is the entry the rule measures from', () => {
    // The premise the gate rests on. If `index.html` ever loaded a different
    // module, reachability-from-`main.tsx` would stop being the criterion.
    for (const files of [plainFiles(), routedFiles()]) {
      expect(files['index.html']).toContain('<script type="module" src="/src/main.tsx"></script>');
      expect(files['src/main.tsx']).toBeTruthy();
    }
  });

  it('reports the layout as unreachable when App.tsx stops importing it', () => {
    // Self-test for the gate above. `src/Layout.tsx` is written only when an
    // `appConfig` is present — exactly when `src/App.tsx` imports it — so
    // stripping that import reproduces the objectui#3759 shape here: a file
    // written into the temp app that no consumer can reach.
    const files = routedFiles();
    expect(files['src/Layout.tsx']).toBeTruthy();
    const strippedApp = files['src/App.tsx'].replace(`import AppLayout from './Layout';\n`, '');
    expect(strippedApp).not.toContain(`from './Layout'`);
    expect(unreachableGeneratedFiles({ ...files, 'src/App.tsx': strippedApp })).toEqual([
      'src/Layout.tsx'
    ]);
  });

  it('reports an orphaned route schema, not just an orphaned module', () => {
    // Why the rule judges every `src/**` file and not only `.tsx?`: a schema
    // written without a matching import is a page the generated router never
    // serves. Nothing produces that today; the rule has to be able to see it.
    const files = routedFiles();
    expect(
      unreachableGeneratedFiles({ ...files, 'src/schemas/page9.json': '{}' })
    ).toEqual(['src/schemas/page9.json']);
  });

  it('keeps every generated path inside the temp app directory', () => {
    // The generator joins these onto a tmpdir, so a `..` segment would escape.
    for (const files of [plainFiles(), routedFiles()]) {
      for (const path of Object.keys(files)) {
        expect(path.split('/')).not.toContain('..');
        expect(path.startsWith('/')).toBe(false);
      }
    }
  });
});

describe('generation onto disk', () => {
  /**
   * Runs the real `createTempApp*` entry points into a throwaway directory.
   *
   * The builders above are only worth asserting over if the writers really
   * write them, so this closes that gap: every file on disk must be
   * byte-identical to the map, with nothing extra. It deliberately does NOT
   * install anything — inside this workspace hoisting satisfies a missing
   * declaration, so a successful install would prove nothing about the
   * manifest, which is the whole lesson of objectui#3827.
   */
  function withTempDir(run: (dir: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), 'objectui-appgen-3827-'));
    try {
      run(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  function filesOnDisk(dir: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (current: string) => {
      for (const entry of readdirSync(current)) {
        const full = join(current, entry);
        if (statSync(full).isDirectory()) walk(full);
        else out[relative(dir, full).split('\\').join('/')] = readFileSync(full, 'utf-8');
      }
    };
    walk(dir);
    return out;
  }

  const contextOfCurrentProcess = (): AppGeneratorContext => ({
    cwd: process.cwd(),
    isMonorepo: existsSync(join(process.cwd(), 'pnpm-workspace.yaml'))
  });

  it('writes exactly the plain app file map, byte for byte', () => {
    withTempDir((dir) => {
      createTempApp(dir, SCHEMA);
      expect(filesOnDisk(dir)).toEqual(buildAppFiles(SCHEMA, contextOfCurrentProcess()));
    });
  });

  it('writes exactly the routed app file map, byte for byte', () => {
    withTempDir((dir) => {
      createTempAppWithRouting(dir, ROUTES, APP_CONFIG);
      const onDisk = filesOnDisk(dir);
      expect(onDisk).toEqual(buildRoutedAppFiles(ROUTES, APP_CONFIG, contextOfCurrentProcess()));
      // The nested schema directory really lands, rather than being flattened.
      expect(Object.keys(onDisk)).toContain('src/schemas/page0.json');
      expect(JSON.parse(onDisk['src/schemas/page0.json'])).toEqual(SCHEMA);
    });
  });

  it('writes a manifest whose @object-ui ranges name this CLI version', () => {
    // The end-to-end form of the objectui#3827 fossil: `^0.1.0` for packages
    // published at 17.x resolved to nothing at all.
    withTempDir((dir) => {
      createTempAppWithRouting(dir, ROUTES, APP_CONFIG);
      const manifest = readManifest(join(dir, 'package.json'));
      const cliVersion = readManifest(CLI_MANIFEST_PATH).version as string;
      for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
        if (!name.startsWith('@object-ui/')) continue;
        expect(range, `${name} in the written manifest`).toBe(`^${cliVersion}`);
      }
      expect(manifest.dependencies?.['lucide-react']).toBe('^1.28.0');
    });
  });
});
