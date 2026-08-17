import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import { analyze, deriveRegistryKeys, scanDocs } from '../check-doc-component-types.mjs';

/**
 * objectui#4823 — the test for `scripts/check-doc-component-types.mjs`.
 *
 * The gate answers one question: does every `type` string literal in a
 * `content/docs/**.mdx` code block name a component this repository actually
 * registers. Nothing rendered or parsed those snippets before it, so the same
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

  it('this repository is green', () => {
    const findings = analyze(repoRoot).findings as Finding[];
    expect(findings.map((f) => `${f.reason} :: ${f.site} :: ${f.value ?? ''}`)).toEqual([]);
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
    // a PR editing only `content/docs/**.mdx` would start this gate nowhere.
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
    const gate = fs.readFileSync(path.join(repoRoot, SCRIPT), 'utf8');
    const imports = [...gate.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports.every((spec) => spec.startsWith('node:')), `non-builtin import in the gate: ${imports}`).toBe(true);
  });
});
