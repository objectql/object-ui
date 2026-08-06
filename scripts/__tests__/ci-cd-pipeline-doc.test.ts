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
    // Fenced blocks are excluded: they hold YAML samples for workflows that do
    // not exist yet ("Adding a New Workflow") and, until #3212, an ASCII overview
    // box that wrapped filenames across lines (`performance-` / `budget.yml`),
    // which no filename scan can read.
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

/**
 * objectui#3451: the same drift as #3197/#3212, one table lower down and pointing
 * the dangerous way. The `## Core CI Workflow (ci.yml)` section opened with "Seven
 * jobs, all parallel" and its table's seventh row described a `dev-server` job —
 * "guards `apps/dev-server`'s `objectstack.config.ts` against fixture /
 * `@objectstack/spec` drift", running "Every run".
 *
 * The history matters, because the row was wrong in two different ways and only the
 * second is the one you would guess:
 *
 *   2026-05-24  `apps/dev-server` lands, and with it the `dev-server` job.
 *   2026-05-26  `apps/dev-server` is removed. The job stays. `--filter
 *               @object-ui/dev-server` now matches no package and exits 0 —
 *               green by vacuity, for the next 69 days.
 *   2026-08-03  #3253 (fixing #3212) rewrites this very table and *adds* the
 *               `dev-server` row, describing a fixture-drift guard that had not
 *               built anything since May. The row was false the day it was written.
 *   2026-08-04  #3325 deletes the vacuous job from `ci.yml`, leaving the row.
 *   2026-08-06  #3451.
 *
 * So this is not only "the YAML moved and the prose lagged". #3253 pinned the
 * *workflow* inventory in both directions and left the *job* table unpinned, and the
 * table drifted within a day. #3197's comment names the direction: understating a
 * gate is annoying, advertising a guardrail the CI does not have is worse than no
 * doc.
 *
 * The count and the table are pinned together because fixing either one alone fixes
 * a snapshot, not the drift. Add or remove a job in `ci.yml` without editing this
 * page and the first test below fails, naming the job in each direction.
 *
 * What this still cannot catch is the 2026-05-26 shape: a job that exists in YAML
 * and does nothing. No amount of doc-to-YAML pinning sees that — only reading what
 * the job runs does.
 */
describe('ci-cd-pipeline.md — ci.yml job table', () => {
  const ciWorkflow = fs.readFileSync(path.join(workflowDir, 'ci.yml'), 'utf8');

  /**
   * Job keys from `ci.yml`, in file order.
   *
   * Scoped to the `jobs:` mapping, because top-level `on:` has two-space children
   * of its own (`push:`, `pull_request:`) that a whole-file scan would read as
   * jobs. Inside `jobs:` the only two-space lines are the job keys themselves:
   * job-level keys sit at four, step bodies deeper still, and every block scalar
   * (`run: |`) is indented past its key, so nothing else can reach column 2.
   */
  function ciJobKeys(): string[] {
    const start = ciWorkflow.search(/^jobs:[ \t]*$/m);
    expect(start, 'ci.yml must still have a top-level `jobs:` mapping').toBeGreaterThan(-1);
    const body = ciWorkflow.slice(start + 'jobs:'.length);
    // `jobs:` is the last top-level key today; stop at the next one regardless.
    const end = body.search(/^[A-Za-z]/m);
    const scoped = end === -1 ? body : body.slice(0, end);
    return [...scoped.matchAll(/^ {2}([a-z0-9][a-z0-9-]*):[ \t]*$/gm)].map((m) => m[1]);
  }

  /** The `name:` each job reports itself under in the checks list, keyed by job key. */
  function ciJobNames(): Map<string, string> {
    const names = new Map<string, string>();
    const start = ciWorkflow.search(/^jobs:[ \t]*$/m);
    const body = ciWorkflow.slice(start);
    for (const key of ciJobKeys()) {
      const at = body.search(new RegExp(`^ {2}${key}:[ \\t]*$`, 'm'));
      const after = body.slice(at);
      const name = after.match(/^ {4}name:[ \t]*(.+?)[ \t]*$/m)?.[1];
      if (name) names.set(key, name.replace(/^['"]|['"]$/g, ''));
    }
    return names;
  }

  /** The `## Core CI Workflow (ci.yml)` section, up to the next `##` heading. */
  function coreCiSection(): string {
    const start = doc.indexOf('## Core CI Workflow (`ci.yml`)');
    expect(start, 'the page must still have a "## Core CI Workflow (`ci.yml`)" section').toBeGreaterThan(-1);
    const rest = doc.slice(start + 2);
    const next = rest.search(/^## /m);
    return next === -1 ? rest : rest.slice(0, next);
  }

  const JOB_TABLE_HEADER = '| Job key | Appears as | What it runs | When |';

  /** First column of the job table, in page order. */
  function docJobRows(): { key: string; appearsAs: string }[] {
    const section = coreCiSection();
    const at = section.indexOf(JOB_TABLE_HEADER);
    expect(at, `the job table must keep the header \`${JOB_TABLE_HEADER}\``).toBeGreaterThan(-1);
    const lines = section.slice(at).split('\n').slice(1);
    const rows: { key: string; appearsAs: string }[] = [];
    for (const line of lines) {
      if (!line.startsWith('|')) break;
      if (/^\|[\s|:-]+\|$/.test(line)) continue; // separator
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      rows.push({ key: cells[0].replace(/`/g, '').trim(), appearsAs: cells[1] ?? '' });
    }
    return rows;
  }

  it('lists exactly the jobs ci.yml defines — in both directions', () => {
    const fromWorkflow = ciJobKeys();
    // A parser that silently matched nothing would make this test vacuously green,
    // which is the failure mode the removed `dev-server` job itself demonstrated.
    expect(fromWorkflow.length, 'the ci.yml `jobs:` parse returned implausibly few keys').toBeGreaterThan(3);

    const fromDoc = docJobRows().map((r) => r.key);
    expect(fromDoc.length, 'the job table parse returned implausibly few rows').toBeGreaterThan(3);

    const phantom = fromDoc.filter((k) => !fromWorkflow.includes(k));
    const missing = fromWorkflow.filter((k) => !fromDoc.includes(k));

    expect(
      phantom,
      `content/docs/guide/ci-cd-pipeline.md's job table has rows for jobs that are NOT in ` +
        `.github/workflows/ci.yml:\n` +
        phantom.map((k) => `  - ${k}`).join('\n') +
        `\n\nDelete the row. A page that advertises a guard CI does not run is worse than no ` +
        `page — objectui#3451: the \`dev-server\` row survived three months after #3325 deleted ` +
        `the job, telling contributors their objectstack.config.ts had drift protection it did not.`,
    ).toEqual([]);

    expect(
      missing,
      `.github/workflows/ci.yml defines jobs with no row in the job table of ` +
        `content/docs/guide/ci-cd-pipeline.md:\n` +
        missing.map((k) => `  - ${k}`).join('\n') +
        `\n\nAdd a row (job key, the \`name:\` it appears as in the checks list, what it runs, and ` +
        `when) — an undocumented job is a check contributors get blocked by without knowing it exists.`,
    ).toEqual([]);
  });

  it('quotes each job under the name ci.yml gives it', () => {
    // `${{ ... }}` is left as a wildcard: `test` is a matrix job whose name is
    // `Test (shard ${{ matrix.shard }}/4)` and the page sensibly writes `N` for the
    // shard index. Everything outside the expressions must match literally.
    const names = ciJobNames();
    expect(names.size, 'every ci.yml job should declare a `name:`').toBe(ciJobKeys().length);

    for (const { key, appearsAs } of docJobRows()) {
      const declared = names.get(key);
      if (!declared) continue; // key mismatch is the previous test's failure to report
      const pattern = new RegExp(
        `^${declared
          .split(/\$\{\{[^}]*\}\}/)
          .map((lit) => lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('.+')}$`,
      );
      expect(
        appearsAs,
        `the job table's "Appears as" for \`${key}\` must match ci.yml's \`name: ${declared}\``,
      ).toMatch(pattern);
    }
  });

  it('states no job count, so the number cannot drift away from the table', () => {
    // The #3212 lesson applied one section down: a hand-maintained count drifts by
    // construction and a stale one still reads as authoritative. "Seven jobs, all
    // parallel" outlived the seventh job by three months.
    const section = coreCiSection();
    const counted = section.match(
      /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)[ \t]+(?:parallel[ \t]+)?jobs\b/i,
    );
    expect(
      counted?.[0],
      `the Core CI section must not hard-code how many jobs ci.yml has (found "${counted?.[0]}") — ` +
        `the table is the list. See the same decision for the workflow count at the top of the page.`,
    ).toBeUndefined();
  });

  it('is telling the truth: no CI job builds the retired dev-server fixture', () => {
    // The inverse pin. The page now states outright that there is *no* guard on
    // `objectstack.config.ts` / `@objectstack/spec` drift. If anyone restores such a
    // job, this fails and points at the paragraph that denies it exists.
    expect(ciJobKeys()).not.toContain('dev-server');
    expect(
      ciWorkflow,
      'a dev-server fixture build is back in ci.yml — update the "What is not in `ci.yml`" ' +
        'section, which currently tells readers no such guard exists',
    ).not.toMatch(/@object-ui\/dev-server/);
    // Reflow-tolerant, and asserted as a boolean so a failure prints the reason
    // rather than diffing the entire page into the terminal.
    expect(
      /Today there is no `apps\/dev-server` and no such job/.test(doc.replace(/\s+/g, ' ')),
      'the "What is not in `ci.yml`" section must keep stating outright that neither the ' +
        '`dev-server` job nor `apps/dev-server` exists. The table pin above catches a restored ' +
        'job with no row; this catches a restored job whose row was added while this paragraph ' +
        'still denies it (objectui#3451).',
    ).toBe(true);
  });
});
