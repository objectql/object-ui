/**
 * Pin tests for `scripts/check-readme-exports.mjs` (objectui#5043).
 *
 * ## Why the planted mutations are in here and not in a prose paragraph
 *
 * The tree is GREEN AT REST: zero fabricated README imports when this landed,
 * and the intent is that there stay zero. So the gate's own run proves nothing
 * about whether it can FAIL, and "I planted a fake name and it caught it" in a
 * pull-request body proves it once and then stops being true. The card recorded
 * three method iterations that each looked right and each was measured wrong,
 * so the four discriminating directions live below as assertions.
 *
 * Recall alone is not enough, and that is the whole reason for the second one:
 *
 *   1. a fabricated name in a MULTI-LINE import block   -> must be REPORTED
 *   2. a fabricated name in a TRAILING `//` COMMENT     -> must NOT be reported
 *   3. `X as Y` where X is fabricated                   -> reported as X
 *   4. a fabricated name MID-BLOCK in a type import     -> must be REPORTED
 *
 * (2) is the false positive the second prototype produced; a gate tested only
 * for recall passes with it present and reddens correct documentation.
 *
 * ## And why there is a fixture tree rather than a scan of this repository
 *
 * The end-to-end verdict needs each package's DECLARED TYPE ENTRY on disk,
 * which for almost every package here is a built `dist/index.d.ts`. The test
 * shards run `pnpm install` and then `pnpm test` — they never build. A suite
 * that scanned this repository for its verdicts would therefore assert nothing
 * in CI while passing locally, which is this gate's own defect one directory
 * over. So the verdicts are asserted against a fixture tree that carries its
 * own hand-written `.d.ts` files, and the assertions about THIS repository
 * below are written to hold in both states and to say which one they are in.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REQUIRED_CONTEXTS } from '../dependabot-merge-gate.mjs';
import {
  CODE_LANGS,
  FLOORS,
  MIN_PARTIAL_REASON,
  PARTIAL_EXCERPTS,
  PARTIAL_MARKER,
  PARTIAL_MARKER_EXAMPLE,
  extractCodeBlocks,
  findDocumentedTypes,
  findImportBindings,
  findPartialMarkers,
  packageDirOf,
  parseReadmeOverrides,
  scan,
  summarise,
  typeEntryOf,
} from '../check-readme-exports.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** A throwaway `packages/` tree, written once and reused by every case below. */
function fixtureTree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-readme-exports-'));
  for (const [rel, body] of Object.entries(files)) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  return root;
}

const manifest = (name: string, types: string | null) =>
  `${JSON.stringify(types === null ? { name } : { name, exports: { '.': { types } } }, null, 2)}\n`;

/**
 * Alpha's export surface, written the way a real barrel is: the two names a
 * consumer sees come through a RE-EXPORT, so both are Alias symbols. That is
 * what makes the value/type flags a real assertion rather than a tautology —
 * reading flags off the alias reports every one of them as type-only, which is
 * what the prototype's first version did.
 */
const FIXTURE = {
  'packages/alpha/package.json': manifest('@fix/alpha', './dist/index.d.ts'),
  'packages/alpha/dist/inner.d.ts':
    'export declare const realValue: number;\n' + 'export interface RealShape { a: string }\n',
  'packages/alpha/dist/index.d.ts':
    "export { realValue, RealShape } from './inner.js';\n" + 'export declare function localFn(): void;\n',
  'packages/beta/package.json': manifest('@fix/beta', './dist/index.d.ts'),
  'packages/beta/dist/index.d.ts': 'export declare const ownedByBeta: string;\n',
};

const FIXTURE_PACKAGES = ['packages/alpha', 'packages/beta'];

const scanFixture = (root: string) =>
  scan(root, { readmes: ['packages/alpha/README.md'], packageDirs: FIXTURE_PACKAGES, floors: {} });

/**
 * The README shape this whole family uses, and the one that broke the regex:
 * a SIDE-EFFECT import, then twenty lines of prose, then a multi-line value
 * block with trailing comments, then a multi-line type block.
 */
const readme = (extraValue = '', extraType = '', trailingComment = '') => `# @fix/alpha

\`\`\`typescript
import '@fix/alpha';
\`\`\`

The registration above is the whole of it. There is no manual component map,
no \`alphaComponents\` record, and no \`AlphaSchema\` export to reach for; the
renderer resolves everything from the schema it is handed. Prose in this
paragraph mentions weeks, title, selection, target and dataSource on purpose —
a scan that reads an import clause by regex swallows all of it.

\`\`\`typescript
import {
  realValue, // the exported constant${trailingComment}
${extraValue}  localFn,
} from '@fix/alpha';
\`\`\`

\`\`\`ts
import type {
${extraType}  RealShape,
} from '@fix/alpha';
\`\`\`
`;

describe('extractCodeBlocks — the fence rules, because a lost block is a silent gap', () => {
  it('reads the info string and reports the opening fence line', () => {
    const blocks = extractCodeBlocks('intro\n\n```typescript\nconst a = 1;\n```\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ lang: 'typescript', startLine: 3, terminated: true });
    expect(blocks[0].body).toBe('const a = 1;');
  });

  it('lets a longer fence CONTAIN a shorter one, as CommonMark specifies', () => {
    const blocks = extractCodeBlocks('````md\n```ts\nimport { X } from "y";\n```\n````\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].lang).toBe('md');
    expect(blocks[0].body).toContain('```ts');
  });

  it('does not treat an info-carrying fence as a closer', () => {
    const blocks = extractCodeBlocks('```ts\na\n```\n\n```ts\nb\n```\n');
    expect(blocks.map((b) => b.body)).toEqual(['a', 'b']);
  });

  it('counts an unterminated fence rather than swallowing the rest of the file', () => {
    const blocks = extractCodeBlocks('```ts\nconst a = 1;\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].terminated).toBe(false);
  });

  it('normalises the language, so `TypeScript` and `ts` are both parsed', () => {
    expect(extractCodeBlocks('```TypeScript\na\n```\n')[0].lang).toBe('typescript');
    expect(CODE_LANGS).toContain('typescript');
    expect(CODE_LANGS).toContain('tsx');
  });
});

describe('findImportBindings — the traps the regex approach could not survive', () => {
  it('reads a multi-line block as ONE declaration, with a name per specifier', () => {
    const found = findImportBindings('import {\n  A,\n  B,\n} from "pkg";');
    expect(found.map((b) => b.exportName)).toEqual(['A', 'B']);
    expect(found.map((b) => b.line)).toEqual([2, 3]);
  });

  it('THE FALSE POSITIVE: a trailing comment can never contribute a name', () => {
    const found = findImportBindings('import {\n  A, // madeUpName is not real\n} from "pkg";');
    expect(found.map((b) => b.exportName)).toEqual(['A']);
  });

  it('judges the EXPORT name of `A as B`, never the local alias', () => {
    const [binding] = findImportBindings('import { madeUp as Real } from "pkg";');
    expect(binding.exportName).toBe('madeUp');
    expect(binding.local).toBe('Real');
  });

  it('reports a side-effect import as such — no clause means no name to judge', () => {
    const [binding] = findImportBindings('import "pkg";');
    expect(binding).toMatchObject({ kind: 'side-effect', exportName: null, specifier: 'pkg' });
  });

  it('THE ROOT CAUSE: a side-effect import cannot swallow the prose after it', () => {
    // The measured regex failure: a lazy quantifier starting at the `from`-less
    // import ran to the next `from "pkg"` and reported five words of prose as
    // fabricated import names.
    const found = findImportBindings(
      'import "pkg";\n\nweeks title selection target dataSource are prose\n\nimport { A } from "pkg";',
    );
    expect(found.map((b) => b.exportName)).toEqual([null, 'A']);
  });

  it('separates a namespace import, which names no export', () => {
    const [binding] = findImportBindings('import * as ns from "pkg";');
    expect(binding).toMatchObject({ kind: 'namespace', exportName: null });
  });

  it('carries the type-only flag from the clause and from the specifier', () => {
    expect(findImportBindings('import type { A } from "pkg";')[0].typeOnly).toBe(true);
    expect(findImportBindings('import { type A } from "pkg";')[0].typeOnly).toBe(true);
    expect(findImportBindings('import { A } from "pkg";')[0].typeOnly).toBe(false);
  });

  it('walks a re-export too — `export { X } from` names an export just as an import does', () => {
    const [binding] = findImportBindings('export { madeUp as Out } from "pkg";');
    expect(binding).toMatchObject({ exportName: 'madeUp', specifier: 'pkg' });
  });

  it('parses a tsx block without treating the JSX as a type assertion', () => {
    const found = findImportBindings('import { A } from "pkg";\nconst el = <A x={1} />;', { jsx: true });
    expect(found.map((b) => b.exportName)).toEqual(['A']);
  });
});

describe('the export surface is symbols, and aliases resolve before the flags are read', () => {
  const root = fixtureTree(FIXTURE);

  it('reads every export of the declared type entry, re-exports included', () => {
    const result = scanFixture(root);
    const alpha = result.packages.find((p) => p.name === '@fix/alpha');
    expect(alpha?.state).toBe('read');
    expect(alpha?.exportCount).toBe(3);
  });

  it('THE ALIAS TRAP: a re-exported VALUE keeps its Value flag', () => {
    // `export { realValue } from './inner.js'` is an Alias symbol carrying no
    // Value flag of its own. Reading flags off it marks every re-export in the
    // repository as type-only — the prototype's first version did exactly that.
    const result = scan(root, {
      readmes: ['packages/alpha/README.md'],
      packageDirs: FIXTURE_PACKAGES,
      readmeOverrides: { 'packages/alpha/README.md': writeReadme(root, readme()) },
      floors: {},
    });
    const byName = new Map(result.bindings.map((b) => [b.exportName, b]));
    expect(byName.get('realValue')).toMatchObject({ verdict: 'real', alias: true, isValue: true });
    expect(byName.get('RealShape')).toMatchObject({ verdict: 'real', alias: true, isType: true });
    expect(byName.get('localFn')).toMatchObject({ verdict: 'real', alias: false, isValue: true });
  });

  it('derives the type entry from the package, never assuming `dist/index.d.ts`', () => {
    // `@object-ui/test-support` really does point `exports['.'].types` at
    // `src/index.ts`; assuming the built path would call it unbuilt.
    const entry = typeEntryOf({ exports: { '.': { types: './src/index.ts' } } }, '/pkg');
    expect(entry.declared).toBe('./src/index.ts');
    expect(entry.path).toBe(path.join('/pkg', 'src/index.ts'));
    expect(typeEntryOf({ types: './t.d.ts' }, '/pkg').declared).toBe('./t.d.ts');
    expect(typeEntryOf({ name: 'x' }, '/pkg').declared).toBeNull();
  });

  it('resolves a nested README to the package that publishes it', () => {
    expect(packageDirOf(repoRoot, 'packages/types/src/zod/README.md')).toBe('packages/types');
    expect(packageDirOf(repoRoot, 'packages/types/README.md')).toBe('packages/types');
  });
});

/** Writes a README into the fixture's scratch space and returns its path. */
function writeReadme(root: string, body: string): string {
  const at = path.join(root, `readme-${Math.random().toString(36).slice(2)}.md`);
  fs.writeFileSync(at, body);
  return at;
}

describe('PLANTED MUTATIONS — the four directions, predicted before they were run', () => {
  const root = fixtureTree(FIXTURE);
  const run = (body: string) =>
    scan(root, {
      readmes: ['packages/alpha/README.md'],
      packageDirs: FIXTURE_PACKAGES,
      readmeOverrides: { 'packages/alpha/README.md': writeReadme(root, body) },
      floors: {},
    });

  it('BASELINE: the unmutated README is clean, so every red below is the mutation', () => {
    const result = run(readme());
    expect(result.findings).toEqual([]);
    expect(result.census.selfBindings).toBe(3);
    expect(result.census.real).toBe(3);
  });

  it('1. a fabricated name in a MULTI-LINE block is REPORTED', () => {
    const result = run(readme('  alphaThings,\n'));
    expect(result.findings.map((f) => `${f.verdict}:${f.exportName}`)).toEqual(['fabricated:alphaThings']);
  });

  it('2. a fabricated name in a TRAILING COMMENT is NOT reported', () => {
    // The direction a recall-only self-test cannot see.
    const result = run(readme('', '', ' — alphaComponents was never real'));
    expect(result.findings).toEqual([]);
    expect(result.census.real).toBe(3);
  });

  it('3. `X as Y` with X fabricated is reported as X, the EXPORT name', () => {
    const result = run(readme('  alphaThings as Things,\n'));
    expect(result.findings.map((f) => f.exportName)).toEqual(['alphaThings']);
    expect(result.findings.map((f) => f.local)).toEqual(['Things']);
  });

  it('4. a fabricated name MID-BLOCK in a multi-line TYPE import is REPORTED', () => {
    const result = run(readme('', '  AlphaSchema,\n'));
    expect(result.findings.map((f) => `${f.verdict}:${f.exportName}`)).toEqual(['fabricated:AlphaSchema']);
    expect(result.findings[0].typeOnly).toBe(true);
  });

  it('5. a REAL name owned by another package is WRONG-PATH, not fabricated', () => {
    // objectui#5010's `CalendarViewSchema`: the fix is the import path, and
    // telling the reader it is fabricated tells them to delete a real symbol.
    const result = run(readme('  ownedByBeta,\n'));
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ verdict: 'wrong-path', exportName: 'ownedByBeta' });
    expect(result.findings[0].owners).toEqual(['@fix/beta']);
  });

  it('names the README LINE of the specifier, not of the `import {` above it', () => {
    const result = run(readme('  alphaThings,\n'));
    const body = readme('  alphaThings,\n').split('\n');
    expect(body[result.findings[0].line - 1]).toContain('alphaThings');
  });

  it('all four mutations at once are reported at once — no first-finding short circuit', () => {
    const result = run(readme('  alphaThings as Things,\n  ownedByBeta,\n', '  AlphaSchema,\n', ' — nope'));
    expect(result.findings.map((f) => `${f.verdict}:${f.exportName}`).sort()).toEqual([
      'fabricated:AlphaSchema',
      'fabricated:alphaThings',
      'wrong-path:ownedByBeta',
    ]);
  });
});

describe('a package whose types are not on disk FAILS — it never reads as "exports nothing"', () => {
  it('reports `unbuilt`, not a wall of fabricated names', () => {
    const root = fixtureTree({
      'packages/alpha/package.json': manifest('@fix/alpha', './dist/index.d.ts'),
      'packages/alpha/README.md': '```ts\nimport { realValue } from "@fix/alpha";\n```\n',
    });
    const result = scan(root, { readmes: ['packages/alpha/README.md'], packageDirs: ['packages/alpha'], floors: {} });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ verdict: 'unjudgeable', reason: 'unbuilt' });
    expect(result.census.fabricated).toBe(0);
    expect(result.census.packagesUnbuilt).toBe(1);
  });

  it('reports `no-type-entry` for a package that publishes no types at all', () => {
    const root = fixtureTree({
      'packages/alpha/package.json': manifest('@fix/alpha', null),
      'packages/alpha/README.md': '```ts\nimport { realValue } from "@fix/alpha";\n```\n',
    });
    const result = scan(root, { readmes: ['packages/alpha/README.md'], packageDirs: ['packages/alpha'], floors: {} });
    expect(result.findings[0]).toMatchObject({ verdict: 'unjudgeable', reason: 'no-type-entry' });
  });

  it('is SILENT about an unbuilt package whose README imports nothing from it', () => {
    // The failure is scoped to the case where the missing exports would have
    // changed a verdict; the count still appears in the census either way.
    const root = fixtureTree({
      'packages/alpha/package.json': manifest('@fix/alpha', './dist/index.d.ts'),
      'packages/alpha/README.md': '```ts\nimport { X } from "@other/pkg";\n```\n',
    });
    const result = scan(root, { readmes: ['packages/alpha/README.md'], packageDirs: ['packages/alpha'], floors: {} });
    expect(result.findings).toEqual([]);
    expect(result.census.packagesUnbuilt).toBe(1);
  });
});

describe('non-vacuity — the population refuses to collapse', () => {
  it('declares a floor for every counter a collapse would zero', () => {
    expect(Object.keys(FLOORS).sort()).toEqual(
      [
        'codeBlocks',
        'exportSymbols',
        'importBindings',
        'keysCompared',
        'packagesRead',
        'readmes',
        'selfBindings',
        'typeDeclarations',
        'typesResolved',
      ].sort(),
    );
  });

  it('reports every floor as breached when BOTH walks return nothing', () => {
    const result = scan(repoRoot, { readmes: [], packageDirs: [] });
    expect(result.vacuous.map((v) => v.counter).sort()).toEqual(Object.keys(FLOORS).sort());
    for (const v of result.vacuous) expect(v.value).toBe(0);
  });

  describe('the two walks breach INDEPENDENTLY', () => {
    // On the FIXTURE tree, not `repoRoot`, and that is the whole point of this
    // block. The claim is "collapse the README walk and only the README-side
    // floors breach", which needs the package-side walk to be HEALTHY so that
    // collapsing `readmes` is the only variable. Against `repoRoot` that
    // precondition is a property of the machine: the fixture carries
    // hand-written `.d.ts` files, while the test shards run `pnpm install` and
    // then `pnpm test` and never build, so on CI every `packages/*` type entry
    // is absent and the package-side floors breach too. Written against
    // `repoRoot` this test passed on a built checkout and RED on CI --
    // measured, on this branch's first CI run.
    //
    // The exact equality is deliberate and must stay exact. Loosening it to a
    // containment check would pass on a built tree AND an unbuilt one, which
    // is precisely the distinction this test exists to draw; it would assert
    // that these four breached without asserting that those two did not, and
    // the independence claim would be gone while the test still read green.
    const root = fixtureTree(FIXTURE);
    const at = writeReadme(root, readme());

    /** Fixture-scale floors: the repo's own numbers are three orders too big. */
    const floors = {
      readmes: 1,
      codeBlocks: 1,
      importBindings: 1,
      selfBindings: 1,
      packagesRead: 2,
      exportSymbols: 3,
    };

    const healthy = scan(root, {
      readmes: ['packages/alpha/README.md'],
      packageDirs: FIXTURE_PACKAGES,
      readmeOverrides: { 'packages/alpha/README.md': at },
      floors,
    });
    const collapsed = scan(root, { readmes: [], packageDirs: FIXTURE_PACKAGES, floors });

    it('breaches nothing while BOTH walks are healthy — the control leg', () => {
      // Without this, a green below could mean "the fixture is broken too".
      expect(healthy.vacuous).toEqual([]);
      expect(healthy.census.packagesRead).toBe(2);
      expect(healthy.census.selfBindings).toBe(3);
    });

    it('breaches the README-side floors ALONE when only that walk collapses', () => {
      expect(collapsed.vacuous.map((v) => v.counter).sort()).toEqual(
        ['codeBlocks', 'importBindings', 'readmes', 'selfBindings'].sort(),
      );
      for (const v of collapsed.vacuous) expect(v.value).toBe(0);
    });

    it('leaves the package-side counters untouched by that collapse', () => {
      // The other half of "independently": these two are read from the same
      // scan and are unchanged from the healthy leg.
      expect(collapsed.census.packagesRead).toBe(healthy.census.packagesRead);
      expect(collapsed.census.exportSymbols).toBe(healthy.census.exportSymbols);
      expect(collapsed.census.packagesRead).toBe(2);
      expect(collapsed.census.exportSymbols).toBe(4);
    });
  });

  it('puts the census in the verdict line, so a reader sees the population', () => {
    // Both walks overridden to empty, so this reads NOTHING off disk and its
    // verdict cannot depend on whether the checkout is built. It asserts the
    // SHAPE of the line, never a count.
    const line = summarise(scan(repoRoot, { readmes: [], packageDirs: [] }));
    expect(line).toContain('README(s) under packages/');
    expect(line).toContain('self-imports judged');
    expect(line).toContain('export symbol(s) read from');
  });

  it('names that population as TRACKED, so a green is not read as a claim about the directory (objectui#6545)', () => {
    // Both walks are `git ls-files -- packages/`. A brand-new
    // `packages/<pkg>/README.md` that has not been `git add`-ed is OUTSIDE the
    // population, and this gate reports OK without ever opening it -- measured:
    // planting an untracked `packages/<pkg>/README.md` left `census.readmes`
    // unchanged. The word is what stops a reader taking the count for a
    // statement about the directory. Same wording as check-control-bytes,
    // check-vi-mock-specifiers and check-vi-mock-inherit.
    const line = summarise(scan(repoRoot, { readmes: [], packageDirs: [] }));
    expect(line).toContain('tracked README(s) under packages/');
    expect(line).toContain('tracked package(s)');
  });
});

/**
 * ── THE INTERFACE PIN (objectui#6214) ────────────────────────────────────────
 *
 * Its own fixture tree, deliberately not `FIXTURE` above. Tier 1's independence
 * test asserts `exportSymbols` EXACTLY (`toBe(4)`), and that exactness is the
 * whole content of its claim, so adding exports to alpha to give this half
 * something to compare would have quietly turned that assertion into a number
 * nobody chose. A second tree costs one `mkdtemp`.
 *
 * The shapes are chosen for the distinctions the pin has to draw, not for
 * realism:
 *   `Widget`    a plain property list -- the ordinary case.
 *   `Themed`    EXTENDS `Widget`, so `all` and `own` differ and the two
 *               directions have to read different sets.
 *   `Handlers`  method signatures only, so a resolved declaration can still be
 *               compared over ZERO keys.
 *   `Mode`      a union alias -- a type with no properties at all.
 * Every one of them reaches the barrel through a RE-EXPORT, so the shape is
 * resolved through an Alias symbol exactly as it is for every real package.
 */
const PIN_FIXTURE = {
  'packages/pin/package.json': manifest('@fix/pin', './dist/index.d.ts'),
  'packages/pin/dist/shapes.d.ts':
    'export interface Widget { id: string; label?: string; hidden?: boolean }\n' +
    'export interface Themed extends Widget { color?: string }\n' +
    'export interface Handlers { run(): void; reset(): void }\n' +
    "export type Mode = 'a' | 'b';\n",
  'packages/pin/dist/index.d.ts': "export { Widget, Themed, Handlers, Mode } from './shapes.js';\n",
};

const PIN_PACKAGES = ['packages/pin'];
const PIN_README = 'packages/pin/README.md';

describe('findDocumentedTypes — what a block DECLARES, and what it deliberately does not count', () => {
  it('reads an `interface` and separates properties from methods', () => {
    const [found] = findDocumentedTypes('interface X {\n  a: string;\n  b?: number;\n  go(): void;\n}');
    expect(found).toMatchObject({ name: 'X', kind: 'interface', keys: ['a', 'b'], methods: ['go'], other: 0 });
  });

  it('reads `type X = { … }`, because READMEs use it for the same job', () => {
    const [found] = findDocumentedTypes('type X = { a: string };');
    expect(found).toMatchObject({ name: 'X', kind: 'type', keys: ['a'] });
  });

  it('does NOT read an alias that is not a property list', () => {
    // A union, a mapped type or a conditional makes no claim about a property
    // set, so treating it as an empty one would report every shipped key as
    // omitted -- a wall of false reds on a correct README.
    expect(findDocumentedTypes("type X = 'a' | 'b';")).toEqual([]);
    expect(findDocumentedTypes('type X = Partial<Y>;')).toEqual([]);
  });

  it('counts an index signature rather than reading it as a key', () => {
    const [found] = findDocumentedTypes('interface X {\n  a: string;\n  [k: string]: unknown;\n}');
    expect(found.keys).toEqual(['a']);
    expect(found.other).toBe(1);
  });

  it('does not walk into a nested declaration — an example’s own scaffolding is not a claim', () => {
    expect(findDocumentedTypes('function demo() {\n  interface Inner { a: string }\n  return null;\n}')).toEqual([]);
  });

  it('reports the line of the declaration WITHIN the block', () => {
    const found = findDocumentedTypes('const a = 1;\n\ninterface X { a: string }\n');
    expect(found[0].line).toBe(3);
  });
});

describe('findPartialMarkers — a marker that declares nothing is worse than no marker', () => {
  const withFences = (md: string) => findPartialMarkers(md, extractCodeBlocks(md));

  it('binds to the next fence across blank lines', () => {
    const md = 'prose\n\n<!-- readme-exports: partial Widget — the rest is in the guide -->\n\n```ts\ninterface Widget {}\n```\n';
    expect(withFences(md)).toEqual([{ line: 3, name: 'Widget', reason: 'the rest is in the guide', fence: 5 }]);
  });

  it('lets a RUN of markers sit above one block, because a block may declare two types', () => {
    const md =
      '<!-- readme-exports: partial Widget — the rest is in the guide -->\n' +
      '<!-- readme-exports: partial Themed — the rest is in the guide -->\n' +
      '```ts\ninterface Widget {}\ninterface Themed {}\n```\n';
    expect(withFences(md).map((m) => [m.name, m.fence])).toEqual([
      ['Widget', 3],
      ['Themed', 3],
    ]);
  });

  it('binds a marker stranded in prose to NOTHING, so it can be reported', () => {
    const md = '<!-- readme-exports: partial Widget — the rest is in the guide -->\nprose\n\n```ts\ninterface Widget {}\n```\n';
    expect(withFences(md)[0].fence).toBeNull();
  });

  it('accepts the em dash, the double hyphen and the colon, like FRAGMENT_MARKER', () => {
    for (const sep of ['—', '--', '-', ':']) {
      expect(PARTIAL_MARKER.test(`<!-- readme-exports: partial Widget ${sep} a reason of real length -->`)).toBe(true);
    }
  });

  it('publishes the marker as a spelled-out example that its own regex accepts', () => {
    // The example is what the failure message hands the reader. An example the
    // parser rejects is a gate telling someone to write something that will not
    // work, which is worse than printing nothing.
    expect(PARTIAL_MARKER.test(PARTIAL_MARKER_EXAMPLE)).toBe(true);
  });
});

describe('the interface pin — BOTH directions, because one of them is green for the wrong reason', () => {
  const root = fixtureTree(PIN_FIXTURE);
  const run = (body: string, excerpts: Record<string, string> = {}) =>
    scan(root, {
      readmes: [PIN_README],
      packageDirs: PIN_PACKAGES,
      readmeOverrides: { [PIN_README]: writeReadme(root, body) },
      floors: {},
      excerpts,
    });
  const block = (code: string) => `# @fix/pin\n\n\`\`\`ts\n${code}\n\`\`\`\n`;
  const kinds = (r: ReturnType<typeof scan>) => r.findings.map((f) => f.verdict);

  it('CONTROL: a correctly documented interface is `matches`, and nothing is reported', () => {
    // Without this leg every green below could just mean the walk found nothing.
    const result = run(block('interface Widget {\n  id: string;\n  label?: string;\n  hidden?: boolean;\n}'));
    expect(result.findings).toEqual([]);
    expect(result.documentedTypes).toHaveLength(1);
    expect(result.documentedTypes[0]).toMatchObject({ typeName: 'Widget', verdict: 'matches', shippedOwn: 3 });
    expect(result.census.keysCompared).toBe(6);
  });

  it('reports a FABRICATED key — one the shipped type does not have', () => {
    const result = run(block('interface Widget {\n  id: string;\n  label?: string;\n  hidden?: boolean;\n  icon?: string;\n}'));
    expect(kinds(result)).toEqual(['fabricated-key']);
    expect(result.findings[0]).toMatchObject({ typeName: 'Widget', keys: ['icon'] });
  });

  it('reports a STALE OMISSION — a shipped key the block never mentions', () => {
    const result = run(block('interface Widget {\n  id: string;\n  label?: string;\n}'));
    expect(kinds(result)).toEqual(['stale-omission']);
    expect(result.findings[0]).toMatchObject({ typeName: 'Widget', keys: ['hidden'] });
  });

  it('THE RENAME: reports the new spelling AND the old one, on the SAME declaration', () => {
    // This is the class the card records that the typed-example half cannot
    // reach: a property-level type error short-circuits the missing-property
    // detail, so compiling `const w: Widget = { caption: … }` reports the excess
    // key and never that `label` is gone. Neither direction alone reports a
    // rename either — that is what makes the pin bidirectional rather than
    // twice as strict.
    const result = run(block('interface Widget {\n  id: string;\n  caption?: string;\n  hidden?: boolean;\n}'));
    expect(kinds(result).sort()).toEqual(['fabricated-key', 'stale-omission']);
    const fabricated = result.findings.find((f) => f.verdict === 'fabricated-key');
    const stale = result.findings.find((f) => f.verdict === 'stale-omission');
    expect(fabricated).toMatchObject({ keys: ['caption'] });
    expect(stale).toMatchObject({ keys: ['label'] });
    expect(fabricated?.line).toBe(stale?.line);
  });

  describe('inheritance — the two directions read DIFFERENT sets, on purpose', () => {
    it('does not call a documented INHERITED key fabricated', () => {
      // `id` reaches `Themed` through `extends Widget`. Documenting it is
      // correct; judging the doc side against own-members-only would tell the
      // reader to delete a key their editor completes.
      const result = run(block('interface Themed {\n  color?: string;\n  id: string;\n}'));
      expect(result.findings).toEqual([]);
    });

    it('does not call an omitted INHERITED key stale', () => {
      // `Themed` documenting only its own `color` is complete. Judging the
      // shipped side against ALL properties would report `id`, `label` and
      // `hidden` on every excerpt of every type with a base -- measured on the
      // real tree at objectui#6214: 36 omissions on one declaration, most of
      // them inherited `BaseSchema` members.
      const result = run(block('interface Themed {\n  color?: string;\n}'));
      expect(result.findings).toEqual([]);
      expect(result.documentedTypes[0]).toMatchObject({ shippedOwn: 1, shippedAll: 4, verdict: 'matches' });
    });
  });

  it('skips METHODS on both sides, and SAYS SO rather than reading as verified', () => {
    const result = run(block('interface Handlers {\n  run(): void;\n}'));
    expect(result.findings).toEqual([]);
    expect(result.census.typesResolved).toBe(1);
    // The honest half: it resolved, and it compared nothing. A census that only
    // said "1 resolved" would read as a checked declaration.
    expect(result.census.typesComparedOverZeroKeys).toBe(1);
  });

  it('records a shipped name with no properties as `not-a-property-type`, never as an empty one', () => {
    const result = run(block('type Mode = { a: string };'));
    expect(result.findings).toEqual([]);
    expect(result.documentedTypes[0]).toMatchObject({ typeName: 'Mode', verdict: 'not-a-property-type' });
    expect(result.census.typesNotAShape).toBe(1);
  });

  it('leaves a name the package does not export alone — a README may declare a local helper', () => {
    const result = run(block('interface LocalOnly {\n  whatever: string;\n}'));
    expect(result.findings).toEqual([]);
    expect(result.documentedTypes[0]).toMatchObject({ typeName: 'LocalOnly', verdict: 'local-declaration' });
  });

  describe('declaring an excerpt — and the one thing neither mechanism may hide', () => {
    const partial = 'interface Widget {\n  id: string;\n  label?: string;\n}';

    it('the MARKER suppresses the omission it declares', () => {
      const body =
        '# @fix/pin\n\n<!-- readme-exports: partial Widget — the rest is in the guide -->\n' +
        `\`\`\`ts\n${partial}\n\`\`\`\n`;
      const result = run(body);
      expect(result.findings).toEqual([]);
      expect(result.census.partialDeclared).toBe(1);
    });

    it('the MARKER does NOT suppress a fabricated key', () => {
      // An excerpt may leave a key out. It may not invent one, and there is no
      // reading of "partial" under which it could.
      const body =
        '# @fix/pin\n\n<!-- readme-exports: partial Widget — the rest is in the guide -->\n' +
        '```ts\ninterface Widget {\n  id: string;\n  icon?: string;\n}\n```\n';
      expect(kinds(run(body))).toContain('fabricated-key');
    });

    it('a marker with no real reason declares nothing, and fails as such', () => {
      const body = '# @fix/pin\n\n<!-- readme-exports: partial Widget — wip -->\n' + `\`\`\`ts\n${partial}\n\`\`\`\n`;
      expect(kinds(run(body)).sort()).toEqual(['partial-marker-no-reason', 'stale-omission']);
      expect('wip'.length).toBeLessThan(MIN_PARTIAL_REASON);
    });

    it('a marker stranded in prose FAILS instead of silently declaring nothing', () => {
      const body =
        '# @fix/pin\n\n<!-- readme-exports: partial Widget — the rest is in the guide -->\nprose in between\n\n' +
        `\`\`\`ts\n${partial}\n\`\`\`\n`;
      expect(kinds(run(body)).sort()).toEqual(['stale-omission', 'stray-partial-marker']);
    });

    it('a marker over a COMPLETE declaration is stale, and fails — the rule is shrink-only', () => {
      const body =
        '# @fix/pin\n\n<!-- readme-exports: partial Widget — the rest is in the guide -->\n' +
        '```ts\ninterface Widget {\n  id: string;\n  label?: string;\n  hidden?: boolean;\n}\n```\n';
      expect(kinds(run(body))).toEqual(['stale-partial-marker']);
    });

    it('a marker names ONE interface, so the neighbour in the same block is still judged', () => {
      // `packages/plugin-kanban/README.md` declares two types in one block. A
      // marker that silenced a whole block would silence the one nobody looked
      // at, which is why the grammar carries the name.
      const body =
        '# @fix/pin\n\n<!-- readme-exports: partial Widget — the rest is in the guide -->\n' +
        '```ts\ninterface Widget {\n  id: string;\n}\ninterface Themed {\n  color?: string;\n  nope?: string;\n}\n```\n';
      const result = run(body);
      expect(kinds(result)).toEqual(['fabricated-key']);
      expect(result.findings[0]).toMatchObject({ typeName: 'Themed', keys: ['nope'] });
      expect(result.census.partialDeclared).toBe(1);
    });

    it('the LEDGER suppresses the omission it records', () => {
      const result = run(block(partial), { [`${PIN_README}::Widget`]: 'objectui#0000 -- a recorded reason' });
      expect(result.findings).toEqual([]);
      expect(result.census.partialLedgered).toBe(1);
    });

    it('the LEDGER does NOT suppress a fabricated key either', () => {
      const result = run(block('interface Widget {\n  id: string;\n  icon?: string;\n}'), {
        [`${PIN_README}::Widget`]: 'objectui#0000 -- a recorded reason',
      });
      expect(kinds(result)).toContain('fabricated-key');
    });

    it('a LEDGER entry that suppresses nothing FAILS as stale, so the list can only shrink', () => {
      const complete = block('interface Widget {\n  id: string;\n  label?: string;\n  hidden?: boolean;\n}');
      const result = run(complete, { [`${PIN_README}::Widget`]: 'objectui#0000 -- a recorded reason' });
      expect(kinds(result)).toEqual(['stale-excerpt-entry']);
    });

    it('a LEDGER entry naming a declaration that is not there FAILS too', () => {
      const result = run(block('interface Widget {\n  id: string;\n  label?: string;\n  hidden?: boolean;\n}'), {
        [`${PIN_README}::Gone`]: 'objectui#0000 -- names nothing',
      });
      expect(kinds(result)).toEqual(['stale-excerpt-entry']);
      expect(result.findings[0]).toMatchObject({ typeName: 'Gone' });
    });
  });

  it('an UNBUILT package is a FAILURE on this side too, never a serene `local-declaration`', () => {
    // The same rule as the import side, and the same reason: with no export
    // surface on disk every documented type resolves to nothing, so the pin
    // would report a clean green over blocks it never judged.
    const unbuilt = fixtureTree({ 'packages/pin/package.json': manifest('@fix/pin', './dist/index.d.ts') });
    const result = scan(unbuilt, {
      readmes: [PIN_README],
      packageDirs: PIN_PACKAGES,
      readmeOverrides: { [PIN_README]: writeReadme(unbuilt, block('interface Widget {\n  id: string;\n}')) },
      floors: {},
      excerpts: {},
    });
    expect(kinds(result)).toEqual(['unjudgeable-type']);
    expect(result.findings[0]).toMatchObject({ reason: 'unbuilt', typeName: 'Widget' });
    expect(result.census.typesUnjudgeable).toBe(1);
  });


  describe('the shrink-only rule is SUSPENDED where nothing was compared (objectui#6214, caught by CI)', () => {
    // The regression: "this entry suppressed no omission" has two causes that
    // are indistinguishable from the outside — the README caught up (stale,
    // delete it), or the declaration could not be judged at all (still true,
    // keep it). The first version reported both as `stale-excerpt-entry`, and
    // because the test shards run `pnpm install` then `pnpm test` and NEVER
    // build, CI took the second cause and printed the first verdict on all
    // three real ledger entries. On the fixture tree here, so the claim does
    // not depend on whether the machine happens to be built.
    const unbuiltRoot = fixtureTree({ 'packages/pin/package.json': manifest('@fix/pin', './dist/index.d.ts') });
    const partial = 'interface Widget {\n  id: string;\n  label?: string;\n}';
    const runUnbuilt = (body: string, excerpts: Record<string, string> = {}) =>
      scan(unbuiltRoot, {
        readmes: [PIN_README],
        packageDirs: PIN_PACKAGES,
        readmeOverrides: { [PIN_README]: writeReadme(unbuiltRoot, body) },
        floors: {},
        excerpts,
      });
    const entry = { [`${PIN_README}::Widget`]: 'objectui#0000 -- a recorded reason' };

    it('does not call a LEDGER entry stale when its declaration could not be judged', () => {
      const result = runUnbuilt(block(partial), entry);
      expect(kinds(result)).toEqual(['unjudgeable-type']);
      expect(result.findings.filter((f) => f.verdict === 'stale-excerpt-entry')).toEqual([]);
      expect(result.census.excerptsNotJudged).toBe(1);
    });

    it('does not call a MARKER stale either, for the same reason', () => {
      const body =
        '# @fix/pin\n\n<!-- readme-exports: partial Widget — the rest is in the guide -->\n' + `\`\`\`ts\n${partial}\n\`\`\`\n`;
      const result = runUnbuilt(body);
      expect(kinds(result)).toEqual(['unjudgeable-type']);
      expect(result.findings.filter((f) => f.verdict === 'stale-partial-marker')).toEqual([]);
      expect(result.census.excerptsNotJudged).toBe(1);
    });

    it('counts NOTHING when the unjudged declaration carries no excerpt at all', () => {
      // The census number must mean "claims this run could not check", not
      // "declarations this run could not judge" — `typesUnjudgeable` already
      // says the latter, and inflating this one would read as excerpt debt
      // that does not exist.
      const result = runUnbuilt(block(partial));
      expect(result.census.typesUnjudgeable).toBe(1);
      expect(result.census.excerptsNotJudged).toBe(0);
    });

    it('MUST-FAIL CONTROL: the same entry on a BUILT tree is still reported stale', () => {
      // Without this leg the three above would also pass if the suspension had
      // swallowed the shrink-only rule outright, which is the opposite defect
      // and the more expensive one — a ledger that can never shrink again.
      const complete = block('interface Widget {\n  id: string;\n  label?: string;\n  hidden?: boolean;\n}');
      const result = run(complete, entry);
      expect(kinds(result)).toEqual(['stale-excerpt-entry']);
      expect(result.census.excerptsNotJudged).toBe(0);
    });
  });

  describe('the pin walk breaches ITS floors independently of the import walk', () => {
    const floors = { packagesRead: 1, exportSymbols: 4, typeDeclarations: 1, typesResolved: 1, keysCompared: 4 };
    const healthy = scan(root, {
      readmes: [PIN_README],
      packageDirs: PIN_PACKAGES,
      readmeOverrides: {
        [PIN_README]: writeReadme(root, block('interface Widget {\n  id: string;\n  label?: string;\n  hidden?: boolean;\n}')),
      },
      floors,
      excerpts: {},
    });
    const noTypes = scan(root, {
      readmes: [PIN_README],
      packageDirs: PIN_PACKAGES,
      readmeOverrides: { [PIN_README]: writeReadme(root, '# @fix/pin\n\n```ts\nimport { Widget } from "@fix/pin";\n```\n') },
      floors,
      excerpts: {},
    });

    it('breaches nothing while both walks are healthy — the control leg', () => {
      expect(healthy.vacuous).toEqual([]);
      expect(healthy.census.typesResolved).toBe(1);
    });

    it('breaches the THREE pin floors alone when only the type walk finds nothing', () => {
      // Exact equality, for the reason tier 1's independence test states: a
      // containment check would assert that these three breached without
      // asserting that the package-side two did not.
      expect(noTypes.vacuous.map((v) => v.counter).sort()).toEqual(
        ['keysCompared', 'typeDeclarations', 'typesResolved'].sort(),
      );
      for (const v of noTypes.vacuous) expect(v.value).toBe(0);
    });

    it('leaves the package-side counters untouched by that collapse', () => {
      expect(noTypes.census.packagesRead).toBe(healthy.census.packagesRead);
      expect(noTypes.census.exportSymbols).toBe(healthy.census.exportSymbols);
      expect(noTypes.census.selfBindings).toBe(1);
    });
  });
});

describe('the PARTIAL_EXCERPTS ledger, as it stands in this repository', () => {
  it('is keyed `<readme>::<InterfaceName>` and every entry carries a card number', () => {
    for (const [key, reason] of Object.entries(PARTIAL_EXCERPTS)) {
      expect(key).toMatch(/^packages\/[^:]+\/README\.md::[A-Za-z_$][A-Za-z0-9_$]*$/);
      expect(reason).toMatch(/objectui#\d+/);
      expect(reason.length).toBeGreaterThanOrEqual(MIN_PARTIAL_REASON);
    }
  });

  it('hides ONLY omissions, and the tree says so in BOTH build states', () => {
    // Written to hold built and unbuilt, like the `repo state` block above.
    // Built: turning the ledger OFF must red, and every red must be a
    // `stale-omission` at a declaration the ledger names -- so the ledger is
    // provably not covering a fabricated key or anything else. Unbuilt: there
    // is no export surface, so the same declarations are `unjudgeable-type`,
    // which is the FAILURE tier 1's rule requires and not a skip.
    const off = scan(repoRoot, { excerpts: {} });
    const built = off.census.packagesUnbuilt === 0;
    const ledgered = new Set(Object.keys(PARTIAL_EXCERPTS));
    if (built) {
      const omissions = off.findings.filter((f) => f.verdict === 'stale-omission');
      expect(omissions.length).toBeGreaterThan(0);
      expect(new Set(omissions.map((f) => `${f.file}::${f.typeName}`))).toEqual(ledgered);
      expect(off.findings.every((f) => f.verdict === 'stale-omission')).toBe(true);
    } else {
      expect(off.findings.some((f) => f.verdict === 'unjudgeable-type')).toBe(true);
      expect(off.findings.every((f) => f.verdict === 'unjudgeable-type' || f.verdict === 'unjudgeable')).toBe(true);
      // With the ledger OFF there is nothing for the sweep to call stale, so
      // this leg cannot see the objectui#6214 regression on its own — the one
      // in the `repo state` block below, with the ledger ON, is the leg that
      // does. Stated so the pair is not mistaken for one assertion twice.
      expect(off.census.excerptsNotJudged).toBe(0);
    }
  });
});

describe('repo state — assertions that hold whether or not the tree is built', () => {
  const result = scan(repoRoot);
  const built = result.census.packagesUnbuilt === 0;

  it('walked the tree: READMEs, fenced blocks and import bindings were all found', () => {
    // These three need no `dist/`, so they assert in the test shards too.
    expect(result.census.readmes).toBeGreaterThanOrEqual(FLOORS.readmes);
    expect(result.census.codeBlocks).toBeGreaterThanOrEqual(FLOORS.codeBlocks);
    expect(result.census.importBindings).toBeGreaterThanOrEqual(FLOORS.importBindings);
    expect(result.census.readmesOrphaned).toBe(0);
  });

  it('finds no fabricated or wrong-path import when built, and refuses to pass when not', () => {
    // `pnpm test` never builds, so in CI this suite takes the second branch;
    // locally, after a build, it takes the first. BOTH branches assert — a
    // conditional that let the unbuilt tree through silently would be this
    // gate's own defect.
    // The could-not-judge class has TWO verdicts since objectui#6214 added the
    // interface pin: `unjudgeable` for a self-import and `unjudgeable-type` for
    // a documented type. Both mean the same single thing — the package's export
    // surface is not on disk — so both are excluded here, exactly as the one
    // did before. This is the filter being kept correct as a new member of the
    // class arrived, NOT an exemption widened to make a red go green: the
    // assertion below still requires the unbuilt tree to FAIL.
    const CANNOT_JUDGE = ['unjudgeable', 'unjudgeable-type'];
    const judged = result.findings.filter((f) => !CANNOT_JUDGE.includes(f.verdict));
    if (built) {
      expect(judged, `unexpected README drift: ${JSON.stringify(judged, null, 2)}`).toEqual([]);
      expect(result.census.selfBindings).toBeGreaterThanOrEqual(FLOORS.selfBindings);
      expect(result.census.exportSymbols).toBeGreaterThanOrEqual(FLOORS.exportSymbols);
      expect(result.vacuous).toEqual([]);
    } else {
      expect(judged, `unbuilt tree reported a verdict it could not have judged: ${JSON.stringify(judged, null, 2)}`).toEqual([]);
      // The specific regression this line exists for (objectui#6214, caught by
      // `Test (shard 2/4)`): the three `PARTIAL_EXCERPTS` entries came back
      // `stale-excerpt-entry` on CI, because they had suppressed nothing — and
      // they had suppressed nothing only because NOTHING WAS COMPARED. Named
      // explicitly rather than left to the `toEqual([])` above, so a future
      // reader sees which verdict must never appear here and why.
      expect(result.findings.filter((f) => f.verdict === 'stale-excerpt-entry')).toEqual([]);
      expect(result.findings.filter((f) => f.verdict === 'stale-partial-marker')).toEqual([]);
      expect(result.census.excerptsNotJudged).toBe(Object.keys(PARTIAL_EXCERPTS).length);
      expect(
        result.findings.length + result.vacuous.length,
        'on an unbuilt tree the gate must FAIL (unjudgeable self-imports and/or a breached floor), never report OK',
      ).toBeGreaterThan(0);
    }
  });

  it('judges the packages the card named, once the tree is built', () => {
    if (!built) {
      expect(result.census.packagesUnbuilt).toBeGreaterThan(0);
      return;
    }
    const judgedIn = [
      ...new Set(
        result.bindings.filter((b) => b.verdict === 'real').map((b) => b.file.split('/').slice(0, 2).join('/')),
      ),
    ];
    // The seven packages the manual sweep hit (objectui#5010-#5016).
    for (const pkg of ['plugin-calendar', 'plugin-form', 'plugin-gantt', 'plugin-grid', 'plugin-view', 'plugin-dashboard', 'plugin-report']) {
      expect(judgedIn, `${pkg}'s README is no longer being judged`).toContain(`packages/${pkg}`);
    }
  });
});

describe('the --readme override, which is what keeps the self-test off the working tree', () => {
  it('parses a `<readme>=<path>` pair', () => {
    expect(parseReadmeOverrides(['--readme', 'packages/a/README.md=/tmp/x.md'])).toEqual({
      'packages/a/README.md': '/tmp/x.md',
    });
  });

  it('refuses a bare path rather than guessing which README it replaces', () => {
    expect(() => parseReadmeOverrides(['--readme', '/tmp/x.md'])).toThrow(/readmePath/);
  });
});

describe('wiring — the gate is reachable and every pull-request shape starts it', () => {
  const workflowDir = path.join(repoRoot, '.github/workflows');
  const workflowFiles = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml'));
  const workflow = fs.readFileSync(path.join(workflowDir, 'readme-exports.yml'), 'utf8');
  const uncommented = workflow
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

  it('is runnable by name', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:readme-exports']).toBe('node scripts/check-readme-exports.mjs');
  });

  it('is run by EXACTLY ONE workflow — two homes is two answers', () => {
    const runners = workflowFiles.filter((file) =>
      fs.readFileSync(path.join(workflowDir, file), 'utf8').includes('check:readme-exports'),
    );
    expect(runners).toEqual(['readme-exports.yml']);
  });

  it('carries NO trigger-level path filter — a README-only PR must start it', () => {
    // This is the shape `ci.yml` structurally cannot see, which is the whole
    // reason this gate has its own workflow.
    expect(uncommented).not.toMatch(/^\s*paths(-ignore)?:/m);
  });

  it('subscribes pull_request, push, merge_group and workflow_dispatch', () => {
    for (const trigger of ['pull_request:', 'push:', 'merge_group:', 'workflow_dispatch:']) {
      expect(uncommented).toContain(trigger);
    }
  });

  it('is classified as a required context, so a Dependabot merge waits for it', () => {
    expect(REQUIRED_CONTEXTS).toContain('README Export Check');
    expect(uncommented).toContain('name: README Export Check');
  });

  it('builds before it judges — without `dist/` the gate can only report `unbuilt`', () => {
    const buildAt = uncommented.indexOf('turbo run build');
    const checkAt = uncommented.indexOf('pnpm check:readme-exports');
    expect(buildAt).toBeGreaterThan(-1);
    expect(checkAt).toBeGreaterThan(buildAt);
    expect(uncommented).toContain('pnpm install --frozen-lockfile');
  });
});
