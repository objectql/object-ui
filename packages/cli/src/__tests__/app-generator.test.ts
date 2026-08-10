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

import { buildInitFiles, buildInitPackageJson } from '../commands/init.js';
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
 * Where each range in the THREE generated manifests must come from.
 *
 * The anchoring discipline objectui#3742/objectui#3754 established: one range
 * per dependency in this repo, quoted rather than invented, so bumping an
 * in-repo manifest and leaving a generator behind fails a test instead of
 * shipping. These literals live in `.ts` source, outside the objectui#3711
 * version-claims gate's scan face, so this map is the only gate they have.
 *
 * The third manifest is `commands/init.ts`'s (`buildInitPackageJson`), folded
 * in by objectui#3892. It is the one an EXTERNAL user gets — `objectui init` is
 * the first command they run — and it sat outside this table until then, which
 * is how it came to ask for `@object-ui/*` at `^2.0.0` against packages
 * publishing at 17.x while its toolchain ranges drifted a major behind the repo
 * (vite `^7.3.1`, typescript `^5.9.3`). Its key set is a strict subset of this
 * table's: it declares neither the seven plugins nor `lucide-react` /
 * `react-router-dom`, because its generated sources import none of them — so
 * the completeness check below unions the three and the per-range check finds
 * each name in whichever manifest declares it.
 *
 * - `root` — the repo root declares it; the generated range must match.
 * - `in-repo` — the root does not, but sibling manifests do, unanimously.
 * - `cli-version` — derived from this CLI's own version at generation time, not
 *   a literal at all (see `platformPackageRange` in `app-generator.ts`).
 *
 * There is no longer a fourth kind: `deferred-tailwind-v4` existed only to hold
 * `tailwindcss` at `^3.4.19` while the generated CSS pipeline was still v3, and
 * objectui#3852 migrated that pipeline — so Tailwind anchors to this repo like
 * everything else. See `keeps the generated Tailwind pipeline v4 end to end`
 * below for what replaced the ledger.
 */
const DEPENDENCY_ANCHORS: Record<string, 'root' | 'in-repo' | 'cli-version'> = {
  '@object-ui/components': 'cli-version',
  '@object-ui/plugin-charts': 'cli-version',
  '@object-ui/plugin-editor': 'cli-version',
  '@object-ui/plugin-form': 'cli-version',
  '@object-ui/plugin-grid': 'cli-version',
  '@object-ui/plugin-kanban': 'cli-version',
  '@object-ui/plugin-markdown': 'cli-version',
  '@object-ui/plugin-view': 'cli-version',
  '@object-ui/react': 'cli-version',
  '@tailwindcss/postcss': 'in-repo',
  '@types/react': 'root',
  '@types/react-dom': 'root',
  '@vitejs/plugin-react': 'in-repo',
  autoprefixer: 'root',
  'lucide-react': 'in-repo',
  postcss: 'in-repo',
  react: 'root',
  'react-dom': 'root',
  'react-router-dom': 'root',
  tailwindcss: 'root',
  typescript: 'root',
  vite: 'root'
};

/** `--color-*` / `--radius-*` token names declared by a `@theme` block. */
function themeTokensOf(css: string): string[] {
  const block = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  return [...block.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1]).sort();
}

/** Custom properties a stylesheet declares outside its `@theme` block. */
function declaredCustomProperties(css: string): Set<string> {
  const outsideTheme = css.replace(/@theme\s*\{[\s\S]*?\n\}/g, '');
  return new Set([...outsideTheme.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1]));
}

/** Custom properties a `@theme` block resolves THROUGH, e.g. `hsl(var(--card))`. */
function customPropertiesReferencedByTheme(css: string): string[] {
  const block = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  return [...new Set([...block.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1]))].sort();
}

/**
 * A `^x.y.z` range's floor, for comparing a generated range against a peer's.
 *
 * Enough semver for the one question asked below — whether the Tailwind the
 * generated app installs can satisfy `@object-ui/components`' peer — without
 * importing a `semver` this package does not declare.
 */
function caretFloor(range: string): [number, number, number] {
  const [major, minor, patch] = range.replace(/^\^/, '').split('.').map(Number);
  return [major, minor, patch];
}

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

/**
 * The `objectui init` scaffold, as a file map (objectui#4061 / objectui#4062).
 *
 * The third generator, and the one an external user meets first. Its manifest
 * joined `DEPENDENCY_ANCHORS` in objectui#3892; its generated SOURCES were still
 * under no gate at all, which is how both of these shipped at once:
 * `@object-ui/components` was declared and never imported (so the registry was
 * empty and every node rendered "Unknown component type"), and `src/index.css`
 * imported none of the library's published CSS. The first is exactly what the
 * unused-declaration gate below reports; see `generated init scaffold sources`.
 *
 * `'simple'` is the default template. The gates are asserted over all three,
 * since each writes a different `app.json` — and the same `src/**`.
 */
const INIT_TEMPLATES = ['simple', 'form', 'dashboard'] as const;
const initFiles = (template: string = 'simple') => buildInitFiles('sample-app', template);

describe('generated app manifests', () => {
  it('declares every package the generated sources import', () => {
    // objectui#3827, generalised over both generators and every generated file.
    //
    // One assertion over all three shapes rather than three in a row: a failing
    // `expect` ends the test, so sequential assertions would report only the
    // first shape and hide the rest. Reverting the fix has to name `lucide-react`
    // — the reported defect, which lives in the routed layout — and not just
    // whichever shape happens to be checked first.
    //
    // `init` joined the shapes in objectui#4061: `src/App.tsx` gained the
    // `@object-ui/components` side-effect import, and a gate that judged only
    // the two temp-app generators could not have seen it arrive OR leave.
    expect({
      plain: undeclaredImports(buildAppPackageJson(STANDALONE), plainFiles()),
      routed: undeclaredImports(buildRoutedAppPackageJson(), routedFiles()),
      routedWithoutAppConfig: undeclaredImports(
        buildRoutedAppPackageJson(),
        routedFilesNoConfig()
      ),
      init: undeclaredImports(buildInitPackageJson('sample-app'), initFiles())
    }).toEqual({ plain: [], routed: [], routedWithoutAppConfig: [], init: [] });
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
    // The init scaffold's 4 runtime ranges, judged for the first time
    // (objectui#4061). This is the gate the defect was a live instance of.
    expect(
      unusedVersionedDependencies(dependenciesOf(buildInitPackageJson('sample-app')), initFiles())
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

  it('keeps all three generated dependency maps under one anchor table', () => {
    // Completeness: a range added to any generator without naming its anchor
    // fails here, which is what kept the eight fossils invisible before — and,
    // until the init manifest joined the union (objectui#3892), what let a whole
    // third generator fossilise without ever failing anything.
    const declared = new Set([
      ...Object.keys(allRangesOf(buildAppPackageJson(STANDALONE))),
      ...Object.keys(allRangesOf(buildRoutedAppPackageJson())),
      ...Object.keys(allRangesOf(buildInitPackageJson('sample-app')))
    ]);
    expect([...declared].sort()).toEqual(Object.keys(DEPENDENCY_ANCHORS).sort());
  });

  it('sources every range from this repo instead of inventing one', () => {
    const routed = allRangesOf(buildRoutedAppPackageJson());
    const plain = allRangesOf(buildAppPackageJson(STANDALONE));
    const init = allRangesOf(buildInitPackageJson('sample-app'));
    const cliVersion = readManifest(CLI_MANIFEST_PATH).version as string;

    for (const [name, anchor] of Object.entries(DEPENDENCY_ANCHORS)) {
      // Every manifest that declares the name is judged, not just the first —
      // one generator anchored and another fossilised is exactly the state
      // objectui#3892 found, and reading `routed ?? plain ?? init` would have
      // reported it green.
      const declaredBy = { routed: routed[name], plain: plain[name], init: init[name] };
      expect(
        Object.values(declaredBy).some((range) => range !== undefined),
        `${name} must be declared by at least one generator`
      ).toBe(true);

      for (const [generator, generated] of Object.entries(declaredBy)) {
        if (generated === undefined) continue;
        const where = `${generator} manifest's ${name}`;

        if (anchor === 'cli-version') {
          expect(generated, `${where} must track this CLI's own version`).toBe(`^${cliVersion}`);
          continue;
        }

        if (anchor === 'root') {
          const rootRange = rootRangeOf(name);
          expect(rootRange, `${name} must exist in the root manifest`).toBeTruthy();
          expect(generated, `${where} must match the repo root`).toBe(rootRange);
          continue;
        }

        const byRange = inRepoRangesOf(name);
        const ranges = Object.keys(byRange);
        expect(ranges.length, `${name} must be declared in-repo to anchor to`).toBeGreaterThan(0);
        expect(
          ranges.sort(),
          `in-repo manifests disagree on ${name}: ${JSON.stringify(byRange)} — settle on one range first`
        ).toHaveLength(1);
        expect(generated, `${where} must match its in-repo range`).toBe(ranges[0]);
      }
    }
  });

  it('names every range the pre-fix init manifest had drifted on', () => {
    // The reverse verification for objectui#3892, direction predicted before
    // running: feed the anchor rule the literal map `commands/init.ts` shipped
    // and every one of its 13 ranges must be judged WRONG — the two
    // `@object-ui/*` at `^2.0.0` against a CLI at 17.x (the reported defect),
    // and the eleven toolchain fossils the measurement turned up beside it.
    // Thirteen, not two, is the size of the drift.
    //
    // The direction is plain red rather than the inverted shape objectui#5009
    // hit, because this rule compares a generated string against a repo fact:
    // there is no schema underneath it to re-judge the same input differently.
    const preFix: Record<string, string> = {
      '@object-ui/components': '^2.0.0',
      '@object-ui/react': '^2.0.0',
      react: '^19.2.0',
      'react-dom': '^19.2.0',
      '@tailwindcss/postcss': '^4.1.18',
      '@types/react': '^19.2.13',
      '@types/react-dom': '^19.2.6',
      '@vitejs/plugin-react': '^5.1.3',
      autoprefixer: '^10.4.23',
      postcss: '^8.5.6',
      tailwindcss: '^4.1.18',
      typescript: '^5.9.3',
      vite: '^7.3.1'
    };
    const cliVersion = readManifest(CLI_MANIFEST_PATH).version as string;

    const drifted = Object.entries(preFix)
      .filter(([name, range]) => {
        const anchor = DEPENDENCY_ANCHORS[name];
        if (anchor === 'cli-version') return range !== `^${cliVersion}`;
        if (anchor === 'root') return range !== rootRangeOf(name);
        return range !== Object.keys(inRepoRangesOf(name))[0];
      })
      .map(([name]) => name)
      .sort();

    expect(drifted).toEqual(Object.keys(preFix).sort());
    // And the manifest shipping today is the exact complement: nothing drifted.
    expect(Object.keys(allRangesOf(buildInitPackageJson('sample-app'))).sort()).toEqual(
      Object.keys(preFix).sort()
    );
  });

  it('keeps the root and in-repo anchors consistent wherever both declare one', () => {
    // Makes the anchor CHOICE non-load-bearing, as objectui#3826 did: anything
    // declared both places must already agree, so reading one instead of the
    // other cannot hide a drift.
    for (const [name, anchor] of Object.entries(DEPENDENCY_ANCHORS)) {
      if (anchor === 'cli-version') continue;
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

  it('installs a Tailwind that satisfies the components peer it depends on', () => {
    // Evidence 1 of objectui#3852, now a gate. The generated app depends on
    // `@object-ui/components`, which peers `tailwindcss ^4.2.1`; the generated
    // devDependency was `^3.4.19`, so once objectui#3827 made the `@object-ui/*`
    // ranges resolvable, a clean install outside this repo hit ERESOLVE. Judged
    // by comparison, not by two literals, so bumping either side alone is red.
    const components = JSON.parse(
      readFileSync(resolve(REPO_ROOT, 'packages/components/package.json'), 'utf-8')
    ) as { peerDependencies?: Record<string, string> };
    const peer = components.peerDependencies?.tailwindcss as string;
    const generated = allRangesOf(buildRoutedAppPackageJson()).tailwindcss;
    expect(peer, 'components must peer a Tailwind version at all').toBeTruthy();

    const [peerMajor, peerMinor, peerPatch] = caretFloor(peer);
    const [genMajor, genMinor, genPatch] = caretFloor(generated);
    expect(genMajor, `generated ${generated} must share a major with the peer ${peer}`).toBe(
      peerMajor
    );
    expect(
      genMinor * 1_000_000 + genPatch,
      `generated ${generated} is below the peer floor ${peer}`
    ).toBeGreaterThanOrEqual(peerMinor * 1_000_000 + peerPatch);
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

/**
 * The `objectui init` scaffold's generated sources (objectui#4061, objectui#4062).
 *
 * Both defects are the same shape as objectui#3755's, one in each direction, and
 * both were invisible for the same reason: this generator's SOURCES had never
 * been judged against its manifest. The gates above now judge them; the cases
 * here plant each defect back, because a gate that passes over a shape it cannot
 * fail is not a gate (objectui#3826).
 */
describe('generated init scaffold sources', () => {
  /** The pre-objectui#4061 `src/App.tsx`, verbatim from `origin/main@11c1e71e8`. */
  const PRE_FIX_APP_TSX = `import { SchemaRenderer } from '@object-ui/react';
import schema from '../app.json';

export default function App() {
  return <SchemaRenderer schema={schema} />;
}
`;

  /** The pre-objectui#4062 `src/index.css`, verbatim — the whole file. */
  const PRE_FIX_INDEX_CSS = `@import 'tailwindcss';
`;

  it('imports the package registration is a side effect of', () => {
    // objectui#4061's fix, pinned where a reader can see WHY the line is there.
    // `SchemaRenderer` resolves nodes through `ComponentRegistry.get(type)` and
    // `@object-ui/react` does not depend on `@object-ui/components`, so this
    // side-effect import is the only thing that fills the registry.
    const app = initFiles()['src/App.tsx'];
    expect(app).toContain(`import '@object-ui/components';`);
    expect(importedPackagesOf(app)).toEqual(['@object-ui/components', '@object-ui/react']);
  });

  it('reports @object-ui/components as unused when the registration import is removed', () => {
    // Reverse verification, direction predicted before running: RED, naming
    // exactly one package. The declaration was already in the manifest
    // (objectui#3892 anchored its range), so removing the import turns the
    // scaffold back into the objectui#4061 shape — declared, never imported —
    // and the unused-declaration gate is what now catches it.
    //
    // This is the defect's real historical text, not an invented one: deleting
    // the import yields `PRE_FIX_APP_TSX` byte for byte, asserted here so the
    // fixture cannot drift away from the shape it claims to restore.
    const preFix = { ...initFiles(), 'src/App.tsx': PRE_FIX_APP_TSX };
    expect(initFiles()['src/App.tsx'].replace(
      `// Registers the component renderers SchemaRenderer looks up. Side-effect\n` +
      `// import — removing it makes every node render "Unknown component type".\n` +
      `import '@object-ui/components';\n`,
      ''
    )).toBe(PRE_FIX_APP_TSX);

    expect(
      unusedVersionedDependencies(dependenciesOf(buildInitPackageJson('sample-app')), preFix)
    ).toEqual(['@object-ui/components']);
  });

  it('needs no @object-ui/plugin-* to render what its own templates contain', () => {
    // Why the fix imports ONE package where the temp-app generator imports nine.
    // None of the three templates names a plugin type: the whole distinct set is
    // the six below, every one registered by `@object-ui/components` itself
    // (measured against `ComponentRegistry.register` calls in that package).
    // Adding nine dependencies a minimal scaffold never uses would be
    // objectui#3755's direction again — and the unused-declaration gate above
    // would fail on all nine, which is the structural reason this stays honest.
    const templateTypes = new Set<string>();
    for (const template of INIT_TEMPLATES) {
      const collect = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(collect);
        if (node === null || typeof node !== 'object') return;
        const record = node as Record<string, unknown>;
        if (typeof record.type === 'string') templateTypes.add(record.type);
        Object.values(record).forEach(collect);
      };
      collect(JSON.parse(initFiles(template)['app.json']));
    }
    expect([...templateTypes].sort()).toEqual([
      'button',
      'card',
      'div',
      'input',
      'text',
      'textarea'
    ]);
    expect(importedPackagesOf(initFiles()['src/App.tsx'])).not.toContain(
      '@object-ui/plugin-grid'
    );
  });

  it('imports the published stylesheet of every declared dependency that ships one', () => {
    // objectui#4062, as a rule rather than a string pin: of the scaffold's
    // runtime `@object-ui/*` dependencies, exactly those whose package declares
    // a `./style.css` export must be imported by the generated CSS. Non-vacuous
    // and discriminating — `@object-ui/components` exports one,
    // `@object-ui/react` exports none, so the rule has something to say in both
    // directions rather than blessing whatever is written.
    const css = initFiles()['src/index.css'];
    const imported = [...css.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);

    const platformDeps = Object.keys(dependenciesOf(buildInitPackageJson('sample-app'))).filter(
      (name) => name.startsWith('@object-ui/')
    );
    const publishesStyles = platformDeps.filter((name) => {
      const exports = readManifest(
        resolve(REPO_ROOT, 'packages', name.replace('@object-ui/', ''), 'package.json')
      ) as unknown as { exports?: Record<string, unknown> };
      return exports.exports?.['./style.css'] !== undefined;
    });

    expect(publishesStyles).toEqual(['@object-ui/components']);
    expect(imported).toEqual(['tailwindcss', '@object-ui/components/style.css']);
  });

  it('is missing that stylesheet when the pre-fix CSS is restored', () => {
    // Reverse verification for objectui#4062, direction predicted before
    // running: the pre-fix file is a bare `@import 'tailwindcss';`, so the set of
    // imported stylesheets loses the components entry and the assertion above
    // goes RED. Stated as the set difference so the failure names the missing
    // sheet rather than just "strings differ".
    const imported = [...PRE_FIX_INDEX_CSS.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map(
      (m) => m[1]
    );
    expect(imported).toEqual(['tailwindcss']);
    expect(imported).not.toContain('@object-ui/components/style.css');
  });

  it('imports no stylesheet from a package it does not depend on', () => {
    // The other half of objectui#4062's undecided cell, settled by measurement:
    // quick-start names `@object-ui/fields/style.css` too, but this scaffold does
    // not depend on `@object-ui/fields` AND that package ships zero CSS at
    // 17.3.0 (published-tarball measurement, objectui#4059). Copying the docs
    // line would declare-vs-import in the wrong direction at an empty file.
    const css = initFiles()['src/index.css'];
    expect(css).not.toContain('@object-ui/fields');
    const declared = new Set(Object.keys(dependenciesOf(buildInitPackageJson('sample-app'))));
    for (const specifier of [...css.matchAll(/@import\s+['"](@[^'"]+)['"]/g)].map((m) => m[1])) {
      const pkg = specifier.split('/').slice(0, 2).join('/');
      expect(declared, `${specifier} is imported but ${pkg} is not a dependency`).toContain(pkg);
    }
  });

  it('keeps the Tailwind entry first, so the library sheet cannot precede it', () => {
    // `@import` order is load-bearing in a Tailwind 4 entrypoint and the CSS spec
    // requires `@import` rules to precede other rules; the library sheet is
    // appended after `@import 'tailwindcss'`, matching what quick-start teaches.
    const css = initFiles()['src/index.css'];
    expect(css.indexOf(`@import 'tailwindcss';`)).toBe(0);
    expect(css.indexOf(`@import '@object-ui/components/style.css';`)).toBeGreaterThan(
      css.indexOf(`@import 'tailwindcss';`)
    );
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

/**
 * The generated CSS pipeline (objectui#3852).
 *
 * What objectui#3827 recorded as `TAILWIND_V3_DEFERRED` and this describe block
 * replaces: the generated app shipped a complete Tailwind 3 trio — `@tailwind
 * base/components/utilities` directives, a `tailwindcss`-keyed PostCSS config,
 * and a `tailwind.config.js` — into a repo that has been on Tailwind 4 (and
 * carried zero `tailwind.config.*` files) since its own migration, while
 * depending on a `@object-ui/components` that peers `tailwindcss ^4.2.1`.
 *
 * These gates judge the pipeline's SHAPE, which is all a unit test can reach: an
 * `@import 'tailwindcss'` is resolved by `@tailwindcss/postcss` relative to the
 * stylesheet's own directory, so compiling a generated `index.css` for real
 * needs a `node_modules` beside the fixture ("Can't resolve 'tailwindcss' in
 * …/app/src" when there is none). That end of it was verified in a browser
 * against a running `objectui dev` instead — readings in the PR.
 */
describe('generated Tailwind 4 pipeline', () => {
  const V3_FOSSILS = ['@tailwind base;', '@tailwind components;', '@tailwind utilities;', '@apply '];

  const everyShape = () => ({
    plain: plainFiles(),
    routed: routedFiles(),
    plainInWorkspace: buildAppFiles(SCHEMA, IN_WORKSPACE),
    routedInWorkspace: buildRoutedAppFiles(ROUTES, APP_CONFIG, IN_WORKSPACE)
  });

  it('writes a v4 CSS-first entrypoint, with no v3 directive left anywhere', () => {
    for (const [shape, files] of Object.entries(everyShape())) {
      const css = files['src/index.css'];
      expect(css, `${shape}: must import Tailwind the v4 way`).toContain(`@import 'tailwindcss';`);
      expect(css, `${shape}: dark variant must follow the .dark class`).toContain(
        '@custom-variant dark (&:where(.dark, .dark *));'
      );
      for (const fossil of V3_FOSSILS) {
        expect(css.includes(fossil), `${shape}: v3 leftover ${fossil}`).toBe(false);
      }
    }
  });

  it('names v4 PostCSS plugin package, not the key that throws', () => {
    for (const [shape, files] of Object.entries(everyShape())) {
      const config = files['postcss.config.js'];
      expect(config, `${shape}: must name the v4 plugin package`).toContain(
        `'@tailwindcss/postcss': {}`);
      // The v3 key resolves to a shim that throws; matched on the bare
      // `tailwindcss:` form so the quoted v4 spelling above does not satisfy it.
      expect(/(^|[^'"])tailwindcss:/.test(config), `${shape}: v3 plugin key`).toBe(false);
    }
  });

  it('writes no tailwind.config.js, because v4 would never read it', () => {
    // A config file is inert in v4 unless a stylesheet points `@config` at it,
    // and none does. Writing one anyway is how the v3 `content` globs stayed the
    // apparent source of truth while nothing consumed them. `commands/dev.ts`
    // used to pass this path to `tailwindcss()`; it no longer exists either.
    for (const [shape, files] of Object.entries(everyShape())) {
      expect(Object.keys(files), `${shape}`).not.toContain('tailwind.config.js');
      expect(files['src/index.css'].includes('@config'), `${shape}`).toBe(false);
    }
  });

  it('translates the v3 content globs into @source, workspace globs included', () => {
    // The v3 `content` list was `['./index.html', './src/**/*.{js,ts,jsx,tsx,json}']`,
    // widened inside a workspace with two absolute globs built from `cwd`. All
    // four survive as `@source`, with the app-relative pair rewritten against
    // `src/index.css`'s own directory (that is what a relative `@source`
    // resolves against — measured, not assumed).
    const inWorkspace = buildRoutedAppFiles(ROUTES, APP_CONFIG, IN_WORKSPACE)['src/index.css'];
    expect(inWorkspace).toContain(`@source '../index.html';`);
    expect(inWorkspace).toContain(`@source '../src/**/*.{js,ts,jsx,tsx,json}';`);
    expect(inWorkspace).toContain(
      `@source '${join(REPO_ROOT, 'packages/components/src/**/*.{ts,tsx}')}';`
    );
    expect(inWorkspace).toContain(
      `@source '${join(REPO_ROOT, 'packages/plugin-*/src/**/*.{ts,tsx}')}';`
    );

    // Outside a workspace those two packages are installed rather than aliased,
    // so the equivalent scan face is their built output under `node_modules` —
    // which v4 does not auto-detect, being gitignored.
    const standalone = routedFiles()['src/index.css'];
    expect(standalone).toContain(`@source '../node_modules/@object-ui/*/dist/**/*.js';`);
    expect(standalone).not.toContain(STANDALONE.cwd);
  });

  it('declares every theme token the component library declares', () => {
    // The generated app owns the single Tailwind entrypoint for everything it
    // renders — `@object-ui/components` deliberately does not inject its own
    // sheet — so a `--color-*` token the library's classes resolve through and
    // this stylesheet omits is a class that compiles to nothing. Comparing the
    // two sets rather than listing literals means adding a token to the library
    // fails here instead of silently degrading a generated app.
    const libraryTokens = themeTokensOf(
      readFileSync(resolve(REPO_ROOT, 'packages/components/src/index.css'), 'utf-8')
    );
    expect(libraryTokens.length, 'the library must declare tokens to compare against').
      toBeGreaterThan(20);
    // Non-vacuous in the direction that failed: the v3 config's `theme.extend`
    // omitted the sidebar tokens the generated `src/Layout.tsx` itself uses.
    expect(libraryTokens).toContain('--color-sidebar-primary');
    expect(libraryTokens).toContain('--color-sidebar-accent-foreground');

    for (const [shape, files] of Object.entries(everyShape())) {
      expect(themeTokensOf(files['src/index.css']), `${shape}`).toEqual(libraryTokens);
    }
  });

  it('resolves every theme token through a variable it declares itself', () => {
    // Self-consistency, and the other half of the gate above: `--color-sidebar:
    // hsl(var(--sidebar))` is worth nothing if `--sidebar` is undeclared. Both
    // light and dark have to carry it, or the token evaluates to nothing under
    // `.dark` only — the hardest version of this bug to notice.
    for (const [shape, files] of Object.entries(everyShape())) {
      const css = files['src/index.css'];
      const declared = declaredCustomProperties(css);
      const referenced = customPropertiesReferencedByTheme(css);
      // Non-vacuity first, and not decoration: run against the pre-fix v3
      // stylesheet this gate passes, because a CSS file with no `@theme` at all
      // references nothing and an empty set has no undeclared member. Every
      // other gate here went red on that input; this one was green for the
      // "produces nothing" reason objectui#3826 warns about.
      expect(referenced.length, `${shape}: no @theme tokens to check`).toBeGreaterThan(20);

      const missing = referenced.filter((property) => !declared.has(property));
      expect(missing, `${shape}: @theme resolves through undeclared variables`).toEqual([]);

      const dark = /\.dark\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
      const darkDeclared = new Set(
        [...dark.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1])
      );
      const colourVariables = referenced.filter((property) => property !== '--radius');
      expect(
        colourVariables.filter((property) => !darkDeclared.has(property)),
        `${shape}: .dark leaves colour variables at their light values`
      ).toEqual([]);
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
