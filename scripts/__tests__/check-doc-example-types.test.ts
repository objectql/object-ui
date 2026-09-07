import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper; its types are inferred from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here.
import ts from 'typescript';
import {
  EXIT_CODES,
  MIN_REASON_LENGTH,
  TS_FENCE_LANGUAGES,
  UNGATED_EXAMPLES,
  codesMatch,
  exampleCensus,
  exportedOwnerOf,
  fencesOfExample,
  funnelLines,
  judge,
  ledgerKey,
  listExampleSources,
  preludeFor,
} from '../check-doc-example-types.mjs';

/**
 * objectui#8258 — the test for `scripts/check-doc-example-types.mjs`.
 *
 * The gate compiles JSDoc `@example` blocks on exported symbols against the
 * BUILT types. Two kinds of assertion live here, and the split matters:
 *
 *   INSTRUMENT  cases built from fixture text, which prove the extraction and
 *               the four ledger verdicts behave as the header says — including
 *               the two that make the ledger shrink-only, which are the ones a
 *               reader would otherwise have to take on trust.
 *   CORPUS      cases about THIS repository, which prove the instrument is
 *               pointed at a real population and that the ledger is exact. They
 *               are what stops the gate going green by scanning nothing.
 *
 * ⛔ What is deliberately NOT here: a case that runs the whole gate and asserts
 * exit 0. That is `pnpm check:doc-examples`' job, it needs the built closure,
 * and duplicating it here would make this file's runtime depend on a build.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const gateSource = fs.readFileSync(path.join(repoRoot, 'scripts', 'check-doc-example-types.mjs'), 'utf8');

// ── instrument: extraction ───────────────────────────────────────────────────

describe('fence extraction inside an `@example` body', () => {
  it('reads ts, tsx and typescript fences and nothing else', () => {
    const fences = fencesOfExample(
      ['```ts', 'const a = 1;', '```', '```json', '{}', '```', '```tsx', '<div />', '```'].join('\n'),
    );
    expect(fences.map((f) => f.language)).toEqual(['ts', 'json', 'tsx']);
    expect(fences.filter((f) => TS_FENCE_LANGUAGES.has(f.language))).toHaveLength(2);
  });

  it('closes a block at a fence of its own run length, so a wider wrapper is one block', () => {
    const fences = fencesOfExample(['````ts', '```', 'const a = 1;', '```', '````'].join('\n'));
    expect(fences).toHaveLength(1);
    expect(fences[0].body).toBe(['```', 'const a = 1;', '```'].join('\n'));
  });

  it('keeps the snippet own indentation', () => {
    const fences = fencesOfExample(['```ts', 'if (x) {', '  go();', '}', '```'].join('\n'));
    expect(fences[0].body).toContain('\n  go();');
  });

  it('an unterminated fence runs to the end rather than swallowing the walk', () => {
    const fences = fencesOfExample(['```ts', 'const a = 1;'].join('\n'));
    expect(fences).toHaveLength(1);
    expect(fences[0].body).toBe('const a = 1;');
  });
});

describe('the exported owner is read from the AST, never from the text', () => {
  const ownerOf = (source: string, needle: string) => {
    const sf = ts.createSourceFile('probe.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    let found: ReturnType<typeof exportedOwnerOf> | null = null;
    const visit = (node: ts.Node) => {
      if (node.getText(sf).startsWith(needle) && found === null) found = exportedOwnerOf(node);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
    return found;
  };

  it('names an exported function', () => {
    expect(ownerOf('export function useThing() {}', 'export function')).toEqual({
      exported: true,
      symbol: 'useThing',
    });
  });

  it('names the VARIABLE, not the statement, for an exported const', () => {
    expect(ownerOf('export const thing = 1;', 'export const')).toEqual({
      exported: true,
      symbol: 'thing',
    });
  });

  it('walks OUTWARD: a property inside an exported interface belongs to the interface', () => {
    const sf = ts.createSourceFile(
      'probe.ts',
      'export interface Shape {\n  /** @example 1 */\n  size: number;\n}',
      ts.ScriptTarget.ES2022,
      true,
    );
    const iface = sf.statements[0] as ts.InterfaceDeclaration;
    expect(exportedOwnerOf(iface.members[0])).toEqual({ exported: true, symbol: 'Shape' });
  });

  it('reports a non-exported declaration as not exported', () => {
    expect(ownerOf('function local() {}', 'function local')).toEqual({
      exported: false,
      symbol: null,
    });
  });

  it('the word `export` inside a STRING does not make a declaration exported', () => {
    expect(ownerOf('const doc = "export function fake() {}";\nfunction real() {}', 'function real')).toEqual({
      exported: false,
      symbol: null,
    });
  });
});

// ── instrument: the one transformation ───────────────────────────────────────

describe('the documented symbol import is injected only when all three conditions hold', () => {
  const block = { symbol: 'useThing', package: '@object-ui/x', body: 'const r = useThing();' };

  it('injects when the block references the symbol and does not import it', () => {
    expect(preludeFor(block, new Set())).toBe("import { useThing } from '@object-ui/x';\n");
  });

  it('does NOT inject when the block never references the symbol', () => {
    expect(preludeFor({ ...block, body: 'const r = 1;' }, new Set())).toBe('');
  });

  it('does NOT inject when the block already imports the symbol itself', () => {
    expect(
      preludeFor({ ...block, body: "import { useThing } from 'somewhere';\nuseThing();" }, new Set()),
    ).toBe('');
  });

  it('does NOT inject when the package entry does not export the symbol — the gate never blames an example for this transformation', () => {
    expect(preludeFor(block, new Set(['@object-ui/x useThing']))).toBe('');
  });
});

// ── instrument: the four ledger verdicts ─────────────────────────────────────

describe('the ledger is re-derived, never trusted', () => {
  const reason = 'a written reason long enough to be a declaration';

  it('a failing block with no row is a FAILURE — the default is COVERED', () => {
    const { findings } = judge({ results: [{ key: 'a.ts:1 A', codes: [2322] }], ledger: {} });
    expect(findings.map((f) => f.reason)).toEqual(['undeclared-failure']);
  });

  it('a failing block whose row matches is exempt, and nothing is reported', () => {
    const { findings, exempt } = judge({
      results: [{ key: 'a.ts:1 A', codes: [2322] }],
      ledger: { 'a.ts:1 A': { codes: [2322], reason } },
    });
    expect(findings).toEqual([]);
    expect(exempt).toEqual(['a.ts:1 A']);
  });

  it('SHRINK-ONLY: a row whose block now COMPILES is stale, and that is a red', () => {
    const { findings } = judge({
      results: [{ key: 'a.ts:1 A', codes: [] }],
      ledger: { 'a.ts:1 A': { codes: [2322], reason } },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe('stale-ledger-row');
    expect(findings[0].detail).toContain('COMPILES now');
  });

  it('SHRINK-ONLY: a row whose block fails DIFFERENTLY is a red — a row may not cover a failure it never declared', () => {
    const { findings } = judge({
      results: [{ key: 'a.ts:1 A', codes: [2322] }],
      ledger: { 'a.ts:1 A': { codes: [2304], reason } },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe('ledger-row-drifted');
    expect(findings[0].detail).toContain('TS2304');
    expect(findings[0].detail).toContain('TS2322');
  });

  it('a row naming a block that is gone is stale', () => {
    const { findings } = judge({ results: [], ledger: { 'gone.ts:1 A': { codes: [2322], reason } } });
    expect(findings.map((f) => f.reason)).toEqual(['stale-ledger-row']);
    expect(findings[0].detail).toContain('no such example');
  });

  it('a row with no written reason is not a declaration', () => {
    const { findings } = judge({
      results: [{ key: 'a.ts:1 A', codes: [2322] }],
      ledger: { 'a.ts:1 A': { codes: [2322], reason: 'short' } },
    });
    expect(findings.map((f) => f.reason)).toEqual(['unexplained-ledger-row']);
  });

  it('a clean block with no row is silent — the whole point of the exercise', () => {
    expect(judge({ results: [{ key: 'a.ts:1 A', codes: [] }], ledger: {} }).findings).toEqual([]);
  });

  it('codes are compared as a SET: a doubled diagnostic is not a changed failure', () => {
    expect(codesMatch([2322, 2322], [2322])).toBe(true);
    expect(codesMatch([2322, 2304], [2304, 2322])).toBe(true);
    expect(codesMatch([2322], [2322, 2304])).toBe(false);
  });
});

// ── corpus: this repository ──────────────────────────────────────────────────

describe('this repository', () => {
  const census = exampleCensus({ root: repoRoot });

  it('walks a plausible number of sources — an empty walk makes every verdict vacuous', () => {
    expect(census.files.length).toBeGreaterThan(500);
    expect(census.excludedAsTooling.length).toBeGreaterThan(100);
  });

  it('has examples to judge — the compiled tier is not empty', () => {
    expect(census.blocks.length).toBeGreaterThan(50);
  });

  it('every block in the compiled tier names an exported symbol and a package', () => {
    for (const block of census.blocks) {
      expect(block.symbol, block.file).toBeTruthy();
      expect(block.package, block.file).toMatch(/^@object-ui\/|^object-ui$/);
    }
  });

  it('the bare tier is COUNTED, not dropped — the header stands or falls on that number', () => {
    expect(census.bare.length).toBeGreaterThan(0);
    expect(census.exported.length).toBe(
      census.withTsFence.length + census.otherFenceOnly.length + census.bare.length,
    );
  });

  it('the funnel prints every narrowing step, so the enforced number is derived', () => {
    const lines = funnelLines(census);
    expect(lines.join('\n')).toContain('EXPORTED declarations');
    expect(lines.join('\n')).toContain('BLOCKS in the compiled tier');
    expect(lines.at(-1)).toContain(String(census.blocks.length));
  });

  it('tooling files contribute nothing to the compiled tier', () => {
    const toolingFiles = new Set(census.excludedAsTooling);
    for (const block of census.blocks) expect(toolingFiles.has(block.file)).toBe(false);
  });
});

describe('the real ledger', () => {
  const census = exampleCensus({ root: repoRoot });
  const keys = new Set(census.blocks.map((b) => ledgerKey(b)));

  it('every row names a block that is actually in the compiled tier', () => {
    for (const key of Object.keys(UNGATED_EXAMPLES)) expect(keys.has(key), key).toBe(true);
  });

  it('every row carries a written reason and a code list', () => {
    for (const [key, row] of Object.entries(UNGATED_EXAMPLES)) {
      expect(row.reason.trim().length, key).toBeGreaterThanOrEqual(MIN_REASON_LENGTH);
      expect(row.codes.length, key).toBeGreaterThan(0);
      expect(row.codes.every((c) => Number.isInteger(c)), key).toBe(true);
    }
  });

  it('is a DEBT, not the corpus: some blocks are off it and therefore actually judged', () => {
    const declared = Object.keys(UNGATED_EXAMPLES).length;
    expect(declared).toBeLessThan(census.blocks.length);
    expect(census.blocks.length - declared).toBeGreaterThan(0);
  });

  it('a row that names a card names one this repository can be asked about', () => {
    for (const [key, row] of Object.entries(UNGATED_EXAMPLES)) {
      if (row.card === null) continue;
      expect(row.card, key).toMatch(/^objectui#\d+$/);
    }
  });
});

// ── the card's own acceptance criterion ──────────────────────────────────────

describe('objectui#7974 — the defect this gate was filed for', () => {
  const key = 'packages/mobile/src/useSpecGesture.ts:69 useSpecGesture';

  it('its example is IN the compiled tier — the gate reaches the block the card named', () => {
    const census = exampleCensus({ root: repoRoot });
    expect(census.blocks.map((b) => ledgerKey(b))).toContain(key);
  });

  it('the scalar `direction` the card measured is what the block still carries', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'packages/mobile/src/useSpecGesture.ts'), 'utf8');
    expect(source).toContain("direction: 'left'");
  });

  it('its row records TS2322 by NUMBER and names the card that owns the repair', () => {
    const row = UNGATED_EXAMPLES[key];
    expect(row).toBeDefined();
    expect(row.codes).toContain(2322);
    expect(row.card).toBe('objectui#7974');
  });

  it('the row is the ONLY thing keeping this green — remove it and the block is an undeclared failure', () => {
    const { findings } = judge({
      results: [{ key, codes: UNGATED_EXAMPLES[key].codes }],
      ledger: {},
    });
    expect(findings.map((f) => f.reason)).toEqual(['undeclared-failure']);
  });

  it("when that lane repairs the example the row goes STALE, so the debt cannot outlive the defect", () => {
    const { findings } = judge({
      results: [{ key, codes: [] }],
      ledger: { [key]: UNGATED_EXAMPLES[key] },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ reason: 'stale-ledger-row', site: key });
  });
});

// ── the decisions this gate is asked to state in its own source ──────────────

describe('the script states its own rulings, so they cannot drift out of the source', () => {
  it('states why bare `@example` bodies are counted and not compiled', () => {
    expect(gateSource).toContain('Why bare `@example` bodies are counted and not compiled');
  });

  it('states the ONE transformation and that it is the only one', () => {
    expect(gateSource).toContain('The ONE transformation, stated out loud');
  });

  it('records that the `declare var NAME: any` route was priced and REFUSED', () => {
    expect(gateSource).toContain('declare var NAME: any');
    expect(gateSource).toContain('REFUSED');
  });

  it('states the template-literal decision and points at the instrument that already owns it', () => {
    expect(gateSource).toContain('The template-literal half of objectui#8258');
    expect(gateSource).toContain('--emit-census');
  });

  it('carries the three exit codes the sibling carries, for the reason the sibling gives', () => {
    expect(EXIT_CODES).toEqual({ verified: 0, examplesFailed: 1, couldNotRun: 2 });
  });

  it('refuses a verdict when the walk collapses or the compiled tier is empty', () => {
    expect(gateSource).toContain('would be a zero that means nothing');
    expect(gateSource).toContain('The compiled tier is EMPTY');
  });
});

// ── the sibling is not perturbed ─────────────────────────────────────────────

describe('the sibling harness is imported, not forked', () => {
  it('imports the compile harness rather than re-spelling it', () => {
    expect(gateSource).toContain("from './check-doc-snippet-types.mjs'");
    expect(gateSource).toMatch(/import \{[^}]*compileSnippets[^}]*\} from '\.\/check-doc-snippet-types\.mjs'/s);
  });

  it("does not re-declare the sibling's controls — a second sentinel would be a second answer", () => {
    expect(gateSource).not.toContain('ThisNameIsDefinitelyNotExported');
  });

  it('the strictness region of the sibling is untouched by this card', () => {
    const sibling = fs.readFileSync(
      path.join(repoRoot, 'scripts', 'check-doc-snippet-types.mjs'),
      'utf8',
    );
    const banner = sibling.indexOf('── Fence scanning');
    expect(banner).toBeGreaterThan(0);
    // The region is licensed: this card may read it, never edit it. Pinned by
    // content rather than by hash so the failure names WHAT moved.
    expect(sibling.slice(banner)).toContain('export function scanFences(source)');
    expect(sibling.slice(banner)).toContain('export function compileSnippets(');
  });

  it('the walk uses the same tooling rule the other source-walking gates use', () => {
    const { files, excludedAsTooling } = listExampleSources(repoRoot);
    expect(files.some((f) => f.includes('__tests__'))).toBe(false);
    expect(excludedAsTooling.some((f) => f.includes('__tests__') || /\.test\./.test(f))).toBe(true);
  });
});
