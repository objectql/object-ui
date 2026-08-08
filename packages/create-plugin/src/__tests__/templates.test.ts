/**
 * Pins the scaffold's test stack (objectui#3716).
 *
 * The generator used to write an example test that imported
 * `@testing-library/react` and asserted with `toBeInTheDocument()`, plus a
 * `test: 'vitest run'` script — while declaring neither library and giving
 * Vitest no DOM environment. `npm test` in a freshly scaffolded plugin was
 * therefore red on the very first run.
 *
 * These tests assert over the SAME file map the CLI writes
 * (`buildPluginFiles`), not over this repo's source text, so they cannot go
 * green on a template that no longer produces a runnable artifact. The two
 * that matter most are structural rather than string-matching:
 *
 * - every bare import in every generated source file must be a declared
 *   dependency of the generated package (the exact defect, generalised);
 * - the `setupFiles` path in the generated Vitest config must name a file the
 *   generator actually writes.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VITEST_SETUP_FILE,
  buildPackageJson,
  buildPluginFiles,
  buildTestFile,
  buildViteConfig,
  buildVitestSetup,
  type PluginTemplateVars
} from '../templates';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** packages/create-plugin/src/__tests__ -> repo root */
const REPO_ROOT = resolve(__dirname, '../../../..');

const VARS: PluginTemplateVars = {
  packageName: '@object-ui/plugin-heatmap',
  pluginName: 'heatmap',
  pascalName: 'Heatmap',
  description: 'Heatmap plugin for ObjectUI',
  author: 'ObjectStack Team',
  version: '0.1.0',
  year: 2026
};

/**
 * Package names imported by a generated source file, excluding relative imports.
 *
 * Covers both `import x from 'pkg'` and the side-effect form `import 'pkg'`
 * (which is how the generated Vitest setup file pulls the matchers in), and
 * folds a subpath specifier back onto its package name so
 * `@testing-library/jest-dom/vitest` is checked against
 * `@testing-library/jest-dom`. Node builtins are dropped — the generated Vite
 * config imports `path`, which nothing declares because nothing has to.
 */
function importedPackagesOf(source: string): string[] {
  const packages = new Set<string>();
  for (const match of source.matchAll(/(?:^|\n)\s*import\s+(?:[^;'"]*?from\s+)?'([^']+)'/g)) {
    const specifier = match[1];
    if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
    if (isBuiltin(specifier)) continue;
    const segments = specifier.split('/');
    packages.add(specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]);
  }
  return [...packages].sort();
}

type Manifest = {
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
};

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, 'utf-8')) as Manifest;
}

/** The repo root `package.json` — anchor for every dependency it declares. */
function rootManifest(): Manifest {
  return readManifest(resolve(REPO_ROOT, 'package.json'));
}

/**
 * `packages/plugin-*` manifests, as `package name -> manifest`.
 *
 * `create-plugin` writes into `<cwd>/packages/plugin-<name>`, so a generated
 * plugin is a literal sibling of these — which makes them the faithful anchor
 * for build dependencies the root manifest does not declare
 * (`@vitejs/plugin-react`, `vite-plugin-dts`).
 */
function inRepoPluginManifests(): Record<string, Manifest> {
  const packagesDir = resolve(REPO_ROOT, 'packages');
  const manifests: Record<string, Manifest> = {};
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('plugin-')) continue;
    const manifestPath = resolve(packagesDir, entry.name, 'package.json');
    if (!existsSync(manifestPath)) continue;
    manifests[entry.name] = readManifest(manifestPath);
  }
  return manifests;
}

/**
 * Which in-repo manifest each generated devDependency range must quote.
 *
 * Anchoring is what keeps ONE range per dependency in this repo instead of one
 * per file. `root` is preferred wherever the dependency exists there (that is
 * the anchor objectui#3733 chose for the three testing entries); the two
 * build-only tools the root does not declare are anchored to the in-repo plugin
 * manifests the generated package sits beside.
 *
 * Every key of the generated `devDependencies` must appear here — the
 * completeness test below fails on an unanchored addition, so this map cannot
 * quietly go back to covering a subset (objectui#3742).
 */
const DEV_DEPENDENCY_ANCHORS: Record<string, 'root' | 'in-repo-plugins'> = {
  '@testing-library/jest-dom': 'root',
  '@testing-library/react': 'root',
  '@vitejs/plugin-react': 'in-repo-plugins',
  jsdom: 'root',
  typescript: 'root',
  vite: 'root',
  'vite-plugin-dts': 'in-repo-plugins',
  vitest: 'root'
};

/** The range `name` is declared at in the root manifest, if it is declared there. */
function rootRangeOf(name: string): string | undefined {
  const manifest = rootManifest();
  return manifest.devDependencies?.[name] ?? manifest.dependencies?.[name];
}

/**
 * The range every in-repo plugin declaring `name` agrees on.
 *
 * Returns the distinct ranges found, keyed by range, so a divergence names the
 * offending manifests instead of just failing. A split here is itself a finding
 * — this repo's rule is one range per dependency — so the parity test asserts
 * unanimity rather than picking a winner.
 */
function inRepoPluginRangesOf(name: string): Record<string, string[]> {
  const byRange: Record<string, string[]> = {};
  for (const [pluginDir, manifest] of Object.entries(inRepoPluginManifests())) {
    const range = manifest.devDependencies?.[name] ?? manifest.dependencies?.[name];
    if (range === undefined) continue;
    (byRange[range] ??= []).push(pluginDir);
  }
  return byRange;
}

function generatedDevDependencies(vars: PluginTemplateVars): Record<string, string> {
  return (buildPackageJson(vars) as { devDependencies: Record<string, string> }).devDependencies;
}

function declaredDependencies(vars: PluginTemplateVars): Record<string, string> {
  const pkg = buildPackageJson(vars) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
  };
  return { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
}

describe('generated package.json', () => {
  it('declares the whole test stack the template ships', () => {
    const pkg = buildPackageJson(VARS) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    // The script is what makes the three declarations mandatory: ship one and
    // the author's first command has to work.
    expect(pkg.scripts.test).toBe('vitest run');

    expect(Object.keys(pkg.devDependencies)).toEqual(
      expect.arrayContaining(['@testing-library/react', '@testing-library/jest-dom', 'jsdom'])
    );
  });

  it('anchors every devDependency range, leaving none unpinned', () => {
    // The completeness gate. objectui#3733 pinned only the three testing
    // ranges, and the five build ranges beside them drifted one to two majors
    // behind the repo's own toolchain unnoticed (objectui#3742). Adding a
    // devDependency to the template without naming its anchor fails here.
    const generated = generatedDevDependencies(VARS);
    expect(Object.keys(generated).sort()).toEqual(Object.keys(DEV_DEPENDENCY_ANCHORS).sort());
  });

  it('sources every devDependency range from this repo instead of inventing them', () => {
    // These literals live in `.ts` source, outside the objectui#3711
    // version-claims gate's scan face, so this is the gate for them: the
    // template must quote the monorepo's own range for the same package.
    // Bumping an in-repo manifest and leaving the template behind is the drift
    // this test exists to catch — update `src/templates.ts` in the same PR.
    const generated = generatedDevDependencies(VARS);

    for (const [name, anchor] of Object.entries(DEV_DEPENDENCY_ANCHORS)) {
      if (anchor === 'root') {
        const rootRange = rootRangeOf(name);
        expect(rootRange, `${name} must exist in the root manifest`).toBeTruthy();
        expect(generated[name], `${name} range must match the repo root`).toBe(rootRange);
        continue;
      }

      const byRange = inRepoPluginRangesOf(name);
      const ranges = Object.keys(byRange);
      expect(
        ranges.length,
        `${name} must be declared by at least one packages/plugin-* manifest to anchor to`
      ).toBeGreaterThan(0);
      expect(
        ranges.sort(),
        `in-repo plugins disagree on ${name}: ${JSON.stringify(byRange)} — settle on one range first`
      ).toHaveLength(1);
      expect(generated[name], `${name} range must match packages/plugin-*`).toBe(ranges[0]);
    }
  });

  it('keeps the two anchors consistent wherever both declare a dependency', () => {
    // Makes the anchor CHOICE non-load-bearing: for anything declared both at
    // the root and in the plugin manifests, the two must already agree, so
    // reading one instead of the other cannot hide a drift.
    for (const name of Object.keys(DEV_DEPENDENCY_ANCHORS)) {
      const rootRange = rootRangeOf(name);
      if (rootRange === undefined) continue;
      for (const [range, plugins] of Object.entries(inRepoPluginRangesOf(name))) {
        expect(
          range,
          `${name} is ${rootRange} at the repo root but ${range} in ${plugins.join(', ')}`
        ).toBe(rootRange);
      }
    }
  });
});

describe('generated sources', () => {
  it('import nothing the generated package.json does not declare', () => {
    // The defect behind objectui#3716, generalised over every generated file:
    // the example test imported `@testing-library/react` and the manifest never
    // declared it. Add an undeclared import to any template and this goes red.
    const declared = declaredDependencies(VARS);
    const files = buildPluginFiles(VARS);
    for (const [relativePath, contents] of Object.entries(files)) {
      if (!/\.tsx?$/.test(relativePath)) continue;
      for (const pkg of importedPackagesOf(contents)) {
        expect(declared[pkg], `${relativePath} imports ${pkg}, which is not declared`).toBeTruthy();
      }
    }
  });

  it('has its jest-dom matchers registered by the setup file', () => {
    expect(buildTestFile(VARS)).toContain('toBeInTheDocument');
    expect(buildVitestSetup()).toContain('@testing-library/jest-dom');
  });
});

describe('generated vite.config.ts', () => {
  const viteConfig = buildViteConfig(VARS);

  it('gives Vitest a DOM environment', () => {
    // Without this the example test's `render()` runs in Vitest's default
    // `node` environment, where React has no `document` to mount into.
    expect(viteConfig).toMatch(/test:\s*\{/);
    expect(viteConfig).toContain(`environment: 'jsdom'`);
  });

  it('enables globals so @testing-library/react registers its auto cleanup', () => {
    // RTL only hooks cleanup when `afterEach` exists as a global
    // (`@testing-library/react/dist/index.js`: `if (typeof afterEach === 'function')`).
    expect(viteConfig).toContain('globals: true');
  });

  it('resolves paths with import.meta.dirname so it survives configLoader native', () => {
    // vite 8 still defines `__dirname` under its default `bundle` config
    // loader, but warns on it ("... unsupported by `configLoader: 'native'`,
    // which is planned to become the default ... Use `import.meta.dirname`
    // instead") and would fail outright once `native` is the default: that
    // loader imports the config with Node's own ESM loader, which defines no
    // `__dirname`. Same conversion `apps/console/vite.config.ts` got in
    // objectui#3384 (objectui#3742).
    expect(viteConfig).toContain('path.resolve(import.meta.dirname,');
    expect(viteConfig).not.toContain('__dirname');
    expect(viteConfig).not.toContain('__filename');
  });

  it('points setupFiles at a file the generator actually writes', () => {
    expect(viteConfig).toContain(`setupFiles: ['./${VITEST_SETUP_FILE}']`);

    const setupPaths = [...viteConfig.matchAll(/setupFiles:\s*\['([^']+)'\]/g)].map((m) => m[1]);
    expect(setupPaths).not.toHaveLength(0);
    const files = buildPluginFiles(VARS);
    for (const setupPath of setupPaths) {
      expect(files[setupPath.replace(/^\.\//, '')], `${setupPath} is not generated`).toBeTruthy();
    }
  });
});

describe('generated file map', () => {
  it('writes the Vitest setup file next to the config that names it', () => {
    const files = buildPluginFiles(VARS);
    expect(Object.keys(files).sort()).toEqual([
      'README.md',
      'package.json',
      'src/HeatmapImpl.test.tsx',
      'src/HeatmapImpl.tsx',
      'src/index.tsx',
      'src/types.ts',
      'tsconfig.json',
      'vite.config.ts',
      'vitest.setup.ts'
    ]);
    expect(files[VITEST_SETUP_FILE]).toContain(`import '@testing-library/jest-dom/vitest';`);
  });

  it('keeps every path inside the generated plugin directory', () => {
    // The CLI joins these onto the target dir, so a `..` segment here would
    // escape it — the same traversal the plugin-name validation guards against.
    for (const relativePath of Object.keys(buildPluginFiles(VARS))) {
      expect(relativePath).not.toMatch(/(^|\/)\.\.(\/|$)/);
      expect(relativePath.startsWith('/')).toBe(false);
    }
  });
});
