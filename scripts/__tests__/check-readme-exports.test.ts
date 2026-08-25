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
  extractCodeBlocks,
  findImportBindings,
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
      ['codeBlocks', 'exportSymbols', 'importBindings', 'packagesRead', 'readmes', 'selfBindings'].sort(),
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
    const judged = result.findings.filter((f) => f.verdict !== 'unjudgeable');
    if (built) {
      expect(judged, `unexpected README drift: ${JSON.stringify(judged, null, 2)}`).toEqual([]);
      expect(result.census.selfBindings).toBeGreaterThanOrEqual(FLOORS.selfBindings);
      expect(result.census.exportSymbols).toBeGreaterThanOrEqual(FLOORS.exportSymbols);
      expect(result.vacuous).toEqual([]);
    } else {
      expect(judged).toEqual([]);
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
