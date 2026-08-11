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

  /**
   * objectui#3724: this page was not the only workflow inventory. `.github/WORKFLOWS.md`
   * held a second one — hand-maintained, linked from nowhere, and pinned by nothing —
   * which had drifted to documenting 5 workflows that did not exist (including a
   * changeset gate skippable with a `skip-changeset` label; neither the workflow nor the
   * label was ever real) while omitting 9 that did, `lint.yml` among them. That is #3212
   * verbatim, on a page no test could see.
   *
   * A duplicate inventory is a drift generator by construction: the pins above make *this*
   * page track `.github/workflows/` in both directions, and a second copy inherits none of
   * that while reading just as authoritative. So the resolution was deletion, not a second
   * ratchet, and this asserts the deletion holds.
   *
   * Scope, stated so it is not mistaken for more: it pins the one path that existed. A new
   * inventory under a different name evades it — the durable protection is that adding a
   * workflow already forces an edit *here*, so a second page earns nothing.
   */
  it('keeps this page as the only workflow inventory', () => {
    expect(
      fs.existsSync(path.join(repoRoot, '.github/WORKFLOWS.md')),
      '`.github/WORKFLOWS.md` is back. It was deleted by objectui#3724 because an unpinned ' +
        'second copy of the workflow inventory drifts to 5 phantom workflows and 9 omissions ' +
        'while nothing checks it. Document workflows in content/docs/guide/ci-cd-pipeline.md, ' +
        'which the tests in this file hold to `.github/workflows/` in both directions.',
    ).toBe(false);
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
 * objectui#3724: the `pnpm-lock.yaml` merge driver is repository configuration
 * (`.gitattributes`) that only works where a workflow defines the driver, so "which
 * workflows define it" is a claim about three files at once — and it was wrong in both
 * copies that made it. This page named `changeset-release.yml` and
 * `dependabot-auto-merge.yml`; the deleted `.github/WORKFLOWS.md` named
 * `changeset-release.yml` and `changelog.yml`. Each omitted a different third, and both
 * read as complete.
 *
 * The content survived the deletion — the `.gitattributes` half and the add-it-to-a-new-
 * workflow half existed nowhere else — so it moved onto this page. Moving an already-drifted
 * hand-maintained list into unpinned prose would just relocate the drift generator, which is
 * the whole reason #3724 chose deletion over a second copy. Hence this pin: both directions,
 * so a workflow that gains the step without a row is as red as a row whose workflow lost it.
 */
describe('ci-cd-pipeline.md — lockfile merge driver', () => {
  /** Workflows that actually configure the driver, by grepping for the git config key. */
  function workflowsConfiguringDriver(): string[] {
    return fs
      .readdirSync(workflowDir)
      .filter((f) => f.endsWith('.yml'))
      .filter((f) => /merge\.pnpm-merge/.test(fs.readFileSync(path.join(workflowDir, f), 'utf8')))
      .sort();
  }

  const DRIVER_TABLE_HEADER = '| Workflow | Why it needs the driver |';

  /**
   * The workflows named in that section's table. Scoped to the table rows on purpose: the
   * surrounding prose names all three again while recounting the drift, and a set built from
   * the whole section would stay green after the table itself was gutted.
   */
  function workflowsNamedInDoc(): string[] {
    const start = doc.indexOf('## Lockfile Merge Driver');
    expect(start, 'the page must keep a "## Lockfile Merge Driver" section').toBeGreaterThan(-1);
    const rest = doc.slice(start + 2);
    const next = rest.search(/^## /m);
    const section = next === -1 ? rest : rest.slice(0, next);

    const at = section.indexOf(DRIVER_TABLE_HEADER);
    expect(at, `that section must keep the table header \`${DRIVER_TABLE_HEADER}\``).toBeGreaterThan(-1);

    const named = new Set<string>();
    for (const line of section.slice(at).split('\n').slice(1)) {
      if (!line.startsWith('|')) break;
      if (/^\|[\s|:-]+\|$/.test(line)) continue; // separator
      for (const m of line.matchAll(/([a-z0-9][a-z0-9-]*\.yml)\b/g)) named.add(m[1]);
    }
    return [...named].sort();
  }

  it('lists exactly the workflows that configure merge.pnpm-merge — in both directions', () => {
    const configuring = workflowsConfiguringDriver();
    // A grep that matched nothing would make both directions vacuously green — the failure
    // mode the retired `dev-server` job demonstrated for the job table below.
    expect(
      configuring.length,
      'no workflow appears to configure `merge.pnpm-merge` — if the driver was genuinely ' +
        'retired, delete the "Lockfile Merge Driver" section and the `.gitattributes` line ' +
        'with it rather than leaving a page describing a mechanism nothing installs',
    ).toBeGreaterThan(0);

    const named = workflowsNamedInDoc();
    const missing = configuring.filter((f) => !named.includes(f));
    const phantom = named.filter((f) => !configuring.includes(f));

    expect(
      missing,
      `these workflows configure the pnpm-lock.yaml merge driver but have no row in the ` +
        `"Lockfile Merge Driver" table of content/docs/guide/ci-cd-pipeline.md:\n` +
        missing.map((f) => `  - ${f}`).join('\n') +
        `\n\nAdd a row saying why that workflow merges. An incomplete list is how this claim ` +
        `was wrong on two pages at once before objectui#3724.`,
    ).toEqual([]);

    expect(
      phantom,
      `the "Lockfile Merge Driver" table names workflows that do NOT configure ` +
        `\`merge.pnpm-merge\`:\n` +
        phantom.map((f) => `  - ${f}`).join('\n') +
        `\n\nEither the step was dropped from that workflow — in which case its lockfile ` +
        `conflicts are being resolved as a text merge, and that is the bug — or the row is ` +
        `stale and should go.`,
    ).toEqual([]);
  });

  it('keeps the .gitattributes half of the mechanism true', () => {
    // The driver only ever runs because an attribute asks for it. Half the mechanism living
    // in a file the workflows do not mention is exactly why this was documented nowhere
    // complete; if the attribute goes, the section is describing dead configuration.
    const attributes = fs.readFileSync(path.join(repoRoot, '.gitattributes'), 'utf8');
    expect(
      attributes,
      '.gitattributes no longer routes pnpm-lock.yaml through the `pnpm-merge` driver, so the ' +
        '"Lockfile Merge Driver" section on content/docs/guide/ci-cd-pipeline.md now describes ' +
        'a driver nothing invokes — the workflows would be configuring it for nothing.',
    ).toMatch(/^pnpm-lock\.yaml\s+merge=pnpm-merge\s*$/m);
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

/**
 * objectui#4170: the `## Merge Queue` section's other current-state claim — the
 * "Some contexts can never be required, structurally" bullet, which names four
 * workflows and, for each, quotes the live YAML property that makes it
 * unrequirable.
 *
 * All four were TRUE when this landed, so this pins prose that was not wrong; it
 * is here because of what happens next. objectui#4154 had just converged the
 * sibling paragraph one level up onto a pointer, for the reason that prose
 * nothing reads goes stale silently — and this bullet is that shape with an
 * expiry date already written into the YAML it describes: `live-e2e.yml`'s own
 * header says its `continue-on-error: true` comes off once the lane has run
 * clean long enough to trust. The day that lands, this page states that a lane
 * which now blocks merges can *never* block them, which is the direction #3197
 * and #3451 both name as the dangerous one — advertising or denying a guardrail
 * wrongly is worse than saying nothing, because people stop checking.
 *
 * The bullet is kept whole rather than replaced by a pointer (the choice that
 * fit #4154 and does not fit here): its four entries teach four *different*
 * structural reasons a context cannot be required — an inverse path filter, an
 * ordinary one, a job that cannot fail, and a trigger that only fires after the
 * merge. That is pedagogy, not an inventory, and a pointer would delete it.
 *
 * Every expectation below is READ OUT OF the workflow — never a second copy of
 * the value written here (the objectui#4150 derived-expectation pattern). The
 * page is then checked against what the YAML actually says, so a path list or a
 * trigger type cannot be changed in one place and stay green in the other.
 *
 * SCOPE, stated so it is not mistaken for more — this pins EXAMPLES TRUE, not a
 * CENSUS:
 *
 *   - Nothing here scans `.github/workflows/` for other structurally
 *     unrequirable workflows, and a fifth one arriving must NOT turn this red.
 *     The bullet says "Some contexts", and it is right to: it exists to teach
 *     the four shapes, not to enumerate their instances.
 *   - What IS checked in both directions is the page's own claims. A line added
 *     to that bullet needs an entry here, or it is unpinned prose again — this
 *     issue verbatim — and an entry here whose line has left the page fails too,
 *     so a claim cannot be quietly dropped while its pin reports green.
 *
 * THE `live-e2e.yml` RED IS EXPECTED, and it is not a bug to be worked around.
 * When `continue-on-error` comes off that job, `structuralBlocks` fails naming
 * `live-e2e.yml`. The fix is to DELETE that line from the bullet and its entry
 * from the map below — the lane has become requirable, so the page must stop
 * saying otherwise. Do not soften the line ("mostly informational"), and do not
 * relax the check to keep it green: a page that hedges about whether a gate can
 * block you is the failure this file was opened for.
 *
 * `performance-budget.yml`'s line quotes no value (it says "an ordinary path
 * filter" and names no globs), so only the existence of the property is pinned
 * there. The asymmetry is deliberate: `quotes` derives from the YAML, and a
 * claim that quotes nothing has nothing to derive.
 *
 * The small YAML-block helpers below are local copies of the ones in
 * `merge-queue-reporting.test.ts`. Data is never copied in this repository; a
 * twenty-line indentation scanner is not data, and neither file is a library.
 */
const readWorkflow = (file: string): string => fs.readFileSync(path.join(workflowDir, file), 'utf8');

/**
 * A workflow's YAML with whole-line comments removed. Load-bearing, not
 * cosmetic: `live-e2e.yml`'s header discusses `continue-on-error` for eight
 * lines and `changeset-guard.yml`'s explains why `.changeset/**` is filtered the
 * way it is, so a scan that counted comments would report properties from prose.
 */
function withoutComments(yaml: string): string {
  return yaml
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/** A top-level block (`on:`, `jobs:`) up to the next top-level key. */
function topLevelBlock(yaml: string, key: string): string {
  const at = yaml.search(new RegExp(`^${key}:`, 'm'));
  if (at === -1) return '';
  const rest = yaml.slice(at);
  const firstLineEnd = rest.indexOf('\n') + 1;
  if (firstLineEnd === 0) return rest;
  const after = rest.slice(firstLineEnd);
  const next = after.search(/^[A-Za-z]/m);
  return next === -1 ? rest : rest.slice(0, firstLineEnd + next);
}

/** One two-space child of `on:` / `jobs:`, up to the next child at that indent. */
function nestedBlock(block: string, key: string): string {
  const at = block.search(new RegExp(`^ {2}${key}:`, 'm'));
  if (at === -1) return '';
  const rest = block.slice(at);
  const firstLineEnd = rest.indexOf('\n') + 1;
  if (firstLineEnd === 0) return rest;
  const after = rest.slice(firstLineEnd);
  const next = after.search(/^ {2}\S/m);
  return next === -1 ? rest : rest.slice(0, firstLineEnd + next);
}

/** The two-space child keys of an `on:` block — the events the workflow subscribes. */
const triggerKeys = (onBlock: string): string[] =>
  [...onBlock.matchAll(/^ {2}([a-z_][a-z_-]*):/gm)].map((m) => m[1]);

/** `- 'pattern'` entries — the shape a `paths:` list is written in. */
const listEntries = (block: string): string[] =>
  [...block.matchAll(/^\s*-\s*'?([^'\n]+?)'?\s*$/gm)].map((m) => m[1]);

/** A trigger's `types:` list, inline (`types: [closed]`) or block. */
function declaredTypes(trigger: string): string[] {
  const inline = trigger.match(/^\s*types:\s*\[([^\]]*)\]\s*$/m);
  if (inline) {
    return inline[1]
      .split(',')
      .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  const at = trigger.search(/^\s*types:\s*$/m);
  if (at === -1) return [];
  const types: string[] = [];
  for (const line of trigger.slice(at).split('\n').slice(1)) {
    const entry = line.match(/^\s*-\s*['"]?([\w-]+)['"]?\s*$/);
    if (!entry) break;
    types.push(entry[1]);
  }
  return types;
}

/** The `paths:` entries on a workflow's `pull_request` trigger, if it has any. */
function pullRequestPaths(file: string): string[] {
  const trigger = nestedBlock(topLevelBlock(withoutComments(readWorkflow(file)), 'on'), 'pull_request');
  const at = trigger.search(/^ {4}paths:\s*$/m);
  if (at === -1) return [];
  return listEntries(trigger.slice(at));
}

interface StructuralBlock {
  /** The property, named the way a failure message should name it. */
  readonly property: string;
  /** `null` while the page's claim still holds; otherwise what the YAML says now. */
  broken(): string | null;
  /** Values the page's line must still quote, READ FROM the YAML. */
  quotes(): string[];
  /** What the fix is when it breaks — different for each, so it is written per claim. */
  readonly whenItBreaks: string;
}

/**
 * `filename -> the YAML property that makes the bullet's claim about it true`.
 *
 * Not a `NEVER_REQUIRABLE` inventory, and the page does not point at it: each
 * entry is a CHECKER for a claim the page makes in its own words. "Can this
 * context be required?" is still a question about repository settings that no
 * test here can read — what is checked is the narrower, mechanical thing the
 * page actually asserts about each workflow's YAML.
 */
const STRUCTURAL_BLOCKS = new Map<string, StructuralBlock>([
  [
    'changeset-guard.yml',
    {
      property: "an inverse path filter — `paths:` on the `pull_request` trigger",
      broken() {
        const paths = pullRequestPaths('changeset-guard.yml');
        return paths.length > 0
          ? null
          : 'its `pull_request` trigger no longer declares `paths:`, so it now reports on ' +
              'pull requests that touch no changeset — which is what would make it requirable';
      },
      quotes: () => pullRequestPaths('changeset-guard.yml'),
      whenItBreaks:
        'If the filter was removed deliberately, this workflow reports on every pull request ' +
        'and belongs in the paragraph ABOVE the bullet instead — the one about workflows that ' +
        'must subscribe `merge_group` — not in the list of contexts that cannot be required.',
    },
  ],
  [
    'performance-budget.yml',
    {
      property: 'a path filter — `paths:` on the `pull_request` trigger',
      broken() {
        const paths = pullRequestPaths('performance-budget.yml');
        return paths.length > 0
          ? null
          : 'its `pull_request` trigger no longer declares `paths:`, so Bundle Analysis now ' +
              'reports on every pull request and the page is denying a guardrail that exists';
      },
      // The page's line names no globs, so there is nothing derived to hold it to.
      quotes: () => [],
      whenItBreaks:
        'Same as above: a filterless Bundle Analysis is a context that reports everywhere, so ' +
        'it stops being an example of this rule and becomes an example of the previous one.',
    },
  ],
  [
    'live-e2e.yml',
    {
      property: '`continue-on-error: true` on the `live-e2e` job',
      broken() {
        const job = nestedBlock(topLevelBlock(withoutComments(readWorkflow('live-e2e.yml')), 'jobs'), 'live-e2e');
        if (job === '') return 'the `live-e2e` job is gone from live-e2e.yml';
        return /^\s*continue-on-error:\s*true\s*$/m.test(job)
          ? null
          : 'the `live-e2e` job no longer carries `continue-on-error: true`, so a failing spec ' +
              'now fails the run — the lane has been promoted';
      },
      quotes() {
        const job = nestedBlock(topLevelBlock(withoutComments(readWorkflow('live-e2e.yml')), 'jobs'), 'live-e2e');
        return [(job.match(/^\s*(continue-on-error:\s*true)\s*$/m)?.[1] ?? '').replace(/\s+/g, ' ')];
      },
      whenItBreaks:
        'THIS ONE IS SCHEDULED, and its red is the point of this pin rather than an accident: ' +
        "live-e2e.yml's header says `continue-on-error` comes off once the lane has run clean " +
        'long enough to trust. When it does, DELETE the `live-e2e.yml` line from the bullet and ' +
        'this entry from STRUCTURAL_BLOCKS — the lane is requirable now and the page must stop ' +
        'saying it can never be. Do not soften the wording and do not relax this check.',
    },
  ],
  [
    'cross-repo-issue-closer.yml',
    {
      property: 'every trigger restricted to `types: [closed]`, plus the job gate on `merged == true`',
      broken() {
        const yaml = withoutComments(readWorkflow('cross-repo-issue-closer.yml'));
        const on = topLevelBlock(yaml, 'on');
        const keys = triggerKeys(on);
        if (keys.length === 0) return 'no trigger could be parsed out of its `on:` block';

        const preMerge = keys.filter((key) => {
          const types = declaredTypes(nestedBlock(on, key));
          return types.length === 0 || types.some((t) => t !== 'closed');
        });
        if (preMerge.length > 0) {
          return `it now subscribes ${preMerge.map((k) => `\`${k}\``).join(', ')} without ` +
            'restricting to `types: [closed]`, so the workflow can start while a pull request ' +
            'is still open';
        }
        return /if:.*github\.event\.pull_request\.merged\s*==\s*true/.test(yaml)
          ? null
          : 'the job no longer gates on `github.event.pull_request.merged == true`, so a pull ' +
              'request CLOSED WITHOUT MERGING now runs it too — "only after a merge" is the ' +
              'half of this claim that gate carries';
      },
      quotes() {
        const on = topLevelBlock(withoutComments(readWorkflow('cross-repo-issue-closer.yml')), 'on');
        // Both halves the page's line names: which event, and which types of it.
        return [...triggerKeys(on), ...triggerKeys(on).flatMap((key) => declaredTypes(nestedBlock(on, key)))];
      },
      whenItBreaks:
        'A trigger that can fire before the merge makes this a context that reports on open ' +
        'pull requests, which is the opposite of what the line says. Rewrite the line to match ' +
        'the new trigger, or move the workflow out of the bullet.',
    },
  ],
]);

/** The bullet, and the one claim each of its nested lines makes. */
interface StructuralClaim {
  /** The workflow file the line names. */
  readonly workflow: string;
  /** The line itself, joined onto one string — for `quotes` and for messages. */
  readonly line: string;
}

const CLAIM_LEAD_IN = /^- \*\*Some contexts can never be required, structurally\*\*/m;

/**
 * The nested lines under the bullet, one per claim.
 *
 * Parsed rather than matched against a fixed shape so that reflowing the prose
 * is free: the bullet block runs from its lead-in to the next line starting at
 * column 0, and inside it a claim starts at each two-space `- ` and continues
 * through its own continuation lines.
 */
function structuralClaims(): StructuralClaim[] {
  const at = doc.search(CLAIM_LEAD_IN);
  if (at === -1) return [];

  const lines = doc.slice(at).split('\n');
  const block: string[] = [lines[0]];
  for (const line of lines.slice(1)) {
    if (line.trim() !== '' && !line.startsWith(' ')) break;
    block.push(line);
  }

  const claimLines: string[] = [];
  let current: string[] | null = null;
  for (const line of block.slice(1)) {
    if (/^ {2}- /.test(line)) {
      if (current) claimLines.push(current.join(' '));
      current = [line.trim()];
    } else if (line.trim() === '') {
      // A blank line ends the claim. The bullet closes with a paragraph about
      // the pin itself, indented into the same list item and naming
      // `live-e2e.yml` again; swallowed into the last claim it would read as a
      // second claim about whichever workflow it happened to mention.
      if (current) claimLines.push(current.join(' '));
      current = null;
    } else if (current) {
      current.push(line.trim());
    }
  }
  if (current) claimLines.push(current.join(' '));

  return claimLines.flatMap((line) => {
    const named = [
      ...new Set([...line.matchAll(/(?<![\w/.-])([a-z0-9][a-z0-9-]*\.yml)\b/g)].map((m) => m[1])),
    ];
    return named.map((workflow) => ({ workflow, line }));
  });
}

describe('ci-cd-pipeline.md — contexts that can never be required (#4170)', () => {
  it('still carries the bullet, with one workflow named per claim', () => {
    expect(
      doc.search(CLAIM_LEAD_IN),
      'the "Some contexts can never be required, structurally" bullet is gone from ' +
        'content/docs/guide/ci-cd-pipeline.md. Everything below pins that bullet, so removing it ' +
        'turns this whole block vacuously green — the failure mode this page keeps meeting ' +
        '(objectui#3451). If the bullet was deliberately retired, delete these tests with it.',
    ).toBeGreaterThan(-1);

    const claims = structuralClaims();
    expect(
      claims.length,
      'the bullet parsed to no claims at all. Each entry must be a nested `  - ` line naming ' +
        'the workflow file it is about (e.g. "`live-e2e.yml`"); a claim that names no file ' +
        'cannot be pinned to anything, which is what objectui#4170 was filed about.',
    ).toBeGreaterThan(0);
  });

  it('pins every workflow the bullet claims', () => {
    // The page → map direction. A fifth structurally unrequirable workflow may
    // exist unmentioned (this bullet is examples, not a census), but a fifth
    // LINE here is a new claim, and an unpinned claim is exactly the defect.
    const unpinned = structuralClaims()
      .filter((claim) => !STRUCTURAL_BLOCKS.has(claim.workflow))
      .map((claim) => `${claim.workflow} — "${claim.line.slice(0, 80)}…"`);

    expect(
      unpinned,
      `The "can never be required, structurally" bullet makes claims about workflows that ` +
        `nothing in this file checks:\n` +
        unpinned.map((u) => `  - ${u}`).join('\n') +
        `\n\nAdd an entry to STRUCTURAL_BLOCKS naming the YAML property that makes the claim ` +
        `true, and read that property out of the workflow rather than restating it here. A ` +
        `claim on this page that no assertion reads is true only until someone edits the YAML, ` +
        `and nothing then says so (objectui#4170).`,
    ).toEqual([]);
  });

  it.each([...STRUCTURAL_BLOCKS.keys()])('%s — the page still makes the claim this pins', (file) => {
    // The map → page direction, so a claim cannot be dropped while its pin keeps
    // reporting green on a property nobody documents any more.
    expect(
      structuralClaims().map((c) => c.workflow),
      `STRUCTURAL_BLOCKS pins a claim about ${file}, but the "can never be required, ` +
        `structurally" bullet in content/docs/guide/ci-cd-pipeline.md no longer names it.\n\n` +
        `If the line was removed because the property changed, remove this entry too — that is ` +
        `the intended sequence for live-e2e.yml. If the line was removed for space, put it ` +
        `back: each of these teaches a different structural reason a context cannot be ` +
        `required, which is why the bullet was kept whole rather than replaced by a pointer ` +
        `(objectui#4170).`,
    ).toContain(file);
  });

  it.each([...STRUCTURAL_BLOCKS.entries()])('%s — the property the page quotes still holds', (file, block) => {
    const broken = block.broken();
    expect(
      broken,
      `content/docs/guide/ci-cd-pipeline.md says ${file} can never produce a required ` +
        `context, because of ${block.property}. That is no longer what the YAML says: ${broken}.` +
        `\n\n${block.whenItBreaks}`,
    ).toBeNull();
  });

  it.each([...STRUCTURAL_BLOCKS.entries()])('%s — the page quotes the values the YAML declares', (file, block) => {
    // Skipped when the property itself is gone: that failure belongs to the test
    // above, and reporting it twice would say a page is quoting a value wrong
    // when the value no longer exists at all.
    if (block.broken() !== null) return;

    const claim = structuralClaims().find((c) => c.workflow === file);
    if (!claim) return; // reported by the presence test above

    const values = block.quotes();
    const missing = values.filter((value) => value !== '' && !claim.line.includes(value));

    expect(
      missing,
      `The ${file} line of the "can never be required, structurally" bullet no longer quotes ` +
        `what ${file} actually declares:\n` +
        missing.map((v) => `  - ${v}`).join('\n') +
        `\n\nThese are read out of the workflow, so the page is behind the YAML, not the other ` +
        `way round. Update the line to quote the live value. (Quoting the property is what ` +
        `makes the claim checkable at all — objectui#4170 was filed because a bullet quoting ` +
        `four YAML properties was pinned to none of them.)`,
    ).toEqual([]);
  });
});
