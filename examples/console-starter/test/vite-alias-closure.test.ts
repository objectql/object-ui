/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `vite.config.ts`'s workspace alias table is a hand-written list standing in
 * for a real import graph, and the two drifted apart: five packages the aliased
 * `src` files import were missing from it, so Vite fell back to node resolution
 * and landed on each package's `dist` directory — which exists only after
 * `pnpm -w build`, so a plain `pnpm dev` served 500s behind a blank `#root` with
 * no on-page diagnosis (objectui#3528).
 *
 * This re-derives the graph instead of re-reading the list. It walks the
 * example's own `src/` and follows every relative import and every
 * `@object-ui/*` import into that package's `src`, transitively, and asserts the
 * alias table covers the fixed point. Because it traverses into packages
 * regardless of whether they are aliased today, a missing alias is reported
 * together with everything that alias would have pulled in — adding one entry
 * can never leave a second hole behind.
 *
 * Specifier extraction uses TypeScript's own preprocessor, not a regex. A
 * hand-rolled import regex was tried first and silently under-reported: a lazy
 * middle between `import` and `from` scans across statement boundaries, so the
 * word "import" appearing in ordinary comment prose swallowed the next two real
 * import statements on its way to a later `export ... from`, and two of the five
 * missing packages disappeared from the answer.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const exampleDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(exampleDir, '../..');
const viteConfigPath = path.join(exampleDir, 'vite.config.ts');

/** `'@object-ui/x': path.resolve(__dirname, '../../packages/x/src'),` */
const ALIAS_ENTRY = /'(@object-ui\/[^']+)':\s*path\.resolve\(__dirname,\s*'([^']+)'\)/g;

function readAliasTable(): Map<string, string> {
  const source = fs.readFileSync(viteConfigPath, 'utf8');
  const table = new Map<string, string>();
  for (const m of source.matchAll(ALIAS_ENTRY)) table.set(m[1], path.resolve(exampleDir, m[2]));
  return table;
}

const RESOLVABLE = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function resolveModule(target: string): string | null {
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  for (const ext of RESOLVABLE) {
    if (fs.existsSync(target + ext)) return target + ext;
  }
  for (const ext of RESOLVABLE) {
    const indexFile = path.join(target, `index${ext}`);
    if (fs.existsSync(indexFile)) return indexFile;
  }
  // An ESM-correct specifier addresses the EMITTED file: `./Foo.js` is how a
  // package whose build preserves specifiers has to spell `Foo.tsx`, because
  // Node's resolver does not extension-search relative specifiers (objectui#4538,
  // enforced per pull request by `pnpm check:esm-specifiers`). Tried only after
  // every candidate above has failed, so a package that genuinely ships a `.js`
  // next to its TypeScript still resolves to that file and nothing that already
  // resolved changes answer.
  //
  // Load-bearing, and it degraded SILENTLY: the relative branch of the walk
  // drops an unresolvable specifier with no record, so as packages converted to
  // explicit extensions the walk kept shrinking while every assertion stayed
  // green. Measured on `main` before objectui#5357: 236 relative specifiers
  // dropped and 890 files walked, against 1242 once they resolve. Only the
  // `filesWalked` floor could see it, and only once app-shell — the largest
  // package — converted too and took the count to 401.
  const asSource = target.replace(/\.(js|jsx|mjs|cjs)$/, '');
  if (asSource !== target) return resolveModule(asSource);
  return null;
}

const packageSrc = (pkg: string) =>
  path.join(repoRoot, 'packages', pkg.slice('@object-ui/'.length), 'src');

const isWorkspacePackage = (pkg: string) => {
  const src = packageSrc(pkg);
  return fs.existsSync(src) && fs.statSync(src).isDirectory();
};

/** `@object-ui/plugin-list/foo` -> `@object-ui/plugin-list` */
const packageOf = (specifier: string) => specifier.split('/').slice(0, 2).join('/');

interface Closure {
  /** every workspace package reached, mapped to the files that import it */
  packages: Map<string, Set<string>>;
  /** the subset imported directly by the example's own src/ */
  direct: Set<string>;
  filesWalked: number;
  unresolvable: string[];
}

function computeClosure(): Closure {
  const packages = new Map<string, Set<string>>();
  const direct = new Set<string>();
  const unresolvable: string[] = [];
  const seen = new Set<string>();

  const exampleSrc = path.join(exampleDir, 'src');

  function walk(file: string): void {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)) return;
    // Tests are not part of what the dev server serves.
    if (/\.(test|spec)\.[tj]sx?$/.test(file)) return;

    const code = fs.readFileSync(file, 'utf8');
    const specifiers = new Set(ts.preProcessFile(code, true, true).importedFiles.map((r) => r.fileName));

    for (const specifier of specifiers) {
      if (specifier.startsWith('.')) {
        const resolved = resolveModule(path.resolve(path.dirname(file), specifier));
        if (resolved) walk(resolved);
        continue;
      }
      // Third-party and @objectstack/* are real registry dependencies; only
      // workspace packages are aliased to source.
      if (!specifier.startsWith('@object-ui/')) continue;

      const pkg = packageOf(specifier);
      if (!isWorkspacePackage(pkg)) {
        unresolvable.push(`${specifier} (no packages/*/src, imported by ${path.relative(repoRoot, file)})`);
        continue;
      }

      if (!packages.has(pkg)) packages.set(pkg, new Set());
      packages.get(pkg)!.add(path.relative(repoRoot, file));
      if (file.startsWith(exampleSrc + path.sep)) direct.add(pkg);

      const resolved = resolveModule(packageSrc(pkg) + specifier.slice(pkg.length));
      if (resolved) walk(resolved);
      else unresolvable.push(`${specifier} (unresolvable under src, imported by ${path.relative(repoRoot, file)})`);
    }
  }

  for (const entry of fs.readdirSync(exampleSrc)) {
    if (/\.(ts|tsx|js|jsx)$/.test(entry)) walk(path.join(exampleSrc, entry));
  }

  return { packages, direct, filesWalked: seen.size, unresolvable };
}

describe('console-starter vite alias table', () => {
  const aliases = readAliasTable();
  const closure = computeClosure();

  it('parses the alias table out of vite.config.ts', () => {
    // Guards the regex above: if the config is reformatted so the entries stop
    // matching, every other assertion here would pass vacuously.
    expect(aliases.size).toBeGreaterThan(20);
    expect(aliases.get('@object-ui/app-shell')).toBe(
      path.join(repoRoot, 'packages/app-shell/src'),
    );
  });

  it('reaches the workspace graph it is meant to cover', () => {
    // Same guard for the walker: a resolution regression that walked nothing
    // would make the closure assertion trivially true.
    expect(closure.filesWalked).toBeGreaterThan(500);
    expect(closure.unresolvable).toEqual([]);
  });

  it('points every alias at a directory that exists', () => {
    const broken = [...aliases.entries()].filter(([, target]) => !fs.existsSync(target));
    expect(broken.map(([k, v]) => `${k} -> ${path.relative(repoRoot, v)}`)).toEqual([]);
  });

  it('is closed under the import graph — no aliased source imports an unaliased workspace package', () => {
    const missing = [...closure.packages.keys()]
      .filter((pkg) => !aliases.has(pkg))
      .sort()
      .map((pkg) => `${pkg} (imported by ${[...closure.packages.get(pkg)!].sort().join(', ')})`);

    // Anything listed here falls back to packages/*/dist at dev time, so
    // `pnpm dev` without a prior `pnpm -w build` renders a blank page.
    expect(missing).toEqual([]);
  });

  it('declares every workspace package the example imports directly', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(exampleDir, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const declared = new Set(Object.keys(manifest.dependencies ?? {}));
    const undeclared = [...closure.direct].filter((pkg) => !declared.has(pkg)).sort();
    expect(undeclared).toEqual([]);
  });
});
