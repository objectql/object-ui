import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * objectui#3523 — the merge queue was enforced and validated nothing.
 *
 * Two independent holes produced one P0, and this file pins both shut, because
 * each of them is invisible in exactly the way that makes CI look healthy.
 *
 *  1. **Nothing subscribed `merge_group`.** A ruleset requires every change to
 *     land through the merge queue (#3243 measured a direct push to `main`
 *     returning 405 `Changes must be made through the merge queue`), yet not one
 *     of the repository's workflows carried the trigger — repo-wide
 *     `event=merge_group` runs stood at total_count = 0, historically. A queue
 *     nothing subscribes to can only carry an EMPTY required-check set, so it
 *     rebuilt each pull request on the current `main` and let it through without
 *     running anything. On 2026-08-07 #3503, #3510 and #3516 all merged with
 *     `Type Check` at conclusion=failure, on a `main` that #3498 had left with a
 *     TS2578; #3505 hot-fixed the result.
 *
 *  2. **`paths-ignore` on the `pull_request` trigger.** `paths-ignore` skips the
 *     WHOLE workflow when every changed file matches, and GitHub has no per-job
 *     path filter, so a docs-only or changeset-only PR started neither `ci.yml`
 *     nor `lint.yml` — #3509 measured zero check runs from them. A check that is
 *     never created does not fail a required-status-check rule, it leaves the PR
 *     pending forever; inside the queue it fails on the ruleset's 60-minute
 *     status-check timeout. So none of those contexts could be made required
 *     while the filter lived on the trigger, which is why the queue's required
 *     set was empty in the first place. `control-bytes.yml` and `docs-links.yml`
 *     had already reached this conclusion for themselves — their headers say a
 *     gate a markdown-only PR cannot start "rebuilds the hole it exists to
 *     close" — but the two heavyweight workflows had not.
 *
 * The fix is deliberately ordered: subscribe the trigger first (pure addition),
 * then move the path decision from the trigger into the jobs, and only then may
 * a maintainer write these contexts into the branch-protection and queue
 * required sets. Reversing that order deadlocks the whole repository, which is
 * what the assertions below exist to prevent someone re-doing by halves.
 *
 * Deliberately NOT asserted: which contexts are actually required. That lives in
 * repository settings, which no test in this repo can read and no agent may
 * change.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowDir = path.join(repoRoot, '.github/workflows');

/**
 * `filename -> why this workflow must subscribe merge_group`.
 *
 * A hand-maintained list, and it has to be: "may this context be required?" is a
 * property of the repository's settings, not of the YAML, so nothing mechanical
 * can derive the set. What IS mechanical is the honesty check below — an entry
 * naming a workflow that no longer exists fails, so the list cannot rot into a
 * comfortable fiction the way a stale count does (#3261).
 */
const MUST_SUBSCRIBE_MERGE_GROUP = new Map<string, string>([
  ['ci.yml', 'produces Type Check, Build & E2E, Test (shard N/4) and Changeset Fixed Group Check'],
  ['lint.yml', 'produces Lint — the ESLint error ratchets'],
  ['control-bytes.yml', 'produces Control Byte Scan, one of the two contexts #3523 found safe to require today'],
  ['docs-links.yml', 'produces Internal Docs Link Check, the other one'],
  [
    'changeset-presence.yml',
    'produces Changeset Declaration — added by objectui#3387 with no path filter at all, for the ' +
      'reason this list exists: it reports on every pull request, so it is requirable, and a ' +
      'requirable context that skips the queue build stalls it',
  ],
  [
    'skills-paths.yml',
    'produces Skill Guide Path Check — added by objectui#3735, same shape as the two above: its ' +
      'entire scan surface is markdown, so it carries no path filter, reports on every pull ' +
      'request, and is therefore requirable',
  ],
]);

/** Workflows whose path filtering had to move from the trigger into the jobs. */
const FILTER_MOVED_INTO_JOBS = ['ci.yml', 'lint.yml'];

const read = (file: string): string => fs.readFileSync(path.join(workflowDir, file), 'utf8');

/**
 * A workflow's YAML with whole-line comments removed. Required, not cosmetic:
 * every one of these files discusses `paths-ignore`, `merge_group` and the
 * incident above in prose, and a scan that counted the prose would report
 * triggers and filters that no file has.
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
  expect(at, `the workflow must still have a top-level \`${key}:\``).toBeGreaterThan(-1);
  const rest = yaml.slice(at);
  const firstLineEnd = rest.indexOf('\n') + 1;
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

/** `- 'pattern'` entries — the shape `paths` / `paths-ignore` lists are written in. */
const quotedEntries = (block: string): string[] =>
  [...block.matchAll(/^\s*-\s*'([^']+)'/gm)].map((m) => m[1]);

/** `':(exclude,glob)pattern'` pathspecs — the shape the in-job gate is written in. */
const excludePathspecs = (yaml: string): string[] =>
  [...yaml.matchAll(/':\(exclude,glob\)([^']+)'/g)].map((m) => m[1]);

/**
 * Every line capturing a `git diff` into `CHANGED` — one per gate, trimmed.
 *
 * Lines rather than whole commands, because the fail-open decision is made
 * entirely by how the capture OPENS: `if ! CHANGED=$(…` is what turns a nonzero
 * `git diff` into `should_run=true`. A capture continued over further lines
 * (every one of these is) still contributes exactly one entry, so the count is
 * the number of gates.
 *
 * Callers must strip comments first (`withoutComments`) — both workflows now
 * discuss this exact shape in prose, and counting the prose would report gates
 * no job has.
 */
const diffCaptureLines = (yaml: string): string[] =>
  yaml
    .split('\n')
    .filter((line) => /CHANGED=\$\(\s*git diff/.test(line))
    .map((line) => line.trim());

/**
 * `file -> the jobs whose diff capture must fail open`.
 *
 * Hand-maintained for the same reason as `MUST_SUBSCRIBE_MERGE_GROUP`, and used
 * only as a FLOOR: the assertion below checks the shape of every capture it
 * finds, so a sixth gate is covered the moment it is written, while the floor is
 * what makes DELETING one red. Without it, the shape check would pass an empty
 * list — green because nothing was produced, not because anything is right.
 */
const FAIL_OPEN_GATES = new Map<string, readonly string[]>([
  // `type-check`, `test` and `e2e` share `id: relevant` (objectui#3523 / PR
  // #3722); `docs` has its own `id: docs-changes` and predates them (#3450),
  // which is how it kept the fail-CLOSED spelling until objectui#3723.
  ['ci.yml', ['type-check', 'test', 'e2e', 'docs']],
  ['lint.yml', ['lint']],
]);

describe('every requirable context reports on a merge-queue build (#3523 step 1)', () => {
  it('subscribes merge_group in each workflow that produces one', () => {
    const missing = [...MUST_SUBSCRIBE_MERGE_GROUP.keys()].filter(
      (file) => !/^ {2}merge_group:/m.test(topLevelBlock(withoutComments(read(file)), 'on')),
    );

    expect(
      missing,
      `These workflows produce a check the repository can require, but do not subscribe ` +
        `\`merge_group\`:\n` +
        missing.map((f) => `  - ${f} (${MUST_SUBSCRIBE_MERGE_GROUP.get(f)})`).join('\n') +
        `\n\nThe merge queue is ENFORCED here (#3243). A required context that does not report ` +
        `on a queue build does not fail the queue, it stalls it until the ruleset's 60-minute ` +
        `status-check timeout — and while nothing at all subscribes, the queue's required set ` +
        `can only be empty, so it rebuilds each PR on the current \`main\` and merges it ` +
        `unvalidated. That is not hypothetical: #3503 / #3510 / #3516 merged on 2026-08-07 with ` +
        `\`Type Check\` at conclusion=failure (objectui#3523).`,
    ).toEqual([]);
  });

  it('keeps the list honest — every name in it is a workflow that exists', () => {
    const files = new Set(fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml')));
    for (const [name, reason] of MUST_SUBSCRIBE_MERGE_GROUP) {
      expect(files, `MUST_SUBSCRIBE_MERGE_GROUP names ${name}, which no longer exists — drop it`).toContain(name);
      expect(reason.length, `MUST_SUBSCRIBE_MERGE_GROUP[${name}] must say which context it produces`).toBeGreaterThan(20);
    }
  });

  it('runs the test suite on a queue build, not only on pull requests', () => {
    // `if: github.event_name == 'pull_request'` predates the queue and was
    // correct while the third event could not happen. Left alone it would make
    // the last validation before `main` the ONLY one that skips every shard.
    const jobs = topLevelBlock(withoutComments(read('ci.yml')), 'jobs');
    const test = nestedBlock(jobs, 'test');
    expect(test, 'ci.yml must still define a `test:` job').not.toEqual('');
    expect(
      test,
      `ci.yml's \`test\` job is restricted to \`pull_request\`, so a merge_group build runs no ` +
        `tests at all. Write the exclusion as "not push" instead — \`test-coverage\` is the push ` +
        `lane, and the queue build is the last check before \`main\` (objectui#3523).`,
    ).not.toMatch(/^\s*if: github\.event_name == 'pull_request'\s*$/m);
  });
});

describe('every context reports on every pull request (#3523 step 2)', () => {
  it.each(FILTER_MOVED_INTO_JOBS)('%s filters no pull request at the trigger', (file) => {
    const pullRequest = nestedBlock(topLevelBlock(withoutComments(read(file)), 'on'), 'pull_request');
    expect(pullRequest, `${file} must still trigger on \`pull_request\``).not.toEqual('');

    for (const key of ['paths-ignore', 'paths']) {
      expect(
        pullRequest,
        `${file} filters its \`pull_request\` trigger by \`${key}\`. That skips the WHOLE ` +
          `workflow — GitHub has no per-job path filter — so on a PR whose files all match, the ` +
          `contexts this file produces are never created. A required check that is never created ` +
          `leaves the PR pending forever and fails a queue build on the 60-minute timeout, which ` +
          `is why they could not be required at all before objectui#3523 (#3509 measured a ` +
          `docs-only PR starting zero of them). Put the path decision in the jobs instead, the ` +
          `way \`ci.yml\`'s \`docs\` job has since #3450.`,
      ).not.toMatch(new RegExp(`^\\s*${key}:`, 'm'));
    }
  });

  it.each(FILTER_MOVED_INTO_JOBS)('%s keeps ONE ignore list, on the push trigger', (file) => {
    // The push lane keeps its `paths-ignore` — branch protection and the merge
    // queue judge pull requests and queue builds, never pushes to `main`, so
    // filtering there costs nothing and saves a full run on every docs merge.
    // That makes it the single authored home for the list, and the in-job gates
    // are held to it here rather than being four hand-synced copies (#3261's
    // lesson: a hand-copied enumeration drifts by construction).
    const push = nestedBlock(topLevelBlock(withoutComments(read(file)), 'on'), 'push');
    const declared = quotedEntries(push);
    expect(
      declared.length,
      `${file}'s \`push\` trigger no longer declares \`paths-ignore\` entries — the in-job gates ` +
        `below have nothing left to be checked against.`,
    ).toBeGreaterThan(0);

    const inJob = [...new Set(excludePathspecs(read(file)))];
    expect(
      inJob.length,
      `${file} declares no \`:(exclude,glob)…\` pathspec, so no job short-circuits and the ` +
        `expensive steps now run on every docs-only PR. objectui#3523 moved the filter into the ` +
        `jobs; it did not delete it.`,
    ).toBeGreaterThan(0);

    expect(
      [...inJob].sort(),
      `${file}'s in-job exclusion list has drifted from the \`paths-ignore\` on its \`push\` ` +
        `trigger. The two must stay identical: the trigger is what the in-job gate replaced for ` +
        `pull requests, and any difference silently means PRs and pushes are judged by different ` +
        `rules (objectui#3523).`,
    ).toEqual([...new Set(declared)].sort());
  });

  it.each(FILTER_MOVED_INTO_JOBS)('%s gates every step after the gate, in every gated job', (file) => {
    const jobs = topLevelBlock(withoutComments(read(file)), 'jobs');
    const keys = [...jobs.matchAll(/^ {2}([a-z0-9][a-z0-9-]*):[ \t]*$/gm)].map((m) => m[1]);
    expect(keys.length, `the ${file} \`jobs:\` parse returned implausibly few keys`).toBeGreaterThan(0);

    const gatedJobs = keys.filter((key) => /^\s*id: relevant$/m.test(nestedBlock(jobs, key)));
    expect(
      gatedJobs.length,
      `${file} has no job carrying the \`id: relevant\` short-circuit. Removing it does not make ` +
        `the gate stricter — it makes every expensive step run on every docs-only PR ` +
        `(objectui#3523).`,
    ).toBeGreaterThan(0);

    for (const key of gatedJobs) {
      const block = nestedBlock(jobs, key);
      const after = block.slice(block.search(/^\s*id: relevant$/m));
      // Step boundaries inside a job body: `      - name: …`.
      const steps = after.split(/^ {6}- name: /m).slice(1);
      expect(steps.length, `${file}'s \`${key}\` job has no steps after its gate`).toBeGreaterThan(0);

      const ungated = steps
        .filter((step) => !step.includes('steps.relevant.outputs.should_run'))
        .map((step) => step.split('\n')[0].trim());

      expect(
        ungated,
        `${file}'s \`${key}\` job runs these steps regardless of its own short-circuit:\n` +
          ungated.map((s) => `  - ${s}`).join('\n') +
          `\n\nEvery step after \`id: relevant\` must carry ` +
          `\`if: steps.relevant.outputs.should_run == 'true'\` (combined with its own condition ` +
          `where it already has one). A step that ignores the gate turns a docs-only PR into a ` +
          `full install-and-build, which is the cost objectui#3523 kept while moving the filter.`,
      ).toEqual([]);
    }
  });

  it('fails OPEN: EVERY gate that cannot compute the diff runs everything', () => {
    // The direction matters more than the code. objectstack#4928 named this the
    // filter contract after the opposite spelling — a diff whose failure was
    // swallowed into an empty result — produced a fully green pull request with
    // no job having run and no red signal anywhere.
    //
    // This assertion used to be a single `toMatch` per FILE, which is why it
    // reported green while `ci.yml`'s `docs` gate was still fail-CLOSED
    // (objectui#3723): the three gates PR #3722 added satisfied the regex on
    // ci.yml's behalf, and a whole-file match cannot tell four captures from
    // three plus a swallow. It is now per CAPTURE, so each gate answers for
    // itself and a fifth spelled the closed way cannot hide behind the others.
    for (const file of FILTER_MOVED_INTO_JOBS) {
      const expected = FAIL_OPEN_GATES.get(file) ?? [];
      const captures = diffCaptureLines(withoutComments(read(file)));

      expect(
        captures.length,
        `${file} declares ${captures.length} \`CHANGED=$(git diff …)\` captures, fewer than the ` +
          `${expected.length} gates that must have one (${expected.join(', ')}). A gate whose diff ` +
          `capture is gone either no longer filters at all, or filters by some other means this ` +
          `test cannot check the direction of — and with none left, the shape assertion below ` +
          `passes an empty list (objectui#3523, objectui#3723).`,
      ).toBeGreaterThanOrEqual(expected.length);

      const failClosed = captures.filter((line) => !line.startsWith('if ! CHANGED=$(git diff'));
      expect(
        failClosed,
        `${file} captures a \`git diff\` without letting its failure mean RUN:\n` +
          failClosed.map((line) => `  - ${line}`).join('\n') +
          `\n\nEvery gate must open its capture as \`if ! CHANGED=$(git diff …); then\` and treat ` +
          `the failure branch as should_run=true. Swallowing the failure instead — the ` +
          `\`2>/dev/null || echo ""\` this file's \`docs\` job used until objectui#3723 — makes ` +
          `"the diff could not be computed" indistinguishable from "nothing changed", so a ` +
          `shallow checkout or a malformed sha skips the job's real work and still reports ` +
          `success. When the filter cannot tell, it must RUN (objectstack#4928).`,
      ).toEqual([]);
    }
  });

  it('fails OPEN in effect, not only in shape: no gate swallows its diff failure', () => {
    // `if !` is necessary but not sufficient. `if ! CHANGED=$(git diff … || echo
    // "")` reads as fail-open and is not: `|| echo ""` makes the command succeed
    // whatever git did, so the failure branch becomes unreachable and the gate is
    // fail-CLOSED again with the safe spelling wrapped around it. Same for
    // `2>/dev/null`, which additionally deletes git's own explanation of what
    // went wrong from the run log — the one diagnostic a future reader gets.
    for (const file of FILTER_MOVED_INTO_JOBS) {
      const code = withoutComments(read(file));
      for (const [shape, why] of [
        [/\|\|\s*echo\s*""/, '`|| echo ""` makes the capture succeed even when git failed'],
        [/2>\s*\/dev\/null/, '`2>/dev/null` hides why git failed'],
      ] as const) {
        expect(
          code,
          `${file} still contains ${why}. Both halves of the fail-CLOSED spelling objectui#3723 ` +
            `removed must stay out: the gate's failure branch has to be reachable, and the run ` +
            `log has to say what happened (objectstack#4928).`,
        ).not.toMatch(shape);
      }
    }
  });
});
