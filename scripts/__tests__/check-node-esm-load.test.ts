import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  EXPLICIT_EXTENSION,
  MIN_LOADED,
  MIN_PACKAGES,
  RELATIVE_SPECIFIER,
  SPECIFIER_DEBT,
  UNBUNDLED_NODE_UNSUPPORTED,
  attributeMissingModule,
  buildPreservesSpecifiers,
  effectiveNoEmit,
  emittedSources,
  esmEntryOf,
  importEntry,
  resolvesToModule,
  scanSpecifiers,
  withoutCommentedCode,
} from '../check-node-esm-load.mjs';

/**
 * objectui#4538 — a published entry plain Node ESM cannot load.
 *
 * `packages/react/dist/index.js` re-exported through extensionless relative
 * specifiers, so `import('@object-ui/react')` under plain Node died with
 * ERR_MODULE_NOT_FOUND. Every bundler in the repository resolved it happily,
 * which is why the whole suite, every example app and CI were green with the
 * defect in place.
 *
 * What this file pins is mostly the ways the NEW gate could join them in being
 * green about nothing:
 *
 *  1. **A check that stops at RESOLUTION is not enough** — measured on the very
 *     package the card was filed from. So the load leg must EVALUATE, and
 *     `importEntry` is exercised against a module whose body throws.
 *  2. **The vacuous verdict is RED.** "Imported nothing, found nothing" is the
 *     answer this gate must never give; `MIN_LOADED`/`MIN_PACKAGES` exist for it.
 *  3. **The emit question decides the scope**, and it is read from the tsconfig,
 *     not the command line. `@object-ui/console` runs a `tsc` that carries
 *     `"noEmit": true`; grading it on the command alone reported 124 findings
 *     against a package that emits none of them.
 *  4. **The ledger is a ratchet, not a mute button** — an entry that is no
 *     longer true is itself a finding.
 *  5. **Line numbers must address the real file.** Stripping comments outright
 *     moved every finding in `react/src/index.ts` up by six lines, so the gate
 *     pointed at line 3 for what `tsc` reported at line 9.
 */

const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'esm-load-gate-'));

describe('objectui#4538 — the defect the gate exists for', () => {
  it('flags an extensionless relative specifier that names a real module', () => {
    const dir = tmpdir();
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/SchemaRenderer.tsx'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(dir, 'src/index.ts'), "export * from './SchemaRenderer';\n");

    const findings = scanSpecifiers({ name: 'p', dir: 'p', srcDir: path.join(dir, 'src') });
    expect(findings).toHaveLength(1);
    expect(findings[0].spec).toBe('./SchemaRenderer');
  });

  it('accepts the same specifier once it carries an extension', () => {
    const dir = tmpdir();
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/SchemaRenderer.tsx'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(dir, 'src/index.ts'), "export * from './SchemaRenderer.js';\n");

    expect(scanSpecifiers({ name: 'p', dir: 'p', srcDir: path.join(dir, 'src') })).toEqual([]);
  });

  it('reports the line number the compiler reports, not the post-strip one', () => {
    // The regression this pins: a license header is a block comment, and
    // removing it outright shifted every finding six lines up.
    const dir = tmpdir();
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const x = 1;\n');
    fs.writeFileSync(
      path.join(dir, 'src/index.ts'),
      `/**\n * license\n * header\n */\n\nexport * from './a';\n`,
    );

    const [finding] = scanSpecifiers({ name: 'p', dir: 'p', srcDir: path.join(dir, 'src') });
    expect(finding.line).toBe(6);
  });

  it('ignores a specifier that resolves to nothing, and one that is commented out', () => {
    const dir = tmpdir();
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/real.ts'), 'export const x = 1;\n');
    fs.writeFileSync(
      path.join(dir, 'src/index.ts'),
      "// export { y } from './real';\nexport * from './deleted-long-ago';\n",
    );

    expect(scanSpecifiers({ name: 'p', dir: 'p', srcDir: path.join(dir, 'src') })).toEqual([]);
  });

  it('preserves line count when blanking comments', () => {
    expect(withoutCommentedCode('/*\n\n*/\nkeep').split('\n')).toHaveLength(4);
  });

  it('catches every specifier form the repo writes', () => {
    const forms = [
      "export * from './a';",
      "import './b';",
      "const m = await import('./c');",
      "import x from './d';",
      "export { y } from './e';",
    ].join('\n');
    const specs = [...forms.matchAll(RELATIVE_SPECIFIER)].map((m) => m[3]);
    expect(specs).toEqual(['./a', './b', './c', './d', './e']);
  });

  it('treats a directory import as needing an extension too', () => {
    // Node rejects `./hooks` for a directory as firmly as for a file: there is
    // no index resolution in ESM. TypeScript grades it TS2834 rather than
    // TS2835, but the runtime consequence is identical.
    const dir = tmpdir();
    fs.mkdirSync(path.join(dir, 'src/hooks'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src/hooks/index.ts'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(dir, 'src/index.ts'), "export * from './hooks';\n");

    expect(scanSpecifiers({ name: 'p', dir: 'p', srcDir: path.join(dir, 'src') })).toHaveLength(1);
  });

  it('does not grade `.css` or `.json`, which fail for a different reason', () => {
    expect(EXPLICIT_EXTENSION.test('./styles.css')).toBe(true);
    expect(EXPLICIT_EXTENSION.test('./data.json')).toBe(true);
  });
});

describe('scope — which builds preserve specifiers', () => {
  function pkg(buildScript: string, noEmit: boolean | undefined) {
    const dir = tmpdir();
    fs.writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: noEmit === undefined ? {} : { noEmit } }),
    );
    return { dir, buildScript };
  }

  it('counts a bare emitting `tsc`', () => {
    const p = pkg('tsc', false);
    expect(buildPreservesSpecifiers(p.buildScript, p.dir)).toBe(true);
  });

  it('does NOT count a `tsc` whose tsconfig says noEmit — the @object-ui/console case', () => {
    const p = pkg('tsc && vite build && pnpm build:plugin', true);
    expect(buildPreservesSpecifiers(p.buildScript, p.dir)).toBe(false);
  });

  it('does NOT count a bundler, which resolves specifiers while bundling', () => {
    const p = pkg('vite build', undefined);
    expect(buildPreservesSpecifiers(p.buildScript, p.dir)).toBe(false);
    expect(buildPreservesSpecifiers('tsup', p.dir)).toBe(false);
  });

  it('counts a pipeline whose emitting `tsc` is followed by a bundler', () => {
    const p = pkg('tsc && vite build && node scripts/build-css.mjs', false);
    expect(buildPreservesSpecifiers(p.buildScript, p.dir)).toBe(true);
  });

  it('does NOT count `tsc --noEmit`', () => {
    const p = pkg('tsc --noEmit', false);
    expect(buildPreservesSpecifiers(p.buildScript, p.dir)).toBe(false);
  });

  it('follows `extends` for noEmit, because the leaf usually does not set it', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'base.json'), JSON.stringify({ compilerOptions: { noEmit: true } }));
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ extends: './base.json' }));
    expect(effectiveNoEmit(path.join(dir, 'tsconfig.json'))).toBe(true);
  });

  it('tolerates the comments this repo writes in tsconfigs', () => {
    const dir = tmpdir();
    fs.writeFileSync(
      path.join(dir, 'tsconfig.json'),
      '{\n // why\n "compilerOptions": { /* inline */ "noEmit": false },\n}\n',
    );
    expect(effectiveNoEmit(path.join(dir, 'tsconfig.json'))).toBe(false);
  });

  it('excludes tooling material, which no build tsconfig emits', () => {
    const dir = tmpdir();
    fs.mkdirSync(path.join(dir, 'src/__tests__'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src/index.ts'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(dir, 'src/a.test.ts'), "import './index';\n");
    fs.writeFileSync(path.join(dir, 'src/__tests__/b.ts'), "import '../index';\n");

    expect(emittedSources(path.join(dir, 'src'))).toEqual([path.join(dir, 'src/index.ts')]);
  });
});

describe('the load leg evaluates rather than resolves', () => {
  it('fails a module that RESOLVES but throws on evaluation', () => {
    // The card's sharpest measured point: plugin-charts' entry resolved fine and
    // the tree was still broken. A resolution-only check passes this case.
    const dir = tmpdir();
    const entry = path.join(dir, 'boom.mjs');
    fs.writeFileSync(entry, 'throw new Error("evaluated and failed");\n');
    expect(fs.existsSync(entry)).toBe(true);

    const outcome = importEntry(entry);
    expect(outcome.ok).toBe(false);
  });

  it('passes a module that loads', () => {
    const dir = tmpdir();
    const entry = path.join(dir, 'fine.mjs');
    fs.writeFileSync(entry, 'export const ok = 1;\n');
    expect(importEntry(entry).ok).toBe(true);
  });

  it('reports ERR_MODULE_NOT_FOUND for the defect itself, and names the missing path', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'dep.mjs'), 'export const x = 1;\n');
    const entry = path.join(dir, 'index.mjs');
    fs.writeFileSync(entry, "export * from './dep';\n");

    const outcome = importEntry(entry);
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe('ERR_MODULE_NOT_FOUND');
    expect(outcome.missing).toContain('dep');
  });

  it('attributes a missing module to the package that owns it, not the importer', () => {
    // plugin-grid, plugin-list, plugin-timeline and plugin-view all failed on
    // packages/mobile/dist/useBreakpoint. One cause, one owner.
    const packages = [
      { name: '@object-ui/mobile', dir: 'packages/mobile' },
      { name: '@object-ui/plugin-grid', dir: 'packages/plugin-grid' },
    ];
    const owner = attributeMissingModule('/repo/packages/mobile/dist/useBreakpoint', packages, '/repo');
    expect(owner).toBe('@object-ui/mobile');
  });

  it('attributes nothing for a path outside the workspace', () => {
    expect(attributeMissingModule('/elsewhere/x.js', [{ name: 'a', dir: 'packages/a' }], '/repo')).toBeNull();
  });

  it('reads the entry a consumer reaches through `exports`, in Node order', () => {
    expect(esmEntryOf({ exports: { '.': { import: './dist/index.js' } } })).toBe('./dist/index.js');
    expect(esmEntryOf({ exports: { '.': './x.js' } })).toBe('./x.js');
    expect(esmEntryOf({ module: './m.js', main: './c.js' })).toBe('./m.js');
    // A bin-only CLI and a built web app declare none — not a defect.
    expect(esmEntryOf({ bin: { x: './dist/cli.js' } })).toBeNull();
  });
});

describe('the gate cannot be green about nothing', () => {
  it('keeps a floor under both legs', () => {
    expect(MIN_PACKAGES).toBeGreaterThanOrEqual(30);
    expect(MIN_LOADED).toBeGreaterThan(0);
  });

  it('finds no specifier in an empty tree, which is why the floors exist', () => {
    const dir = tmpdir();
    fs.mkdirSync(path.join(dir, 'src'));
    expect(scanSpecifiers({ name: 'p', dir: 'p', srcDir: path.join(dir, 'src') })).toEqual([]);
  });

  it('resolvesToModule answers for files and for directory indexes', () => {
    const dir = tmpdir();
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'file.ts'), '');
    fs.writeFileSync(path.join(dir, 'sub/index.tsx'), '');
    const from = path.join(dir, 'index.ts');
    expect(resolvesToModule(from, './file')).toBe(true);
    expect(resolvesToModule(from, './sub')).toBe(true);
    expect(resolvesToModule(from, './nope')).toBe(false);
  });
});

describe('the ledger is a ratchet', () => {
  it('records a reason for every entry, so no name is unexplained', () => {
    for (const [name, reason] of SPECIFIER_DEBT) {
      expect(name).toMatch(/^@object-ui\//);
      expect(reason.length).toBeGreaterThan(10);
    }
    for (const [name, reason] of UNBUNDLED_NODE_UNSUPPORTED) {
      expect(name).toMatch(/^@object-ui\//);
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it('cites a ruling on every boundary entry, so no exemption is a bare name', () => {
    // objectui#5384 turned these three from debt into a permanent statement:
    // unbundled Node consumption is not supported for style-carrying plugin
    // packages. A permanent exemption a reader cannot trace is how it becomes a
    // mystery three months later — the reason and the ruling have to come from
    // the ENTRY, not from the fact that a name sits in a map. This is the pin
    // that makes adding a bare name fail.
    for (const reason of UNBUNDLED_NODE_UNSUPPORTED.values()) {
      expect(reason).toMatch(/objectui#\d+/);
      expect(reason).toMatch(/unbundled Node is not supported/);
    }
  });

  it('holds exactly the group the ruling covered, so it cannot widen quietly', () => {
    // The ruling was taken over the style-carrying packages as a GROUP rather
    // than one at a time, which is also what keeps the boundary describable in
    // one sentence. A fourth name is a new product decision, not a spelling
    // change, so it has to come here and say so.
    expect([...UNBUNDLED_NODE_UNSUPPORTED.keys()].sort()).toEqual([
      '@object-ui/app-shell',
      '@object-ui/plugin-dashboard',
      '@object-ui/plugin-map',
    ]);
  });

  it('keeps the two ledgers disjoint — they answer different questions', () => {
    // SPECIFIER_DEBT is this defect class. UNBUNDLED_NODE_UNSUPPORTED is "can an
    // unbundled consumer load this at all", which is a product question that has
    // been answered and closed. Merging them would let the defect stop being
    // visible inside a grab-bag.
    for (const name of UNBUNDLED_NODE_UNSUPPORTED.keys()) expect(SPECIFIER_DEBT.has(name)).toBe(false);
  });

  it('does not ledger the packages objectui#4538 fixed', () => {
    for (const fixed of [
      '@object-ui/react',
      '@object-ui/types',
      '@object-ui/core',
      '@object-ui/i18n',
    ]) {
      expect(SPECIFIER_DEBT.has(fixed)).toBe(false);
      expect(UNBUNDLED_NODE_UNSUPPORTED.has(fixed)).toBe(false);
    }
  });
});
