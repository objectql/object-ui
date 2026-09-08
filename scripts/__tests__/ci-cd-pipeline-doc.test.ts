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

  /**
   * objectui#4912: `skip-changeset` is the other phantom that deleted page left behind, and
   * unlike `size-check.yml` it did not stay dead. The label *object* was re-minted in this
   * repository's label set — GitHub creates a label the first time one is applied by name, so
   * one API call that applies it is enough — and by 2026-08-25 it sat on seven pull requests,
   * carrying the default grey `ededed` and the empty description that tell an auto-minted
   * label apart from a curated one. It is now actively read as a mechanism: a triage comment
   * on objectui#6243 instructed a PR to carry it, the developer refused on the grounds
   * recorded above, and the refusal was upheld on PR #6260. That is the exact harm #4912
   * predicted, arriving after the card was filed.
   *
   * ⛔ What these two cases can and cannot see, said plainly because the boundary is the whole
   * design of this file: **a label lives in GitHub's data, not in the tree, so nothing here
   * can assert the label object is gone.** Deleting it is an administrative act, and a test
   * that reached for the labels API would put a network call and a credential in a suite that
   * deliberately has neither. The pins below are therefore not restatements of "the label does
   * nothing" — that needs no pin. They hold the two things that *are* ours and that a future
   * commit could change without anyone noticing.
   */
  it('never wires the phantom `skip-changeset` label into a workflow or a gate', () => {
    // Option B of #4912 — give the changeset gates a labelled skip path — was declined by
    // #3724 and again by the #4912 ruling: the presence gate has no bypass by design, and its
    // exemption is an empty-frontmatter changeset, which lives in the repo where the next
    // reader finds it rather than in a label that vanishes from history. So a read of this
    // name appearing under `.github/` or `scripts/` is that declined option landing without a
    // decision. The name IS wired in the `objectstack` sibling (lint.yml, pr-automation.yml,
    // check-empty-changeset.mjs), which is how it reaches agents who then look for it here —
    // copying that wiring across is precisely what this catches.
    const selfPath = path.resolve(fileURLToPath(import.meta.url));
    const offenders: string[] = [];

    function scan(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.turbo') continue;
          scan(full);
        } else if (entry.isFile() && path.resolve(full) !== selfPath) {
          // This file is the one legitimate mention: it records the history above.
          if (fs.readFileSync(full, 'utf8').includes('skip-changeset')) {
            offenders.push(path.relative(repoRoot, full));
          }
        }
      }
    }

    for (const root of ['.github', 'scripts']) scan(path.join(repoRoot, root));

    expect(
      offenders.sort(),
      `these files under .github/ or scripts/ mention \`skip-changeset\`:\n` +
        offenders.map((f) => `  - ${f}`).join('\n') +
        `\n\nNo gate in this repository reads that label and none is supposed to. If this is a ` +
        `workflow or script that now honours it, that is objectui#4912 option B — a labelled ` +
        `bypass on a changeset gate that deliberately has none — and it was declined twice ` +
        `(#3724, and the #4912 ruling). Land the decision to reverse those before the code. ` +
        `To declare that a PR publishes nothing, add a changeset with empty frontmatter; that ` +
        `is the mechanism, and it is the one content/docs/guide/ci-cd-pipeline.md documents.`,
    ).toEqual([]);
  });

  it('keeps the page denying `skip-changeset` rather than describing it', () => {
    // `ci-cd-pipeline.md` is where a contributor looks up "how do I declare this PR publishes
    // nothing", so the page is the surface that decides whether the next reader believes the
    // label. Unlike the `size-check.yml` pin, absence is the wrong assertion here: the page
    // has to keep NAMING the label in order to deny it, or the phantom is simply undocumented
    // again. So the denial itself is what gets pinned.
    //
    // Blockquote markers are stripped before matching — the whole passage is a `>` block, and
    // its sentences wrap across lines, so a raw substring search would silently never match
    // and this pin would be vacuously green.
    const prose = doc.replace(/^[ \t]*>[ \t]?/gm, '').replace(/\s+/g, ' ');

    expect(
      prose,
      'content/docs/guide/ci-cd-pipeline.md must keep stating that nothing reads the ' +
        '`skip-changeset` label. The label object exists in this repository (auto-minted by ' +
        'being applied, objectui#4912) and agents are being told to use it, so a page that ' +
        'stops denying it leaves the label as the most authoritative-looking answer in reach.',
    ).toContain('no gate in this repository reads it');

    expect(
      prose,
      'the page must keep telling the reader what to do INSTEAD of the label — a denial with ' +
        'no alternative sends them back to the label. The real exemption is a changeset with ' +
        'empty frontmatter.',
    ).toContain('declare an empty changeset instead');

    // The 2026-08-08 labels-API reading this note used to carry ("the label still does not
    // exist") had expired by the time #4912 was worked: the object had been re-minted. A
    // point-in-time API reading is not a fact this repository can keep true, and restating one
    // is how the page came to assert something false about the very phantom it documents.
    expect(
      prose,
      'do not put a point-in-time labels-API reading back on this page. Nothing in the tree ' +
        'can keep it true, and the last one was false within weeks (objectui#4912).',
    ).not.toContain('checked against the labels API');
  });
});

/**
 * objectui#3724: the `pnpm-lock.yaml` merge driver is repository configuration
 * (`.gitattributes`) that only works where something defines the driver, so "which
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
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * objectui#6436 (ruled 2026-08-27) removed the LAST workflow that configured the driver.
 * `changeset-release.yml` performs no local merge, so its config could never fire; the
 * repository half (`.gitattributes`) and the contributor half (`CONTRIBUTING.md`) were
 * measured live and were kept. The mechanism is now contributor-facing with zero CI
 * consumers.
 *
 * ⭐ THE ANTI-VACUITY WEIGHT MOVED — IT DID NOT VANISH. This block used to open with
 * `expect(configuring.length).toBeGreaterThan(0)`, and that single line was doing two
 * different jobs:
 *
 *   1. proving the grep had matched something, so "no workflow is missing a row" was a
 *      reading rather than an artifact of a scan that read nothing; and
 *   2. proving the mechanism still had a consumer at all — a zero-match grep once let both
 *      directions of this pin go vacuously green, which is why the guard was added.
 *
 * Zero is now the CORRECT answer to that count, so the guard cannot stay as `> 0`. ⛔ But
 * flipping it to `=== 0` and stopping there would delete both jobs and re-install the exact
 * defect this block exists to catch. Each job therefore has a new and explicit owner:
 *
 *   1. → `the workflow scan is live` below. A zero-hit taken with no control is not a
 *      reading. The scan now takes a control term that MUST hit the same population —
 *      `git config`, which `changelog.yml` genuinely runs. If the directory, the read or
 *      the regex ever breaks, the control collapses to zero as well and that test fails,
 *      instead of a broken scan silently agreeing with the expected zero.
 *   2. → `keeps the .gitattributes half of the mechanism true` and `keeps CONTRIBUTING.md's
 *      contributor path — the mechanism's only remaining consumer` below. That is where the
 *      real weight landed: those two files ARE the mechanism now. If either goes, the driver
 *      genuinely has no consumers left and this section should be deleted with it — which is
 *      exactly what the old `> 0` failure message demanded, re-pointed at the consumer that
 *      is actually live.
 *
 * The both-directions pin itself stays, and the PHANTOM direction is now the load-bearing
 * half of it: with zero configuring workflows, `phantom` is precisely "workflows this page
 * still names", so a row that comes back reddens on its own. The `missing` direction is the
 * tripwire for a CI consumer returning.
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

  /**
   * The control population: workflows containing a `git config` of any kind. Deliberately a
   * NEAR MISS of the driver key — both are `git config` lines in `.github/workflows/`, read
   * out of the same directory by the same reader — so a scan that can see one can see the
   * other. `changelog.yml` really does run `git config --local user.email`, so zero here
   * means the scan is broken, not that the repository changed.
   */
  function workflowsMatchingControl(): string[] {
    return fs
      .readdirSync(workflowDir)
      .filter((f) => f.endsWith('.yml'))
      .filter((f) => /git config/.test(fs.readFileSync(path.join(workflowDir, f), 'utf8')))
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

  it('the workflow scan is live — zero configuring workflows is a reading, not a broken grep', () => {
    // This test is the replacement for the retired `configuring.length > 0` guard, in its
    // first job only: proving the scan works. It says nothing about whether the driver has a
    // consumer — that question moved to the two `keeps …` tests below.
    const files = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml'));
    expect(
      files.length,
      `no .yml files were read out of ${workflowDir} at all, so every count this block takes ` +
        'is zero for a reason that has nothing to do with the merge driver',
    ).toBeGreaterThan(0);

    expect(
      workflowsMatchingControl(),
      'the control term `git config` matched NO workflow, but `changelog.yml` runs ' +
        '`git config --local user.email`. The directory listing, the file reads or the regex ' +
        'is broken — and until it is fixed, "zero workflows configure the merge driver" is ' +
        'not a measurement. A zero-hit taken with no control is not a reading (objectui#6436).',
    ).not.toEqual([]);
  });

  it('lists exactly the workflows that configure merge.pnpm-merge — in both directions', () => {
    const configuring = workflowsConfiguringDriver();
    const named = workflowsNamedInDoc();
    const missing = configuring.filter((f) => !named.includes(f));
    const phantom = named.filter((f) => !configuring.includes(f));

    expect(
      missing,
      `these workflows configure the pnpm-lock.yaml merge driver but have no row in the ` +
        `"Lockfile Merge Driver" table of content/docs/guide/ci-cd-pipeline.md:\n` +
        missing.map((f) => `  - ${f}`).join('\n') +
        `\n\nSince objectui#6436 the expected count is ZERO, so this is a CI consumer coming ` +
        `back. Either it genuinely merges on the runner — in which case add its row, saying ` +
        `why it merges — or it is configuring a driver it can never use, which is the dead ` +
        `half that card removed. NOTE the scan greps workflow text, so merely NAMING the ` +
        `config key in a comment trips this; that is the safe direction, but spell the key ` +
        `as the \`merge=pnpm-merge\` attribute in prose to avoid it.`,
    ).toEqual([]);

    expect(
      phantom,
      `the "Lockfile Merge Driver" table names workflows that do NOT configure ` +
        `\`merge.pnpm-merge\`:\n` +
        phantom.map((f) => `  - ${f}`).join('\n') +
        `\n\n⭐ This direction is load-bearing now. With zero configuring workflows, it says ` +
        `exactly "the page names no workflow", so a row that comes back — stale, or copied ` +
        `from the pre-objectui#6436 page — fails here on its own rather than riding along ` +
        `with a count that happened to be non-zero. Either the workflow really configures ` +
        `the driver, or the row goes.`,
    ).toEqual([]);
  });

  it('keeps the .gitattributes half of the mechanism true', () => {
    // ⭐ Load-bearing since objectui#6436: with no workflow configuring the driver, the
    // attribute is the mechanism's only presence IN this repository. It used to be checked
    // because "the workflows would be configuring it for nothing"; there are no workflows to
    // configure it now, so this assertion is no longer a corollary of anything else.
    const attributes = fs.readFileSync(path.join(repoRoot, '.gitattributes'), 'utf8');
    expect(
      attributes,
      '.gitattributes no longer routes pnpm-lock.yaml through the `pnpm-merge` driver. Since ' +
        'objectui#6436 removed the last workflow that configured it, this line is the only ' +
        'thing in the repository that asks for the driver at all — without it the mechanism ' +
        'is gone, contributors who configured the driver silently stop getting it, and the ' +
        '"Lockfile Merge Driver" section of content/docs/guide/ci-cd-pipeline.md describes ' +
        'nothing. Removing it is a decision, not a cleanup: measured, a conflicting merge ' +
        'without this attribute leaves conflict markers INSIDE pnpm-lock.yaml.',
    ).toMatch(/^pnpm-lock\.yaml\s+merge=pnpm-merge\s*$/m);
  });

  it("keeps CONTRIBUTING.md's contributor path — the mechanism's only remaining consumer", () => {
    // ⭐ This is where the retired `configuring.length > 0` guard's SECOND job landed. That
    // guard asked "does anything still consume this driver?" and answered with the workflow
    // count. The workflow count is zero by ruling now, so the question is answered here, at
    // the consumer that was measured live: CONTRIBUTING.md defines the driver locally and
    // then runs a merge that gives it an occasion to fire.
    const contributing = fs.readFileSync(path.join(repoRoot, 'CONTRIBUTING.md'), 'utf8');

    expect(
      contributing,
      'CONTRIBUTING.md no longer tells contributors to define `merge.pnpm-merge.driver`. An ' +
        'attribute names a driver but does not define one, and since objectui#6436 no ' +
        'workflow defines it either — so if this instruction is gone, `.gitattributes:5` ' +
        'selects a driver that exists nowhere and silently falls back to a text merge. At ' +
        'that point the mechanism has zero consumers and the "Lockfile Merge Driver" section ' +
        'of content/docs/guide/ci-cd-pipeline.md, plus the .gitattributes line, should be ' +
        'deleted with it — which is what the retired `configuring.length > 0` guard demanded, ' +
        'pointed at the consumer that is actually live.',
    ).toMatch(/git config\s+merge\.pnpm-merge\.driver/);

    expect(
      contributing,
      "CONTRIBUTING.md still defines the driver but no longer tells contributors to merge " +
        'upstream, so nothing in the documented workflow gives the driver an occasion to ' +
        'fire. A configured driver with no merge is the same dead shape objectui#6436 removed ' +
        'from changeset-release.yml — if the contributor path really no longer merges, the ' +
        'driver instruction above it is dead too and this whole mechanism should be re-judged.',
    ).toMatch(/git merge\s+upstream\/main/);
  });
});

/**
 * ── What a job RUNS, paired against the prose that documents it ──────────────
 *
 * objectui#3653 introduced this pairing for `ci.yml`'s job table. objectui#8015
 * lifted it out of that table, because the rule it encodes was never about a
 * table: *every first-party command a job runs must be named where this page
 * documents that job, and that documentation may not credit it with one the job
 * does not run.*
 *
 * Both directions are asserted, because the documentation is a claim in both: a
 * command the job runs and the page omits is a contributor who cannot learn from
 * this page that a gate exists; a command the page names and the job does not run
 * is the objectui#3451 shape one level down — a page advertising a guardrail that
 * is not there.
 *
 * The two sources differ only in WHERE the prose lives — one table cell per job
 * for `ci.yml`, one whole `##` section for `lint.yml`'s single job — so that is
 * the only thing a caller supplies. The rule itself is written once, here.
 *
 * What counts as a command is deliberately narrower than "every step", and the
 * boundary is *derived* rather than hand-listed: a step counts when it names
 * something this repository owns — a `scripts/*.mjs` file, a script in the root
 * `package.json`, or a `turbo run` task. Environment setup drops out on its own
 * because it names none of those (`corepack enable`, `pnpm --version`, `pnpm
 * install --frozen-lockfile`, `pnpm exec playwright install`, `pnpm --filter …
 * exec vite build`, `pnpm --filter '@object-ui/cli...' build`), which keeps the
 * documentation a summary of the gates rather than a transcript of the YAML.
 *
 * The hole that leaves, stated so nobody mistakes it for coverage: a gate written
 * as an inline shell block names no first-party command and is invisible here.
 * Gates in this repository land as a root `package.json` script or a
 * `scripts/*.mjs` file — both covered — and that is the only reason the narrower
 * rule is enough.
 *
 * Steps are read from `run:` values only, never from the surrounding YAML. Both
 * workflows carry comments that name their own gates — `ci.yml`'s `type-check`
 * block mentions `pnpm type-check`, `turbo run type-check` and `pnpm
 * check:i18n-drift`, and `lint.yml`'s step comments name every script it runs
 * plus two `pnpm check:*` aliases it deliberately does NOT use — so a scan of the
 * raw block would take all of them for steps and this pin would then be
 * describing its own comments.
 *
 * A `--self-test` invocation and the real one collapse to one entry: the rule is
 * about which gate the page must name, not how many times the YAML types it.
 */
const rootScripts = new Set(
  Object.keys(
    (
      JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts,
  ),
);

/**
 * The job keys a workflow defines, in file order.
 *
 * Scoped to the `jobs:` mapping, because top-level `on:` has two-space children
 * of its own (`push:`, `pull_request:`) that a whole-file scan would read as
 * jobs. Inside `jobs:` the only two-space lines are the job keys themselves:
 * job-level keys sit at four, step bodies deeper still, and every block scalar
 * (`run: |`) is indented past its key, so nothing else can reach column 2.
 */
function jobKeys(yaml: string, workflowFile: string): string[] {
  const start = yaml.search(/^jobs:[ \t]*$/m);
  expect(start, `${workflowFile} must still have a top-level \`jobs:\` mapping`).toBeGreaterThan(-1);
  const body = yaml.slice(start + 'jobs:'.length);
  // `jobs:` is the last top-level key in both workflows today; stop at the next
  // one regardless.
  const end = body.search(/^[A-Za-z]/m);
  const scoped = end === -1 ? body : body.slice(0, end);
  return [...scoped.matchAll(/^ {2}([a-z0-9][a-z0-9-]*):[ \t]*$/gm)].map((m) => m[1]);
}

/** One job's YAML block, from its key line up to the next thing at that indent. */
function jobBlock(yaml: string, key: string, workflowFile: string): string {
  const body = yaml.slice(yaml.search(/^jobs:[ \t]*$/m));
  const at = body.search(new RegExp(`^ {2}${key}:[ \\t]*$`, 'm'));
  expect(at, `${workflowFile} must still define a \`${key}:\` job`).toBeGreaterThan(-1);
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
 * bodies on one side and to the prose documenting it on the other, so the two
 * sides are compared by the same rule rather than by two spellings of it.
 */
function firstPartyCommands(text: string): Set<string> {
  const found = new Set<string>();
  // A gate that lives in this repo's `scripts/` tree. The `node ` prefix is not
  // required: the workflows write `node scripts/x.mjs`, the page writes the path.
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

/** One unit of the pairing: a job's steps, and the prose this page documents it in. */
type CommandParity = {
  /** How a failure names the unit — a `ci.yml` job key, or a workflow section. */
  label: string;
  /** First-party commands the job's `run:` steps actually invoke. */
  ran: Set<string>;
  /** First-party commands the page credits it with. */
  named: Set<string>;
};

/** Pair one job's `run:` steps against the piece of the page that documents it. */
function commandParity(
  workflowFile: string,
  jobKey: string,
  documentation: string,
  label: string = jobKey,
): CommandParity {
  const yaml = fs.readFileSync(path.join(workflowDir, workflowFile), 'utf8');
  return {
    label,
    ran: firstPartyCommands(runSteps(jobBlock(yaml, jobKey, workflowFile)).join('\n')),
    named: firstPartyCommands(documentation),
  };
}

/** Commands a job runs that the prose documenting it does not name. */
function undocumentedCommands(units: CommandParity[]): string[] {
  return units.flatMap((u) => [...u.ran].filter((c) => !u.named.has(c)).map((c) => `${u.label}: ${c}`));
}

/** Commands the prose names that the job it documents does not run. */
function phantomCommands(units: CommandParity[]): string[] {
  return units.flatMap((u) => [...u.named].filter((c) => !u.ran.has(c)).map((c) => `${u.label}: ${c}`));
}

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

  /** Job keys from `ci.yml`, in file order — see `jobKeys` for how the scan is scoped. */
  function ciJobKeys(): string[] {
    return jobKeys(ciWorkflow, 'ci.yml');
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
   * The rule, both of its directions, and what counts as a command all live at
   * module scope now (objectui#8015) — `lint.yml`'s section had the identical
   * drift and is pinned by the same code at the bottom of this file. Only the
   * `ci.yml`-specific part is here: the documentation for each job is that job's
   * `What it runs` table cell.
   *
   * Whether a given step still EXISTS in `ci.yml` is pinned where that step was
   * introduced — `check-i18n-call-site-keys.test.ts` and
   * `check-i18n-en-drift.test.ts` each hold their own, as do
   * `scripts-type-check.test.ts` and `vitest-setup-type-check.test.ts`. This block
   * does not repeat those assertions; it pins the *pairing* between the YAML and
   * this page, which is the part nothing owned.
   */
  describe('what each job runs', () => {
    /** `job key -> commands it actually runs`, and the same from the page's table. */
    function commandsByJob(): CommandParity[] {
      return docJobRows().map((row) => commandParity('ci.yml', row.key, row.runs));
    }

    it('names every first-party command the job actually runs', () => {
      const jobs = commandsByJob();

      // A parser that matched nothing would make both directions vacuously green —
      // the exact failure the `dev-server` job demonstrated one level up.
      const ran = jobs.reduce((n, j) => n + j.ran.size, 0);
      expect(ran, 'the ci.yml `run:` parse found implausibly few first-party commands').toBeGreaterThan(8);

      const missing = undocumentedCommands(jobs);

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

      const phantom = phantomCommands(jobs);

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
 * objectui#8015: the same pairing, applied to the section this page's other pins
 * could not reach.
 *
 * `lint.yml` is a REQUIRED context on `pull_request` and `merge_group` alike, and
 * every gate in it blocks a merge. The only thing holding its section here was the
 * workflow-inventory pin at the top of the file, which requires a `##` heading
 * naming the file and says nothing whatsoever about the heading's contents — so the
 * step list underneath it could drift indefinitely and every test on this page
 * stayed green. It had: measured on `4b4d35a7d`, the section named three of the
 * seven first-party commands the `lint` job runs, and the four it omitted —
 * `check-entry-guard.mjs`, `check-upstream-port-parity.mjs`,
 * `check-bash32-floor.mjs` and `check-cross-repo-closer-outcome.mjs` — are all
 * blocking gates. Three of them had been missing since they landed; the fourth
 * (`check-bash32-floor.mjs`, PR #8016) arrived while the card was open, which is
 * the drift rate this pin exists to absorb.
 *
 * The neighbouring gap was demonstrated rather than argued: on the card before this
 * one, a sentence in this same document was replaced with an obvious falsehood and
 * the eleven test files that read the page were re-run — 404/404 green, plus
 * `check-doc-links` at exit 0. Nothing looked at this page's contents beyond the
 * `ci.yml` table.
 *
 * The prose SHAPE differs from `ci.yml`'s (bullets and paragraphs, not a table
 * cell), which is exactly why the rule was hoisted to module scope instead of
 * copied: `commandParity` takes whatever text documents a job, so the unit here is
 * the whole `## Lint (lint.yml)` section against the single `lint` job. Reading the
 * whole section rather than only the bullet list is deliberate — the paragraphs
 * below the bullets discuss `pnpm lint` and `pnpm check` too, and a rule that read
 * only the list would call those phantoms.
 */
describe('ci-cd-pipeline.md — lint.yml step list', () => {
  const lintWorkflow = fs.readFileSync(path.join(workflowDir, 'lint.yml'), 'utf8');
  const LINT_HEADING = '## Lint (`lint.yml`)';

  /** The `## Lint (lint.yml)` section, up to the next `##` heading. */
  function lintSection(): string {
    const start = doc.indexOf(LINT_HEADING);
    expect(start, `the page must still have a "${LINT_HEADING}" section`).toBeGreaterThan(-1);
    const rest = doc.slice(start + 2);
    const next = rest.search(/^## /m);
    return next === -1 ? rest : rest.slice(0, next);
  }

  function lintUnits(): CommandParity[] {
    return [commandParity('lint.yml', 'lint', lintSection(), 'lint.yml `lint`')];
  }

  it('describes the only job lint.yml defines', () => {
    // The unit below covers the `lint` job and nothing else. A second job added to
    // this workflow would run gates that no assertion here reads and no section
    // here documents, so it has to come through this test first.
    expect(
      jobKeys(lintWorkflow, 'lint.yml'),
      'lint.yml no longer defines exactly one `lint` job. The section pinned below ' +
        'documents that job alone, so a new job needs its own documentation and its own ' +
        'unit in `lintUnits()` — otherwise its gates are unpinned and undocumented at once.',
    ).toEqual(['lint']);
  });

  it('names every first-party command the lint job actually runs', () => {
    const units = lintUnits();

    // A parser that matched nothing would make both directions vacuously green.
    // The floor is a control on the matcher, not a ratchet on the gate count.
    const ran = units.reduce((n, u) => n + u.ran.size, 0);
    expect(ran, 'the lint.yml `run:` parse found implausibly few first-party commands').toBeGreaterThan(4);

    const missing = undocumentedCommands(units);

    expect(
      missing,
      `.github/workflows/lint.yml runs commands that the "${LINT_HEADING}" section of ` +
        `content/docs/guide/ci-cd-pipeline.md does not name:\n` +
        missing.map((m) => `  - ${m}`).join('\n') +
        `\n\nAdd each one to that section, in the order lint.yml runs it. Every gate in this ` +
        `job blocks a merge on a required check, so one nobody wrote down is a build failure ` +
        `contributors meet with no way to learn from this page what produced it — objectui#8015.`,
    ).toEqual([]);
  });

  it('credits the lint job with no first-party command it does not run', () => {
    const units = lintUnits();

    const named = units.reduce((n, u) => n + u.named.size, 0);
    expect(named, 'the Lint section parse found implausibly few commands').toBeGreaterThan(4);

    const phantom = phantomCommands(units);

    expect(
      phantom,
      `the "${LINT_HEADING}" section of content/docs/guide/ci-cd-pipeline.md names commands ` +
        `that .github/workflows/lint.yml does not run:\n` +
        phantom.map((p) => `  - ${p}`).join('\n') +
        `\n\nEither the step was removed and the prose is stale, or the command runs in a ` +
        `different workflow and belongs in that section. This section reads as the \`lint\` ` +
        `job's gate list, so naming a command inside it makes the page claim a guardrail — ` +
        `the objectui#3451 mistake, in prose instead of a table.`,
    ).toEqual([]);
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

/**
 * objectui#7689 — the page's live-e2e section states a pin rule that nothing read.
 *
 * `content/docs/guide/ci-cd-pipeline.md` says the backend pins "must match the
 * `@objectstack/spec` version in `pnpm-lock.yaml` — bump both in the same PR, or the
 * run proves nothing", and `e2e/live/ci/backend.env` repeats the same MUST in its own
 * header. Both were true statements about what a reader should do and false statements
 * about what CI checked: `git grep -l backend.env scripts/ .github/ e2e/` reached only
 * the workflow that caches on its hash and the script that sources it. Nothing compared
 * the two numbers, so the pin sat at `17.0.0-rc.2` against a lockfile resolving `17.2.0`
 * for two minor versions while `Live E2E (informational)` reported green.
 *
 * That is the shape this file exists for, and the worst instance of it yet. The size
 * regime in #3197 advertised a guardrail CI did not have; here the lane's OWN contract
 * says a mismatched pair "proves nothing", so every green run it produced over those two
 * minors was a check whose documentation declared it meaningless. A stale constant is a
 * chore; a green light its own spec disclaims is worse than a red one.
 *
 * ## What this asserts, and the one half it deliberately does not
 *
 * ASSERTED: `OBJECTSTACK_VERSION` equals the `@objectstack/spec` version the lockfile
 * resolves, read two independent ways (the resolution keys under `packages:`/`snapshots:`
 * and the `version:` line of every workspace importer) whose union must hold exactly one
 * value. Two readings rather than one because "the resolved version" is only a
 * well-formed question while the tree agrees with itself: a lockfile carrying two
 * `@objectstack/spec` versions has no single number for the pin to match, and naming that
 * is more useful than picking one of them and comparing to it.
 *
 * ALSO ASSERTED, since objectui#7964: that the file's other pin is GONE. `OBJECTSTACK_REF`
 * used to be a second, hand-moved sha here, carrying a MUST — "always the commit the
 * `@objectstack/cli@${OBJECTSTACK_VERSION}` release tag points at" — that nothing could
 * check, because reading that tag needs the objectstack repository over the network and
 * this unit lane has not got it. That was a true statement about what a reader should do
 * and, again, an unenforceable one: the same shape #7689 is about, one file down.
 *
 * The fix was not another check. It was to delete the second value: `start-backend.sh`
 * now RESOLVES the commit at boot from the release tag named by `OBJECTSTACK_VERSION`
 * (`git ls-remote --tags`, peeled `^{}` sha preferred) and refuses to start when the tag
 * does not resolve to a 40-character sha. The lane that consumes the commit is the lane
 * that can reach the repository, and it always could. So the pair the header describes
 * cannot disagree by construction, and there is nothing left here to hand-move.
 *
 * What this file pins about that half is therefore the ABSENCE and the DERIVATION, by
 * content: no `OBJECTSTACK_REF=` key in backend.env, and the resolution + refusal still in
 * start-backend.sh. Either one alone would be vacuous — an absent key is fine only while
 * something derives the value, and a derivation is only load-bearing while no pin
 * overrides it.
 *
 * ## Anti-vacuity
 *
 * Each half is floored. The doc sentence is required to still be on the page, because
 * this whole block is the enforcement of that sentence and a page that stopped making the
 * claim should retire the pin deliberately rather than leave it running on prose nobody
 * reads. The lockfile scan is required to have matched something, so a lockfile format
 * change turns this red instead of green-with-an-empty-set — the failure mode #3451 keeps
 * teaching this page.
 */
const backendEnvPath = path.join(repoRoot, 'e2e/live/ci/backend.env');
const startBackendPath = path.join(repoRoot, 'e2e/live/ci/start-backend.sh');
const lockfilePath = path.join(repoRoot, 'pnpm-lock.yaml');
const backendEnv = fs.readFileSync(backendEnvPath, 'utf8');
const startBackend = fs.readFileSync(startBackendPath, 'utf8');

/** The page's statement of the rule, whitespace-normalised because the source wraps it. */
const PIN_RULE_SENTENCE =
  /Backend pins live in `e2e\/live\/ci\/backend\.env` and must match the `@objectstack\/spec` version in `pnpm-lock\.yaml`/;

const readEnvKey = (key: string): string | null =>
  backendEnv.match(new RegExp('^' + key + '=(.+)$', 'm'))?.[1].trim() ?? null;

/**
 * Every `@objectstack/spec` version the lockfile resolves, from both spellings.
 *
 * The resolution keys carry the peer-suffixed identity (`17.2.0(ai@…)`) under
 * `snapshots:` and the bare one under `packages:`; the importer entries carry the same
 * value on their `version:` line. Each is truncated at the first `(` so the three
 * spellings collapse to one comparable number.
 */
function resolvedSpecVersions(): string[] {
  const lock = fs.readFileSync(lockfilePath, 'utf8');
  const found = new Set<string>();

  for (const m of lock.matchAll(/^\s{0,4}'?@objectstack\/spec@([0-9][^'(\s:]*)/gm)) {
    found.add(m[1]);
  }
  for (const m of lock.matchAll(
    /^\s*'@objectstack\/spec':\s*\n\s*specifier:.*\n\s*version:\s*([0-9][^\s(]*)/gm,
  )) {
    found.add(m[1]);
  }
  return [...found].sort();
}

describe('ci-cd-pipeline.md — live-e2e backend pin (#7689)', () => {
  it('still carries the sentence this block enforces', () => {
    expect(
      PIN_RULE_SENTENCE.test(doc.replace(/\s+/g, ' ')),
      'content/docs/guide/ci-cd-pipeline.md no longer states that the backend pins in ' +
        '`e2e/live/ci/backend.env` must match the `@objectstack/spec` version in ' +
        '`pnpm-lock.yaml`. Everything below is the enforcement of that sentence, so losing it ' +
        'would leave these assertions running on a rule the page stopped teaching. If the rule ' +
        'was retired, retire this describe with it; if the sentence merely moved or was ' +
        'reworded, update PIN_RULE_SENTENCE.',
    ).toBe(true);
  });

  it('resolves exactly one @objectstack/spec version to compare against', () => {
    const versions = resolvedSpecVersions();

    expect(
      versions.length,
      `Nothing in ${path.relative(repoRoot, lockfilePath)} matched either reading of an ` +
        '`@objectstack/spec` resolution. That is a green this test must never report: the ' +
        'comparison below would run against an empty set and pass no matter what ' +
        '`e2e/live/ci/backend.env` says. Either the dependency is genuinely gone — in which ' +
        'case the live lane has nothing to pin and this block should go — or the lockfile ' +
        'format moved and the two regexes above need updating.',
    ).toBeGreaterThan(0);

    expect(
      versions,
      'The lockfile resolves more than one `@objectstack/spec` version:\n' +
        versions.map((v) => `  - ${v}`).join('\n') +
        '\n\nThere is then no single "the resolved version" for `OBJECTSTACK_VERSION` to ' +
        'match, so the live lane cannot be a matched pair against any of them. Resolve the ' +
        'workspace onto one version first; this test deliberately names the split rather than ' +
        'picking a winner.',
    ).toHaveLength(1);
  });

  it('pins OBJECTSTACK_VERSION to the version the lockfile resolves', () => {
    const versions = resolvedSpecVersions();
    if (versions.length !== 1) return; // reported by the test above

    const pinned = readEnvKey('OBJECTSTACK_VERSION');
    expect(
      pinned,
      `${path.relative(repoRoot, backendEnvPath)} declares no OBJECTSTACK_VERSION. ` +
        '`start-backend.sh` sources this file and installs published `@objectstack/*` at that ' +
        'value, so an absent key is not a lighter failure than a wrong one.',
    ).not.toBeNull();

    expect(
      pinned,
      `The live-e2e lane is pinned to an unmatched pair:\n` +
        `  ${path.relative(repoRoot, backendEnvPath)}  OBJECTSTACK_VERSION=${pinned}\n` +
        `  ${path.relative(repoRoot, lockfilePath)}          @objectstack/spec  ${versions[0]}\n\n` +
        'content/docs/guide/ci-cd-pipeline.md states the rule: "Backend pins live in ' +
        '`e2e/live/ci/backend.env` and must match the `@objectstack/spec` version in ' +
        '`pnpm-lock.yaml` — bump both in the same PR, or the run proves nothing." The header ' +
        'of backend.env says the same thing in its own words. A run of `Live E2E ' +
        '(informational)` against this pair therefore carries no information, green or red — ' +
        'it exercises one published backend against a console built for another.\n\n' +
        'Fix it in whichever direction the change came from: a lockfile bump must move ' +
        'OBJECTSTACK_VERSION, and a pin bump must be a lockfile bump. That is the only ' +
        'value to move — the showcase-app commit follows it on its own, because ' +
        'start-backend.sh resolves the `@objectstack/cli@$OBJECTSTACK_VERSION` release tag ' +
        'at boot (objectui#7964). ' +
        '⛔ Do not resolve this by reverting the pin to whatever was green last: a failing ' +
        'matched pair carries strictly more information than a green mismatched one ' +
        '(objectui#7689).',
    ).toBe(versions[0]);
  });

  // Retired here, deliberately, with objectui#7964: `keeps OBJECTSTACK_REF in the one shape
  // start-backend.sh can fetch`. It asserted that a hand-moved sha was 40 hex characters —
  // the only half of that pin a lane with no network could read. There is no hand-moved sha
  // any more, so the shape pin has nothing to hold; the three below hold what replaced it.
  // ⛔ Do not restore it by re-adding the key: a pin that overrides the derivation brings
  // back the exact pair that could silently disagree.

  it('declares no OBJECTSTACK_REF — the commit is derived, not pinned', () => {
    expect(
      readEnvKey('OBJECTSTACK_REF'),
      `${path.relative(repoRoot, backendEnvPath)} declares an OBJECTSTACK_REF again. That ` +
        'key was retired by objectui#7964: it was a second, hand-moved sha whose stated MUST ' +
        '— always the commit the `@objectstack/cli@$OBJECTSTACK_VERSION` release tag points ' +
        'at — nothing could check, and a pair that CAN disagree eventually does (it is the ' +
        'same failure #7689 found in the version half). start-backend.sh resolves the commit ' +
        'from the tag at boot instead, so the app source and the published packages come ' +
        'from one release by construction.\n\n' +
        'If the derivation genuinely cannot serve some case, that is a decision to take on ' +
        'the record — reintroducing the pin here restores the drift, and this lane is ' +
        '`informational`, so nothing else would notice.',
    ).toBeNull();
  });

  it('derives the commit from the @objectstack/cli release tag in start-backend.sh', () => {
    const rel = path.relative(repoRoot, startBackendPath);

    // Pinned by CONTENT, not by behaviour: this lane cannot run the script (it needs the
    // network the whole #7964 argument turns on). What it can read is that the resolution
    // is still there and still keyed off OBJECTSTACK_VERSION — the two things whose loss
    // would leave the absent key above vacuous.
    expect(
      /git ls-remote --tags/.test(startBackend),
      `${rel} no longer resolves the release tag with \`git ls-remote --tags\`. The test ` +
        'above requires backend.env to carry NO OBJECTSTACK_REF, on the understanding that ' +
        'this script derives it. Without a resolution here, that absence is not a design — ' +
        'it is a missing value, and the lane fetches nothing.',
    ).toBe(true);

    expect(
      /refs\/tags\/\$OBJECTSTACK_TAG/.test(startBackend) &&
        /OBJECTSTACK_TAG="@objectstack\/cli@\$OBJECTSTACK_VERSION"/.test(startBackend),
      `${rel} no longer builds the tag it resolves from OBJECTSTACK_VERSION as ` +
        '`@objectstack/cli@$OBJECTSTACK_VERSION`. That coupling is the entire guarantee: it ' +
        'is what makes the checked-out app source and the installed published packages the ' +
        'same release. A tag derived from anything else — a branch, a literal, another ' +
        "package's tag — reopens the gap objectui#7964 closed.",
    ).toBe(true);

    // The refusal is half the ruling: `git ls-remote` prints nothing and exits 0 for a tag
    // that does not exist, so without a shape check the script would carry an empty ref into
    // `git fetch --depth 1 origin ""` and fail 300 seconds later, in a log nobody reads.
    expect(
      /\[\[ ! "\$OBJECTSTACK_REF" =~ \^\[0-9a-f\]\{40\}\$ \]\]/.test(startBackend),
      `${rel} no longer refuses to start when the release tag fails to resolve to a ` +
        '40-character sha. `git ls-remote` reports a missing tag as empty output and exit 0, ' +
        'so this check is the only thing standing between a typo in OBJECTSTACK_VERSION and ' +
        'a 300-second timeout with no explanation. Keep a refusal that names the tag.',
    ).toBe(true);
  });

  it('documents the derivation in backend.env, where the pin used to be', () => {
    expect(
      /no OBJECTSTACK_REF key here/.test(backendEnv) && /DERIVED at\s*\n#\s*boot/.test(backendEnv),
      `${path.relative(repoRoot, backendEnvPath)} no longer explains that the showcase-app ` +
        'commit is derived at boot rather than pinned. The key is absent from this file; a ' +
        'reader who finds no OBJECTSTACK_REF and no note saying why will conclude the pin was ' +
        'dropped by accident and restore it — which is exactly the regression the test above ' +
        'forbids. The absence has to be legible as a decision.',
    ).toBe(true);
  });
});

/**
 * objectui#8043 — the Half-State Patrol section told readers the sweeper's closed-card reader was
 * "switched **off** here via `PM_SWEEP_CLOSED_WINDOW_PAGES: '0'`". The workflow stopped setting
 * that variable on 2026-08-28: the reader is ON with a dated floor (`PM_SWEEP_CLOSED_FLOOR`), the
 * page window is deliberately absent, and the retired knob survives only in the workflow's header
 * comments as history. So the page sent anyone looking for the switch to a variable nothing sets,
 * and — worse in the direction this page is read — it described a predicate as disabled while it
 * runs four times a day.
 *
 * The `workflow inventory` block above cannot see this: it matches filenames in headings, so a
 * false sentence *inside* a documented section is exactly the drift it is blind to (objectui#7852
 * says so in as many words). This block closes that gap for the one thing on this page that names
 * the sweeper's wiring by identifier.
 *
 * ⛔ The comparison reads the workflow's `env:` KEYS, never the file as text. A whole-file grep
 * would find `PM_SWEEP_CLOSED_WINDOW_PAGES` in the header at `:39` / `:80` and accept the very
 * sentence this block exists to reject — the retired knob is *discussed* there precisely because
 * it is retired. `envKeysOf` below is unit-controlled against that shape.
 */
const HALF_STATE_WORKFLOW = 'half-state-patrol.yml';

/**
 * Every key of every `env:` mapping in a workflow — i.e. the variables the workflow actually SETS.
 *
 * Whole-line comments go first (`withoutComments`), and only children at exactly `env:`'s
 * indentation + 2 are read, so the continuation lines of a folded scalar (`PROVENANCE: >-` runs to
 * three of them here) cannot be mistaken for further keys.
 */
function envKeysOf(yaml: string): Set<string> {
  const keys = new Set<string>();
  const lines = withoutComments(yaml).split('\n');

  lines.forEach((line, index) => {
    const opener = line.match(/^(\s*)env:\s*$/);
    if (!opener) return;
    const openIndent = opener[1].length;

    for (const child of lines.slice(index + 1)) {
      if (child.trim() === '') continue;
      const indent = child.match(/^\s*/)![0].length;
      if (indent <= openIndent) break;
      if (indent !== openIndent + 2) continue;
      const key = child.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (key) keys.add(key[1]);
    }
  });

  return keys;
}

/** The page section headed by `<heading> (`<file>`)`, up to the next heading at that level or above. */
function sectionForWorkflow(file: string): string {
  const lines = doc.split('\n');
  const start = lines.findIndex((line) => /^#{1,6}\s/.test(line) && line.includes(file));
  if (start === -1) return '';
  const level = lines[start].match(/^#+/)![0].length;
  const after = lines.slice(start + 1);
  const next = after.findIndex((line) => new RegExp(`^#{1,${level}}\\s`).test(line));
  return (next === -1 ? after : after.slice(0, next)).join('\n');
}

const SWEEP_NAME = /PM_SWEEP_[A-Z0-9_]+/g;

describe('ci-cd-pipeline.md — Half-State Patrol sweeper wiring (#8043)', () => {
  const section = sectionForWorkflow(HALF_STATE_WORKFLOW);
  const set = [...envKeysOf(readWorkflow(HALF_STATE_WORKFLOW))].filter((k) => k.startsWith('PM_SWEEP_')).sort();
  const named = [...new Set([...section.matchAll(SWEEP_NAME)].map((m) => m[0]))].sort();

  it('has both sides to compare — neither may be empty', () => {
    // The vacuity legs. Each of the three below has a failure mode that renders the comparison
    // green while checking nothing, and each fails silently: a renamed heading empties the
    // section, a restructured `env:` empties the workflow side, and a rewrite that drops every
    // identifier leaves the page describing the wiring without naming any of it.
    expect(
      section,
      `No heading on the page names \`${HALF_STATE_WORKFLOW}\`, so this block has no section to ` +
        'read and its comparison below would pass vacuously. The `workflow inventory` block ' +
        'requires that heading to exist; if it moved, teach `sectionForWorkflow` where it went.',
    ).not.toBe('');

    expect(
      set,
      `${HALF_STATE_WORKFLOW} sets no \`PM_SWEEP_*\` variable in any \`env:\` block. Either the ` +
        'wiring moved out of `env:` — in which case `envKeysOf` is reading the wrong thing and ' +
        'every name on the page would now be reported as a phantom — or the sweeper is no longer ' +
        'called with any of it, and this section is describing a configuration that is gone.',
    ).not.toEqual([]);

    expect(
      named,
      'The Half-State Patrol section names no `PM_SWEEP_*` variable at all. The reader needs at ' +
        'least the closure floor: it is the one thing about this install that is not the ' +
        "sweeper's own default, and a section that omits it sends the next reader to the upstream " +
        'script for behaviour that is decided in the workflow (objectui#8043).',
    ).not.toEqual([]);
  });

  it('reads the workflow\'s env keys, not the file as text', () => {
    // The control for the paragraph above: a commented-out key is HISTORY, and a whole-file grep
    // cannot tell it from a setting. That is not hypothetical here — it is the exact shape of
    // `half-state-patrol.yml`'s header, and it is why the wrong sentence survived.
    const specimen = [
      'jobs:',
      '  patrol:',
      '    steps:',
      '      - name: sweep',
      '        env:',
      "          # PM_SWEEP_RETIRED: '0'  — read this until the cutover; history, not a setting",
      "          PM_SWEEP_LIVE: 'x'",
      '          FOLDED: >-',
      '            PM_SWEEP_NOT_A_KEY: still just prose',
      '',
    ].join('\n');

    expect([...envKeysOf(specimen)].sort()).toEqual(['FOLDED', 'PM_SWEEP_LIVE']);
  });

  it('names only variables the workflow actually sets', () => {
    const phantom = named.filter((name) => !set.includes(name));

    expect(
      phantom,
      'The Half-State Patrol section names these `PM_SWEEP_*` variables:\n' +
        phantom.map((n) => `  - ${n}`).join('\n') +
        `\n\n…and \`${HALF_STATE_WORKFLOW}\` sets none of them. What it does set is:\n` +
        set.map((n) => `  - ${n}`).join('\n') +
        '\n\nA reader who goes looking for the knob the page names finds a variable nothing ' +
        'assigns, and — the expensive direction — believes whatever the page says that knob is ' +
        'doing. That is objectui#8043 verbatim: the page claimed the closed-card reader was ' +
        "switched off by `PM_SWEEP_CLOSED_WINDOW_PAGES: '0'` for the eight days after the " +
        'workflow stopped setting it, while the reader ran four times a day. Fix the page ' +
        'against the workflow, not the other way round: the `env:` block and the header ' +
        'divergence list are where this install records its wiring.',
    ).toEqual([]);
  });

  it('quotes the closure floor the sweep step is actually given', () => {
    const floor = withoutComments(readWorkflow(HALF_STATE_WORKFLOW)).match(
      /^\s*PM_SWEEP_CLOSED_FLOOR:\s*'([^']+)'\s*$/m,
    )?.[1];

    expect(
      floor,
      '`PM_SWEEP_CLOSED_FLOOR` is no longer set to a quoted literal in ' +
        `${HALF_STATE_WORKFLOW}. If the floor was removed, the closed-card reader now judges the ` +
        'whole window and the section above is wrong in the other direction; if it merely moved ' +
        'to an expression, this assertion needs to read it from wherever the value now lives.',
    ).toBeDefined();

    expect(named, 'the section must keep naming the floor variable').toContain('PM_SWEEP_CLOSED_FLOOR');

    expect(
      section,
      `The workflow floors H22 at ${floor}, and the Half-State Patrol section does not say so. ` +
        'The date is the whole of the divergence — it is what separates "the reader is off" from ' +
        '"the reader judges everything closed since the convention started" — so a page that ' +
        'names the variable without its value tells a reader nothing they can check.',
    ).toContain(floor!);
  });
});

/**
 * objectui#8238 — the lane promised an artefact its configuration cannot produce.
 *
 * `live-e2e.yml`'s header, its job-summary step, its upload glob and this page's Live E2E
 * section were FOUR spellings of one claim — "failures surface as an uploaded Playwright
 * report" — and all four were decided by a single line somewhere else entirely:
 * `playwright.live.config.ts`'s `reporter`. That line reads `[['list']]`; the `list` reporter
 * writes to stdout and nothing in that config writes `playwright-report/`, so the promised
 * report was unreachable in EVERY outcome. Measured on a passing run and on a failing run:
 * absent both times, with an `html` reporter as the control that proves the directory is
 * observable when a reporter actually writes it.
 *
 * Nothing read those four sites against the config, which is exactly how they drifted, and
 * the cost was not cosmetic: objectui#8084's acceptance criterion was written as "a
 * `playwright-report/` appears in the uploaded artifact", so a correct fix could never have
 * satisfied its stated test. An acceptance criterion nobody can pass is the same hazard as a
 * check nobody can fail, pointed the other way.
 *
 * So this block pins the claim to the mechanism rather than to a sentence. It does not care
 * which way the repository decides the question — it requires only that the reporter list and
 * everything that describes it move together. Turn the HTML reporter on and this test goes red
 * naming every site that must be updated with it; leave it off and the sites must keep quoting
 * the reporter value that makes the absence true.
 */
const LIVE_CONFIG_FILE = 'playwright.live.config.ts';
const liveConfig = fs.readFileSync(path.join(repoRoot, LIVE_CONFIG_FILE), 'utf8');

/**
 * Source with `//` and block comments removed. The YAML-oriented `withoutComments` above
 * cannot be reused: this is TypeScript, and `playwright.live.config.ts` opens with a 20-line
 * block comment that names the config's behaviour in prose. A whole-file regex would read that
 * prose as configuration — the same class of mistake as counting a commented-out `env:` key.
 */
function withoutTsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The `reporter:` value exactly as written in a Playwright config, e.g. `[['list']]`. */
function reporterValueOf(source: string): string | undefined {
  return withoutTsComments(source).match(/^\s*reporter:\s*(.+?),?\s*$/m)?.[1];
}

describe('ci-cd-pipeline.md + live-e2e.yml — the Playwright report claim (#8238)', () => {
  const section = sectionForWorkflow('live-e2e.yml');
  const liveWorkflow = readWorkflow('live-e2e.yml');
  const header = liveWorkflow.slice(0, liveWorkflow.indexOf('\nname:'));
  const reporter = reporterValueOf(liveConfig);
  const declaresHtmlReporter = /['"]html['"]/.test(reporter ?? '');

  it('has all four sides to compare — none may be empty', () => {
    // The vacuity legs. Each failure below is silent: a renamed heading empties the section, a
    // restructured config empties the reporter read, and a header that no longer leads the file
    // empties the header slice. Any one of them would make the assertions pass while comparing
    // nothing — which is the failure mode this whole block exists to prevent elsewhere.
    expect(
      section,
      'No heading on this page names `live-e2e.yml`, so this block has no section to read and ' +
        'its assertions below would pass vacuously. The `workflow inventory` block requires ' +
        'that heading to exist; if it moved, teach `sectionForWorkflow` where it went.',
    ).not.toBe('');

    expect(
      reporter,
      `${LIVE_CONFIG_FILE} no longer declares a \`reporter:\` on a line of its own. That line is ` +
        'what decides whether `playwright-report/` can exist, and every sentence pinned below ' +
        'describes it. If the reporter moved to a variable or a spread, this assertion has to ' +
        'read it from wherever the value now lives — do not delete the comparison, or the four ' +
        'claim sites go back to being unchecked prose (objectui#8238).',
    ).toBeDefined();

    expect(header, 'live-e2e.yml must still open with its header comment block').not.toBe('');
  });

  it('reads the config, not the file as text', () => {
    // The control for the paragraph above. `playwright.live.config.ts`'s header describes the
    // config in prose; a whole-file grep cannot tell that prose from a setting. This is the
    // exact shape of that file, and it is why the parser strips comments first.
    const specimen = [
      '/**',
      " * Run with reporter: [['html']] when you want a browsable report.",
      ' */',
      'export default defineConfig({',
      "  // reporter: [['html']],  — history, not a setting",
      "  reporter: [['list']],",
      '});',
    ].join('\n');

    expect(reporterValueOf(specimen)).toBe("[['list']]");
  });

  it('uploads no path the reporter cannot produce', () => {
    // Mechanical and exact: the glob may name `playwright-report/` only when a reporter that
    // writes it is declared. This is the half of #8238 that is not a matter of wording — the
    // upload step listed a directory that could not exist in any outcome, and `upload-artifact`
    // reports that as a warning, not a failure, so nothing ever went red over it.
    const globsReport = /^\s*playwright-report\/\s*$/m.test(withoutComments(liveWorkflow));

    expect(
      globsReport,
      declaresHtmlReporter
        ? `${LIVE_CONFIG_FILE} declares an HTML reporter (\`${reporter}\`) but live-e2e.yml no ` +
          'longer uploads `playwright-report/`, so the lane now produces a report and throws it ' +
          'away. Add the path back to the upload glob.'
        : `live-e2e.yml's upload glob names \`playwright-report/\`, but ${LIVE_CONFIG_FILE} ` +
          `declares \`reporter: ${reporter}\` — no reporter in it writes that directory, so the ` +
          'path matches nothing on a pass, a fail or a crash. Either declare an HTML reporter in ' +
          'that config, or drop the path. ⛔ Do not do neither: the glob is read by humans as a ' +
          'promise that the artefact contains a report, and objectui#8084 wrote an acceptance ' +
          'criterion on exactly that reading which no fix could ever have satisfied.',
    ).toBe(declaresHtmlReporter);
  });

  it('quotes the reporter value both prose sites are describing', () => {
    // The fence, adopted verbatim from #8238: the header, this page's section and the upload
    // glob are spellings of ONE claim and must move together. Requiring both prose sites to
    // quote the reporter value as written turns "they must move together" into something a test
    // can hold: flip the config and both sentences go red until someone rewrites them.
    for (const [name, text] of [
      ['live-e2e.yml’s header comment', header],
      ['the Live E2E section of content/docs/guide/ci-cd-pipeline.md', section],
    ] as const) {
      expect(
        text,
        `${name} does not quote \`${reporter}\`, the reporter list ${LIVE_CONFIG_FILE} actually ` +
          'declares. Both sites tell the reader what a failing run leaves behind, and that ' +
          'answer is decided entirely by this value — a site that describes the artefacts ' +
          'without naming the line that produces them is how this lane spent its whole ' +
          'existence promising a Playwright report it could not write (objectui#8238).',
      ).toContain(reporter!);
    }
  });

  it('says that a green run uploads nothing at all', () => {
    // #8238's second and sharper edge, and the one that outlives whichever way the reporter
    // question is decided. The upload step is gated on `failure()`, so on a green lane it never
    // runs: there is no artifact, so there is no file count, so any acceptance criterion
    // phrased over the artifact's contents is readable ONLY on a run that failed. That trap is
    // what produced objectui#8084's unpassable criterion, and it is invisible from the prose
    // unless the prose says it.
    const uploadStep = withoutComments(liveWorkflow).slice(
      withoutComments(liveWorkflow).indexOf('name: Upload'),
    );

    expect(
      uploadStep,
      'live-e2e.yml has no `Upload` step, so the sentence pinned below is describing a step ' +
        'that is gone. Re-point this assertion or drop the sentence with it.',
    ).not.toBe('');

    expect(
      /if:.*failure\(\)/.test(uploadStep.split('\n').slice(0, 6).join('\n')),
      'live-e2e.yml’s upload step is no longer gated on `failure()`. If it now runs on green ' +
        'runs too, the warning on the page — that a green lane leaves no artifact to inspect — ' +
        'has become false and must be removed in the same PR.',
    ).toBe(true);

    expect(
      section,
      'The Live E2E section does not mention `failure()`. The upload step is gated on it, so a ' +
        'green run of this lane produces NO artifact — not an empty one, none — and a reader ' +
        'who does not know that will write a check against artefact contents that can only ever ' +
        'be read on a red run. objectui#8084 did exactly that. Say it on the page.',
    ).toContain('failure()');
  });
});
