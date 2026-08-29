import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

// Types are INFERRED from the .mjs source by `tsconfig.scripts.json`
// (`allowJs`), so no `@ts-expect-error` and no hand-written `.d.mts`.
import {
  EXIT_DISAGREES,
  EXIT_NO_MEASUREMENT,
  EXIT_OK,
  classifyEffect,
  evaluate,
  evaluatePackage,
  main,
  readArrayPackages,
} from '../check-side-effects-array.mjs';

/**
 * objectui#6683. The gate under test exists because an INCOMPLETE `sideEffects`
 * array fails silently inside a CONSUMER's bundle — no error, no warning, exit
 * 0. A gate against a silent failure is worth exactly as much as its ability to
 * go red, so this file's first duty is DISCRIMINATION: every assertion below
 * has a partner that makes the same fixture fail.
 *
 * The fixtures are synthetic workspaces rather than the repo, for the reason
 * `check-eager-closure-budget.test.ts` gives about its own: a gate whose only
 * test is "it passes on today's tree" is green because the tree is currently
 * correct, and stays green when the gate stops looking.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

interface Files {
  [relativePath: string]: string;
}

/** A throwaway workspace on disk. The gate reads files, so the fixture is files. */
function workspace(files: Files): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'objectui-6683-'));
  fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return dir;
}

const manifest = (sideEffects: string[]): string =>
  JSON.stringify(
    {
      name: '@fixture/pkg',
      type: 'module',
      main: './dist/index.js',
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
      sideEffects,
    },
    null,
    2,
  );

/** barrel -> a registrar (bare import) and a pure module (named import). */
const SOURCES: Files = {
  'packages/pkg/src/index.ts': "import './registrar.js';\nexport { pure } from './pure.js';\n",
  'packages/pkg/src/registrar.ts': "import { Registry } from 'somewhere';\nRegistry.register('fixture:key', 1);\n",
  'packages/pkg/src/pure.ts': 'export const pure = 1;\n',
};

const HONEST_ARRAY = ['./dist/index.js', './dist/registrar.js', './src/index.ts', './src/registrar.ts'];

function run(files: Files): ReturnType<typeof evaluatePackage> {
  const dir = workspace(files);
  try {
    const packages = readArrayPackages(dir);
    expect(packages, 'the fixture workspace must expose exactly one array package').toHaveLength(1);
    return evaluatePackage(packages[0], dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('the honest array', () => {
  it('passes, and names the registrar it derived', () => {
    const verdict = run({ ...SOURCES, 'packages/pkg/package.json': manifest(HONEST_ARRAY) });
    expect(verdict.problems).toEqual([]);
    expect(verdict.missing).toEqual([]);
    expect(verdict.stale).toEqual([]);
    expect(verdict.registrars).toEqual(['src/registrar.ts']);
    expect(verdict.ok).toBe(true);
  });

  it('is not passing because the walk found nothing', () => {
    // The anti-vacuity partner of the case above. A walk that collapsed to the
    // barrel would derive an empty registrar set, and an empty set agrees with
    // any array at all.
    const verdict = run({ ...SOURCES, 'packages/pkg/package.json': manifest(HONEST_ARRAY) });
    expect(verdict.modulesWalked).toBe(3);
    expect(verdict.registrars.length).toBeGreaterThan(0);
  });
});

describe('MISSING — the silent drop this gate exists to make loud', () => {
  it('fails when the array omits a registering module', () => {
    const verdict = run({
      ...SOURCES,
      'packages/pkg/package.json': manifest(HONEST_ARRAY.filter((e) => !e.includes('registrar'))),
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toEqual(['dist/registrar.js', 'src/registrar.ts']);
    expect(verdict.stale).toEqual([]);
  });

  it('fails when only the SOURCE spelling is named and the published one is not', () => {
    // The half a consumer pays for. In-repo bundlers resolve the alias to
    // `src/`; everyone who installs the package resolves `exports` to `dist/`.
    const verdict = run({
      ...SOURCES,
      'packages/pkg/package.json': manifest(HONEST_ARRAY.filter((e) => e !== './dist/registrar.js')),
    });
    expect(verdict.missing).toEqual(['dist/registrar.js']);
  });

  it('fails when an entry form itself is missing', () => {
    const verdict = run({
      ...SOURCES,
      'packages/pkg/package.json': manifest(HONEST_ARRAY.filter((e) => e !== './src/index.ts')),
    });
    expect(verdict.missing).toEqual(['src/index.ts']);
  });
});

describe('STALE — a name whose module no longer registers anything', () => {
  it('fails when the array names a pure module', () => {
    const verdict = run({
      ...SOURCES,
      'packages/pkg/package.json': manifest([...HONEST_ARRAY, './src/pure.ts']),
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.stale).toEqual(['src/pure.ts']);
    expect(verdict.missing).toEqual([]);
  });

  it('fails when the array names a path that does not exist at all', () => {
    const verdict = run({
      ...SOURCES,
      'packages/pkg/package.json': manifest([...HONEST_ARRAY, './src/gone.ts']),
    });
    expect(verdict.stale).toEqual(['src/gone.ts']);
  });
});

describe('the gauge — exit 2 territory, never a pass', () => {
  it('refuses a top-level side effect it does not recognise', () => {
    const verdict = run({
      ...SOURCES,
      'packages/pkg/src/pure.ts': "export const pure = 1;\nsomeGlobal.installed = true;\n",
      'packages/pkg/package.json': manifest(HONEST_ARRAY),
    });
    expect(verdict.gauge).toBe(true);
    expect(verdict.problems.join('\n')).toContain('does not recognise');
    // ...and it did NOT quietly decide the module was pure, which is the whole
    // point: an unrecognised effect must not collapse into "not a registration".
    expect(verdict.stale).toEqual([]);
  });

  it('refuses a glob, which would make the comparison vacuous on whatever it covers', () => {
    const verdict = run({
      ...SOURCES,
      'packages/pkg/package.json': manifest([...HONEST_ARRAY, './src/**/*.ts']),
    });
    expect(verdict.gauge).toBe(true);
    expect(verdict.problems.join('\n')).toContain('is a glob');
  });

  it('refuses an unresolved relative specifier rather than shrinking the walk', () => {
    const verdict = run({
      ...SOURCES,
      'packages/pkg/src/index.ts': "import './registrar.js';\nimport './not-here.js';\n",
      'packages/pkg/package.json': manifest(HONEST_ARRAY),
    });
    expect(verdict.gauge).toBe(true);
    expect(verdict.problems.join('\n')).toContain('unresolved relative specifier');
  });

  it('refuses a spelling map that does not round-trip on the barrel', () => {
    const dir = workspace({
      ...SOURCES,
      'packages/pkg/package.json': JSON.stringify({
        name: '@fixture/pkg',
        main: './build/index.js',
        sideEffects: ['./build/index.js', './src/index.ts'],
      }),
    });
    try {
      const verdict = evaluatePackage(readArrayPackages(dir)[0], dir);
      // `src/index.ts` -> `build/index.js` round-trips, so this one is FINE;
      // the failure below is the real asymmetry. Keeping both in one test is
      // deliberate: a map test that only ever sees `src`/`dist` proves nothing
      // about the derivation being a derivation.
      expect(verdict.problems.join('\n')).not.toContain('round-trip');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    const broken = workspace({
      ...SOURCES,
      'packages/pkg/src/index.ts': "import './registrar.js';\n",
      'packages/pkg/package.json': JSON.stringify({
        name: '@fixture/pkg',
        // A published barrel two levels deep: `src/index.ts` cannot produce it.
        main: './dist/esm/index.js',
        sideEffects: ['./dist/esm/index.js', './src/index.ts'],
      }),
    });
    try {
      const verdict = evaluatePackage(readArrayPackages(broken)[0], broken);
      expect(verdict.gauge).toBe(true);
      expect(verdict.problems.join('\n')).toContain('round-trip');
    } finally {
      fs.rmSync(broken, { recursive: true, force: true });
    }
  });

  it('main() exits 2 when no package declares an array', () => {
    const dir = workspace({ 'packages/pkg/package.json': JSON.stringify({ name: '@fixture/pkg' }) });
    try {
      expect(main([], dir)).toBe(EXIT_NO_MEASUREMENT);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('reachability — naming a module is not enough to retain it', () => {
  it('fails when a registrar is reachable only through a shakeable module', () => {
    // `barrel -> pure.ts -> registrar.ts`. Every name is in the array, and the
    // registration is still lost: `pure.ts` is shakeable, so when its exports go
    // unused a bundler drops it and takes the registrar's ONLY edge with it.
    const verdict = run({
      'packages/pkg/src/index.ts': "export { pure } from './pure.js';\n",
      'packages/pkg/src/pure.ts': "import './registrar.js';\nexport const pure = 1;\n",
      'packages/pkg/src/registrar.ts': "import { Registry } from 'somewhere';\nRegistry.register('fixture:key', 1);\n",
      'packages/pkg/package.json': manifest(HONEST_ARRAY),
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join('\n')).toContain('no chain of `sideEffects`-covered modules reaches it');
  });

  it('passes when the same registrar is reached from the barrel directly', () => {
    // The partner. Identical shape apart from where the edge starts, so the
    // assertion above is about REACHABILITY and not about the fixture.
    const verdict = run({ ...SOURCES, 'packages/pkg/package.json': manifest(HONEST_ARRAY) });
    expect(verdict.problems).toEqual([]);
  });
});

describe('classifyEffect', () => {
  const statements = (source: string) =>
    ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true).statements;
  const kindOf = (source: string, locals: string[] = []) =>
    [...statements(source)].map((stmt) => classifyEffect(stmt, new Set(locals))).filter((k) => k !== null);

  it('reads any top-level call as a registration, whatever it is called', () => {
    // Deliberately NOT a name test. `Registry.add(...)` and `register(...)` are
    // indistinguishable to a bundler, and a name test is an UNDER-reading —
    // which here is the silent drop.
    expect(kindOf("register('x');")).toEqual(['registration']);
    expect(kindOf("Registry.add('x');")).toEqual(['registration']);
    expect(kindOf('new Thing();')).toEqual(['registration']);
    expect(kindOf('try { register(); } catch {}')).toEqual(['registration']);
  });

  it('reads a write to this module’s own binding as module-local', () => {
    expect(kindOf("Banner.displayName = 'Banner';", ['Banner'])).toEqual(['local-binding-write']);
  });

  it('...but a write to something it did NOT declare is unknown, not local', () => {
    // The asymmetry that keeps the carve-out honest: `window.x = 1` is
    // observable from outside and must not ride the displayName exemption.
    expect(kindOf("window.installed = true;")).toEqual(['unknown']);
    expect(kindOf("Banner.displayName = 'Banner';")).toEqual(['unknown']);
  });

  it('reads a bare import as propagation, not as an effect of the importer', () => {
    expect(kindOf("import './x.js';")).toEqual(['side-effect-only-import']);
    expect(kindOf("import { a } from './x.js';")).toEqual([]);
    expect(kindOf("export { a } from './x.js';")).toEqual([]);
  });

  it('reads declarations and directive prologues as nothing', () => {
    expect(kindOf("'use client';\nconst a = 1;\nfunction f() { register(); }\nexport const b = f;")).toEqual([]);
  });
});

describe('the real workspace', () => {
  it('agrees with every array this repo actually declares', () => {
    const { packages, results } = evaluate(repoRoot);
    expect(packages.length, 'this gate is a set comparison; over nothing it is green for nothing').toBeGreaterThanOrEqual(2);
    for (const r of results) {
      expect(r.problems, `${r.name}: ${r.problems.join('\n')}`).toEqual([]);
      expect(r.missing, `${r.name} is missing ${r.missing.join(', ')}`).toEqual([]);
      expect(r.stale, `${r.name} has stale entries ${r.stale.join(', ')}`).toEqual([]);
    }
    expect(main([], repoRoot)).toBe(EXIT_OK);
  });

  it('finds the three registrations the 2026-08-29 ruling names as controls', () => {
    // A FLOOR on the derivation, not a copy of it: the enumeration is derived
    // from the module bodies, and these three are the modules whose registrations
    // `"sideEffects": false` was measured to drop to 0 chunks (objectui#6535).
    // If the walk stops seeing them, the array agrees with an empty enumeration.
    const { results } = evaluate(repoRoot);
    const appShell = results.find((r) => r.name === '@object-ui/app-shell');
    expect(appShell, '@object-ui/app-shell must still declare a `sideEffects` array').toBeDefined();
    expect(appShell!.registrars).toContain('src/console/connect/ConnectAgentWidget.tsx');
    expect(appShell!.registrars).toContain('src/console/home/CloudOnboardingNext.tsx');
    expect(appShell!.registrars).toContain('src/console/diagnostics/CloudAiModelStatus.tsx');
  });

  it('would go RED if one of those controls left the array', () => {
    // The discrimination proof against the REAL manifest: same package, same
    // module bodies, one entry removed. A gate that passes both before and
    // after proves nothing.
    const packages = readArrayPackages(repoRoot);
    const appShell = packages.find((p) => p.name === '@object-ui/app-shell')!;
    const wrong = {
      ...appShell,
      declared: (appShell.declared as string[]).filter((e: string) => e !== 'src/console/connect/ConnectAgentWidget.tsx'),
    };
    const verdict = evaluatePackage(wrong, repoRoot);
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toEqual(['src/console/connect/ConnectAgentWidget.tsx']);
    expect(main([], repoRoot)).toBe(EXIT_OK); // ...and the real one still passes
  });

  it('publishes distinct exit codes for a wrong array and a broken gauge', () => {
    expect(EXIT_OK).toBe(0);
    expect(EXIT_DISAGREES).toBe(1);
    expect(EXIT_NO_MEASUREMENT).toBe(2);
  });
});
