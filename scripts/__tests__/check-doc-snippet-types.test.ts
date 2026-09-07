import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';

// Plain-JS CI helper; its types are inferred from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here.
import ts from 'typescript';
import {
  EXIT_CODES,
  FRAGMENT_MARKER_EXAMPLES,
  ROOT_DECLARED_CONTROL_PACKAGE,
  UNDECLARED_CONTROL_PACKAGE,
  UNGATED_DOCS,
  analyze,
  blockingPreconditions,
  buildFilterArgs,
  compileSnippets,
  deriveDeclaredDependencyPaths,
  derivePackageTypePaths,
  findInstalledCopy,
  listDocuments,
  moduleSpecifiersOf,
  moduleSpecifiersOfBlock,
  resolvesOnlyThroughRootManifest,
  ROOT_DOCS,
  rootDeclaredSpecifiers,
  rootDocsPages,
  scanFences,
  scopedBuildNotice,
  specifierRoot,
} from '../check-doc-snippet-types.mjs';

/**
 * objectui#5138 shape 2 — the test for `scripts/check-doc-snippet-types.mjs`.
 *
 * The gate compiles documentation snippets against the BUILT types. Its three
 * self-controls (resolution / sentinel / positive) can only be exercised against
 * a real build, which this suite deliberately does not do — a unit test that
 * needed `turbo run build` would stop running per-PR. So what is pinned here is
 * everything that can go wrong WITHOUT a build, in the order it would hurt:
 *
 *  1. **The fragment rule**, because its failure mode is silent. A marker that
 *     attaches to the wrong block, or a block that gets skipped without a
 *     declaration, converts a real defect into a green.
 *  2. **The ledger is re-derived, never trusted** — an entry for a file that no
 *     longer exists, or that holds no snippet, is a hole that reads as coverage.
 *  3. **The scan cannot collapse quietly.** An empty walk makes every other
 *     assertion vacuous, which is how a gate reports green over nothing.
 *  4. **The types come from `dist`, never from `src`.** The repository's own root
 *     `tsconfig.json` maps the workspace to source; a harness that inherited it
 *     would check the docs against code no consumer sees.
 *  5. **The gate is wired**, in a workflow a docs-only pull request can start.
 *  6. **Third-party resolution reaches exactly as far as the imported packages
 *     DECLARE** (objectui#6120). This one's failure mode is the worst in the list
 *     because it is invisible: widen resolution past the declarations and every
 *     document stays green while the gate stops being able to fail. The suite
 *     therefore pins both directions — a declared dependency IS mapped, and an
 *     installed-but-undeclared one is NOT — plus the two preconditions the
 *     UNDECLARED control needs in order to mean anything.
 *  7. **The exit path tells "I could not run" from "I ran and found errors"**
 *     (objectui#5465). A run that resolved against nothing produced no verdict
 *     about any document; leaving through the same code as a real snippet
 *     failure makes neither actionable, and leaving through 0 would be zero
 *     information wearing a green tick.
 *
 * Fixtures are throwaway trees, never `content/docs`: a committed fixture page
 * would have to contain a deliberately broken snippet, and this very gate scans
 * that directory.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = 'scripts/check-doc-snippet-types.mjs';

interface Finding {
  reason: string;
  site: string;
  detail?: string;
}

function tempTree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-snippet-gate-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  fs.mkdirSync(path.join(root, 'packages'), { recursive: true });
  return root;
}

const FENCE = '```';

/**
 * The corpus specimen behind objectui#7555 — a `tsx` block whose body assigns a
 * template literal holding a README sample, and inside that literal the line
 * `npm install project-name`.
 */
const README_SAMPLE_DOC = 'content/docs/plugins/plugin-markdown.mdx';
// 195 until objectui#6972 replaced two prop-table rows above it with a
// retirement blockquote (+11 lines); re-declared here, as this pin intends.
const README_SAMPLE_FENCE_LINE = 206;

/**
 * The regex reader objectui#7555 removed from both gates, kept HERE and only
 * here, as the contrast that makes the pin using it a measurement rather than a
 * tautology. ⛔ Not a fallback and not a second answer: nothing in either gate
 * may call anything shaped like this.
 */
function retiredRegexReader(body: string): string[] {
  const out = new Set<string>();
  const patterns = [
    /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) out.add(m[1]);
  }
  return [...out];
}

describe('fence scanning', () => {
  it('reads ts, tsx and typescript fences and nothing else', () => {
    const { blocks } = scanFences(
      [
        `${FENCE}ts`,
        'export const a = 1;',
        FENCE,
        `${FENCE}tsx`,
        'export const b = <div />;',
        FENCE,
        `${FENCE}typescript`,
        'export const c = 2;',
        FENCE,
        `${FENCE}json`,
        '{ "type": "grid" }',
        FENCE,
        `${FENCE}bash`,
        'pnpm install',
        FENCE,
      ].join('\n'),
    );
    expect(blocks.map((b) => b.language)).toEqual(['ts', 'tsx', 'typescript']);
  });

  it('does not read a ts fence nested inside a wider fence as a block of its own', () => {
    // A four-backtick wrapper is how this repo's docs quote markdown that itself
    // contains a fence. Reading the inner one would compile prose.
    const { blocks } = scanFences(
      ['````markdown', `${FENCE}ts`, 'not really a snippet', FENCE, '````'].join('\n'),
    );
    expect(blocks).toHaveLength(0);
  });

  it('collects a fence opened inside a blockquote and strips the quoting from its body', () => {
    // objectui#7086: the opening anchor allowed leading spaces and tabs only, so a
    // fence inside a callout was never collected and the gate compiled nothing for
    // it. Silently — an uncollected block appears in no count, and the page still
    // reports as covered.
    const { blocks } = scanFences(
      [
        '> **Import:** All types are available from `@object-ui/types`.',
        '>',
        `> ${FENCE}typescript`,
        "> import type { PageNodeSchema } from '@object-ui/types';",
        `> ${FENCE}`,
        '',
        'Prose after the callout.',
      ].join('\n'),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('typescript');
    expect(blocks[0].body).toBe("import type { PageNodeSchema } from '@object-ui/types';");
  });

  it('closes a blockquoted fence at its own depth rather than running to end of file', () => {
    const { blocks } = scanFences(
      [
        `> ${FENCE}ts`,
        '> export const a = 1;',
        `> ${FENCE}`,
        '',
        'export const notPartOfTheBlock = true;',
      ].join('\n'),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].body).toBe('export const a = 1;');
  });

  it('strips the opening depth only, so nesting and the snippet own indentation survive', () => {
    const { blocks } = scanFences(
      [
        `> > ${FENCE}ts`,
        '> > export const nested = {',
        '> >   deep: true,',
        '> > };',
        `> > ${FENCE}`,
      ].join('\n'),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].body).toBe(['export const nested = {', '  deep: true,', '};'].join('\n'));
  });

  it('does not let a quoted backtick line close an unquoted fence', () => {
    // Depth 0 takes the identity path. This is what keeps every unquoted fence in
    // the corpus collecting exactly as it did before blockquotes were recognised.
    const { blocks } = scanFences(
      [
        `${FENCE}ts`,
        '// a quoted fence, as prose inside a snippet:',
        `> ${FENCE}`,
        'export const a = 1;',
        FENCE,
      ].join('\n'),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].body).toBe(
      ['// a quoted fence, as prose inside a snippet:', `> ${FENCE}`, 'export const a = 1;'].join('\n'),
    );
  });

  it('attaches a fragment marker only to the fence directly beneath it', () => {
    const { blocks } = scanFences(
      [
        '{/* doc-snippet: fragment — continues the block above */}',
        '',
        `${FENCE}ts`,
        'first',
        FENCE,
        '',
        'Prose in between resets the declaration.',
        '',
        `${FENCE}ts`,
        'second',
        FENCE,
      ].join('\n'),
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].fragmentReason).toBe('continues the block above');
    expect(blocks[1].fragmentReason).toBeNull();
  });

  it('accepts both marker spellings, and both examples in the script are real markers', () => {
    for (const example of FRAGMENT_MARKER_EXAMPLES) {
      const { blocks } = scanFences([example, `${FENCE}ts`, 'x', FENCE].join('\n'));
      expect(blocks[0].fragmentReason, `${example} did not declare its block`).toBeTruthy();
    }
  });

  it('attaches a blockquoted fragment marker to the fence directly beneath it', () => {
    // objectui#7099: the marker anchor read `^[ \t]*`, so `> {/* doc-snippet:
    // fragment ... */}` did not register as a marker at all. objectui#7086 had
    // already brought the quoted fence under the gate's contract, and that
    // contract has two halves — compile, OR declare why you cannot. Only the
    // first half reached blockquotes, so a quoted block that legitimately cannot
    // compile had no declared way to say so.
    const { blocks, markers } = scanFences(
      [
        '> **Note:** the renderer is already mounted above.',
        '> {/* doc-snippet: fragment \u2014 continues the block above */}',
        `> ${FENCE}ts`,
        '> renderer.mount(el);',
        `> ${FENCE}`,
      ].join('\n'),
    );
    expect(markers, 'a quoted marker must register as a marker').toHaveLength(1);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].fragmentReason).toBe('continues the block above');
  });

  it('attaches across a bare `>` spacer — the callout shape real pages use', () => {
    // This is the case a half-fix misses. Widening the marker anchor alone makes
    // the pin above pass and leaves this one failing: the attachment walk wants
    // the nearest NON-BLANK line above the fence, and `'>'.trim()` is `'>'`, not
    // the empty string — so the walk stops on the very spacer that separates a
    // callout's prose from its fence. Passing in tests and failing on the shape
    // real pages use is why both mechanisms move together.
    const { blocks } = scanFences(
      [
        '> **Note:** the renderer is already mounted above.',
        '>',
        '> {/* doc-snippet: fragment \u2014 continues the block above */}',
        '>',
        `> ${FENCE}ts`,
        '> renderer.mount(el);',
        `> ${FENCE}`,
      ].join('\n'),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].fragmentReason).toBe('continues the block above');
  });

  it('does not attach a marker written at a different quote depth than its fence', () => {
    // The rule: a marker declares the fence at its OWN depth. A depth-0 marker
    // above a quoted fence is not inside the callout the block lives in; a quoted
    // marker above an unquoted fence is not outside it. Neither attaches, and the
    // unattached marker is reported rather than silently dropped.
    const outside = scanFences(
      [
        '{/* doc-snippet: fragment \u2014 continues the block above */}',
        `> ${FENCE}ts`,
        '> renderer.mount(el);',
        `> ${FENCE}`,
      ].join('\n'),
    );
    expect(outside.blocks).toHaveLength(1);
    expect(outside.blocks[0].fragmentReason).toBeNull();
    expect(outside.markers.map((m) => m.consumed)).toEqual([false]);

    const inside = scanFences(
      [
        '> {/* doc-snippet: fragment \u2014 continues the block above */}',
        `${FENCE}ts`,
        'renderer.mount(el);',
        FENCE,
      ].join('\n'),
    );
    expect(inside.blocks).toHaveLength(1);
    expect(inside.blocks[0].fragmentReason).toBeNull();
    expect(inside.markers.map((m) => m.consumed)).toEqual([false]);
  });

  it('leaves the unquoted path exactly as it was — depth 0 is the identity path', () => {
    const { blocks, markers } = scanFences(
      [
        '{/* doc-snippet: fragment \u2014 continues the block above */}',
        '',
        '',
        `${FENCE}ts`,
        'renderer.mount(el);',
        FENCE,
      ].join('\n'),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].quoteDepth).toBe(0);
    expect(blocks[0].fragmentReason).toBe('continues the block above');
    expect(markers.map((m) => m.consumed)).toEqual([true]);
  });

  it('reports a blockquoted marker that declares nothing, instead of never seeing it', () => {
    const root = tempTree({
      'content/docs/a.mdx': [
        '> {/* doc-snippet: fragment \u2014 nothing follows this */}',
        '>',
        '> Just prose.',
      ].join('\n'),
    });
    const findings = analyze({ root, ungated: {} }).findings as Finding[];
    expect(findings.map((f) => f.reason)).toContain('stale-fragment-marker');
  });

  it('reports a marker that declares nothing rather than ignoring it', () => {
    const root = tempTree({
      'content/docs/a.mdx': ['{/* doc-snippet: fragment — nothing follows this */}', '', 'Just prose.'].join('\n'),
    });
    const findings = analyze({ root, ungated: {} }).findings as Finding[];
    expect(findings.map((f) => f.reason)).toContain('stale-fragment-marker');
  });

  it('rejects a fragment declaration with no written reason', () => {
    const root = tempTree({
      'content/docs/a.mdx': ['{/* doc-snippet: fragment — short */}', `${FENCE}ts`, 'x', FENCE].join('\n'),
    });
    const findings = analyze({ root, ungated: {} }).findings as Finding[];
    expect(findings.map((f) => f.reason)).toContain('unexplained-fragment');
  });
});

/**
 * objectui#7505 — a DECLARED fragment is the one block this gate never compiles,
 * so a reason claiming the block was checked against something is an assertion
 * the gate structurally cannot re-verify. Measured cost: the claim on
 * `content/docs/utilities/data-objectstack.mdx` was true when written, went
 * silently false when objectui#7503 widened the factory's return type, and three
 * independent readers hunting for exactly that falsehood missed it because the
 * page reads as verified.
 *
 * ⭐ What is pinned here is that the gate refuses the COMBINATION and nothing
 * wider. The exemption stays legal; the claim stays legal on a compiled block;
 * only the two together are refused. A test suite that only proved "the claim
 * turns it red" would not notice the check growing into a phrase hunt over every
 * reason in the corpus, which is the failure mode the card named in advance.
 */
describe('objectui#7505 — a fragment reason may not claim the block was checked', () => {
  const claimDoc = (reason: string) =>
    ['# T', '', `{/* doc-snippet: fragment — ${reason} */}`, `${FENCE}ts`, 'const x: Broken =', FENCE].join('\n');

  const reasonsOf = (reason: string) =>
    (analyze({ root: tempTree({ 'content/docs/a.mdx': claimDoc(reason) }), ungated: {} }).findings as Finding[])
      .map((f) => f.reason);

  it('turns red on the spelling that was actually written here, and names itself', () => {
    const findings = analyze({
      root: tempTree({
        'content/docs/a.mdx': claimDoc(
          'a SIGNATURE excerpt, checked against the shipped `dist/index.d.ts` with the same type',
        ),
      }),
      ungated: {},
    }).findings as Finding[];
    const claim = findings.find((f) => f.reason === 'verification-claim-on-fragment');
    expect(claim, 'the combination this card exists to refuse went green').toBeDefined();
    expect(claim!.site).toBe('content/docs/a.mdx:4');
    // The remedy has to reach the author who is standing in front of the red.
    expect(claim!.detail).toContain('checked');
    expect(claim!.detail).toContain('compiled tier');
  });

  it('is a verdict about the document, not a precondition — it leaves through exit 1', () => {
    const findings = analyze({
      root: tempTree({ 'content/docs/a.mdx': claimDoc('a shape excerpt, verified member for member') }),
      ungated: {},
    }).findings as Finding[];
    expect(findings.map((f) => f.reason)).toContain('verification-claim-on-fragment');
    // `couldNotRun` would say the gate never judged the document. It did.
    expect(blockingPreconditions(findings)).toHaveLength(0);
  });

  it('refuses the COMBINATION, not the claim: the same words on a COMPILED block are untouched', () => {
    // No marker, so the block is in the compiled tier — where the claim is one
    // this gate re-verifies on every commit, which is the shape the rule wants.
    const root = tempTree({
      'content/docs/a.mdx': [
        '# T',
        '',
        `${FENCE}ts`,
        '// verified against the shipped dist/index.d.ts, checked member for member',
        'export const a = 1;',
        FENCE,
      ].join('\n'),
    });
    const state = analyze({ root, ungated: {} });
    expect((state.findings as Finding[]).map((f) => f.reason)).not.toContain('verification-claim-on-fragment');
    expect(state.compiled).toHaveLength(1);
  });

  it('leaves a reason that names the same authority to say the OPPOSITE alone', () => {
    // content/docs/plugins/plugin-calendar.mdx's real shape: it names the shipped
    // declaration in order to state that nothing agrees with it. Anchoring the
    // match on "against the shipped" instead of on a verb would fail this.
    expect(
      reasonsOf(
        'the half cannot compile against the SHIPPED prop type: `schema` is declared `ObjectGridSchema` and neither admits this node',
      ),
    ).not.toContain('verification-claim-on-fragment');
  });

  it("leaves `type-checked` alone — it names THIS gate's own action, which does re-run every commit", () => {
    // content/docs/guide/component-registry.md's real shape. This is the good
    // shape the rule is built to distinguish: a claim backed by a check that
    // runs on every commit is not a fact with an expiry date.
    expect(
      reasonsOf(
        'continues the block above; the literal it shows is type-checked on the complete example at the end of the page, which does compile',
      ),
    ).not.toContain('verification-claim-on-fragment');
    // …while the hyphenated compound that IS a manual claim still trips it, so
    // the guard that lets `type-checked` through is not a hole for `hand-checked`.
    expect(reasonsOf('a signature excerpt; agreement with dist is hand-checked at each edit')).toContain(
      'verification-claim-on-fragment',
    );
  });

  it('trips on every verb it claims to cover, so the closed list cannot rot in silence', () => {
    const spellings = [
      'this excerpt was verified against the shipped declaration',
      'this excerpt was confirmed against the shipped declaration',
      'this excerpt was validated against the shipped declaration',
      'this excerpt was audited against the shipped declaration',
      'this excerpt was reconciled against the shipped declaration',
      'this excerpt was checked against the shipped declaration',
      'agreement with the declaration is cross-checked at each edit',
      'agreement with the declaration is spot-checked at each edit',
      'agreement with the declaration is double-checked at each edit',
      'agreement with the declaration is manually checked at each edit',
    ];
    for (const reason of spellings) {
      expect(reasonsOf(reason), `"${reason}" was not read as a claim`).toContain('verification-claim-on-fragment');
    }
  });

  it("this repository's own 158 declared fragments carry no such claim", () => {
    // The census that decided the route (the card asked for it before any gate
    // change): 2 of 158 carried a claim, both on the page the card sampled, and
    // both are repaired on this branch. A corpus-wide pin, so the next one is
    // caught here and not only in CI.
    const state = analyze({ root: repoRoot });
    const claims = (state.findings as Finding[]).filter((f) => f.reason === 'verification-claim-on-fragment');
    expect(claims.map((f) => f.site)).toEqual([]);
    // Guards the pin above against going vacuous: this gate must still be
    // reading a real population of declared fragments for "zero" to mean
    // anything, and that population must not have moved into the compiled tier.
    expect(state.declaredFragments.length).toBeGreaterThan(100);
  });

  it('states the rule in its own header, so it cannot drift out of the source', () => {
    const source = fs.readFileSync(path.join(repoRoot, SCRIPT), 'utf8');
    expect(source).toContain('It never claims the block was');
    expect(source).toContain(
      'A claim that something was verified is only as good as the check that',
    );
  });
});

describe('the coverage ledger is re-derived, never trusted', () => {
  it('fails on an entry naming a document that does not exist', () => {
    const root = tempTree({ 'content/docs/a.mdx': [`${FENCE}ts`, 'export const a = 1;', FENCE].join('\n') });
    const findings = analyze({ root, ungated: { 'content/docs/gone.mdx': 'a reason long enough' } })
      .findings as Finding[];
    expect(findings.some((f) => f.reason === 'stale-ungated-entry')).toBe(true);
  });

  it('fails on an entry for a document that holds no snippet at all', () => {
    const root = tempTree({ 'content/docs/a.mdx': 'Only prose lives here.' });
    const findings = analyze({ root, ungated: { 'content/docs/a.mdx': 'a reason long enough' } })
      .findings as Finding[];
    expect(findings.some((f) => f.reason === 'stale-ungated-entry')).toBe(true);
  });

  it('fails on an entry with no written reason — a bare path is not a declaration', () => {
    const root = tempTree({ 'content/docs/a.mdx': [`${FENCE}ts`, 'export const a = 1;', FENCE].join('\n') });
    const findings = analyze({ root, ungated: { 'content/docs/a.mdx': '' } }).findings as Finding[];
    expect(findings.some((f) => f.reason === 'unexplained-ungated-entry')).toBe(true);
  });

  it('covers a document nobody declared — the default is COVERED, so a new page is gated on arrival', () => {
    const root = tempTree({
      'content/docs/new-page.mdx': [`${FENCE}ts`, 'export const a = 1;', FENCE].join('\n'),
    });
    const state = analyze({ root, ungated: {} });
    expect(state.covered).toContain('content/docs/new-page.mdx');
    expect(state.compiled).toHaveLength(1);
  });

  it('every entry in the real ledger carries a written reason', () => {
    for (const [doc, reason] of Object.entries(UNGATED_DOCS as Record<string, string>)) {
      expect(reason.trim().length, `${doc} is listed with no reason`).toBeGreaterThan(11);
    }
  });
});

describe('this repository', () => {
  it('scans a plausible number of documents — an empty walk makes every verdict vacuous', () => {
    const documents = listDocuments(repoRoot);
    expect(documents.length).toBeGreaterThan(100);
    expect(documents.some((d: string) => d.startsWith('content/docs/'))).toBe(true);
    expect(documents.some((d: string) => /^packages\/[^/]+\/README\.md$/.test(d))).toBe(true);
  });

  it('is green, and the ledger is exact', () => {
    const state = analyze({});
    const findings = state.findings as Finding[];
    // `unbuilt-package` is the one finding a test run without a build produces,
    // and it is the gate reporting honestly rather than a stale ledger.
    expect(findings.filter((f) => f.reason !== 'unbuilt-package')).toEqual([]);
  });

  it('has snippets to judge — the covered set is not empty', () => {
    const state = analyze({});
    expect(state.compiled.length).toBeGreaterThan(20);
  });

  it('resolves the workspace to built artifacts, never to a package src/', () => {
    const { paths } = derivePackageTypePaths(repoRoot);
    const targets = Object.values(paths as Record<string, string[]>).map((v) => v[0]);
    expect(targets.length).toBeGreaterThan(20);
    for (const target of targets) {
      expect(target, 'a snippet must be judged against the surface a consumer imports').not.toMatch(
        /[\\/]packages[\\/][^\\/]+[\\/]src[\\/]/,
      );
      expect(target).toMatch(/\.d\.ts$/);
    }
  });
});

/**
 * objectui#7115 — the root `README.md` was in NO doc gate's scan set: this gate
 * walked `content/docs` plus the package READMEs, its sibling
 * `check-doc-component-types.mjs` walked `content/docs`, and the repository's
 * landing page fell between them.
 *
 * ⚠️ Read the second assertion carefully. Being ON the ungated ledger is NOT a
 * claim that this file compiles — it does not; objectui#7417 carries its nine
 * measured diagnostics. It is the objectui#5174 distinction, which this script's
 * own header states: a document outside the walk is "neither covered NOR
 * declared ungated", invisible to the gate's own accounting, while a ledgered
 * one is named, counted, re-derived every run and shrink-only.
 */
describe('objectui#7115 — the root README is in the scan set', () => {
  it('listDocuments reaches it', () => {
    expect(listDocuments(repoRoot)).toContain('README.md');
  });

  it('is DECLARED debt rather than absent, and its reason names the card that carries it', () => {
    expect(Object.keys(UNGATED_DOCS as Record<string, string>)).toContain('README.md');
    expect((UNGATED_DOCS as Record<string, string>)['README.md']).toContain('objectui#7417');
  });

  it('root pages are collected BY NAME, not by the packages walk', () => {
    // The mechanism, isolated: a tree with no `content/docs` and no `packages`
    // still lists its root page, which is what makes the entry independent of
    // the two walks it sits between.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-doc-snippet-types-rootpages-'));
    try {
      fs.writeFileSync(path.join(dir, 'README.md'), '# root\n');
      expect(listDocuments(dir)).toEqual(['README.md']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('states in its own source that a dangling root page fails the run', () => {
    // The guard lives in `main()`, which takes no `--root`, so it cannot be
    // driven from a fixture. Pinned against the source for the same reason the
    // exit-code contract is: a silently narrowed surface is this card's defect.
    const source = fs.readFileSync(path.join(repoRoot, 'scripts/check-doc-snippet-types.mjs'), 'utf8');
    expect(source).toContain('ROOT_PAGES');
    expect(source).toMatch(/for \(const name of ROOT_PAGES\) \{\n\s*if \(!existsSync\(join\(repoRoot, name\)\)\)/);
  });
});

/**
 * objectui#7856 card 1 — the repository-root `docs/` tree was in NO doc gate's
 * scan set, and `lint:root` ignores it by name (`--ignore-pattern 'docs/**'`).
 * The card measured what that bought: three phantom-teaching sites found in it by
 * hand (objectui#7838, objectui#7854) and 11 diagnostics under `docs/*.md` that
 * nothing reported.
 *
 * The rule this file's sibling states — "Widening a scan surface is the change
 * that can be GREEN ABOUT NOTHING… Anything added here later is owed the same
 * proof" — is why membership is pinned by name below, and why the leg's
 * BOUNDARY is pinned too. `recursive: false` is not a performance note: the
 * subtree it excludes is `docs/adr/**`, a governed surface whose pull requests
 * stop in draft for a human, plus `docs/audits/**`, and both are card 2. A leg
 * that grew into them by accident would put a governed-surface failure in front
 * of a pull request that cannot land it.
 */
describe('objectui#7856 — the root docs/*.md pages are in the scan set, and only those', () => {
  it('listDocuments reaches them', () => {
    const documents = listDocuments(repoRoot);
    for (const doc of rootDocsPages(repoRoot)) expect(documents).toContain(doc);
    // Non-vacuous: the leg reaches a real page, not an empty directory.
    expect(rootDocsPages(repoRoot)).toContain('docs/ARCHITECTURE.md');
  });

  it('the widening judges something — the leg contributes blocks to the compiled tier', () => {
    // Being IN the walk is one fact; being compiled is the other, and this card
    // delivered both (no `UNGATED_DOCS` entry was needed — the blocks were
    // repaired). A leg whose pages all sat on the ledger would be visible to the
    // accounting and judged by nothing, which is a weaker claim than this test
    // makes.
    const state = analyze({});
    const leg = new Set(rootDocsPages(repoRoot));
    expect((state.covered as string[]).filter((d) => leg.has(d)).sort()).toEqual([...leg].sort());
    expect((state.compiled as { doc: string }[]).some((b) => leg.has(b.doc))).toBe(true);
  });

  it('stops at the top level: a page in a subdirectory is NOT collected', () => {
    const root = tempTree({
      'docs/PAGE.md': '# top level\n',
      'docs/adr/0001-decision.md': '# governed, card 2\n',
      'docs/audits/2026-07-audit.md': '# card 2\n',
    });
    try {
      expect(rootDocsPages(root)).toEqual(['docs/PAGE.md']);
      expect(listDocuments(root)).toEqual(['docs/PAGE.md']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('collects files only, and only page extensions', () => {
    const root = tempTree({
      'docs/b.mdx': '# b\n',
      'docs/a.md': '# a\n',
      'docs/notes.txt': 'not a page\n',
      'docs/screenshots/shot.png': 'not a page\n',
    });
    try {
      expect(rootDocsPages(root)).toEqual(['docs/a.md', 'docs/b.mdx']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('an absent docs/ tree yields nothing here, and a verdict is refused in main', () => {
    const root = tempTree({ 'README.md': '# root\n' });
    try {
      // A throwaway fixture tree stays listable…
      expect(rootDocsPages(root)).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
    // …while a REAL run refuses, the same way a dangling ROOT_PAGES name does.
    // `main()` takes no `--root`, so this is pinned against the source for the
    // same reason the ROOT_PAGES guard above is.
    const source = fs.readFileSync(path.join(repoRoot, 'scripts/check-doc-snippet-types.mjs'), 'utf8');
    expect(source).toMatch(/if \(!existsSync\(join\(repoRoot, ROOT_DOCS\.dir\)\)\) \{/);
    expect(ROOT_DOCS).toEqual({ dir: 'docs', recursive: false });
  });
});

describe('third-party resolution reaches exactly as far as the imported packages declare', () => {
  /** A workspace package with its own `node_modules`, the way pnpm links one. */
  function treeWithDependency(files: Record<string, string> = {}): string {
    return tempTree({
      'content/docs/a.mdx': [FENCE + 'ts', "import 'declared-dep';", FENCE].join('\n'),
      'packages/pkg-a/package.json': JSON.stringify({
        name: 'pkg-a',
        dependencies: { 'declared-dep': '^1.0.0' },
        peerDependencies: { 'peer-dep': '^1.0.0' },
        devDependencies: { 'dev-dep': '^1.0.0' },
      }),
      'packages/pkg-a/node_modules/declared-dep/package.json': JSON.stringify({
        name: 'declared-dep',
        types: 'index.d.ts',
      }),
      'packages/pkg-a/node_modules/declared-dep/index.d.ts': 'export declare const declared: number;\n',
      // Installed right beside it and NOT declared: the shape a blanket mapping
      // over node_modules would pick up, and the one no consumer can import.
      'packages/pkg-a/node_modules/undeclared-dep/package.json': JSON.stringify({
        name: 'undeclared-dep',
        types: 'index.d.ts',
      }),
      'packages/pkg-a/node_modules/undeclared-dep/index.d.ts': 'export declare const undeclared: number;\n',
      'packages/pkg-a/node_modules/peer-dep/package.json': JSON.stringify({ name: 'peer-dep', types: 'index.d.ts' }),
      'packages/pkg-a/node_modules/peer-dep/index.d.ts': 'export declare const peer: number;\n',
      'packages/pkg-a/node_modules/dev-dep/package.json': JSON.stringify({ name: 'dev-dep', types: 'index.d.ts' }),
      'packages/pkg-a/node_modules/dev-dep/index.d.ts': 'export declare const dev: number;\n',
      ...files,
    });
  }

  const derive = (root: string, imported: string[] = ['pkg-a']) =>
    deriveDeclaredDependencyPaths(root, imported, { 'pkg-a': 'packages/pkg-a' }) as unknown as {
      paths: Record<string, string[]>;
      declaredBy: Record<string, string>;
      untyped: { specifier: string }[];
    };

  it('maps a specifier the imported package DECLARES — that is what a consumer resolves', () => {
    const { paths, declaredBy } = derive(treeWithDependency());
    expect(Object.keys(paths)).toContain('declared-dep');
    expect(paths['declared-dep'][0]).toMatch(/declared-dep[\\/]index\.d\.ts$/);
    expect(declaredBy['declared-dep']).toBe('pkg-a');
  });

  it('does NOT map a package that is merely INSTALLED — the control that keeps this a check', () => {
    // If this ever passes, resolution has been widened to a blanket mapping and
    // a snippet may import what no reader of these packages can get.
    const { paths } = derive(treeWithDependency());
    expect(Object.keys(paths)).not.toContain('undeclared-dep');
  });

  it('does not map peerDependencies or devDependencies — it fails CLOSED', () => {
    const { paths } = derive(treeWithDependency());
    expect(Object.keys(paths)).not.toContain('peer-dep');
    expect(Object.keys(paths)).not.toContain('dev-dep');
  });

  it('maps nothing for a package no covered document imports', () => {
    const { paths } = derive(treeWithDependency(), []);
    expect(paths).toEqual({});
  });

  it('leaves a specifier that ships no types unresolvable rather than approximating it', () => {
    // A JS-only dependency: declared, installed, and carrying nothing a strict
    // program can judge. Mapping it to something approximate would report green
    // over a snippet nobody type-checked; leaving it unresolvable fails honestly.
    const root = tempTree({
      'packages/pkg-a/package.json': JSON.stringify({
        name: 'pkg-a',
        dependencies: { 'untyped-dep': '^1.0.0' },
      }),
      'packages/pkg-a/node_modules/untyped-dep/package.json': JSON.stringify({
        name: 'untyped-dep',
        main: 'index.js',
      }),
      'packages/pkg-a/node_modules/untyped-dep/index.js': 'module.exports = {};\n',
    });
    const { paths, untyped } = derive(root);
    expect(Object.keys(paths)).not.toContain('untyped-dep');
    expect(untyped.map((u) => u.specifier)).toContain('untyped-dep');
  });

  it('never maps a workspace package — those come from their own exports, or deliberately not at all', () => {
    const root = tempTree({
      'packages/pkg-a/package.json': JSON.stringify({ name: 'pkg-a', dependencies: { 'pkg-b': 'workspace:*' } }),
      'packages/pkg-a/node_modules/pkg-b/package.json': JSON.stringify({ name: 'pkg-b', types: 'src/index.ts' }),
      'packages/pkg-a/node_modules/pkg-b/src/index.ts': 'export const b = 1;\n',
    });
    const { paths } = deriveDeclaredDependencyPaths(root, ['pkg-a'], {
      'pkg-a': 'packages/pkg-a',
      'pkg-b': 'packages/pkg-b',
    }) as unknown as { paths: Record<string, string[]> };
    expect(Object.keys(paths)).not.toContain('pkg-b');
  });

  describe('in this repository', () => {
    it("maps lucide-react, which the documented packages declare (objectui#6120)", () => {
      const state = analyze({}) as unknown as {
        dependencyPaths: Record<string, string[]>;
        dependencyDeclaredBy: Record<string, string>;
      };
      expect(Object.keys(state.dependencyPaths)).toContain('lucide-react');
      expect(state.dependencyPaths['lucide-react'][0]).toMatch(/\.d\.ts$/);
    });

    it('maps only declaration files, and never a package src/', () => {
      const state = analyze({}) as unknown as { dependencyPaths: Record<string, string[]> };
      const targets = Object.values(state.dependencyPaths).map((v) => v[0]);
      expect(targets.length).toBeGreaterThan(10);
      for (const target of targets) {
        expect(target).toMatch(/\.d\.(ts|mts|cts)$/);
        expect(target, 'a snippet must never be judged against a package src/').not.toMatch(
          /[\\/]packages[\\/][^\\/]+[\\/]src[\\/]/,
        );
      }
    });

    it('the UNDECLARED control specifier is installed here — otherwise it proves nothing', () => {
      expect(
        findInstalledCopy(repoRoot, UNDECLARED_CONTROL_PACKAGE),
        `${UNDECLARED_CONTROL_PACKAGE} is not installed, so "it does not resolve" measures nothing`,
      ).toBeTruthy();
    });

    it('the UNDECLARED control specifier is declared by no workspace package at all', () => {
      const packagesDir = path.join(repoRoot, 'packages');
      const declaring = fs
        .readdirSync(packagesDir)
        .filter((d) => fs.existsSync(path.join(packagesDir, d, 'package.json')))
        .filter((d) => {
          const manifest = JSON.parse(
            fs.readFileSync(path.join(packagesDir, d, 'package.json'), 'utf8'),
          ) as { dependencies?: Record<string, string> };
          return Boolean(manifest.dependencies?.[UNDECLARED_CONTROL_PACKAGE]);
        });
      expect(declaring, 'pick a control specifier no package declares').toEqual([]);
    });
  });
});

describe('the ROOT BOUND — what only this repository declares does not resolve (objectui#7463 item 2)', () => {
  /**
   * The bound closes the last way a snippet could be green over a package its
   * reader was never told to install: pnpm symlinks the repository ROOT's own
   * devDependencies into `/node_modules`, one directory above where every block
   * is compiled. Ruled into the SHARED harness, unconditionally for both gates,
   * on 2026-09-03 (objectstack#14909 item 1, option A).
   *
   * Both directions are pinned here, and the negative half is the load-bearing
   * one: a bound that refused everything would satisfy the positive half alone
   * while turning every correct snippet red.
   */
  const rootDeclared = new Set(['root-dev-dep', '@scope/root-dev-dep', 'react']);

  it('refuses a specifier only the repository ROOT declares', () => {
    expect(resolvesOnlyThroughRootManifest('root-dev-dep', { paths: {}, rootDeclared })).toBe(true);
    expect(resolvesOnlyThroughRootManifest('@scope/root-dev-dep', { paths: {}, rootDeclared })).toBe(true);
  });

  it('refuses a SUBPATH of one too — the root symlink carries the whole package', () => {
    expect(resolvesOnlyThroughRootManifest('root-dev-dep/sub', { paths: {}, rootDeclared })).toBe(true);
    expect(specifierRoot('@scope/root-dev-dep/sub')).toBe('@scope/root-dev-dep');
  });

  it('does NOT refuse a mapped specifier — one a documented package declares reaches the reader', () => {
    const paths = { 'root-dev-dep': ['/somewhere/index.d.ts'] };
    expect(resolvesOnlyThroughRootManifest('root-dev-dep', { paths, rootDeclared })).toBe(false);
    expect(resolvesOnlyThroughRootManifest('root-dev-dep/sub', { paths, rootDeclared })).toBe(false);
  });

  it('does NOT refuse a specifier the root never declared — that is the UNDECLARED control\'s half', () => {
    expect(resolvesOnlyThroughRootManifest('some-transitive', { paths: {}, rootDeclared })).toBe(false);
  });

  it('does NOT refuse a relative or absolute specifier', () => {
    expect(resolvesOnlyThroughRootManifest('./sibling', { paths: {}, rootDeclared })).toBe(false);
    expect(resolvesOnlyThroughRootManifest('/abs/path', { paths: {}, rootDeclared })).toBe(false);
  });

  it('never refuses the JSX factory module, even when `react` is root-declared and unmapped', () => {
    // Compiler-emitted, not author-written: every block is compiled as TSX, so
    // refusing it would red a block over a line nobody wrote.
    expect(resolvesOnlyThroughRootManifest('react/jsx-runtime', { paths: {}, rootDeclared })).toBe(false);
    expect(resolvesOnlyThroughRootManifest('react/jsx-dev-runtime', { paths: {}, rootDeclared })).toBe(false);
  });

  it('reads BOTH dependency fields of the root manifest, not just the populated one', () => {
    const root = tempTree({
      'package.json': JSON.stringify({ dependencies: { 'a-dep': '1' }, devDependencies: { 'a-dev': '1' } }),
    });
    const declared = rootDeclaredSpecifiers(root) as Set<string>;
    expect([...declared].sort()).toEqual(['a-dep', 'a-dev']);
  });

  describe('the specifier set comes from the AST, never from a regex over the text', () => {
    const parse = (code: string) =>
      ts.createSourceFile('probe.tsx', code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);

    it('collects static, type-only, side-effect, re-export and dynamic imports', () => {
      const found = moduleSpecifiersOf(
        parse(
          [
            "import a from 'a';",
            "import type { B } from 'b';",
            "import 'c';",
            "export { d } from 'd';",
            "const e = await import('e');",
            'export const used = [a, B, e, d];',
          ].join('\n'),
        ),
      ) as string[];
      expect(found.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('does NOT collect an import-shaped line inside a template literal', () => {
      // Measured while deriving the bound: a README example whose fenced body
      // held `npm install project-name` inside a template literal read as an
      // import of `project-name` under the regex reader each gate carried
      // privately until objectui#7555. A false refusal would red a document
      // that is correct.
      const found = moduleSpecifiersOf(
        parse("export const readme = `\n# Project\n\nimport x from 'project-name';\n`;\n"),
      ) as string[];
      expect(found).toEqual([]);
    });

    it('reports nothing for the corpus block that finding measured', () => {
      // The synthetic pin above paraphrases the specimen; this one is the
      // specimen. Keyed on the fence LINE, so an edit above it forces a
      // re-declaration here rather than a row that silently covers nothing —
      // the convention `KNOWN_ROOT_DEVDEP_EXAMPLES` already uses in the skills
      // gate's suite.
      const state = analyze({}) as unknown as {
        compiled: { doc: string; fenceLine: number; body: string }[];
      };
      const site = `${README_SAMPLE_DOC}:${README_SAMPLE_FENCE_LINE}`;
      const block = state.compiled.find(
        (b) => b.doc === README_SAMPLE_DOC && b.fenceLine === README_SAMPLE_FENCE_LINE,
      );
      expect(block, `no compiled block at ${site}`).toBeDefined();
      expect(block!.body, `the README sample moved out of ${site}`).toContain(
        'npm install project-name',
      );
      expect(moduleSpecifiersOfBlock(block!.body)).toEqual([]);
      // The retired reader, kept as this pin's CONTRAST: without it, the
      // assertion above would hold just as well for a block that imports
      // nothing and has no template literal either, and the pin would stop
      // being about the defect it was written for.
      expect(retiredRegexReader(block!.body)).toEqual(['project-name']);
    });
  });

  describe('end to end, over a throwaway tree', () => {
    /** A root that declares one devDependency and installs it where pnpm would. */
    function treeWithRootDevDependency(): string {
      const root = tempTree({
        'package.json': JSON.stringify({ name: 'root', devDependencies: { 'root-dev-dep': '^1.0.0' } }),
        'node_modules/root-dev-dep/package.json': JSON.stringify({ name: 'root-dev-dep', types: 'index.d.ts' }),
        'node_modules/root-dev-dep/index.d.ts': 'export declare const fromRoot: number;\n',
        'node_modules/mapped-dep/package.json': JSON.stringify({ name: 'mapped-dep', types: 'index.d.ts' }),
        'node_modules/mapped-dep/index.d.ts': 'export declare const mapped: number;\n',
      });
      return root;
    }

    const block = (doc: string, body: string) => ({ doc, fenceLine: 1, body });

    it('keeps a block importing a root-only specifier OUT of the program and names the specifier', () => {
      const root = treeWithRootDevDependency();
      const run = compileSnippets({
        root,
        compiled: [block('fixture/root-only.md', "import { fromRoot } from 'root-dev-dep';\nexport const x = fromRoot;\n")],
        paths: {},
        declaredSpecifiers: [],
      }) as unknown as {
        boundFailures: { block: { doc: string }; specifiers: string[] }[];
        boundedSpecifiers: string[];
        semanticallyJudged: number;
      };
      expect(run.boundFailures.map((f) => f.block.doc)).toEqual(['fixture/root-only.md']);
      expect(run.boundFailures[0].specifiers).toEqual(['root-dev-dep']);
      expect(run.boundedSpecifiers).toEqual(['root-dev-dep']);
      // Refused, therefore NOT judged: the coverage count is what stops a
      // refusal from reading as a pass.
      expect(run.semanticallyJudged).toBe(0);
    });

    it('still resolves a MAPPED specifier — the bound refuses the root set, not everything', () => {
      const root = treeWithRootDevDependency();
      const run = compileSnippets({
        root,
        compiled: [block('fixture/mapped.md', "import { mapped } from 'mapped-dep';\nexport const y = mapped;\n")],
        paths: { 'mapped-dep': [path.join(root, 'node_modules/mapped-dep/index.d.ts')] },
        declaredSpecifiers: [],
      }) as unknown as {
        boundFailures: unknown[];
        semanticFailures: unknown[];
        semanticallyJudged: number;
      };
      expect(run.boundFailures).toEqual([]);
      expect(run.semanticFailures).toEqual([]);
      expect(run.semanticallyJudged).toBe(1);
    });

    it('refuses a root-only specifier even when the map covers a DIFFERENT one', () => {
      const root = treeWithRootDevDependency();
      const run = compileSnippets({
        root,
        compiled: [
          block(
            'fixture/both.md',
            "import { mapped } from 'mapped-dep';\nimport { fromRoot } from 'root-dev-dep';\nexport const z = [mapped, fromRoot];\n",
          ),
        ],
        paths: { 'mapped-dep': [path.join(root, 'node_modules/mapped-dep/index.d.ts')] },
        declaredSpecifiers: [],
      }) as unknown as { boundFailures: { specifiers: string[] }[] };
      expect(run.boundFailures[0].specifiers).toEqual(['root-dev-dep']);
    });
  });

  describe('in this repository', () => {
    it("the ROOT-DECLARED control specifier is declared by the root and covered by no paths entry", () => {
      // Both are preconditions for the control to mean anything, and both are
      // re-checked at run time by the gate itself; pinned here so a change to
      // either shows up in a test rather than only in a red gate.
      const declared = rootDeclaredSpecifiers(repoRoot) as Set<string>;
      expect(declared.has(ROOT_DECLARED_CONTROL_PACKAGE)).toBe(true);
      const state = analyze({}) as unknown as { paths: Record<string, string[]> };
      expect(Object.keys(state.paths)).not.toContain(ROOT_DECLARED_CONTROL_PACKAGE);
      expect(findInstalledCopy(repoRoot, ROOT_DECLARED_CONTROL_PACKAGE)).toBeTruthy();
    });

    it('no COVERED snippet imports a specifier that only the root declares', () => {
      // The gate itself proves this on a built tree; this pin is the build-free
      // half, so a new page resting on the workspace's own devDependencies is
      // caught by the per-PR suite too.
      const declared = rootDeclaredSpecifiers(repoRoot) as Set<string>;
      const state = analyze({}) as unknown as {
        compiled: { doc: string; fenceLine: number; body: string }[];
        paths: Record<string, string[]>;
      };
      const offenders: string[] = [];
      for (const b of state.compiled) {
        const sf = ts.createSourceFile('probe.tsx', b.body, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
        for (const specifier of moduleSpecifiersOf(sf) as string[]) {
          if (resolvesOnlyThroughRootManifest(specifier, { paths: state.paths, rootDeclared: declared })) {
            offenders.push(`${b.doc}:${b.fenceLine} ${specifier}`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });

    it('states the bound in its own header, so the rule cannot drift out of the source', () => {
      const source = fs.readFileSync(path.join(repoRoot, SCRIPT), 'utf8');
      expect(source).toContain('resolves ONLY through the repository root');
      expect(source).toContain('ROOT-');
    });
  });
});

/**
 * objectui#7555 — the OTHER consumer of the reader, and the one with teeth.
 *
 * A specifier the reader invents matters here only when it happens to equal a
 * workspace package: that package then joins the build filter AND the
 * unbuilt-package precondition, so the gate refuses to run (exit 2) over a
 * package no snippet imports. On this corpus the invented name was
 * `project-name`, which is not a workspace package, so nothing moved — luck,
 * not construction, which is why the consequence is pinned over a tree where
 * the name DOES collide.
 */
describe('what the snippets make the gate build is read by the same reader (objectui#7555)', () => {
  const treeWithBlock = (body: string): string =>
    tempTree({
      'content/docs/sample.mdx': [`${FENCE}tsx`, body, FENCE].join('\n'),
      'packages/pkg-a/package.json': JSON.stringify({ name: '@fixture/pkg-a', types: 'dist/index.d.ts' }),
    });

  type State = { neededPackages: Set<string>; findings: { reason: string }[] };

  it('adds a package a block really imports — the control for the pin below', () => {
    // Without this half, the pin below would also pass over a tree where the
    // package was never discovered at all.
    const state = analyze({
      root: treeWithBlock("import { a } from '@fixture/pkg-a';\nexport const x = a;"),
    }) as unknown as State;
    expect([...state.neededPackages]).toEqual(['@fixture/pkg-a']);
    expect(buildFilterArgs(state.neededPackages)).toBe('--filter=@fixture/pkg-a...');
    expect(state.findings.map((f) => f.reason)).toContain('unbuilt-package');
  });

  it('does NOT add one named only inside a template literal', () => {
    const state = analyze({
      root: treeWithBlock(
        "export const readme = `\n# Project\n\nimport { a } from '@fixture/pkg-a';\n`;",
      ),
    }) as unknown as State;
    expect([...state.neededPackages]).toEqual([]);
    expect(buildFilterArgs(state.neededPackages)).toBe('');
    expect(state.findings.map((f) => f.reason)).not.toContain('unbuilt-package');
  });
});

describe('the exit path — "I could not run" is not "I ran and found errors" (objectui#5465)', () => {
  /** A workspace package that DECLARES built types, with nothing built. */
  const unbuiltTree = (types: string): string =>
    tempTree({
      'content/docs/a.mdx': [`${FENCE}ts`, "import '@fixture/pkg-a';", FENCE].join('\n'),
      'packages/pkg-a/package.json': JSON.stringify({ name: '@fixture/pkg-a', types }),
    });

  it('gives the two failure modes different codes, and neither of them is 0', () => {
    expect(EXIT_CODES.verified).toBe(0);
    expect(EXIT_CODES.documentsFailed).not.toBe(0);
    expect(
      EXIT_CODES.couldNotRun,
      'exit 0 with nothing run reads as coverage — the failure shape this gate family exists to prevent',
    ).not.toBe(0);
    expect(
      EXIT_CODES.couldNotRun,
      'an unbuilt tree and a broken snippet are different facts; a caller must be able to tell them apart',
    ).not.toBe(EXIT_CODES.documentsFailed);
  });

  it('reads an unbuilt package as a precondition, never as a documentation defect', () => {
    const findings = analyze({ root: unbuiltTree('./dist/index.d.ts'), ungated: {} })
      .findings as Finding[];
    expect(findings.map((f) => f.reason)).toContain('unbuilt-package');
    expect(blockingPreconditions(findings).length).toBeGreaterThan(0);
  });

  it('reads a source-typed package the same way — it too judges nothing', () => {
    const findings = analyze({ root: unbuiltTree('./src/index.ts'), ungated: {} })
      .findings as Finding[];
    expect(findings.map((f) => f.reason)).toContain('source-typed-package');
    expect(blockingPreconditions(findings).length).toBeGreaterThan(0);
  });

  it('leaves ledger findings OUT of the preconditions — those ARE verdicts, and they exit 1', () => {
    const findings: Finding[] = [
      { reason: 'stale-ungated-entry', site: 'content/docs/gone.mdx' },
      { reason: 'unexplained-fragment', site: 'content/docs/a.mdx:3' },
      { reason: 'stale-fragment-marker', site: 'content/docs/a.mdx:7' },
    ];
    expect(blockingPreconditions(findings)).toEqual([]);
  });

  it('states all three codes in its own header, so the contract cannot drift out of the source', () => {
    const source = fs.readFileSync(path.join(repoRoot, SCRIPT), 'utf8');
    const header = source.slice(0, source.indexOf('## What this gate answers'));
    expect(header).toContain('1 = THE GATE RAN AND FOUND ERRORS');
    expect(header).toContain('2 = THE GATE COULD NOT RUN');
  });
});

/**
 * The scoping notice on the precondition path — objectui#7795.
 *
 * The command that path prints builds a CLOSURE, not the tree, and said so
 * nowhere: measured on `origin/main` `abdcd189c`, running it left 34 of the
 * workspace's 40 packages with a `dist/`, and nothing told the reader that the
 * leftovers were the intended end state rather than a build that half-failed.
 *
 * Pinned here is the half that rots unwatched — the notice must keep DERIVING its
 * numbers and must never grow a package list of its own — plus the half that makes
 * it worthless: the precondition path has to actually print it. That it reaches a
 * real terminal is shown on an unbuilt tree in the pull request; this suite cannot
 * get there, because the path only opens when this repository's own packages are
 * unbuilt, and CI has built them by the time it runs.
 */
describe('the printed build command says what it does NOT build (objectui#7795)', () => {
  it('interpolates the counts it is handed — without this, a fixed sentence passes every pin below', () => {
    expect(scopedBuildNotice(26, 40)).toContain('26 package(s)');
    expect(scopedBuildNotice(26, 40)).toContain('packages/ holds 40');
    // The control: different inputs, different text. A hard-coded "26 of 40" —
    // exactly the rotting summary this notice exists not to be — passes the
    // assertions above and fails these.
    const other = scopedBuildNotice(1, 2);
    expect(other).toContain('1 package(s)');
    expect(other).toContain('packages/ holds 2');
    expect(other).not.toContain('26');
    expect(other).not.toContain('40');
  });

  it('names no package of its own — the reader is sent to the filter, never to a copy of it', () => {
    const notice = scopedBuildNotice(26, 40);
    expect(
      notice,
      'a package name written here is a second list of what gets built, and it rots the first time coverage moves',
    ).not.toMatch(/@object-ui\//);
    expect(notice).toContain('--build-filter');
    expect(notice, 'without a way to ask, the notice is one more thing the reader has to trust').toContain(
      '--dry=text',
    );
  });

  it('says the build is scoped and that what it leaves behind is the designed end state', () => {
    const notice = scopedBuildNotice(26, 40);
    expect(notice).toContain('not a whole-tree build');
    expect(notice).toContain('left exactly as it was');
  });

  it('is printed on the precondition path, not merely defined', () => {
    const source = fs.readFileSync(path.join(repoRoot, SCRIPT), 'utf8');
    const start = source.indexOf('PRECONDITION NOT MET');
    expect(start, 'the precondition path must still print that headline').toBeGreaterThan(-1);
    const end = source.indexOf('return EXIT_CODES.couldNotRun;', start);
    expect(
      source.slice(start, end),
      'a notice nothing calls is a string in a file, and objectui#7795 was filed about a reader who was never told',
    ).toContain('scopedBuildNotice(');
  });

  it('counts the workspace from what the gate itself read, not from a number written down', () => {
    const root = tempTree({
      'content/docs/a.mdx': [`${FENCE}ts`, 'export const x = 1;', FENCE].join('\n'),
      'packages/pkg-a/package.json': JSON.stringify({ name: '@fixture/pkg-a', types: './dist/index.d.ts' }),
      'packages/pkg-b/package.json': JSON.stringify({ name: '@fixture/pkg-b', types: './dist/index.d.ts' }),
    });
    const state = analyze({ root }) as unknown as { packageDirOf: Record<string, string> };
    expect(Object.keys(state.packageDirOf).sort()).toEqual(['@fixture/pkg-a', '@fixture/pkg-b']);
  });
});

describe('wiring — a script nothing runs is not a gate', () => {
  const workflowDir = path.join(repoRoot, '.github/workflows');
  const workflowPath = path.join(workflowDir, 'doc-snippet-types.yml');
  const workflowFiles = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml'));

  /** A workflow's YAML with whole-line comments removed — the headers in this
   *  repository name other workflows and other scripts in prose. */
  const yamlOf = (file: string): string =>
    fs
      .readFileSync(path.join(workflowDir, file), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

  it('has a workflow that gates pull requests, not just pushes', () => {
    expect(fs.existsSync(workflowPath), 'a check nothing runs is not a gate').toBe(true);
    const yaml = yamlOf('doc-snippet-types.yml');
    expect(yaml).toContain('pull_request:');
    expect(yaml).toContain(SCRIPT);
  });

  it('runs it in NO path-filtered workflow — the change that breaks a snippet is docs-only', () => {
    expect(workflowFiles.length, 'the workflow directory scan returned implausibly few files').toBeGreaterThan(5);
    for (const file of workflowFiles) {
      const yaml = yamlOf(file);
      if (!yaml.includes(SCRIPT)) continue;
      expect(yaml, `${file} filters paths and would miss a docs-only change`).not.toMatch(
        /^\s*paths(-ignore)?:/m,
      );
    }
  });

  it('lives in exactly one workflow — one gate, one home', () => {
    expect(workflowFiles.filter((f) => yamlOf(f).includes(SCRIPT))).toEqual(['doc-snippet-types.yml']);
  });

  it('builds a FILTER, never the whole workspace', () => {
    const yaml = yamlOf('doc-snippet-types.yml');
    expect(yaml).toContain('--build-filter');
    expect(yaml, 'the 2026-08-16 ruling on objectui#4846 rejected a per-PR full-repo build').not.toMatch(
      /run: pnpm( exec turbo run)? build\s*$/m,
    );
  });

  it('builds BEFORE it invokes the gate, so a precondition exit is not a state CI can reach', () => {
    const yaml = yamlOf('doc-snippet-types.yml');
    const build = yaml.indexOf('turbo run build');
    const invoke = yaml.search(new RegExp(`run: node ${SCRIPT.replace(/[.\\/]/g, '\\$&')}\\s*$`, 'm'));
    expect(build, 'the workflow must build the packages the covered snippets import').toBeGreaterThan(-1);
    expect(invoke, 'the workflow must invoke the gate itself').toBeGreaterThan(-1);
    expect(
      build,
      'invoked before its own build, the gate would red a healthy pull request on a precondition',
    ).toBeLessThan(invoke);
  });

  /**
   * objectui#5911 — the emitted list must be BUILDABLE, not merely accurate.
   *
   * The set the gate computes is the packages the DOCUMENTS import. That is a
   * true answer to a different question than "what do I build": those packages
   * depend on workspace packages no snippet names, and without them the build
   * the gate prescribes dies on an import the reader never wrote. Measured on
   * this tree before the fix: `pnpm <bare list> run build` selected 21 packages
   * and failed with `TS2307: Cannot find module '@object-ui/sdui-parser'`.
   *
   * The suffix is pinned rather than the list, because the list is supposed to
   * move as coverage grows — that is the property `--build-filter` exists for.
   */
  it('emits the dependency-closure suffix on every filter, so the build it prescribes is complete', () => {
    const args = buildFilterArgs(['@object-ui/react', '@object-ui/core']);
    expect(args).toBe('--filter=@object-ui/core... --filter=@object-ui/react...');
    for (const word of args.split(' ')) {
      expect(word, 'a bare --filter= builds the package without what it depends on').toMatch(
        /^--filter=\S+\.\.\.$/,
      );
    }
  });

  it('keeps the emission sorted and shell-safe — the workflow word-splits it unquoted', () => {
    const args = buildFilterArgs(['@object-ui/types', '@object-ui/app-shell', '@object-ui/i18n']);
    expect(args.split(' ')).toEqual([
      '--filter=@object-ui/app-shell...',
      '--filter=@object-ui/i18n...',
      '--filter=@object-ui/types...',
    ]);
    expect(args, 'a glob or quote here would be re-interpreted by the runner shell').not.toMatch(
      /["'`$*?]/,
    );
  });

  it('names every package it is given, so the closure suffix never replaces a name', () => {
    const names = ['@object-ui/react', '@object-ui/core', '@object-ui/i18n'];
    const args = buildFilterArgs(names);
    for (const name of names) expect(args).toContain(`--filter=${name}...`);
    expect(args.split(' ')).toHaveLength(names.length);
  });

  it('is reachable by name from the workspace root', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:doc-snippets']).toBe(`node ${SCRIPT}`);
  });
});

/**
 * The step's own shell, executed — objectui#6221.
 *
 * The defect this pins was not in the gate but in the SHELL wrapped around it:
 * `echo "args=$(node …)" >> "$GITHUB_OUTPUT"` gives the step `echo`'s status, so
 * a gate that exited non-zero read as a gate that named no packages, and the
 * build step below it expanded to a bare `turbo run build` over the whole
 * workspace — the one thing this workflow's header forbids, with no signal
 * anywhere. A regex over the YAML would pin the letter of the fix; these run the
 * step scripts the workflow actually carries, under the runner's own default
 * shell (`bash -e {0}`), with `node` and `pnpm` shimmed so that what is measured
 * is the shell's handling of a failure rather than the gate's behaviour.
 */
describe('the build-filter steps propagate failure instead of silently building everything (objectui#6221)', () => {
  const stepScript = (name: string): string => {
    const workflow = parseYaml(fs.readFileSync(path.join(repoRoot, '.github/workflows/doc-snippet-types.yml'), 'utf8')) as {
      jobs: Record<string, { steps?: { name?: string; run?: string }[] }>;
    };
    const step = Object.values(workflow.jobs)
      .flatMap((job) => job.steps ?? [])
      .find((s) => s.name === name);
    expect(step?.run, `doc-snippet-types.yml must keep a step named "${name}" with a run: script`).toBeTypeOf(
      'string',
    );
    return step!.run!;
  };

  /** Run a step's `run:` script as the runner does, with the named executables shimmed. */
  const runStep = (script: string, shims: Record<string, string>, env: Record<string, string> = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-snippet-step-'));
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    for (const [name, body] of Object.entries(shims)) {
      fs.writeFileSync(path.join(bin, name), body);
      fs.chmodSync(path.join(bin, name), 0o755);
    }
    const scriptPath = path.join(dir, 'step.sh');
    fs.writeFileSync(scriptPath, script);
    const githubOutput = path.join(dir, 'github_output');
    fs.writeFileSync(githubOutput, '');
    const turboArgv = path.join(dir, 'turbo_argv');
    // `bash -e {0}` is the default shell for a `run:` step on a Linux runner.
    const proc = spawnSync('bash', ['-e', scriptPath], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_OUTPUT: githubOutput, TURBO_ARGV: turboArgv, ...env },
    });
    return {
      status: proc.status,
      stderr: proc.stderr,
      githubOutput: fs.readFileSync(githubOutput, 'utf8'),
      turboInvoked: fs.existsSync(turboArgv),
      turboArgv: fs.existsSync(turboArgv) ? fs.readFileSync(turboArgv, 'utf8').trim() : null,
    };
  };

  const failingGate = '#!/usr/bin/env bash\necho "the filter could not be derived" >&2\nexit 3\n';
  const healthyGate = '#!/usr/bin/env bash\necho "--filter=@object-ui/core --filter=@object-ui/react"\n';
  const recordingPnpm = '#!/usr/bin/env bash\necho "$*" > "$TURBO_ARGV"\n';

  it('fails the filter step when the gate fails, and writes no output at all', () => {
    const result = runStep(stepScript('Derive the packages the covered snippets import'), { node: failingGate });
    expect(result.status, 'a failed filter must not read as a successful step').not.toBe(0);
    expect(result.stderr, 'the step must say what failed, not just fail').toContain('--build-filter');
    expect(result.stderr, 'a failure the log does not annotate is a failure someone has to go looking for').toContain(
      '::error::',
    );
    expect(
      result.githubOutput,
      'an `args=` line written after a failed gate is the empty filter that becomes an unfiltered build',
    ).toBe('');
  });

  it('writes the derived filter through unchanged when the gate succeeds', () => {
    const result = runStep(stepScript('Derive the packages the covered snippets import'), { node: healthyGate });
    expect(result.status).toBe(0);
    expect(result.githubOutput.trim()).toBe('args=--filter=@object-ui/core --filter=@object-ui/react');
  });

  it('refuses an empty filter in the build step rather than building the whole workspace', () => {
    const result = runStep(stepScript('Build those packages'), { pnpm: recordingPnpm }, { FILTER_ARGS: '' });
    expect(result.status, 'an empty filter can only mean something upstream went wrong').not.toBe(0);
    expect(result.turboInvoked, 'turbo must not run at all on an empty filter').toBe(false);
    expect(result.stderr, 'the refusal must be the step\'s own, not a shell error that happens to mention a filter').toContain(
      '::error::',
    );
  });

  it('hands turbo the derived packages as separate words when the filter is real', () => {
    const result = runStep(stepScript('Build those packages'), { pnpm: recordingPnpm }, {
      FILTER_ARGS: '--filter=@object-ui/core --filter=@object-ui/react',
    });
    expect(result.status).toBe(0);
    expect(result.turboArgv).toBe(
      'exec turbo run build --filter=@object-ui/core --filter=@object-ui/react --concurrency=2',
    );
  });

  it('never puts the gate back inside a command substitution whose status is discarded', () => {
    expect(
      stepScript('Derive the packages the covered snippets import'),
      'the step status would be `echo`\'s again, and a failed gate would read as an empty filter',
    ).not.toMatch(/echo\s+"?args=\$\(/);
  });
});
