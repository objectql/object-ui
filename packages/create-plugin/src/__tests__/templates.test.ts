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
 * - every bare import in the generated example test must be a declared
 *   dependency of the generated package (the exact defect, generalised);
 * - the `setupFiles` path in the generated Vitest config must name a file the
 *   generator actually writes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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

/** Bare (non-relative) module specifiers imported by a generated source file. */
function bareImportsOf(source: string): string[] {
  const specifiers = new Set<string>();
  for (const match of source.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+'([^']+)'/g)) {
    const specifier = match[1];
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) specifiers.add(specifier);
  }
  return [...specifiers].sort();
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

  it('sources the testing ranges from this repo instead of inventing them', () => {
    // These literals live in `.ts` source, outside the objectui#3711
    // version-claims gate's scan face, so this is the gate for them: the
    // template must quote the monorepo's own range for the same package.
    // Bumping the root manifest and leaving the template behind is the drift
    // this test exists to catch — update `src/templates.ts` in the same PR.
    const rootPkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf-8')) as {
      devDependencies: Record<string, string>;
    };
    const generated = (
      buildPackageJson(VARS) as { devDependencies: Record<string, string> }
    ).devDependencies;

    for (const name of ['@testing-library/react', '@testing-library/jest-dom', 'jsdom']) {
      expect(rootPkg.devDependencies[name], `${name} must exist in the root manifest`).toBeTruthy();
      expect(generated[name], `${name} range must match the repo root`).toBe(
        rootPkg.devDependencies[name]
      );
    }
  });
});

describe('generated example test', () => {
  it('imports nothing the generated package.json does not declare', () => {
    const declared = declaredDependencies(VARS);
    for (const specifier of bareImportsOf(buildTestFile(VARS))) {
      expect(declared[specifier], `${specifier} is imported but not declared`).toBeTruthy();
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
