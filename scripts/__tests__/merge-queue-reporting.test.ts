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

  it('fails OPEN: a gate that cannot compute the diff runs everything', () => {
    // The direction matters more than the code. objectstack#4928 named this the
    // filter contract after the opposite spelling — a diff whose failure was
    // swallowed into an empty result — produced a fully green pull request with
    // no job having run and no red signal anywhere. `ci.yml`'s older `docs` gate
    // still uses that fail-CLOSED spelling (`|| echo ""`); the gates added by
    // objectui#3523 must not copy it.
    for (const file of FILTER_MOVED_INTO_JOBS) {
      const yaml = read(file);
      const gates = [...yaml.matchAll(/^\s*id: relevant$/gm)];
      expect(gates.length, `${file} must still carry at least one \`id: relevant\` gate`).toBeGreaterThan(0);

      expect(
        yaml,
        `${file}'s short-circuit swallows a failed \`git diff\` into an empty result, which reads ` +
          `as "nothing relevant changed" and skips every gate. When the filter cannot tell, it ` +
          `must RUN (objectstack#4928).`,
      ).toMatch(/if ! CHANGED=\$\(git diff --name-only/);
    }
  });
});
