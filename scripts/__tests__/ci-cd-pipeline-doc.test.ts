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

  /** The job table's rows in page order: job key, `Appears as`, `What it runs`. */
  function docJobRows(): { key: string; appearsAs: string; runs: string }[] {
    const section = coreCiSection();
    const at = section.indexOf(JOB_TABLE_HEADER);
    expect(at, `the job table must keep the header \`${JOB_TABLE_HEADER}\``).toBeGreaterThan(-1);
    const lines = section.slice(at).split('\n').slice(1);
    const rows: { key: string; appearsAs: string; runs: string }[] = [];
    for (const line of lines) {
      if (!line.startsWith('|')) break;
      if (/^\|[\s|:-]+\|$/.test(line)) continue; // separator
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      rows.push({ key: cells[0].replace(/`/g, '').trim(), appearsAs: cells[1] ?? '', runs: cells[2] ?? '' });
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

  /**
   * objectui#3653: every pin above judges `ci.yml` at JOB granularity — the set of
   * job keys, the `name:` each one reports under, the absence of a count. None of
   * them reads what a job *runs*, so a `run:` step added to an existing job left
   * this whole file green. Two such steps had landed unlisted: `pnpm
   * check:i18n-keys` (objectui#3530, PR #3547) and `pnpm check:i18n-drift`
   * (objectui#3650, PR #3659) both ran in the `type-check` job while its row on the
   * page still listed five commands.
   *
   * Both directions are asserted, because the column is a claim in both: a command
   * the job runs and the row omits is a contributor who cannot learn from this page
   * that a gate exists; a command the row names and the job does not run is the
   * objectui#3451 shape one level down — a page advertising a guardrail that is not
   * there.
   *
   * What counts as a command is deliberately narrower than "every step", and the
   * boundary is *derived* rather than hand-listed: a step counts when it names
   * something this repository owns — a `scripts/*.mjs` file, a script in the root
   * `package.json`, or a `turbo run` task. Environment setup drops out on its own
   * because it names none of those (`corepack enable`, `pnpm --version`, `pnpm
   * install --frozen-lockfile`, `pnpm exec playwright install`, `pnpm --filter …
   * exec vite build`), which keeps this column a summary of the gates rather than a
   * transcript of the YAML: the `e2e` job's artifact check and Playwright cache are
   * real steps that no reader of this page needs enumerated.
   *
   * The hole that leaves, stated so nobody mistakes it for coverage: a gate written
   * as an inline shell block names no first-party command and is invisible here.
   * Gates in this repository land as a root `package.json` script or a
   * `scripts/*.mjs` file — both covered — and that is the only reason the narrower
   * rule is enough.
   *
   * Steps are read from `run:` values only, never from the surrounding YAML. The
   * `type-check` job's comments alone mention `pnpm type-check`, `turbo run
   * type-check` and `pnpm check:i18n-drift`; a scan of the raw block would take all
   * three for steps and this pin would then be describing its own comments.
   *
   * Whether a given step still EXISTS in `ci.yml` is pinned where that step was
   * introduced — `check-i18n-call-site-keys.test.ts` and
   * `check-i18n-en-drift.test.ts` each hold their own, as do
   * `scripts-type-check.test.ts` and `vitest-setup-type-check.test.ts`. This block
   * does not repeat those assertions; it pins the *pairing* between the YAML and
   * this page, which is the part nothing owned.
   */
  describe('what each job runs', () => {
    const rootScripts = new Set(
      Object.keys(
        (
          JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
            scripts: Record<string, string>;
          }
        ).scripts,
      ),
    );

    /** One job's YAML block, from its key line up to the next thing at that indent. */
    function jobBlock(key: string): string {
      const body = ciWorkflow.slice(ciWorkflow.search(/^jobs:[ \t]*$/m));
      const at = body.search(new RegExp(`^ {2}${key}:[ \\t]*$`, 'm'));
      expect(at, `ci.yml must still define a \`${key}:\` job`).toBeGreaterThan(-1);
      const rest = body.slice(at + 1);
      // A job's own comments are indented four spaces or more; the two-space ones
      // introduce the *next* job, so stopping at any two-space line is right.
      const next = rest.search(/^ {2}\S/m);
      return next === -1 ? rest : rest.slice(0, next);
    }

    /** Every `run:` step body in a job block — single-line and block scalar alike. */
    function runSteps(block: string): string[] {
      const lines = block.split('\n');
      const steps: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const at = lines[i].indexOf('run:');
        // `run:` must be the key of the line, not text inside another value.
        if (at === -1 || !/^[\s-]*$/.test(lines[i].slice(0, at))) continue;
        const value = lines[i].slice(at + 'run:'.length).trim();
        if (!/^[|>][-+]?$/.test(value)) {
          steps.push(value);
          continue;
        }
        const body: string[] = [];
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === '') continue;
          if (lines[j].search(/\S/) <= at) break;
          body.push(lines[j].trim());
        }
        steps.push(body.join('\n'));
      }
      return steps;
    }

    /**
     * The first-party commands named in a piece of text — applied to a job's `run:`
     * bodies on one side and to its `What it runs` cell on the other, so the two
     * sides are compared by the same rule rather than by two spellings of it.
     */
    function firstPartyCommands(text: string): Set<string> {
      const found = new Set<string>();
      // A gate that lives in this repo's `scripts/` tree. The `node ` prefix is not
      // required: ci.yml writes `node scripts/x.mjs`, the page writes the path.
      for (const m of text.matchAll(/scripts\/[\w./-]+\.mjs/g)) found.add(m[0]);
      // A root `package.json` script. `install`, `--version`, `exec` and `--filter`
      // are not scripts, so the setup steps need no exemption list.
      for (const m of text.matchAll(/\bpnpm\s+([\w:.-]+)/g)) {
        if (rootScripts.has(m[1])) found.add(`pnpm ${m[1]}`);
      }
      // The build graph, invoked through the task runner instead of a script.
      for (const m of text.matchAll(/\bturbo\s+run\s+([\w:-]+)/g)) found.add(`turbo run ${m[1]}`);
      return found;
    }

    /** `job key -> commands it actually runs`, and the same from the page's table. */
    function commandsByJob(): { key: string; ran: Set<string>; named: Set<string> }[] {
      return docJobRows().map((row) => ({
        key: row.key,
        ran: firstPartyCommands(runSteps(jobBlock(row.key)).join('\n')),
        named: firstPartyCommands(row.runs),
      }));
    }

    it('names every first-party command the job actually runs', () => {
      const jobs = commandsByJob();

      // A parser that matched nothing would make both directions vacuously green —
      // the exact failure the `dev-server` job demonstrated one level up.
      const ran = jobs.reduce((n, j) => n + j.ran.size, 0);
      expect(ran, 'the ci.yml `run:` parse found implausibly few first-party commands').toBeGreaterThan(8);

      const missing = jobs.flatMap((j) => [...j.ran].filter((c) => !j.named.has(c)).map((c) => `${j.key}: ${c}`));

      expect(
        missing,
        `.github/workflows/ci.yml runs commands that the job table in ` +
          `content/docs/guide/ci-cd-pipeline.md does not name:\n` +
          missing.map((m) => `  - ${m}`).join('\n') +
          `\n\nAdd each one to that job's "What it runs" cell, in the order ci.yml runs it. ` +
          `A gate nobody wrote down is a build failure contributors meet without knowing what ` +
          `produced it — objectui#3653: two locale gates ran in \`type-check\` unlisted, because ` +
          `the pins on this page read job keys and job names but never read the steps.`,
      ).toEqual([]);
    });

    it('credits no job with a first-party command it does not run', () => {
      const jobs = commandsByJob();

      const named = jobs.reduce((n, j) => n + j.named.size, 0);
      expect(named, 'the job table parse found implausibly few commands in "What it runs"').toBeGreaterThan(8);

      const phantom = jobs.flatMap((j) => [...j.named].filter((c) => !j.ran.has(c)).map((c) => `${j.key}: ${c}`));

      expect(
        phantom,
        `content/docs/guide/ci-cd-pipeline.md's job table credits jobs with commands that ` +
          `.github/workflows/ci.yml does not run there:\n` +
          phantom.map((p) => `  - ${p}`).join('\n') +
          `\n\nEither the step was removed and the cell is stale, or the command runs in a ` +
          `different job and belongs in that row. A "What it runs" cell reads as this job's ` +
          `gate list, so naming a command for contrast inside it makes the page claim a ` +
          `guardrail — the objectui#3451 mistake, one level down.`,
      ).toEqual([]);
    });
  });
});
