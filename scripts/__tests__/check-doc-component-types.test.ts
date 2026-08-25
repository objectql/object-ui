import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import { analyze, deriveRegistryKeys, scanDocs } from '../check-doc-component-types.mjs';
import { blank, scanSource } from '../js-comment-mask.mjs';

/**
 * objectui#4823 — the test for `scripts/check-doc-component-types.mjs`.
 *
 * The gate answers one question: does every `type` string literal in a
 * `content/docs/**` code block — `.mdx` and `.md` alike — name a component this
 * repository actually registers. Nothing rendered or parsed those snippets before it, so the same
 * defect landed three times (objectui#4786 `stats-card`, objectui#4796
 * `plugin:grid` and `plugin:map`) and CI was green through all three.
 *
 * What this file pins, in the order the gate can go wrong:
 *
 *  1. **The registry derivation**, because a key it MISSES turns correct
 *     documentation red — the expensive direction. Every registration form the
 *     repo uses is fixtured, including the two that a naive scan gets wrong: a
 *     `skipFallback` belonging to the NEXT call, and a registration quoted
 *     inside a comment or a string.
 *  2. **The verdicts**, over throwaway trees rather than this repository, so
 *     they stay decidable when the docs move.
 *  3. **The exemption table is load-bearing and re-derived, never trusted.**
 *  4. **The scan cannot collapse quietly** — an empty walk would make every
 *     assertion vacuous.
 *  5. **This repository is green**, and the three snippets the first run of this
 *     gate found stay fixed.
 *  6. **The gate is wired** where the other install-free gates are, and where a
 *     docs-only pull request can start it.
 *
 * Fixtures are temporary trees, never the real `content/docs`: a committed
 * fixture page would have to contain a deliberately wrong `type`, and this very
 * gate would then scan it.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = 'scripts/check-doc-component-types.mjs';

interface Finding {
  reason: string;
  site: string;
  value?: string;
  detail?: string;
}

/** Builds a throwaway tree and runs the REAL derivation/scan over it. */
function withTree<T>(build: (write: (rel: string, contents: string) => void) => void, run: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-doc-component-types-'));
  const write = (rel: string, contents: string) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  };
  try {
    build(write);
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The live tables are keyed by real repository paths, so a fixture tree can only
 * exercise the MECHANISM if it supplies its own. Empty ones are the neutral
 * default; a test that wants an exemption passes one.
 */
const BARE = { exemptions: {}, indirectRegistrations: [], openRegistrationSites: {} };

const keysOf = (dir: string): string[] => [...deriveRegistryKeys(dir, BARE).keys.keys()].sort();
const derivationFindings = (dir: string): Finding[] => deriveRegistryKeys(dir, BARE).findings as Finding[];

// ── 1. the registry derivation ───────────────────────────────────────────────

describe('the registered-key universe is derived from the registration calls', () => {
  it('reads a namespaced registration as BOTH the namespaced key and the bare fallback', () => {
    const keys = withTree((write) => {
      write(
        'packages/demo/src/index.tsx',
        [
          // No import of a workspace package here, not even as fixture TEXT.
          // `scripts-type-check.test.ts` greps this project's files for the
          // `from '<at>object-ui/…'` shape to pin the claim that
          // `pnpm type-check:scripts` needs no build, and that grep cannot tell a
          // string literal — or a comment quoting one — from a real import. The
          // fixture does not need the import line: the derivation reads the
          // register CALL, not what the file imports.
          "ComponentRegistry.register('object-grid', Renderer, {",
          "  namespace: 'plugin-grid',",
          "  label: 'Object Grid',",
          '});',
        ].join('\n'),
      );
    }, keysOf);
    expect(keys).toEqual(['object-grid', 'plugin-grid:object-grid']);
  });

  it('honours skipFallback — and reads it from the call it belongs to, not the next one', () => {
    // The measured bug this assertion exists for. `plugin-grid/src/index.tsx`
    // registers `object-grid` (no skipFallback) twelve lines above `grid` (which
    // HAS it). A derivation that looks for `skipFallback` in a fixed-size window
    // after the call reads the second call's flag on the first, drops the bare
    // `object-grid` key — and then reports the thirteen doc sites that spell it
    // correctly as unregistered types. A gate's derivation bug is a false RED on
    // correct prose, which is the failure mode that gets gates deleted.
    const keys = withTree((write) => {
      write(
        'packages/demo/src/index.tsx',
        [
          "ComponentRegistry.register('object-grid', Renderer, {",
          "  namespace: 'plugin-grid',",
          "  label: 'Object Grid',",
          '  inputs: GRID_INPUTS.map((i) => ({ ...i })),',
          '});',
          '',
          "ComponentRegistry.register('grid', Renderer, {",
          "  namespace: 'view',",
          '  skipFallback: true,',
          '});',
        ].join('\n'),
      );
    }, keysOf);
    expect(keys).toEqual(['object-grid', 'plugin-grid:object-grid', 'view:grid']);
    expect(keys, 'the bare `grid` key belongs to the layout container, not to this registration').not.toContain('grid');
  });

  it('resolves the three loop forms the repo registers through', () => {
    const keys = withTree((write) => {
      write(
        'packages/demo/src/loops.tsx',
        [
          "const TAGS = ['h1', 'h2'];",
          'for (const tag of TAGS) {',
          "  ComponentRegistry.register(tag, El, { namespace: 'ui' });",
          '}',
          '',
          "const tags = ['aside', 'main'];",
          'tags.forEach(tag => {',
          "  ComponentRegistry.register(tag, El, { namespace: 'ui' });",
          '});',
          '',
          "for (const variant of ['metric', 'pivot']) {",
          "  ComponentRegistry.registerLazy(variant, () => import('x'), { namespace: 'plugin-dashboard' });",
          '}',
        ].join('\n'),
      );
    }, keysOf);
    expect(keys).toEqual([
      'aside',
      'h1',
      'h2',
      'main',
      'metric',
      'pivot',
      'plugin-dashboard:metric',
      'plugin-dashboard:pivot',
      'ui:aside',
      'ui:h1',
      'ui:h2',
      'ui:main',
    ]);
  });

  it('does not read a registration written inside a comment or a string', () => {
    // Both live in this repository: `Registry.ts` documents `register()` in
    // JSDoc and quotes it inside a deprecation warning, `errors/index.ts` names
    // it in an English sentence. Treating prose as a registration puts arbitrary
    // strings into the universe, which makes the gate accept them in the docs.
    const result = withTree((write) => {
      write(
        'packages/demo/src/index.tsx',
        [
          '/**',
          " * @example ComponentRegistry.register('from-jsdoc', C, { namespace: 'ui' });",
          ' */',
          "// ComponentRegistry.register('from-line-comment', C, { namespace: 'ui' });",
          'export const warn = () =>',
          '  `Ensure the component is registered via registry.register() before rendering.`;',
          "ComponentRegistry.register('real', C, { namespace: 'ui' });",
        ].join('\n'),
      );
    }, (dir) => deriveRegistryKeys(dir, BARE));
    expect([...result.keys.keys()].sort()).toEqual(['real', 'ui:real']);
    expect((result.findings as Finding[]).map((f) => f.reason)).not.toContain('unresolved-registration');
  });

  it('reports a registration whose key it cannot resolve, rather than losing it', () => {
    // Silently skipping an unresolvable call NARROWS the universe, and a
    // narrowed universe reports correct documentation as wrong. The gate has to
    // fail loudly on a registration form it was never taught.
    const findings = withTree((write) => {
      write('packages/demo/src/index.tsx', 'ComponentRegistry.register(computeKey(), C, { namespace: "ui" });\n');
    }, derivationFindings);
    expect(findings.map((f) => f.reason)).toEqual(['unresolved-registration']);
  });

  it('ignores registrations that live in test files', () => {
    // `probe`, `crashing-widget`, `test-widget` and friends are registered by
    // suites all over this repo. Letting them into the universe would let a doc
    // page teach a type that exists only inside a test.
    const keys = withTree((write) => {
      write('packages/demo/src/index.tsx', "ComponentRegistry.register('real', C, { namespace: 'ui' });\n");
      write('packages/demo/src/__tests__/x.test.tsx', "ComponentRegistry.register('probe', C, { namespace: 'ui' });\n");
      write('packages/demo/src/y.test.tsx', "ComponentRegistry.register('probe2', C, { namespace: 'ui' });\n");
    }, keysOf);
    expect(keys).toEqual(['real', 'ui:real']);
  });
});

// ── 2. the docs scan ─────────────────────────────────────────────────────────

describe('the docs scan reads code blocks, in both spellings, and only code blocks', () => {
  it('captures JSON and object-literal spellings and ignores prose', () => {
    const { sites, counters } = withTree((write) => {
      write(
        'content/docs/x.mdx',
        [
          'Prose mentioning `type: \'never-scanned\'` in backticks.',
          '',
          '```json',
          '{ "type": "from-json" }',
          '```',
          '',
          '```plaintext',
          "{ type: 'from-literal' }",
          '```',
          '',
          '```tsx',
          "const node = { type: 'from-tsx' };",
          '```',
        ].join('\n'),
      );
    }, (dir) => scanDocs(dir));
    expect(sites.map((s) => s.value)).toEqual(['from-json', 'from-literal', 'from-tsx']);
    expect(counters.codeBlocks).toBe(3);
  });

  it('does not read a JSX `type=` attribute or a dotted `.type` access as a site', () => {
    const { sites } = withTree((write) => {
      write(
        'content/docs/x.mdx',
        ['```tsx', '<input type="email" />', "const t = schema.type; // 'x'", "const nested = { subtype: 'y' };", '```'].join(
          '\n',
        ),
      );
    }, (dir) => scanDocs(dir));
    expect(sites).toEqual([]);
  });

  it('collects `.md` pages as well as `.mdx` — the extension is not a coverage decision', () => {
    // objectui#5342. The collector used to walk `.mdx` only, so 40 `.md` guides
    // under the SAME tree were neither judged nor declared. This asserts the
    // walk, not the verdict: revert `DOC_EXTENSIONS` to `['.mdx']` and the
    // `from-md` site disappears while every other test in this file stays green.
    const { sites, counters } = withTree((write) => {
      write('content/docs/a.mdx', ['```json', '{ "type": "from-mdx" }', '```'].join('\n'));
      write('content/docs/guide/b.md', ['```json', '{ "type": "from-md" }', '```'].join('\n'));
      // Not a page: the `meta.json` sidecars fumadocs keeps beside the prose.
      write('content/docs/meta.json', '{ "pages": ["a"] }');
    }, (dir) => scanDocs(dir));
    expect(sites.map((s) => s.value).sort()).toEqual(['from-md', 'from-mdx']);
    expect(counters.files).toBe(2);
  });

  it('judges a `.md` page by the same rule, so an unregistered type there is a finding', () => {
    const { findings } = withTree((write) => {
      write('packages/demo/src/index.tsx', "ComponentRegistry.register('div', C, { namespace: 'ui' });\n");
      write('content/docs/guide/b.md', ['```json', '{ "type": "not-a-component" }', '```'].join('\n'));
    }, (dir) => analyze(dir, BARE));
    const f = findings as Finding[];
    expect(f.map((x) => x.reason)).toContain('unregistered-doc-type');
    expect(f.find((x) => x.reason === 'unregistered-doc-type')?.site).toBe('content/docs/guide/b.md:2');
  });

  it('reports an unterminated fence rather than guessing where code stops', () => {
    const { findings } = withTree((write) => {
      write('content/docs/x.mdx', ['```json', '{ "type": "div" }'].join('\n'));
      write('packages/demo/src/i.tsx', "ComponentRegistry.register('div', C, { namespace: 'ui' });\n");
    }, (dir) => analyze(dir, BARE));
    expect((findings as Finding[]).map((f) => f.reason)).toContain('unterminated-code-fence');
  });
});

// ── 3. the verdicts ──────────────────────────────────────────────────────────

describe('a documented type that nothing registers is a finding', () => {
  const tree = (mdx: string) => (write: (rel: string, contents: string) => void) => {
    write(
      'packages/demo/src/index.tsx',
      [
        "ComponentRegistry.register('object-grid', C, { namespace: 'plugin-grid' });",
        "ComponentRegistry.register('object-map', C, { namespace: 'plugin-map' });",
      ].join('\n'),
    );
    write('content/docs/page.mdx', mdx);
  };

  it('passes a registered type, bare or namespaced', () => {
    const { findings, counters } = withTree(
      tree(['```json', '{ "type": "object-grid" }', '{ "type": "plugin-map:object-map" }', '```'].join('\n')),
      (dir) => analyze(dir, BARE),
    );
    expect(findings).toEqual([]);
    expect(counters.registered, 'both sites must have been READ, not skipped').toBe(2);
  });

  it('flags the exact three recurrences objectui#4823 was filed for', () => {
    const findings = withTree(
      tree(
        [
          '```plaintext',
          "{ type: 'stats-card' }",
          "{ type: 'plugin:grid' }",
          "{ type: 'plugin:map' }",
          '```',
        ].join('\n'),
      ),
      (dir) => analyze(dir, BARE).findings as Finding[],
    );
    expect(findings.map((f) => `${f.reason} :: ${f.value}`)).toEqual([
      'unregistered-doc-type :: stats-card',
      'unregistered-doc-type :: plugin:grid',
      'unregistered-doc-type :: plugin:map',
    ]);
    expect(findings[1].site).toBe('content/docs/page.mdx:3');
  });
});

// ── 4. the exemption table ───────────────────────────────────────────────────

describe('the exemption table is load-bearing, and re-derived rather than trusted', () => {
  // The table in the script is keyed by REAL repository paths, so a fixture
  // cannot exercise it directly. What a fixture CAN prove is the mechanism, and
  // what the repository proves is that the entries are live — both below.

  it('every entry in the live table is hit by a real site', () => {
    // The stale check is the mechanism; this asserts the repository currently
    // satisfies it. An entry whose page stopped spelling that type silently
    // widens the hole for the next snippet that lands there.
    const findings = (analyze(repoRoot).findings as Finding[]).filter((f) => f.reason === 'stale-exemption');
    expect(findings.map((f) => f.site)).toEqual([]);
  });

  it('the table is doing work — emptying it turns this repository red', () => {
    // The direction was decided before it was run: the exempted vocabularies are
    // real (action schemas, block schemas, validation rules, field data types),
    // so removing their declarations must produce findings, not silence. A gate
    // whose exemption table could be deleted with no effect would be judging
    // nothing that the registry check does not already accept.
    const source = fs.readFileSync(path.join(repoRoot, SCRIPT), 'utf8');
    const exempted = analyze(repoRoot).counters.exempted;
    expect(exempted, 'the live scan exempts nothing, so the table cannot be load-bearing').toBeGreaterThan(50);
    // …and each exempted site is a distinct (file, value) declaration rather
    // than one blanket rule.
    const declarations = [...source.matchAll(/^\s{4}'?[\w:-]+'?:\s*$|^\s{4}'?[\w:-]+'?:\s*\n?\s*'/gm)].length;
    expect(declarations, 'the exemption table has collapsed to a handful of entries').toBeGreaterThan(20);
  });

  it('an exemption without a written reason does not count as one', () => {
    // A blank reason is how an exemption table degrades into a mute allow-list.
    const source = fs.readFileSync(path.join(repoRoot, SCRIPT), 'utf8');
    expect(source).toContain("reason.trim().length > 0");
    expect(source).toContain('exemption carries no written reason');
  });
});

// ── 5. the floors, and this repository ───────────────────────────────────────

describe('the scan cannot collapse quietly', () => {
  it('an empty docs tree produces zero sites, which the floors reject', () => {
    // Proven at the analysis layer, since the floors themselves live in the CLI:
    // a walk that finds nothing must be visible as nothing, not as "no findings".
    const counters = withTree((write) => {
      write('packages/demo/src/index.tsx', "ComponentRegistry.register('div', C, { namespace: 'ui' });\n");
    }, (dir) => analyze(dir, BARE).counters);
    expect(counters.files).toBe(0);
    expect(counters.typeSites).toBe(0);
  });

  it('this repository clears every floor by a wide margin', () => {
    const { counters } = analyze(repoRoot);
    expect(counters.files).toBeGreaterThan(120);
    expect(counters.codeBlocks).toBeGreaterThan(500);
    expect(counters.typeSites).toBeGreaterThan(400);
    expect(counters.registryKeys).toBeGreaterThan(500);
    expect(counters.registered).toBeGreaterThan(400);
  });

  it('really walks the `.md` half of this tree — the objectui#5342 widening, pinned', () => {
    // A repo-level assertion because the fixture above proves only the
    // mechanism. `content/docs` holds 143 `.mdx` and 40 `.md`; a revert to
    // `.mdx`-only drops ~323 `type` literals out of the scan and this repository
    // stays green while judging none of them.
    const { sites, counters } = scanDocs(repoRoot);
    const mdFiles = new Set(sites.filter((s: { file: string }) => s.file.endsWith('.md')).map((s: { file: string }) => s.file));
    expect(mdFiles.size, 'no `.md` page carries a scanned `type` literal — the collector narrowed').toBeGreaterThan(15);
    expect(mdFiles.has('content/docs/api/schema-reference.md')).toBe(true);
    expect(counters.files).toBeGreaterThan(170);
  });

  it('this repository is green', () => {
    const findings = analyze(repoRoot).findings as Finding[];
    expect(findings.map((f) => `${f.reason} :: ${f.site} :: ${f.value ?? ''}`)).toEqual([]);
  });
});

// ── objectui#5106: the key-table surface ─────────────────────────────────────

/**
 * objectui#5106 — the gate's second scan surface.
 *
 * Two measured facts on the card, both reproduced below as fixtures:
 *
 *  1. The objectui#5002 family replaced eight plugin pages' fictional
 *     registration loops with a markdown KEY TABLE. The new form is right, and
 *     it landed entirely outside a scan surface that reads fenced code only — so
 *     a fake key in a table was GREEN while the same fake key in a fence was RED.
 *  2. The gate never judged a NAMESPACE at all. It compared bare keys against a
 *     universe that merely happens to contain namespaced ones, so flipping a
 *     registration's `namespace` left every doc that teaches the old namespace
 *     green.
 *
 * The false-positive corpus in `does not read a table that is not a key table`
 * is the reason the anchor is the table HEADER rather than the row shape, and it
 * is taken from this repository rather than invented — see the gate's header for
 * the measurement (33 rows matched by the row heuristic, only 22 of them keys).
 */
describe('objectui#5106 — plugin key tables are judged, on both halves', () => {
  /** A tree with one registration and one key table over it. */
  const tableTree = (rows: string[], registration: string) =>
    withTree((write) => {
      write('packages/demo/src/index.tsx', registration);
      write(
        'content/docs/plugins/demo.mdx',
        ['# Demo', '', '| Namespaced key | Bare-name fallback | Renderer behind it |', '| --- | --- | --- |', ...rows, ''].join(
          '\n',
        ),
      );
    }, (dir) => analyze(dir, BARE));

  const REG = "ComponentRegistry.register('widget', W, { namespace: 'view' });\n";

  it('passes a row whose halves both name registered keys', () => {
    const { findings, counters } = tableTree(['| `view:widget` | `widget` | `W` |'], REG);
    expect(findings as Finding[]).toEqual([]);
    expect(counters.keyTables).toBe(1);
    expect(counters.keyTableRows).toBe(1);
    expect(counters.keyTableKeys).toBe(2);
  });

  it('reds a table row that names a key nothing registers — the surface that was green', () => {
    // The card's own reproduction: a fake key in the TABLE, which produced
    // `rc=0, Every documented component type is registered.` before this landed.
    const findings = tableTree(
      ['| `view:widget` | `widget` | `W` |', '| `view:phantom-widget` | `phantom-widget` | nothing registers this |'],
      REG,
    ).findings as Finding[];
    expect(findings.map((f) => `${f.reason} :: ${f.value}`)).toEqual([
      'unregistered-key-table-key :: view:phantom-widget',
      'unregistered-key-table-key :: phantom-widget',
    ]);
  });

  it('⭐ judges the NAMESPACED half — a namespace move reds the doc that teaches the old one', () => {
    // The half objectui#5106 was filed for. Same table, same bare name, only the
    // registration's `namespace` differs: `deriveRegistryKeys` follows it live,
    // so the row's namespaced cell is the ONLY thing that can notice.
    const rows = ['| `view:widget` | `widget` | `W` |'];
    expect(tableTree(rows, REG).findings as Finding[]).toEqual([]);

    const moved = tableTree(rows, "ComponentRegistry.register('widget', W, { namespace: 'dash' });\n");
    const findings = moved.findings as Finding[];
    expect(
      findings.map((f) => `${f.reason} :: ${f.value}`),
      'the bare half still matches, so a gate that judges only bare keys stays green here',
    ).toEqual(['unregistered-key-table-key :: view:widget']);
  });

  it('accepts the declared "none — `skipFallback: true`" fallback, and does not assert the negative', () => {
    // The universe is a UNION across the repo, so a call skipping its own bare
    // fallback says nothing about whether another package registers that bare
    // name — and in this tree one does. Asserting the negative would red a
    // correct row (`plugins/plugin-grid.mdx:185` is the live specimen).
    const { findings, counters } = tableTree(
      ['| `view:widget` | none — `skipFallback: true` | `W` |'],
      "ComponentRegistry.register('widget', W, { namespace: 'view', skipFallback: true });\n" +
        "OtherRegistry.register('widget', Other);\n",
    );
    expect(findings as Finding[]).toEqual([]);
    expect(counters.keyTableRows).toBe(1);
    expect(counters.keyTableKeys, 'only the namespaced half is a judgeable key here').toBe(1);
  });

  it('does not read a table that is not a key table — the false-positive corpus', () => {
    // Every row here matches the rejected row heuristic ("backticked cell with a
    // colon, then a backticked cell") and none of them is a component key. They
    // are the real shapes this repository writes: React route patterns, URLs,
    // HTTP routes and JSON literals. A gate that reds on these is worse than no
    // gate, because false RED on correct docs is the expensive direction.
    const findings = withTree((write) => {
      write('packages/demo/src/index.tsx', REG);
      write(
        'content/docs/guide/routes.md',
        [
          '| Route Pattern | Component | Purpose |',
          '| --- | --- | --- |',
          '| `/apps/:appName/:objectName` | `ObjectView` | Object list |',
          '| `http://localhost:5173/` | `LocalBundleLoader` | bundled JSON |',
          '| `GET /api/v1/meta/items/:type` | `effective._diagnostics` | per item |',
          '| `{ "type": "object", "objectName": "project" }` | `/apps/my_app/project` | default view |',
          '',
        ].join('\n'),
      );
    }, (dir) => analyze(dir, BARE).findings as Finding[]);
    expect(findings).toEqual([]);
  });

  it('does not read a key table drawn INSIDE a code fence', () => {
    // A table inside a fence is an example OF a table, not a claim about this
    // repository — the mirror of the rule that a fenced `type` IS a claim.
    const { findings, counters } = withTree((write) => {
      write('packages/demo/src/index.tsx', REG);
      write(
        'content/docs/plugins/demo.mdx',
        [
          '# Demo',
          '',
          '```markdown',
          '| Namespaced key | Bare-name fallback | Renderer behind it |',
          '| --- | --- | --- |',
          '| `view:phantom-widget` | `phantom-widget` | nothing registers this |',
          '```',
          '',
        ].join('\n'),
      );
    }, (dir) => analyze(dir, BARE));
    expect(findings as Finding[]).toEqual([]);
    expect(counters.keyTables).toBe(0);
  });

  it('reports a row it cannot read rather than skipping it', () => {
    // A row this gate cannot parse is a row it silently stops guarding, which is
    // how a scan narrows itself into vacuity one page at a time.
    const findings = tableTree(['| ObjectGrid | `widget` | prose, not a key |'], REG).findings as Finding[];
    expect(findings.map((f) => f.reason)).toEqual(['unreadable-key-table-row']);
  });

  it('does not let DOC_TYPE_EXEMPTIONS silence a table row', () => {
    // Exemptions declare "this value belongs to another vocabulary". A row under
    // a header that says "Namespaced key" has already declared its vocabulary, so
    // an exemption there would be a lie rather than a fact — the escape hatch is
    // deliberately absent.
    const findings = withTree((write) => {
      write('packages/demo/src/index.tsx', REG);
      write(
        'content/docs/plugins/demo.mdx',
        [
          '| Namespaced key | Bare-name fallback | Renderer behind it |',
          '| --- | --- | --- |',
          '| `view:phantom-widget` | `phantom-widget` | nothing registers this |',
          '',
        ].join('\n'),
      );
    }, (dir) =>
      analyze(dir, {
        ...BARE,
        exemptions: { 'content/docs/plugins/demo.mdx': { 'view:phantom-widget': 'a written reason', 'phantom-widget': 'ditto' } },
      }).findings as Finding[],
    );
    expect(findings.map((f) => f.reason)).toEqual([
      'unregistered-key-table-key',
      'unregistered-key-table-key',
      // The exemptions went unhit, which is itself reported — an exemption that
      // matches nothing widens the hole for the next snippet that lands there.
      'stale-exemption',
      'stale-exemption',
    ]);
  });

  it('this repository has key tables, and every key in them is registered', () => {
    // The repo-level half. The fixtures above prove the mechanism; this proves
    // the mechanism is pointed at something. `content/docs` carries the
    // objectui#5002 family's four plugin key tables.
    const { counters, findings } = analyze(repoRoot);
    expect(counters.keyTables, 'the family form vanished, or the header was renamed').toBeGreaterThanOrEqual(4);
    expect(counters.keyTableRows).toBeGreaterThanOrEqual(24);
    expect(counters.keyTableKeys).toBeGreaterThanOrEqual(45);
    expect(counters.keyTableKeys).toBe(counters.keyTableRegistered);
    expect((findings as Finding[]).filter((f) => f.reason.includes('key-table'))).toEqual([]);
  });

  it('really reads the four plugin pages, not just some table somewhere', () => {
    const { tableRows } = scanDocs(repoRoot) as { tableRows: { file: string; namespaced: string }[] };
    expect([...new Set(tableRows.map((r) => r.file))].sort()).toEqual([
      'content/docs/plugins/plugin-dashboard.mdx',
      'content/docs/plugins/plugin-form.mdx',
      'content/docs/plugins/plugin-grid.mdx',
      'content/docs/plugins/plugin-view.mdx',
    ]);
    expect(tableRows.map((r) => r.namespaced)).toContain('`view:dashboard`');
  });
});

describe('objectui#5106 — a floor that names no counter is not a floor', () => {
  // `FLOORS.docFiles` named a counter that never existed (`scanDocs` publishes
  // `files`), so it compared `undefined`, which is never below anything. The one
  // floor whose job is to catch the walk finding NOTHING was inert for its whole
  // life. Fixed by spelling, and the CLASS closed by the guard this pins.
  const script = fs.readFileSync(path.join(repoRoot, SCRIPT), 'utf8');

  it('every FLOORS key names a counter `analyze` really publishes', () => {
    const block = /const FLOORS = \{([\s\S]*?)\n\};/.exec(script);
    expect(block, 'FLOORS moved or changed shape').not.toBeNull();
    const keys = [...block![1].matchAll(/^\s*([A-Za-z]\w*):\s*\d+,/gm)].map((m) => m[1]);
    expect(keys.length, 'no floors parsed — the assertion below would be vacuous').toBeGreaterThan(4);
    const counters = analyze(repoRoot).counters as Record<string, number>;
    for (const key of keys) {
      expect(Object.hasOwn(counters, key), `FLOORS.${key} names no counter, so it can never fail`).toBe(true);
    }
  });

  it('does not reintroduce the `docFiles` spelling', () => {
    expect(script, 'the counter is `files`; `docFiles` compares undefined').not.toMatch(/\bdocFiles\b\s*:/);
  });

  it('the guard rejects a mis-keyed floor at runtime, not just in review', () => {
    expect(script).toMatch(/Object\.hasOwn\(counters, key\)/);
    expect(script).toContain('A floor over a missing counter compares');
  });
});

describe('the three snippets this gate found on its first run stay fixed', () => {
  // Named rather than left to the repo-wide green assertion: these are the live
  // specimens of objectui#4823's shape, and a revert would otherwise read as an
  // ordinary docs edit.
  const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

  it('`heading` is gone from the two page schemas that taught it', () => {
    // Nothing registers `heading`. `h1` is registered by `html-elements.tsx`'s
    // TAGS loop and renders `schema.children`, which is what both snippets want.
    for (const file of ['content/docs/utilities/runner.mdx', 'content/docs/utilities/vscode-extension.mdx']) {
      const body = read(file);
      expect(body, `${file} still teaches the unregistered \`heading\` type`).not.toContain('"type": "heading"');
      expect(body).toContain('"type": "h1"');
    }
  });

  it('the multi-step form teaches the wizard shape its own schema declares', () => {
    const body = read('content/docs/plugins/plugin-form.mdx');
    // The page still SAYS `multi-step-form` — in prose, telling the reader the
    // type does not exist. What must not come back is the snippet that authored
    // it, which is the only spelling a reader copies.
    expect(body).not.toContain('"type": "multi-step-form"');
    expect(body).toContain('there is\nno `multi-step-form` type');
    expect(body).toContain('"formType": "wizard"');
    expect(body).toContain('"type": "object-form"');
    // The package's own exported type is what makes that spelling the canonical
    // one, so the pin fails if the declaration moves rather than going stale.
    const schema = read('packages/plugin-form/src/WizardForm.tsx');
    expect(schema).toContain("type: 'object-form';");
    expect(schema).toContain("formType: 'wizard';");
  });
});

// ── 6. the wiring ────────────────────────────────────────────────────────────

describe('objectui#5342 — the key errors the widened collector found stay fixed', () => {
  // Named rather than left to the repo-wide green assertion, for the same reason
  // the block above names its three: these are the live specimens the extension
  // widening produced, and a revert would otherwise read as an unrelated
  // regression somewhere in a 183-file scan. Each one rendered the OBJUI-001
  // "Unknown component type" panel for a reader who copied it.
  const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

  it('the CRUD guide spells the registered keys, not the PascalCase component names', () => {
    const body = read('content/docs/guide/building-crud-app.md');
    for (const wrong of ['ObjectGrid', 'ObjectForm', 'ObjectDetail']) {
      expect(body, `${wrong} is a component NAME; the registry key is lower-kebab`).not.toContain(
        `type: '${wrong}'`,
      );
    }
    expect(body).toContain("type: 'object-grid'");
    expect(body).toContain("type: 'object-form'");
    expect(body).toContain("type: 'detail-view'");
  });

  it('the two empty-state snippets spell `empty`, the key EmptySchema declares', () => {
    // packages/types/src/feedback.ts declares `type: 'empty'` and
    // packages/components/src/renderers/feedback/empty.tsx registers it.
    for (const rel of ['content/docs/guide/expressions.md', 'content/docs/guide/schema-rendering.md']) {
      expect(read(rel), `${rel} still teaches empty-state`).not.toContain('"type": "empty-state"');
      expect(read(rel)).toContain('"type": "empty"');
    }
  });

  it('the playground teaches `grid`, in the fenced snippet AND in the prose beside it', () => {
    const body = read('content/docs/guide/schema-playground.md');
    expect(body, 'nothing registers grid-layout').not.toContain('grid-layout');
    expect(body).toContain('"type": "grid"');
  });

  it('the schema reference gives its Email field a field type that exists', () => {
    // `link` is not in fieldWidgetMap; `email` and `url` are.
    const body = read('content/docs/api/schema-reference.md');
    expect(body).not.toContain('"label": "Email", "type": "link"');
    expect(body).toContain('"label": "Email", "type": "email"');
  });
});

describe('wiring — the gate is reachable and a docs-only PR starts it', () => {
  const workflowDir = path.join(repoRoot, '.github/workflows');
  const workflowPath = path.join(workflowDir, 'doc-component-types.yml');
  const workflowFiles = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml'));

  /**
   * A workflow's YAML with whole-line comments removed — these headers name each
   * other's scripts in prose, and a scan that counted comments would report
   * duplicate homes that no file has.
   */
  const yamlOf = (file: string) =>
    fs
      .readFileSync(path.join(workflowDir, file), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

  it('is exposed as a root package script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['check:doc-types']).toBe(`node ${SCRIPT}`);
  });

  it('has a workflow that gates pull requests, not just pushes', () => {
    expect(fs.existsSync(workflowPath), 'a check nothing runs is not a gate').toBe(true);
    const yaml = yamlOf('doc-component-types.yml');
    expect(yaml).toMatch(new RegExp(`run:\\s*node\\s+${SCRIPT.replace(/[.]/g, '\\.')}`));
    expect(yaml).toMatch(/^\s*pull_request:/m);
    expect(yaml).toMatch(/^\s*push:/m);
    expect(yaml).toMatch(/^\s*merge_group:/m);
  });

  it('runs it in NO path-filtered workflow — the change that breaks it is docs-only', () => {
    // The whole reason this is its own workflow. `ci.yml`'s type-check job
    // excludes `content/**` from the diff that decides whether its gates run, so
    // a PR editing only `content/docs/**` would start this gate nowhere.
    expect(workflowFiles.length, 'the workflow directory scan returned implausibly few files').toBeGreaterThan(5);
    for (const file of workflowFiles) {
      const yaml = yamlOf(file);
      if (!yaml.includes(SCRIPT)) continue;
      expect(yaml, `${file} runs ${SCRIPT} behind a paths-ignore — a docs-only change would not start it`).not.toMatch(
        /paths-ignore:/,
      );
      expect(yaml, `${file} runs ${SCRIPT} behind a paths filter — see objectui#3448`).not.toMatch(/^\s+paths:/m);
    }
  });

  it('has exactly one home', () => {
    expect(workflowFiles.filter((f) => yamlOf(f).includes(SCRIPT))).toEqual(['doc-component-types.yml']);
  });

  it('needs no install, so it can afford to run unfiltered', () => {
    // The moment this needs `pnpm install` it stops being cheap enough to run on
    // every PR shape, and the filter that follows is the hole.
    const yaml = yamlOf('doc-component-types.yml');
    expect(yaml).not.toContain('pnpm install');
    expect(yaml).not.toContain('corepack');

    // Walk the WHOLE static import graph, not just the gate's own first line.
    // objectui#6092 converted this gate's entry guard to `./invoked-as.mjs`, a
    // relative import — install-free, but not spelled `node:`. Asserting on the
    // gate's own imports alone would have had to be loosened to let that
    // through, and a loosened one-file assertion is how a relative import that
    // DOES pull a package in later lands unnoticed. Following the graph keeps
    // the original claim ("this needs no node_modules") literally true, and
    // makes it true of every module the gate reaches.
    const seen = new Set<string>();
    const external: string[] = [];
    const walk = (abs: string) => {
      if (seen.has(abs)) return;
      seen.add(abs);
      const source = fs.readFileSync(abs, 'utf8');
      for (const m of source.matchAll(/^import .* from '([^']+)';$/gm)) {
        const spec = m[1];
        if (spec.startsWith('node:')) continue;
        if (!spec.startsWith('.')) {
          external.push(`${path.relative(repoRoot, abs)} -> ${spec}`);
          continue;
        }
        walk(path.resolve(path.dirname(abs), spec));
      }
    };
    walk(path.join(repoRoot, SCRIPT));

    expect(seen.size, 'the import walk read only the gate itself — it followed nothing').toBeGreaterThan(1);
    expect(external, `the gate's import graph reaches a package, so it needs an install: ${external}`).toEqual([]);
  });
});

/**
 * Comments AND string / template / regex literal CONTENT blanked, offsets kept.
 *
 * Both halves are load-bearing, and the second one is what lets the scan below
 * read THIS file without reding on it: the fixture table writes the very
 * declaration it is looking for, as a string. `maskComments` alone leaves those
 * strings live. Measured over the 3,603 TypeScript files git tracks, blanking
 * literal content as well loses 16 of 2,324 top-level exported declarations, in
 * exactly two files — `packages/sdui-parser/src/codegen.ts`, which EMITS a
 * declaration from a template, and `check-spec-symbol-derivation.test.ts`, whose
 * fixtures are template literals. Both are the direction to lose them in: source
 * that declares nothing must not be read as declaring something.
 */
function codeOnly(source: string): string {
  const { comment, literal } = scanSource(source);
  const flags = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i++) flags[i] = comment[i] || literal[i];
  return blank(source, flags);
}

/**
 * Every site in `source` that puts the BARE name `ValidationRule` into this
 * repository's types, reported as `line: what`. Empty means the sentence on
 * `content/docs/plugins/plugin-form.mdx` holds for this file.
 *
 * ⛔ Why this is written the long way (objectui#6186). A substring match on
 * `ValidationRule` matched 106 lines when this was written, every one of them a
 * real and DIFFERENT type: `AdvancedValidationRule`, `ValidationRuleType`,
 * `ObjectValidationRule`, `DesignerValidationRule` and `FieldValidationRules`,
 * plus `ValidationRuleSchema`, `ValidationRuleDraft`, `BaseValidationRuleShape`
 * and `buildValidationRules`. A naive match therefore reds on a TRUE claim, and
 * the next person to hit that deletes the assertion — which puts the claim back
 * where it started, unguarded. So every spelling above is fixtured as a NEGATIVE
 * in the test below rather than remembered here.
 */
function bareValidationRuleSites(source: string): string[] {
  const code = codeOnly(source);
  const lineOf = (index: number) => code.slice(0, index).split('\n').length;
  const sites: string[] = [];

  // A declaration of the exact name. The trailing `\b` is what keeps
  // `ValidationRuleType` and `ValidationRuleDraft` out; requiring the keyword and
  // the whitespace immediately before the name is what keeps
  // `AdvancedValidationRule`, `ObjectValidationRule`, `DesignerValidationRule`
  // and `FieldValidationRules` out.
  for (const m of code.matchAll(/\b(?:interface|class|enum)\s+ValidationRule\b|\btype\s+ValidationRule\s*[=<]/g)) {
    sites.push(`${lineOf(m.index ?? 0)}: declares \`${m[0].replace(/\s+/g, ' ').trim()}\``);
  }

  // A re-export publishes the name without declaring it here, so a check that
  // read declarations alone would call the page true while
  // `import { ValidationRule } from '@object-ui/types'` compiled for the reader.
  // Specifiers are SPLIT rather than matched inside the braces, which is what
  // keeps `export { ValidationRuleSchema }` out — and `export { ValidationRule as
  // SpecRule }` too, because that publishes a different name.
  for (const m of code.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const specifier of m[1].split(',')) {
      const published = specifier.trim().split(/\s+as\s+/).pop()?.trim().replace(/^type\s+/, '');
      if (published === 'ValidationRule') sites.push(`${lineOf(m.index ?? 0)}: re-exports \`ValidationRule\``);
    }
  }

  return sites;
}

describe('objectui#5118 — the plugin-form page teaches the real `validation` shape', () => {
  // The `type` literals this gate judges were only half the drift on that page.
  // `### Form Field` redeclared a local `interface FormField` whose `validation`
  // was `ValidationRule[]` — a type name that exists nowhere in this repository
  // — and `### Form with Validation` authored the array to match. Neither half
  // was visible to any check: a hand-written `interface` in a ```plaintext block
  // compiles nowhere, and the array's `type: 'minLength'` / `'maxLength'` were
  // EXEMPTED here, with a reason ("ValidationRule discriminant under a field's
  // `validation[]`") that restated the fiction. Deleting those entries is what
  // gives this gate teeth over the example half; this block pins the rest.
  const page = path.join(repoRoot, 'content/docs/plugins/plugin-form.mdx');
  const body = fs.readFileSync(page, 'utf8');

  it('no longer authors `ValidationRule`, and says outright that it does not exist', () => {
    // Same shape as the `multi-step-form` pin above: the page still NAMES the
    // fiction in prose, to tell the reader it is one. What must not come back is
    // the declaration a reader copies.
    expect(body).not.toMatch(/validation\??\s*:\s*ValidationRule/);
    expect(body).toContain('There is no `ValidationRule` type in this repository');
  });

  // ── The OTHER half of that pin (objectui#6186) ─────────────────────────────
  // `toContain` above asserts the sentence is PRESENT. It cannot assert the
  // sentence is TRUE. Land a bare declaration of the name tomorrow and the page
  // turns false while that assertion stays green — worse than no pin at all,
  // because a green test reads as coverage of the claim it quotes. The two tests
  // below re-derive the claim from source instead of pinning the prose that
  // states it. Presence and truth are different assertions; there is now one of
  // each and neither pretends to do the other's job.
  //
  // ⛔ The pin above stays exactly as it is. Its job — keeping the fiction from
  // being authored back into a snippet a reader copies — is not this one's.

  it('the bare-`ValidationRule` match discriminates every near-spelling that really exists', () => {
    // Fixtures rather than the tree, so the negative control stays decidable
    // when the types move. Every negative is a spelling this repository really
    // writes, cited where it lives — an assertion that red on `FieldValidationRules`
    // would be deleted by the first person who hit it, and the claim would be
    // back to unguarded.
    for (const source of [
      'export interface ValidationRule {\n  type: string;\n}',
      'export type ValidationRule = { type: string };',
      'export type ValidationRule<T> = T[];',
      'interface ValidationRule {}',
      'export declare class ValidationRule {}',
      'export enum ValidationRule {}',
      "export { ValidationRule } from './rules';",
      "export type { SpecRule as ValidationRule } from '@objectstack/spec';",
    ]) {
      expect(bareValidationRuleSites(source), source).not.toEqual([]);
    }

    for (const source of [
      'export interface AdvancedValidationRule {}', //          packages/types/src/data-protocol.ts:708
      "export type ValidationRuleType = 'required';", //        packages/types/src/data-protocol.ts:748
      'export type ObjectValidationRule = { name: string };', // packages/types/src/data-protocol.ts:1129
      'export interface DesignerValidationRule {}', //           packages/types/src/designer.ts:762
      'export interface FieldValidationRules {}', //             packages/types/src/form.ts:744
      'interface ValidationRuleDraft {}', //                     app-shell ObjectValidationsPanel.tsx:46
      'interface BaseValidationRuleShape {}', //                 quoted at types/src/data-protocol.ts:980
      "import { ValidationRuleSchema } from '@objectstack/spec/data';",
      "export { ValidationRuleSchema } from '@objectstack/spec/data';",
      'export function buildValidationRules(field: unknown) {\n  return field;\n}',
      'const rules: ObjectValidationRule[] = [];',
      "export { ValidationRule as SpecRule } from '@objectstack/spec';", // publishes another name
      '// nothing here declares interface ValidationRule', //             prose is masked
      "const fixture = 'export interface ValidationRule {}';", //         a fixture is masked
    ]) {
      expect(bareValidationRuleSites(source), source).toEqual([]);
    }
  });

  it('re-derives the claim: nothing this repository declares is a bare `ValidationRule`', () => {
    // SCANNED POPULATION, stated because the sentence says "in this repository":
    // every TypeScript file git tracks — `git ls-files` filtered to the `.ts`
    // family, `.d.ts` included. 3,603 files on the tree this was written against.
    // It is DERIVED, not listed: `node_modules`, `dist` and every other build
    // output are untracked and so are out by construction, and a TypeScript type
    // cannot be declared in a file outside that family.
    // `scripts/check-control-bytes.mjs` reads this repository the same way, for
    // the same reason.
    //
    // ⚠️ The population and the sentence have to stay co-extensive. If this scan
    // ever has to be narrowed, narrow the sentence on the page with it — a gate
    // that asserts less than the prose while looking like it covers it is the
    // exact defect objectui#6186 filed.
    const tracked = execFileSync('git', ['ls-files', '-z'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\0')
      .filter((rel) => /\.(?:[cm]?ts|tsx)$/.test(rel));

    // The walk cannot collapse quietly: an empty population makes the assertion
    // below vacuous and green forever, which is the shape this whole block exists
    // to stop.
    expect(tracked.length, 'the source walk found no TypeScript files at all').toBeGreaterThan(1000);

    const sites: string[] = [];
    for (const rel of tracked) {
      const source = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      // Prefilter on the raw bytes. Masking only ever REMOVES text, so a site in
      // the masked code implies the raw file carries the name.
      if (!source.includes('ValidationRule')) continue;
      for (const site of bareValidationRuleSites(source)) sites.push(`${rel}:${site}`);
    }

    expect(
      sites,
      'content/docs/plugins/plugin-form.mdx tells the reader there is no `ValidationRule` type here. ' +
        `These declare or publish one, so either the page or the type has to go:\n${sites.join('\n')}`,
    ).toEqual([]);
  });

  it('authors `validation` as an object keyed by rule name, never an array', () => {
    // Prose may still SHOW the array spelling (it is the counterexample); an
    // authored one — JSON or TS, in a snippet or a table — may not come back.
    const authoredArrays = [...body.matchAll(/^\s*"?validation"?\s*:\s*\[/gm)];
    expect(authoredArrays.map((m) => m[0].trim())).toEqual([]);
    expect(body).toContain('"minLength": { "value": 3, "message": "Min 3 characters" }');
    expect(body).toContain('| `validation` | `FieldValidationRules` |');
  });

  it('names types that are really declared, so the pin fails if one moves', () => {
    const types = fs.readFileSync(path.join(repoRoot, 'packages/types/src/form.ts'), 'utf8');
    expect(types).toContain('export interface FieldValidationRules {');
    expect(types).toContain('validation?: FieldValidationRules;');
    // The keys the page's rule table teaches, as the interface declares them.
    for (const rule of ['required?:', 'minLength?:', 'maxLength?:', 'min?:', 'max?:', 'pattern?:', 'validate?:']) {
      expect(types.slice(types.indexOf('export interface FieldValidationRules {'))).toContain(rule);
    }
    // `defaultValue` / `className` are named as NON-members; that is only true
    // while the interface really omits them.
    const formField = types.slice(types.indexOf('export interface FormField {'));
    const declaredKeys = formField.slice(0, formField.indexOf('\n}'));
    expect(declaredKeys).not.toMatch(/^\s{2}defaultValue\??:/m);
    expect(declaredKeys).not.toMatch(/^\s{2}className\??:/m);
  });
});
