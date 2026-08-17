---
---

CI + tooling + test only (objectui#4973). No published package changes: the files touched are
`.github/workflows/dependabot-auto-merge.yml`, a new `scripts/` helper with its pin test, and the
CI/CD guide page.

`dependabot-auto-merge.yml` no longer runs `gh pr merge --auto --squash` unconditionally. `--auto`
lands the merge the moment GitHub considers the pull request mergeable — i.e. the moment the
*branch-protection required set* is satisfied, which is a different set from "the checks this
repository runs". On 2026-08-17 that difference put a red commit on `main`: #4959 merged at
08:13:36Z with nine of its nineteen check runs still in flight, and its shard 3/4 and shard 1/4
then reported `failure` 5m25s and 8m20s later. The four-way test shard matrix is the slowest job
in the repository by construction (it exists to cut a ~9 minute wall clock), so it is the check
`--auto` systematically outruns; `main` went red for every parallel agent until #4968 repaired it,
the second such block in seven days (#4098). The channel was never specific to lockfile ranges —
any red on a slow job could ride it, which is #3523 and #3243 again.

The wait is now explicit and this workflow owns it. `scripts/dependabot-merge-gate.mjs` polls the
Checks API for the pull request's head SHA and returns a verdict; approval and enqueue are both
behind `gate == 'green'`, and the merge is pinned to the judged SHA with `--match-head-commit`. A
required context that is missing, still running at the deadline, or anything other than `success`
is not green — nothing merges, the job goes red, and a PR comment names what refused. The semver
policy (patch/minor auto, major comment-only) is unchanged, and `--auto` is still the merge action
because an enforced merge queue rejects a direct merge with 405.

`scripts/__tests__/dependabot-merge-gate.test.ts` replays #4959's measured check-run timeline and
asserts the counterfactual — `pending` at 08:13:36Z, `red` once shard 3/4 reports — and asserts
that the gate's three declared buckets partition exactly the check names that
`pull_request`-triggered workflows produce, so a renamed or added job fails a test instead of
quietly dropping out of the wait.

Not addressed here, because it is a repository-**settings** surface this repository can neither
read nor change: the branch-protection / merge-queue required set itself, which provably contains
none of the four shards (a merge happened while all four were `in_progress`).
