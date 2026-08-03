import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * objectui#3197: `content/docs/guide/ci-cd-pipeline.md` described a bundle-size
 * regime that had not existed for a long time — a 60 KB console budget against a
 * workflow that enforces 350 KB (5.8x off), a `size-check.yml` workflow that has
 * never existed in this repository, and three package-size tiers printed under an
 * **Enforced limits** heading even though the step that emits them compares
 * nothing and never exits non-zero.
 *
 * Prose cannot be trusted to stay in sync with YAML by review alone — the number
 * had already drifted once and would drift again. So the doc is pinned to the
 * workflow here: change `MAX_ENTRY_GZIP_KB` (or the advisory tiers, or the set of
 * workflows the page names) without updating the page and this test fails.
 *
 * The dangerous direction is deliberately covered twice. A doc that *understates*
 * a gate is annoying; a doc that advertises a guardrail the CI does not have is
 * worse than no doc, because people make size decisions believing something will
 * stop them. Hence the last block: if anyone ever makes the size report actually
 * enforce those tiers, this test fails and points at the page that calls them
 * advisory.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const docPath = path.join(repoRoot, 'content/docs/guide/ci-cd-pipeline.md');
const workflowPath = path.join(repoRoot, '.github/workflows/performance-budget.yml');
const workflowDir = path.join(repoRoot, '.github/workflows');

const doc = fs.readFileSync(docPath, 'utf8');
const workflow = fs.readFileSync(workflowPath, 'utf8');

/**
 * The `Generate package size report` step body, from its `- name:` line up to the
 * next step at the same indentation. Scoping matters: the *budget* step legitimately
 * exits non-zero, and asserting over the whole file would conflate the two.
 */
function sizeReportStep(): string {
  const start = workflow.indexOf('      - name: Generate package size report');
  expect(start, 'the size-report step must still be named "Generate package size report"').toBeGreaterThan(-1);
  const rest = workflow.slice(start + 1);
  const next = rest.indexOf('\n      - name: ');
  return next === -1 ? rest : rest.slice(0, next);
}

describe('ci-cd-pipeline.md — enforced console budget', () => {
  it('quotes the same MAX_ENTRY_GZIP_KB the workflow enforces', () => {
    const fromWorkflow = workflow.match(/^\s*MAX_ENTRY_GZIP_KB=(\d+)\s*$/m)?.[1];
    expect(fromWorkflow, 'MAX_ENTRY_GZIP_KB must still be assigned a literal in the workflow').toBeDefined();

    // The doc row that names the constant — the number lives next to it so the
    // two can never be read apart.
    const docRow = doc.split('\n').find((line) => line.includes('MAX_ENTRY_GZIP_KB') && line.startsWith('|'));
    expect(docRow, 'the doc must have a table row naming MAX_ENTRY_GZIP_KB').toBeDefined();

    const fromDoc = docRow!.match(/\*\*(\d+) KB\*\*/)?.[1];
    expect(
      fromDoc,
      `ci-cd-pipeline.md must state the console entry budget as "**${fromWorkflow} KB**"`,
    ).toBe(fromWorkflow);
  });

  it('does not leave the superseded 60 KB figure anywhere on the page', () => {
    expect(doc).not.toMatch(/\b60 ?KB\b/);
  });
});

describe('ci-cd-pipeline.md — advisory package size tiers', () => {
  // `- ✅ Core packages should be < 50KB gzipped`, ×3.
  const tiersFromWorkflow = [...workflow.matchAll(/should be < (\d+)KB gzipped/g)].map((m) => m[1]);
  // `| Core packages | < 50 KB | **No** — advisory only |`
  const advisoryRows = doc.split('\n').filter((line) => /^\|.*\|\s*<\s*\d+ KB\s*\|/.test(line));

  it('lists the same three tiers the workflow echoes into the report', () => {
    expect(tiersFromWorkflow).toEqual(['50', '100', '150']);
    expect(advisoryRows.map((row) => row.match(/<\s*(\d+) KB/)![1])).toEqual(tiersFromWorkflow);
  });

  it('marks every tier as NOT enforced', () => {
    expect(advisoryRows).toHaveLength(3);
    for (const row of advisoryRows) {
      expect(row, `advisory tier row must say it is not enforced: ${row}`).toMatch(/\*\*No\*\*/);
    }
    expect(doc).toMatch(/### Package size report — advisory, not a gate/);
  });

  it('is telling the truth: the size-report step compares nothing and cannot fail', () => {
    // The inverse pin. If someone turns the tiers into a real gate, this fails —
    // which is the moment the "advisory only" wording above must be rewritten.
    const step = sizeReportStep();
    expect(step).not.toMatch(/\bexit 1\b/);
    expect(step).not.toMatch(/\b(50|100|150)\b\s*\)?\s*(?:\]\]|\))?\s*(?:&&|\|\||;|then)/);
    expect(step).not.toMatch(/-(gt|lt|ge|le)\s/);
  });
});

/**
 * objectui#3212: the forward direction above (every workflow the page names must
 * exist) was pinned by #3197; the reverse was deliberately left out because it
 * would have gone red immediately — `lint.yml`, `cross-repo-issue-closer.yml`
 * and later `changeset-guard.yml` had no section at all. `lint.yml` is a real PR
 * gate, and a contributor reading this page had no way to learn it existed.
 *
 * Only the reverse direction actually stops the drift. Without it, fixing the
 * page fixes one snapshot and guarantees the next workflow repeats the omission
 * silently — `changeset-guard.yml` appearing between #3212 being filed and being
 * fixed is the proof.
 *
 * A *heading* is required, not a passing mention: a filename buried in a table
 * row or an ASCII box is how the page got here. The heading is what makes the
 * workflow findable and forces someone to write down what it does.
 */

/**
 * `filename -> why this workflow must not be documented`. Deliberately empty.
 *
 * A workflow that runs in this repository is a workflow contributors can be
 * blocked by, so "not worth a section" is a claim that has to be made
 * explicitly and reviewed — never by quietly skipping the page. The test below
 * also rejects entries that name a workflow which no longer exists, so the
 * escape hatch cannot rot into a permanent hole.
 */
const DOCUMENTATION_EXEMPT = new Map<string, string>();

describe('ci-cd-pipeline.md — workflow inventory', () => {
  const workflowFiles = new Set(fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml')));

  /** Workflow filenames named in a markdown heading, e.g. `## Lint (\`lint.yml\`)`. */
  const documented = new Set(
    doc
      .split('\n')
      .filter((line) => /^#{1,6}\s/.test(line))
      .flatMap((line) => [...line.matchAll(/([a-z0-9][a-z0-9-]*\.yml)\b/g)].map((m) => m[1])),
  );

  it('gives every workflow in .github/workflows/ its own section', () => {
    const undocumented = [...workflowFiles].filter(
      (f) => !documented.has(f) && !DOCUMENTATION_EXEMPT.has(f),
    );

    expect(
      undocumented,
      `These workflows exist in .github/workflows/ but no heading in ` +
        `content/docs/guide/ci-cd-pipeline.md names them:\n` +
        undocumented.map((f) => `  - ${f}`).join('\n') +
        `\n\nAdd a section to that page — a heading that contains the file name ` +
        `(e.g. "### Stale Issues (\`stale.yml\`)"), what triggers it, and whether it can ` +
        `block a merge — and a row in the "Workflow Inventory" table. A workflow nobody ` +
        `documented is a check contributors get blocked by without knowing it exists ` +
        `(objectui#3212: \`lint.yml\` gated PRs for months while this page never mentioned it).` +
        `\n\nIf a workflow genuinely must not be documented, add it to DOCUMENTATION_EXEMPT in ` +
        `this file with the reason — the exemption is reviewable, skipping the page is not.`,
    ).toEqual([]);
  });

  it('keeps the documentation exemption list honest', () => {
    for (const [name, reason] of DOCUMENTATION_EXEMPT) {
      expect(workflowFiles, `DOCUMENTATION_EXEMPT names ${name}, which no longer exists — drop it`).toContain(name);
      expect(reason.length, `DOCUMENTATION_EXEMPT[${name}] must carry a real justification`).toBeGreaterThan(20);
    }
  });

  it('never names a workflow file that does not exist', () => {
    // Fenced blocks are excluded: the ASCII overview box wraps filenames across
    // lines (`performance-` / `budget.yml`), which no filename scan can read.
    const prose = doc.replace(/```[\s\S]*?```/g, '');
    // Skip path-qualified mentions (`.github/labeler.yml` is the labeler *config*,
    // not the workflow of the same name).
    const named = new Set([...prose.matchAll(/(?<![\w/.-])([a-z0-9][a-z0-9-]*\.yml)\b/g)].map((m) => m[1]));

    expect(named.size).toBeGreaterThan(5);
    for (const name of named) {
      expect(workflowFiles, `ci-cd-pipeline.md documents ${name}, which is not in .github/workflows/`).toContain(name);
    }
  });

  it('does not resurrect the never-existent size-check.yml', () => {
    // Checked over the whole file, fences included — the stale claim lived in the
    // ASCII overview box as well as in its own section. (The page may still say
    // the words "size-check" while denying that such a workflow exists; what it
    // must never do again is name the file.)
    expect(doc).not.toMatch(/size-check\.yml/);
    expect(workflowFiles).not.toContain('size-check.yml');
  });
});
