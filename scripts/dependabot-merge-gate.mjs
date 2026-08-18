#!/usr/bin/env node
/**
 * The merge gate `.github/workflows/dependabot-auto-merge.yml` consults before
 * it approves or enqueues a Dependabot pull request (objectui#4973).
 *
 * ## What went wrong, measured
 *
 * The workflow used to run, unconditionally, for every semver-patch/minor bump:
 *
 *     gh pr merge --auto --squash "$PR_URL"
 *
 * `--auto` lands the merge the moment GitHub considers the pull request
 * mergeable — that is, the moment the *branch-protection required set* is
 * satisfied. It does NOT wait for the checks this repository actually runs. On
 * 2026-08-17 that difference was cashed in on #4959 (`lucide-react` 1.29.0 ->
 * 1.31.0), whose own head SHA `31745d8b` was red:
 *
 *   08:07:41Z  PR opened
 *   08:13:07Z  the four `Test (shard N/4)` jobs start
 *   08:13:30Z  this workflow's own `dependabot` job completes
 *   08:13:36Z  github-actions[bot] MERGES it into `main`
 *   08:18:55Z  shard 4/4 reports success
 *   08:21:01Z  shard 3/4 reports FAILURE   (5m25s after the merge)
 *   08:21:56Z  shard 1/4 reports FAILURE   (8m20s after the merge)
 *   08:22:33Z  `Type Check` reports        (8m57s after the merge)
 *
 * Nine of the nineteen check runs on that SHA were still in flight when the
 * merge happened — all four shards, `Type Check`, `Lint`, `Build & E2E`,
 * `Build Docs` and `Bundle Analysis`. The four-way test shard matrix is the
 * slowest job in the repository BY CONSTRUCTION (it exists to cut a ~9 minute
 * wall clock, see `ci.yml`), so it is the check that `--auto` systematically
 * outruns. `main` went red for every parallel agent, which is what #4968 then
 * had to repair.
 *
 * The hole is not specific to lockfile ranges: ANY red on a slow job could ride
 * through it. Same family as objectui#3523 (an empty merge-queue required set
 * let #3503/#3510/#3516 land with `Type Check` at conclusion=failure) and
 * #3243.
 *
 * ## Why this is a script and not a `run:` block
 *
 * Same reason `scripts/render-budget-comment.mjs` and
 * `scripts/shadcn-check-report.mjs` exist: logic that lives in YAML is logic
 * nothing ever executes between real firings, and this particular logic decides
 * whether something lands on the shared `main`. Here it buys something extra —
 * `scripts/__tests__/dependabot-merge-gate.test.ts` replays the REAL #4959
 * check-run timeline through `evaluateGate()` and asserts the counterfactual
 * directly: `pending` at 08:13:36Z (so the merge does not happen) and `red`
 * once the shards report. A workflow cannot be run locally; this decision can.
 *
 * ## The contract: declared = enforced, and absence is never green
 *
 * The gate does NOT ask GitHub "are the required checks green?" — that question
 * is answered by the branch-protection required set, which is a
 * repository-SETTINGS surface this repository can neither read nor change
 * (`content/docs/guide/ci-cd-pipeline.md`, "Merge Queue", step 3), and which is
 * demonstrably not carrying the shards today: a merge occurred while all four
 * were `in_progress`, so none of them can be in it.
 *
 * So the set is declared here, and three rules keep the declaration honest:
 *
 *  1. Every context in `REQUIRED_CONTEXTS` must be PRESENT and `success`.
 *     Missing counts as not-green, never as green — a renamed or skipped job
 *     must stall the gate and then fail it, which is the one direction that
 *     cannot silently let a red PR through. (objectui#3523's lesson stated the
 *     other way round: a check that never reports does not fail a required-set
 *     rule, it leaves the PR pending — so a gate that reads "absent = fine" is
 *     the same bug wearing the fix's clothes.)
 *  2. `OPTIONAL_CONTEXTS` are blocking checks whose WORKFLOW carries a
 *     trigger-level path filter, so they legitimately do not report on every
 *     pull request. Present -> must be `success`; absent -> not waited for.
 *  3. `NOT_A_GATE` names every remaining context a pull request produces, each
 *     with the reason it cannot gate. `dependabot-merge-gate.test.ts` asserts
 *     the three buckets partition the produced set EXACTLY — no name produced
 *     by a `pull_request`-triggered workflow may be unclassified, and no
 *     classified name may be unproduced. A new job or a renamed one fails that
 *     test instead of quietly shrinking the gate.
 *
 * Only `success` is green for a required context. `skipped` is not: every
 * required context here belongs to a workflow that reports on every pull
 * request by design (the path decision moved INTO the jobs in #3523, so an
 * ignored-paths run still reports `success`), which means a `skipped` required
 * context is a change in the pipeline, not a pass.
 *
 * ## What this file deliberately does not do
 *
 * It never mutates anything — no merge, no approval, no comment. It reads check
 * runs and returns a verdict; the workflow performs the two mutations, under an
 * `if:` on that verdict, so the whole set of things that can write is visible
 * in the YAML. A crash here (403 on `checks: read`, network, bad input) exits
 * non-zero and merges nothing, which is the correct direction to fail.
 *
 * ## The boundary of the declared set: check RUNS, not commit STATUSES
 *
 * Everything above is about check runs — what GitHub Actions jobs produce.
 * Third-party apps can also attach a legacy commit STATUS to the same SHA, and
 * this repository has one: `Vercel`, which on a pull request reports
 * `success` / "Canceled by Ignored Build Step" for changes its ignored-build
 * step filters out. The gate does not read statuses, so a red Vercel status
 * would not stop a Dependabot merge.
 *
 * That is a stated boundary, not an oversight, and it is not a regression: the
 * unconditional `--auto` this replaced waited for nothing at all. It is left
 * outside deliberately — requiring a preview deployment from a third-party
 * service would let an unrelated outage block every dependency bump, and
 * whether that trade is worth making is a maintainer's call, not a hot fix's.
 * It is written down here so the next reader does not have to infer the scope
 * from the endpoint being called.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Blocking checks whose workflow subscribes `pull_request` with NO trigger-level
 * path filter, so every pull request produces every one of them. Source of each
 * name, in the checks list rather than the file name:
 *
 *   ci.yml            Changeset Fixed Group Check, Type Check,
 *                     Test (shard 1..4/4), Build & E2E, Build Docs
 *   lint.yml          Lint
 *   control-bytes.yml Control Byte Scan
 *   docs-links.yml    Internal Docs Link Check
 *   skills-paths.yml  Skill Guide Path Check
 *   changeset-presence.yml   Changeset Declaration
 *   doc-component-types.yml  Doc Component Type Check
 *   doc-snippet-types.yml    Doc Snippet Type Check
 *
 * The four shards are spelled out individually on purpose. A single `Test`
 * entry, or any pattern match, would be satisfied by whichever shard happened
 * to exist — and #4959 failed on shards 1 and 3 while 2 and 4 passed.
 */
export const REQUIRED_CONTEXTS = Object.freeze([
  'Changeset Fixed Group Check',
  'Type Check',
  'Test (shard 1/4)',
  'Test (shard 2/4)',
  'Test (shard 3/4)',
  'Test (shard 4/4)',
  'Build & E2E',
  'Build Docs',
  'Lint',
  'Control Byte Scan',
  'Internal Docs Link Check',
  'Skill Guide Path Check',
  'Changeset Declaration',
  'Doc Component Type Check',
  'Doc Snippet Type Check',
]);

/**
 * Blocking checks that a pull request may legitimately not produce, because
 * their workflow filters at the trigger. Waiting for one of these to appear
 * would hang the gate until its deadline on a pull request that was never going
 * to start it; requiring nothing of them when they DO run would let a real red
 * through. So: present -> must be `success`, absent -> ignored.
 *
 * They are evaluated on the same poll as the required set, i.e. only once every
 * required context has already reported. By then the whole check-run list for
 * the SHA has existed for minutes (on #4959 all nineteen runs were created
 * within three seconds of each other), so "absent" here means "the path filter
 * kept it out", not "it has not been created yet".
 */
export const OPTIONAL_CONTEXTS = Object.freeze({
  'Bundle Analysis':
    "performance-budget.yml filters on paths: packages/**, apps/console/**, pnpm-lock.yaml. Blocking when it runs (console gzip budget); absent on a PR that touches none of them.",
  'Changeset Bump Policy':
    'changeset-guard.yml filters on paths: .changeset/**. A Dependabot PR carries no changeset, so it normally does not report at all.',
});

/**
 * Everything else a pull request to `main` produces, and why it cannot gate.
 * Kept as a named list rather than an implicit "anything not required is
 * ignored", so that a new check has to be classified by a human instead of
 * defaulting into silence.
 */
export const NOT_A_GATE = Object.freeze({
  dependabot:
    'This workflow itself. The gate runs inside this job, so requiring it would deadlock at its own deadline.',
  'Test (coverage)':
    "ci.yml's push lane (`if: github.event_name == 'push'`), so on a pull request it reports conclusion=skipped by design. The PR lane is the four shards above.",
  'Live E2E (informational)':
    'live-e2e.yml is declared INFORMATIONAL and NON-REQUIRED in its own header and runs `continue-on-error: true`; ci-cd-pipeline.md says in as many words not to add it to required checks.',
  label:
    'labeler.yml applies labels. It is a mutation, not a verdict — nothing about the change is judged by it.',
});

/**
 * GitHub keeps every check run for a SHA, including superseded re-runs. The
 * verdict must come from the newest run per name: an old `success` next to a
 * fresh `queued` re-run means the answer is "wait", not "green".
 *
 * @param {Array<{ name: string, id?: number, status?: string, conclusion?: string|null }>} checkRuns
 * @returns {Map<string, { name: string, id?: number, status?: string, conclusion?: string|null }>}
 */
export function latestByName(checkRuns = []) {
  /** @type {Map<string, any>} */
  const latest = new Map();
  for (const run of checkRuns) {
    if (!run?.name) continue;
    const seen = latest.get(run.name);
    if (!seen || Number(run.id ?? 0) >= Number(seen.id ?? 0)) latest.set(run.name, run);
  }
  return latest;
}

/** A required context is green only when it has completed with `success`. */
function classify(run) {
  if (!run) return 'missing';
  if (run.status !== 'completed') return 'pending';
  return run.conclusion === 'success' ? 'green' : 'not-green';
}

/**
 * One verdict over one snapshot of a SHA's check runs.
 *
 * `red` wins over `pending`: once a required context has failed, the remaining
 * shards can only confirm it, and continuing to wait would just delay a report
 * the author already needs.
 *
 * @param {{ checkRuns?: Array<object>, required?: readonly string[], optional?: readonly string[] }} input
 * @returns {{ verdict: 'green'|'red'|'pending', failing: string[], pending: string[], missing: string[] }}
 */
export function evaluateGate({
  checkRuns = [],
  required = REQUIRED_CONTEXTS,
  optional = Object.keys(OPTIONAL_CONTEXTS),
} = {}) {
  const latest = latestByName(checkRuns);
  /** @type {string[]} */ const failing = [];
  /** @type {string[]} */ const pending = [];
  /** @type {string[]} */ const missing = [];

  for (const name of required) {
    const run = latest.get(name);
    switch (classify(run)) {
      case 'missing':
        missing.push(name);
        break;
      case 'pending':
        pending.push(`${name} (${run.status})`);
        break;
      case 'not-green':
        failing.push(`${name} (${run.conclusion ?? 'no conclusion'})`);
        break;
      default:
        break;
    }
  }

  for (const name of optional) {
    const run = latest.get(name);
    // Absent, or skipped: the path filter decided this pull request is not one
    // this check judges. Nothing to wait for and nothing to hold against it.
    if (!run || (run.status === 'completed' && run.conclusion === 'skipped')) continue;
    if (run.status !== 'completed') pending.push(`${name} (${run.status})`);
    else if (run.conclusion !== 'success') failing.push(`${name} (${run.conclusion ?? 'no conclusion'})`);
  }

  const verdict = failing.length > 0 ? 'red' : pending.length + missing.length > 0 ? 'pending' : 'green';
  return { verdict, failing, pending, missing };
}

/**
 * The Checks REST surface the gate needs, injectable so tests never reach the
 * network. Needs `checks: read`; a 403 here throws, which fails the job and
 * merges nothing.
 */
export function createChecksApi({
  token = process.env.GITHUB_TOKEN ?? '',
  apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com',
  repository = process.env.GITHUB_REPOSITORY ?? '',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!repository) throw new Error('GITHUB_REPOSITORY is not set');

  const get = async (route) => {
    const res = await fetchImpl(`${apiUrl}${route}`, {
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`GET ${route} -> HTTP ${res.status}`);
    return res.json();
  };

  return {
    /**
     * Every check run on one SHA. `filter=latest` is GitHub's default and is
     * spelled out so a future default change cannot start feeding the gate
     * stale runs; `latestByName()` de-duplicates again on our side because the
     * endpoint's notion of "latest" is per check SUITE, not per name.
     */
    listCheckRuns: async (sha) => {
      /** @type {Array<object>} */ const all = [];
      for (let page = 1; page <= 10; page += 1) {
        const body = await get(`/repos/${repository}/commits/${sha}/check-runs?filter=latest&per_page=100&page=${page}`);
        const runs = body?.check_runs ?? [];
        all.push(...runs);
        if (runs.length < 100) break;
      }
      return all;
    },
  };
}

/**
 * Poll until the verdict is decided, or until the deadline turns an undecided
 * gate into a red one. A timeout is a failure, never a pass: the reason a
 * context is still missing at the deadline (renamed job, cancelled workflow,
 * a filter that stopped it reporting) is exactly the kind of thing that must
 * reach a human instead of a merge.
 *
 * @param {{ api: { listCheckRuns: (sha: string) => Promise<Array<object>> }, sha: string,
 *           timeoutMs?: number, intervalMs?: number,
 *           now?: () => number, sleep?: (ms: number) => Promise<void>, log?: (msg: string) => void }} input
 */
export async function waitForGate({
  api,
  sha,
  timeoutMs = 40 * 60 * 1000,
  intervalMs = 20 * 1000,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {},
}) {
  if (!sha) throw new Error('waitForGate needs the head SHA the verdict is about');
  const startedAt = now();
  let polls = 0;

  for (;;) {
    const checkRuns = await api.listCheckRuns(sha);
    const result = evaluateGate({ checkRuns });
    polls += 1;
    const elapsedMs = now() - startedAt;

    if (result.verdict !== 'pending') return { ...result, polls, elapsedMs, timedOut: false, sha };

    if (elapsedMs >= timeoutMs) {
      return {
        ...result,
        verdict: /** @type {'red'} */ ('red'),
        polls,
        elapsedMs,
        timedOut: true,
        sha,
      };
    }

    log(
      `waiting: ${result.pending.length} in flight, ${result.missing.length} not reported yet ` +
        `(${Math.round(elapsedMs / 1000)}s of ${Math.round(timeoutMs / 1000)}s)`,
    );
    await sleep(intervalMs);
  }
}

/**
 * The visible artefact of a non-green gate: what is red, what never reported,
 * and the fact that nothing was merged. Rendered for both the step summary and
 * the pull-request comment so the outcome is legible without opening the run.
 *
 * @param {{ verdict: string, failing: string[], pending: string[], missing: string[],
 *           timedOut?: boolean, sha?: string, runUrl?: string, elapsedMs?: number }} result
 */
export function renderVerdict(result) {
  const lines = [];
  const sha7 = (result.sha ?? '').slice(0, 7);

  if (result.verdict === 'green') {
    lines.push(`### Dependabot merge gate: green (\`${sha7}\`)`);
    lines.push('');
    lines.push(`All ${REQUIRED_CONTEXTS.length} required contexts reported \`success\` on this head SHA.`);
  } else {
    lines.push(`### Dependabot merge gate: NOT merged (\`${sha7}\`)`);
    lines.push('');
    lines.push(
      result.timedOut
        ? 'The gate hit its deadline with contexts still undecided. A context that has not reported is **not** treated as green (objectui#4973), so nothing was merged.'
        : 'A required context is not green, so auto-merge was **not** enabled and this pull request was **not** approved (objectui#4973).',
    );
  }

  if (result.failing?.length) {
    lines.push('');
    lines.push('**Failing:**');
    for (const name of result.failing) lines.push(`- ${name}`);
  }
  if (result.pending?.length) {
    lines.push('');
    lines.push('**Still running at the deadline:**');
    for (const name of result.pending) lines.push(`- ${name}`);
  }
  if (result.missing?.length) {
    lines.push('');
    lines.push('**Never reported:**');
    for (const name of result.missing) lines.push(`- ${name}`);
  }
  if (typeof result.elapsedMs === 'number') {
    lines.push('');
    lines.push(`Waited ${Math.round(result.elapsedMs / 1000)}s.`);
  }
  if (result.runUrl) {
    lines.push('');
    lines.push(`[Gate run](${result.runUrl})`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * A duration from the environment, in seconds, or a loud failure.
 *
 * `Number('40 minutes')` is `NaN`, and `elapsedMs >= NaN` is false forever — a
 * typo in the workflow would turn the deadline off and leave the gate polling
 * until the runner killed the job. That direction is still fail-closed (nothing
 * merges) but it burns 50 minutes of a runner and reports as a timeout rather
 * than as the misconfiguration it is. So a bad value throws here instead.
 *
 * @param {string|undefined} raw
 * @param {number} fallbackSeconds
 * @param {string} name
 */
function readDuration(raw, fallbackSeconds, name) {
  const seconds = raw === undefined || raw === '' ? fallbackSeconds : Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`${name} must be a positive number of seconds, got ${JSON.stringify(raw)}`);
  }
  return seconds * 1000;
}

function appendTo(envVar, text) {
  const target = process.env[envVar];
  if (!target) return;
  fs.appendFileSync(target, `${text}\n`);
}

/**
 * The workflow's entry point. `api` is injectable for the tests; `env` is split
 * out for the same reason. Typed explicitly because a binding with no default in
 * a destructured JS parameter is dropped from the inferred signature under
 * `strict`, which would make the injected `api` a type error at the call site
 * (`tsconfig.scripts.json` compiles the pin tests).
 *
 * @param {{ api?: { listCheckRuns: (sha: string) => Promise<Array<object>> },
 *           env?: Record<string, string | undefined> }} [input]
 */
export async function main({ api, env = process.env } = {}) {
  const sha = env.HEAD_SHA ?? '';
  if (!sha) throw new Error('HEAD_SHA is not set — the gate must be told which commit it is judging');

  const timeoutMs = readDuration(env.GATE_TIMEOUT_SECONDS, 2400, 'GATE_TIMEOUT_SECONDS');
  const intervalMs = readDuration(env.GATE_INTERVAL_SECONDS, 20, 'GATE_INTERVAL_SECONDS');
  const reportFile = env.GATE_REPORT_FILE ?? 'dependabot-merge-gate.md';
  const runUrl =
    env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : '';

  const result = await waitForGate({
    api: api ?? createChecksApi(),
    sha,
    timeoutMs,
    intervalMs,
    log: (msg) => console.log(msg),
  });

  const body = renderVerdict({ ...result, runUrl });
  fs.writeFileSync(reportFile, body);
  appendTo('GITHUB_STEP_SUMMARY', body);
  appendTo('GITHUB_OUTPUT', [`gate=${result.verdict}`, `gated_sha=${sha}`, `timed_out=${result.timedOut}`].join('\n'));

  if (result.verdict === 'green') {
    console.log(`::notice::Dependabot merge gate green on ${sha} after ${Math.round(result.elapsedMs / 1000)}s.`);
  } else {
    const detail = [...result.failing, ...result.missing.map((n) => `${n} (never reported)`)].join(', ');
    console.log(`::error::Dependabot merge gate refused ${sha}: ${detail || 'undecided at deadline'}. Nothing merged.`);
  }

  return result;
}

const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  await main();
}
