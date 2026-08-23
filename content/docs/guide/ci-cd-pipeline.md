---
title: CI/CD Pipeline
description: Overview of the ObjectUI continuous integration and deployment workflows.
---

# CI/CD Pipeline

ObjectUI automates testing, quality checks, releases, and repository maintenance with GitHub Actions. All workflow files live in `.github/workflows/`.

This page deliberately states **no workflow count**. It used to open with "11 GitHub Actions
workflows"; the directory held 12 when [#3212](https://github.com/objectstack-ai/objectui/issues/3212)
was filed and 13 by the time it was fixed. A hand-maintained number drifts by construction, and a
stale one still reads as authoritative. What is pinned instead is the *set*:
`scripts/__tests__/ci-cd-pipeline-doc.test.ts` fails `pnpm test` when a file in
`.github/workflows/` has no section on this page, **and** when this page names a `.yml` that is not
in that directory. Adding a workflow without documenting it is a red test, not a silent omission.

## Workflow Inventory

Every workflow, the name it appears under in the checks list (they are not the same string —
`performance-budget.yml` shows up as **Bundle Analysis**), and whether it can block a merge. Each
one has its own section below.

| Workflow file | Appears as | Runs on | Blocks a PR? |
|---|---|---|---|
| `ci.yml` | CI | Push / PR to `main`, `develop`; merge-queue builds | **Yes** — every job but the two coverage-lane jobs (`test-coverage` and `coverage-report`, push only) runs on PRs and on queue builds |
| `lint.yml` | Lint | Push / PR to `main`, `develop`; merge-queue builds; manual | **Yes** — ESLint **errors** only |
| `changeset-guard.yml` | Changeset Bump Policy | PR / push touching `.changeset/**` | **Yes** |
| `changeset-presence.yml` | Changeset Declaration | PR to `main`, `develop` — **no path filter**; merge-queue builds | **Yes** — when a released package's `src/` changed and no changeset was added |
| `control-bytes.yml` | Control Byte Scan | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** |
| `docs-links.yml` | Internal Docs Link Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** |
| `skills-paths.yml` | Skill Guide Path Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a path stated in a `skills/` guide does not exist |
| `doc-component-types.yml` | Doc Component Type Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a `content/docs/**.mdx` snippet teaches a `type` nothing registers |
| `doc-snippet-types.yml` | Doc Snippet Type Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a covered documentation snippet no longer compiles against the packages' built types |
| `performance-budget.yml` | Bundle Analysis | Push / PR touching `packages/**`, `apps/console/**`, `pnpm-lock.yaml` | **Yes** — the console entry gzip budget |
| `live-e2e.yml` | Live E2E (informational) | PR to `main`, `develop` (code paths); nightly cron `30 6 * * *`; manual | No — informational lane, `continue-on-error` |
| `labeler.yml` | Auto Label PRs | PR `opened`, `synchronize`, `reopened` | No |
| `dependabot-auto-merge.yml` | Dependabot Auto-merge | PR to `main`/`develop` authored by `dependabot[bot]` | No — but it gates *its own* merge, and goes red instead of merging when the check set is not green |
| `cross-repo-issue-closer.yml` | Cross-repo Issue Closer | PR `closed` (acts only when merged) | No — runs after merge |
| `changeset-release.yml` | Changeset Release | Push to `main` (publish half); 6-hourly cron `0 */6 * * *`; manual (version-PR refresh half) | n/a |
| `changelog.yml` | Auto Changelog | Manual dispatch only — nothing triggers it automatically | n/a |
| `stale.yml` | Stale Issues & PRs | Daily cron `0 0 * * *`; manual | n/a |
| `shadcn-check.yml` | Check Shadcn Components | Weekly cron `0 9 * * 1`; manual | n/a |
| `check-links.yml` | Check Links | Weekly cron `17 4 * * 0`; manual | n/a — reports, never gates |
| `published-dist-gate.yml` | Published Dist Tooling Scan | Nightly cron `41 3 * * *`; push to `main` touching the gate; manual | No — the blocking copy runs on the publish path, not here |
| `node-esm-load-gate.yml` | Node ESM Load Scan | Nightly cron `17 4 * * *`; push to `main` touching the gate; manual | No — the per-PR half is `pnpm check:esm-specifiers` in **Type Check** |

The path filters explain most "why did nothing run on my PR?" questions:

- `ci.yml` and `lint.yml` both list `**/*.md`, `content/**`, `docs/**` and `.changeset/**` under
  `paths-ignore` (`ci.yml` also ignores `apps/site/**`) — but **only on their `push` trigger**.
  Their `pull_request` trigger carries no filter at all since
  [#3523](https://github.com/objectstack-ai/objectui/issues/3523): every pull request starts both workflows, and the same list decides *inside
  each job* whether the expensive steps run. A docs-only PR therefore still installs nothing and
  builds nothing, while **Lint**, **Type Check**, **Test (shard N/4)**, **Build & E2E** and
  **Changeset Fixed Group Check** all appear in the checks list and all report. That difference is
  the whole point: a check that is never *created* cannot be a required check — it leaves the PR
  pending rather than failing it — so while the filter sat on the trigger, none of these could be
  required at all.
- `changeset-guard.yml` carries the inverse filter — it runs *only* when `.changeset/**` changes,
  which is precisely why it is a separate workflow instead of a job inside `ci.yml`.
- `changeset-presence.yml` is that guard's mirror image and the reason there are two: a PR which
  *forgot* its changeset does not touch `.changeset/**`, so the inverse filter guarantees the one
  check that could notice never runs. It therefore carries **no** filter and decides from the diff
  inside its script.
- `control-bytes.yml` and `docs-links.yml` carry **no** filter of any kind, which is equally
  deliberate: both guard markdown, and a gate that a markdown-only PR cannot start is no gate on
  the change most likely to trip it. Both cost a checkout plus one `node` call.

## Merge Queue

`main` sits behind an **enforced merge queue**: a direct push is rejected with
405 `Changes must be made through the merge queue`. The queue takes each approved pull request,
rebuilds it on top of whatever `main` has become in the meantime, and merges it only if the
checks it requires are green **on that rebuilt commit**. Those runs are a distinct event,
`merge_group`, on a throwaway `gh-readonly-queue/**` branch — a workflow that does not subscribe
to that event simply does not run there.

Which workflows subscribe is deliberately not listed here. `MUST_SUBSCRIBE_MERGE_GROUP` in
`scripts/__tests__/merge-queue-reporting.test.ts` is the maintained list, and the only copy
anything reads — it records why each entry is on it, and an assertion fails when one of them drops
the trigger. A copy of it on this page would be right the day it was written and quietly wrong
after the next subscriber landed, which is exactly what this paragraph used to do
([#4154](https://github.com/objectstack-ai/objectui/issues/4154)). What is worth knowing here is
the rule that decides membership, not the instances: a gate that carries no path filter reports on
every pull request and is therefore requirable — and a requirable context that skips the queue
build does not fail it, it stalls it.

That rule was learned the expensive way. `ci.yml`, `lint.yml`, `control-bytes.yml` and
`docs-links.yml` did not subscribe at all until
[#3523](https://github.com/objectstack-ai/objectui/issues/3523), and the consequence was not subtle. A queue whose required set
is empty validates nothing: it rebuilds the PR, sees no failing required check because there are
no required checks, and merges. On 2026-08-07 three pull requests
([#3503](https://github.com/objectstack-ai/objectui/issues/3503), [#3510](https://github.com/objectstack-ai/objectui/issues/3510), [#3516](https://github.com/objectstack-ai/objectui/issues/3516)) merged with **Type Check** at
`conclusion=failure`, onto a `main` that [#3498](https://github.com/objectstack-ai/objectui/issues/3498) had left with a type error;
[#3505](https://github.com/objectstack-ai/objectui/issues/3505) hot-fixed the result.

**The three steps have to happen in this order**, and reversing them deadlocks the repository:

1. Subscribe the workflows to `merge_group`. Pure addition — nothing about pull requests changes.
2. Make the contexts report on *every* pull request, by moving path filtering out of
   `on.pull_request.paths-ignore` and into the jobs.
3. Only then may a maintainer add context names to the branch-protection and merge-queue required
   sets. This is a **repository-settings** change; nothing in this repository can do it, and
   nothing here can read the current state of it either.

Step 3 before step 1 is the deadlock: a required context that never reports does not fail a queue
build, it stalls it until the ruleset's 60-minute status-check timeout assumes failure — every
queued PR burns an hour and fails, with nothing red to point at.

Two things follow for anyone editing this directory:

- **A workflow producing a context that could ever be required must subscribe `merge_group`**,
  and takes an entry in `MUST_SUBSCRIBE_MERGE_GROUP` (above) naming the context it produces. That
  entry is what fails the build if the workflow later drops the trigger; nothing derives the set,
  because "may this context be required?" is a property of the repository's settings, which no
  test here can read.
- **Some contexts can never be required, structurally**, and no amount of triggering changes
  that. Each line below is blocked by a *different* property, which is why they are all worth
  reading; they are examples rather than a census, so a further workflow carrying any of these
  shapes is just as unrequirable without appearing here.
  - **Changeset Bump Policy** (`changeset-guard.yml`) — an **inverse** path filter: its
    `pull_request` trigger declares `paths: ['.changeset/**']`, so on a PR that touches nothing
    under `.changeset/**` the context is never created at all.
  - **Bundle Analysis** (`performance-budget.yml`) — an ordinary path filter on the same
    trigger, with the same consequence for every PR that matches none of its paths.
  - **Live E2E (informational)** (`live-e2e.yml`) — the job carries `continue-on-error: true`,
    so the run is green whatever the specs did; it cannot serve as a guarantee of anything.
  - **Close issues referenced in other repositories** (`cross-repo-issue-closer.yml`) — its only
    trigger is `pull_request_target` with `types: [closed]`, and the job additionally requires
    `github.event.pull_request.merged == true`, so it runs only *after* a merge.

  Each of those properties is pinned against the YAML in
  `scripts/__tests__/ci-cd-pipeline-doc.test.ts`: change one of them without editing its line
  here and that test fails, naming the workflow
  ([#4170](https://github.com/objectstack-ai/objectui/issues/4170)). The `live-e2e.yml` line is
  the one already scheduled to become false — that workflow's header says `continue-on-error`
  comes off once the lane has run clean long enough to trust, and the day it does, the lane
  becomes requirable and this line is wrong. Then delete the line and its entry in that test;
  do not soften it in place.

## Core CI Workflow (`ci.yml`)

**Triggers:** **Every** PR to `main`/`develop` (no path filter), every merge-queue build
(`merge_group`), and pushes to `main`/`develop` unless the change touches only `**/*.md`,
`content/**`, `docs/**`, `apps/site/**` or `.changeset/**` (`paths-ignore`, kept on the push
trigger only — see [#3523](https://github.com/objectstack-ai/objectui/issues/3523) and the **Merge Queue** section below).

The path list did not go away, it moved. `type-check`, `test` and `e2e` each open with a
`Decide whether this change needs a full run` step that diffs the PR against its merge base with
exactly that list excluded, and every following step carries
`if: steps.relevant.outputs.should_run == 'true'`. The job always runs and always reports; the
paths decide only whether it does any work. The `docs` job has worked this way since
[#3450](https://github.com/objectstack-ai/objectui/pull/3450) and is where the shape comes from.
The gate fails **open** — if the diff cannot be computed the job runs everything, rather than
reporting green having built nothing.

Every job runs in parallel — there are no `needs:` edges between them. As with the workflow
inventory above, this page states **no job count**: the table *is* the list, and
`scripts/__tests__/ci-cd-pipeline-doc.test.ts` pins its first column against `ci.yml`'s `jobs:`
keys in both directions, so a job added or removed without touching this table is a red test.
(This section used to open with a hard-coded count and list a seventh job, `dev-server`, that had
been deleted three months earlier — [#3451](https://github.com/objectstack-ai/objectui/issues/3451).)

The **What it runs** column is pinned one level further down, by command
([#3653](https://github.com/objectstack-ai/objectui/issues/3653)): every first-party command a job
runs — a `node scripts/*.mjs` invocation, a root `package.json` script, or a `turbo run` task — must
be named in that job's row, and a row may not name one its job does not run. Until that pin landed
this page was judged job by job only, so a `run:` step added to an existing job left every check on
it green — which is how two of `type-check`'s gates came to be missing from this column.

| Job key | Appears as | What it runs | When |
|---|---|---|---|
| `changeset-check` | Changeset Fixed Group Check | `scripts/check-changeset-fixed.mjs` — every workspace package must be in the changeset `fixed` group or explicitly ignored. It checks group *membership*; it does **not** check whether the PR added a changeset. | Every run |
| `type-check` | Type Check | `scripts/check-type-check-coverage.mjs`, then `pnpm check:phantom-deps`, then `pnpm check:self-import`, then `pnpm check:esm-specifiers`, then `pnpm check:spec-symbols`, then `pnpm check:action-forward-parity`, then `pnpm check:i18n-keys`, then `pnpm check:i18n-drift`, then `pnpm type-check:scripts`, then `pnpm type-check`, then `pnpm type-check:vitest-setup`. The coverage guard runs first because turbo silently skips packages that have no `type-check` script, so a package without one would otherwise read as passing (#2911). `pnpm check:phantom-deps` fails when a released package imports a bare specifier its own `package.json` does not declare — a *phantom dependency*, invisible locally because the workspace root's `devDependencies` sit on the upward resolution path from every package directory and on no consumer's, so `require.resolve('react', { paths: ['packages/core/src'] })` succeeds while `@object-ui/core` declares react in no field at all ([#4394](https://github.com/objectstack-ai/objectui/issues/4394)). `pnpm check:self-import` runs next because it reuses that gate's parser: it fails when a file inside a package names its OWN package, a specifier that resolves through the package's `exports` map to `dist/` while `type-check` waits on `^build` — the *dependencies'* builds, never the package's own — so on a cold cache the declarations do not exist yet and the file fails with `TS2307`. Locally it is always green, because every local workflow builds before it type-checks and leaves a `dist/` behind; PR #4789's first run was red on exactly one such line ([#4801](https://github.com/objectstack-ai/objectui/issues/4801)). `pnpm check:esm-specifiers` follows it for the same reason — sources only, no build: it fails when a published package whose build preserves import specifiers (a bare emitting `tsc`, which never rewrites them) writes a relative specifier with no file extension. Node's ESM resolver does not extension-search relative specifiers, so such a specifier makes the published entry unloadable outside a bundler; `@object-ui/react`'s entry died with `ERR_MODULE_NOT_FOUND` while every bundler-based consumer, the whole test suite and CI stayed green ([#4538](https://github.com/objectstack-ai/objectui/issues/4538)). The half that actually *imports* each built entry needs a full build and runs in `node-esm-load-gate.yml`. `pnpm check:action-forward-parity` fails when an action renderer's forward whitelist drops a key the action runtime reads — the class that shipped six times one key at a time, each time green, because the key parses and publishes while the payload is dropped one hop before the runner ([#4050](https://github.com/objectstack-ai/objectui/issues/4050)). The two locale gates sit in the middle because both parse the sources with `typescript`: they need the install and nothing built. `pnpm check:i18n-keys` fails when a `t()` call site asks for a key the `en` pack does not define ([#3530](https://github.com/objectstack-ai/objectui/issues/3530)); `pnpm check:i18n-drift` fails when a change to an `en` string is not accompanied by the nine translation packs ([#3650](https://github.com/objectstack-ai/objectui/issues/3650)), and it is why this job's checkout sets `fetch-depth: 0` — it diffs against the merge base, which a depth-1 clone cannot resolve. `pnpm type-check:scripts` (`tsconfig.scripts.json`) covers `scripts/**/*.ts`, which `pnpm type-check` cannot reach at all — `scripts/` has no package.json, so turbo never walks it, and the coverage guard decides coverage per *package*. Until [#3494](https://github.com/objectstack-ai/objectui/issues/3494) that left the pin tests in `scripts/__tests__/` — including the one pinning this very page — compiled by nothing. `pnpm type-check:vitest-setup` (`tsconfig.vitest-setup.json`) closes the same gap for the four repo-root `vitest.setup.*` files, uncovered until [#3515](https://github.com/objectstack-ai/objectui/issues/3515); it runs *last*, after `pnpm type-check`, because `vitest.setup.dom.tsx` side-effect-imports four `@object-ui/*` packages and resolves them through the declarations that turbo's `^build` produces. | Every run; on a PR the steps short-circuit when only ignored paths changed |
| `test` | Test (shard N/4) | `pnpm test --shard=N/4` across a 4-runner matrix with `fail-fast: false`, so every shard reports its own failures. No coverage instrumentation — v8 adds 40–100% overhead. | Pull requests and merge-queue builds (everything but `push`); steps short-circuit on a PR that changed only ignored paths |
| `test-coverage` | Test (coverage shard N/4) | `pnpm test:coverage --reporter=blob --shard=N/4` across a 4-runner matrix with `fail-fast: false`. Each shard writes `.vitest-reports/blob-N-4.json` — raw coverage and test results in one file — and uploads it as an artifact even when the shard is red, which is what makes a failing coverage run diagnosable at all (vitest deletes `coverage/` on a red run unless `coverage.reportOnFailure` is set, [#5402](https://github.com/objectstack-ai/objectui/issues/5402)). The configured coverage thresholds are neutralised on the shard legs, because a quarter of the suite judged against a whole-suite threshold is not a defect signal; they are enforced once, on the merged report, by the job below ([#5403](https://github.com/objectstack-ai/objectui/issues/5403)). | **Push only** |
| `coverage-report` | Test (coverage) | Downloads the four blob reports, refuses to continue unless all four arrived, merges them with `pnpm test:coverage --merge-reports` into one complete report, and uploads that to Codecov. Its last step runs on every path and states the outcome: the job is **red, with an error annotation**, whenever Codecov did not receive a report for the commit — before [#5403](https://github.com/objectstack-ai/objectui/issues/5403) the upload carried the implicit `success()` and was silently skipped by 311 of 373 coverage jobs, which is how four days of a 100%-failing coverage job went unnoticed. ⛔ It never uploads a report merged from fewer than four shards: a wrong coverage number is worse than a missing one. | **Push only** |
| `e2e` | Build & E2E | Builds the console with `vite build` (`VITE_BASE_PATH=/console/`), verifies the artifact, then `pnpm test:e2e --project=chromium`. Uploads the Playwright report on failure. | Every run; on a PR the steps short-circuit when only ignored paths changed |
| `docs` | Build Docs | `turbo run build --filter='@object-ui/site'`. On a PR it first diffs against the base and skips the build when nothing under `apps/site/` or `content/` changed. It does **not** check docs links any more — that moved to `docs-links.yml` (#3448), because this workflow's `paths-ignore` then hid exactly the docs-only PRs a link check needs to see. #3523 has since removed that filter from the `pull_request` trigger, but the check stays in its own home: `docs-links.yml` still runs where this workflow does not (a docs-only push to `main`), and one gate with one home was the point of #3448. | Every run (build itself conditional) |

Uses: Node 22.x, pnpm via `corepack`, `actions/cache` over `.turbo/cache`.

### What is *not* in `ci.yml`

Three job names this page has carried at one time or another are absent from `ci.yml`, and looking
for them there is a dead end:

- **Lint** is not a `ci.yml` job, and never was. ESLint runs in its own workflow, `lint.yml` (next
  section), and shows up as a separate **Lint** check on the PR.
- **Build Core** does not exist, and never did. `ci.yml` builds only the console SPA that Playwright
  consumes; building the packages and measuring their size belongs to the Bundle Analysis workflow
  (`performance-budget.yml`), as the comment on the `e2e` job states.
- **Dev-server fixture build** (`dev-server`) is the one that *did* exist, and it is the cautionary
  tale behind the pin above. It was added on 2026-05-24 to run
  `pnpm --filter @object-ui/dev-server build` against an in-repo `apps/dev-server`. That app was
  removed two days later, on 2026-05-26 — after which the filter matched no package and the job
  exited 0 without building anything. It stayed green by vacuity for over two months; was then
  *documented in that state* by
  [#3253](https://github.com/objectstack-ai/objectui/pull/3253) on 2026-08-03, whose table row
  claimed a fixture-drift guard that had not run since May; and was finally deleted from `ci.yml`
  by [#3325](https://github.com/objectstack-ai/objectui/pull/3325) on 2026-08-04, which left the
  row behind ([#3451](https://github.com/objectstack-ai/objectui/issues/3451)). **Today there is no
  `apps/dev-server` and no such job** — nothing in the repository is being left unguarded by its
  absence. The intent it was meant to serve, proving this console still works against a real
  `@objectstack` backend, is carried by `live-e2e.yml`, informationally.

  Both halves of that history are the reason the job table is pinned. A row can be wrong because
  the job was deleted under it, and a row can be wrong the day it is written, because the job it
  describes was already doing nothing. Understating a gate is annoying; advertising a guardrail CI
  does not have is worse than no doc, because people trust it and stop checking.

## Lint (`lint.yml`)

**Triggers:** **Every** PR to `main`/`develop` (no path filter), every merge-queue build, pushes
to `main`/`develop` under the same `paths-ignore` as `ci.yml` minus `apps/site/**`, plus manual
dispatch. As in `ci.yml`, the path list moved into the job ([#3523](https://github.com/objectstack-ai/objectui/issues/3523)): the `Lint`
context now reports on every pull request, and short-circuits to no install and no lint when only
ignored paths changed.

This is a **real PR gate**, and it is easy to miss because it is not part of CI — it is its own
**Lint** entry in the checks list.

- `scripts/check-lint-coverage.mjs` runs first: every package must run ESLint or be declared a
  known gap. turbo skips scriptless packages silently, so without this guard a package reads as
  clean because nothing ever linted it.
- Then `pnpm lint`.
- Then `pnpm check` — this repository's own tree run through `objectui check`, the command the CLI
  ships. The step builds the CLI and its workspace dependency closure first, through pnpm rather
  than turbo: the root script executes `packages/cli/dist/`, this job installs without building, and
  a turbo cache hit can replay a build that writes no `dist/` at all — either way the step would
  then fail for a reason that has nothing to do with the tree being checked. Nothing ran this
  command until
  [#5246](https://github.com/objectstack-ai/objectui/issues/5246) — it had been exiting 1 on `main`
  for as long as any `tsconfig.json` carried a comment
  ([#5237](https://github.com/objectstack-ai/objectui/issues/5237)), and no gate ever asked.

**It gates errors, not warnings.** `--max-warnings` is deliberately unset: the repository carries
thousands of warnings (overwhelmingly `no-explicit-any`, plus React Compiler rules the config
downgrades on purpose), and failing on those would make the gate unusable. What must stay clean are
the rules [`eslint.config.js`](https://github.com/objectstack-ai/objectui/blob/main/eslint.config.js)
sets to `error` — including the custom `object-ui/*` ratchets, each of which carries the ADR or
issue it came from in a comment beside the rule itself. Until #2923 this workflow was
`workflow_dispatch`-only, so every one of those `error` ratchets was inert: each was written
specifically to fail CI, and nothing ran them.

The `pnpm check` step splits the same way, and by the command's own behaviour rather than by a flag
set here: `objectui check` exits non-zero on parse errors only, while its unknown-schema-type
warnings print and leave the exit code alone. This gate neither promotes those warnings to failures
nor suppresses them from the log — [#5127](https://github.com/objectstack-ai/objectui/issues/5127)
owns that arm and is open.

## Control Bytes (`control-bytes.yml`)

**Triggers:** Push and PR to `main`/`develop`, plus manual dispatch — with **no path filter at
all**, which is the point of the workflow. It appears in the checks list as **Control Byte Scan**.

Runs `scripts/check-control-bytes.mjs`, which reads `git ls-files` and rejects raw control
characters in every tracked **text** file: the C0 range apart from tab, line feed and carriage
return, plus U+007F. No install, no build — a checkout and one `node` call.

**Why it blocks a merge.** A single raw U+0000 makes grep and ripgrep classify the *entire* file
as binary: they print `binary file matches` and no matching line, so the file silently drops out
of code search and out of every grep-based lint. Nothing else catches it — git decides
binary-ness from the first 8000 bytes only, so a control byte past that offset keeps diffing as
ordinary text, and review cannot see a character that renders as nothing. objectui had no such
guard until objectstack#5425, by which time five files had accumulated the defect.

The two byte classes carry different harms and the report says which:

| Byte | Harm | Measured behaviour |
|---|---|---|
| U+0000 | Code-search outage | GNU grep 3.11 and ripgrep 14 both refuse to print matching lines |
| Every other control byte | Invisible, unreviewable literal | Both tools print the line normally |

Covering only U+0000 would reproduce a known miss: objectstack#5140 shipped a NUL *and* a U+0001
fourteen bytes away, and the NUL-only scanner reported OK on the second one (objectstack#5157).

**Why it is a separate workflow.** `ci.yml` and `lint.yml` used to list `'**/*.md'`, `content/**`,
`docs/**` and `.changeset/**` under `paths-ignore` on *every* trigger, and GitHub has no per-job
path filter. Markdown
is exactly the carrier the worst instance of this bug used — objectstack#4890 was a raw NUL in a
`.claude/` skill file, emitted by the PR that was writing the rule forbidding it, leaving the agent
instructions unfindable by `grep -r` with no signal that anything was missing. A path-filtered gate
could not have seen that PR. [#3523](https://github.com/objectstack-ai/objectui/issues/3523) has since taken that filter off their
`pull_request` triggers, so a markdown-only PR does start them now — but their jobs short-circuit
to nothing on such a change, and both keep the filter on `push`. This gate stays where it is, and
its unfiltered trigger set is why it is one of only two contexts that audit found safe to make
required today. `scripts/__tests__/check-control-bytes.test.ts` fails if a `paths` or
`paths-ignore` key is ever added here.

**If it fails:** write the escape sequence (backslash, lowercase `u`, four zeroes) instead of the
byte — the resulting string is byte-identical at runtime. Better still, if the byte was only ever
"a character the data cannot contain" (a join/split separator, a sentinel), use something a reader
can verify: a newline, a comma, or `JSON.stringify`, which needs no impossible character at all.
When writing *about* these bytes in prose or in a tool payload, name them as `U+0000` — a backslash
escape typed into an agent's tool payload gets decoded into the real byte before it reaches disk,
which is how two of the five incidents in this family happened.

**Known pre-existing offenders.** `KNOWN_OFFENDERS` in the script baselines the files that already
carried a control byte when the gate landed, so it could be switched on as a ratchet. It is not a
skip-list: the scan fails on an entry whose file has been cleaned or deleted, so a fix that forgets
to remove its entry is as red as a new offender. Entries carry the issue tracking their removal
(objectstack#5450) and the map is expected to reach empty and stay there.

## Performance Budget (`performance-budget.yml`)

**Triggers:** Push and PR when changes touch `packages/`, `apps/console/`, or `pnpm-lock.yaml`.
Its display name in the checks list is **Bundle Analysis**.

### Enforced limit

Exactly one bundle-size number in this repository is enforced — this one:

| Bundle | Max gzip size | Enforced |
|--------|---------------|----------|
| Console main entry (`apps/console/dist/assets/index-*.js`) | **350 KB** (`MAX_ENTRY_GZIP_KB`) | Yes — the step exits non-zero when the entry chunk exceeds it |

> The 350 KB above is **pinned to the workflow**, not retyped from memory:
> `scripts/__tests__/ci-cd-pipeline-doc.test.ts` reads `MAX_ENTRY_GZIP_KB` out of
> `.github/workflows/performance-budget.yml` and fails `pnpm test` if this page
> disagrees with it. Change one and you must change the other — the number cannot
> drift silently again ([#3197](https://github.com/objectstack-ai/objectui/issues/3197)).

- Builds the console app and measures bundle sizes.
- Posts a PR comment with the budget report and pass/fail status — but **only when the bundle was actually measured**. A run that was cancelled (a second push supersedes the first via `cancel-in-progress`) posts nothing, and a run whose build never produced a bundle posts a neutral "not measured" note instead of a verdict. A `FAIL` verdict therefore always carries the measured size that exceeded the budget.
- The comment is rendered by `scripts/render-budget-comment.mjs` (unit-tested), not by logic inlined in YAML.

**If it fails:** the step prints `BUDGET EXCEEDED: Main entry is <n> KB gzip (limit: 350 KB)`
and the PR comment carries the same two numbers, so the log already tells you the size and the
overshoot. Read the package size report appended to that comment next: the entry chunk is
`apps/console`'s own code plus everything it imports eagerly, so a jump usually traces to one
new eager import pulling a dependency in. Fix it at that import. Raising `MAX_ENTRY_GZIP_KB`
is a deliberate decision, not a workaround for a red check — and it cannot be done quietly,
because the pin above fails until this page states the new number too.

### Package size report — advisory, not a gate

The same workflow's `Generate package size report` step writes a markdown table of every
`packages/*/dist/*.js` file with its raw and gzipped size, and that table is appended to the
PR comment. The report is generated only from a **complete** package build, so it is never a
truncated table that looks complete.

The step **never compares a measured size against a limit and never exits non-zero** — it
`echo`s the three tiers below into the report as explanatory text. They are guidance for
reviewers; exceeding any of them turns no check red and blocks no merge:

| Package category | Advisory target (gzip) | Enforced |
|------------------|------------------------|----------|
| Core packages | < 50 KB | **No** — advisory only |
| Component packages | < 100 KB | **No** — advisory only |
| Plugin packages | < 150 KB | **No** — advisory only |

> **There is no separate size-check workflow**, and there never has been one in this
> repository — the package size report has always been a step inside
> `performance-budget.yml`. This page used to document one as its own workflow file,
> enforcing the three tiers above; both claims were false, which is worse than no
> documentation because it advertises a guardrail that does not exist. If you want
> these tiers enforced, add the comparison to the workflow — do not describe it as
> enforced here.

## Live E2E (`live-e2e.yml`)

**Trigger:** PRs to `main` / `develop` (same code-path filter as `ci.yml` — docs-only and
changeset-only PRs skip it), a nightly cron (`30 6 * * *`) on `main`, and manual dispatch.

**Blocks a merge: no.** The job runs with `continue-on-error: true` by construction — a red run
is informational and never ejects a PR from the merge queue. Do not add it to required checks
(and do not remove `continue-on-error`) until the nightly record proves the lane stable; see the
header comment in the workflow file (#2835).

What it does: runs an allowlist of the live specs (`pnpm test:e2e:live:ci`) against a real
`objectstack dev` backend booted from **published** `@objectstack/*` packages serving the
showcase app, catching the class of bug only a real browser against a real backend can see.
Failures still surface as a red step plus an uploaded Playwright report and job summary.

**Which specs are in the allowlist:** whatever the `test:e2e:live:ci` script in `package.json`
names — that script is the single source of truth, and this page deliberately does not repeat
the list. The lane grows the allowlist a few proven specs at a time (see the workflow's header
comment), so every promotion would stale a hand-copied enumeration here; it already did
(objectui#3488).

Backend pins live in `e2e/live/ci/backend.env` and must match the `@objectstack/spec` version in
`pnpm-lock.yaml` — bump both in the same PR, or the run proves nothing.

## Internal Docs Links (`docs-links.yml`)

**Triggers:** Push and PR to `main`/`develop`, plus manual dispatch — with **no path filter at
all**, which is the point of the workflow. It appears in the checks list as **Internal Docs Link
Check**.

Runs `scripts/check-doc-links.mjs`, which walks every `.md` / `.mdx` file in the surfaces listed in
its `SCAN_ROOTS` — `content/docs/`, `examples/`, the root `README.md`, `CONTRIBUTING.md`,
`ROADMAP.md`, the internal `docs/` tree and every package `README.md` — and asks of each internal
markdown link whether its target is really there.

**Two rules, because the two groups are read through different machinery** (objectui#3536). For
`content/docs/` the question is the one a site reader cares about, **does the site serve this URL?**
Four checks, by href shape:

| Href shape | Resolved against | Rejected when |
|---|---|---|
| relative (`../plugins/plugin-charts.mdx`) | the linking file's directory | the target file is missing… |
| relative escaping the collection (`../../../packages/x/README.md`) | — | …**or** it resolves outside `content/docs/` (fumadocs can only resolve inside its page index, so the href reaches the browser verbatim — a 404 even though the file exists) |
| absolute `/docs/...` | `content/docs/` as a **route** | no `foo.md`, `foo.mdx` or `foo/index.md*` backs it — a `.md`/`.mdx` suffix always fails, since that URL 404s whatever is on disk |
| any other absolute (`/spec/...`, `/img/...`) | the **site itself**: route segments enumerated from `apps/site/app`, plus static files under `apps/site/public` | no route pattern or static file matches |

**Two href shapes are checked on _every_ surface, both rules included**, because they look external
but are decidable offline:

| Href shape | Resolved against | Rejected when |
|---|---|---|
| this repo's own `https://github.com/objectstack-ai/objectui/(blob\|tree)/main/...` (objectui#3536) | the path in the working tree | that path is not in the checkout. Only `main` and only this repo — other refs and repos cannot be answered offline |
| this site's own `https://[www.]objectui.org/...` (objectui#3603) | the origin is stripped, and what remains goes through the two absolute rows above, unchanged | the resulting route does not resolve — so `…/docs/guide/foo.md` fails for exactly the reason `/docs/guide/foo.md` does |

The second one had been invisible since the beginning: `judgeHref()` skipped every href carrying a
scheme, so a route written with the site's own origin was never checked while the identical
origin-less route was checked strictly. That blind spot was never confined to package READMEs —
`content/docs/` writes 6 such URLs itself — which is why the fix strips the origin in `judgeHref()`
rather than special-casing any surface. Measured before landing: 11 across the scanned tree, zero
dead. Prefer the origin-less form (`/docs/guide/plugins`) in new prose: it survives a domain change,
and both spellings are now checked identically.

Every other surface — `examples/`, `README.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `docs/` and the
package READMEs — is read on **GitHub** (and, for the package READMEs, on **npm**), not served by
the site, so a relative href there names a path on disk and is checked for existence only: a
directory (`./packages/core`) or a non-markdown file (`./vite.config.ts`) is a perfectly good
target, and there is no collection to escape. A leading `/` is rejected outright: GitHub resolves it
against `github.com`, not against this repository. Applying the `content/docs/` rules to these files
instead would reject 186 links that render correctly today.

`CONTRIBUTING.md`, `ROADMAP.md` and `docs/` are objectui#3572. They cost one `SCAN_ROOTS` row each
and no new rule, because "read on GitHub" already had one; their own backlog — three dead links —
was cleared first and separately (objectui#3545), so the rows landed on a green tree.

The package READMEs are objectui#3622, and the same shape: **one row, its backlog paid first**. That
backlog was 11 dead links in seven packages — three `/api/<pkg>` routes the site has never served,
four site URLs naming three `content/docs/` directories that have no index page (so fumadocs
generates no route for them), a `/docs/types` tree that does not exist, an `/examples` route that
does not either, and two disk paths that were simply absent. Each was repointed at a real page, or
replaced with the repository URL that does exist, before the row went in. The row is also the table's only wildcard: `packages/*/README.md` stands for
one file per package directory (38 of the 39 today), and only the README — a package's
`CHANGELOG.md`, `TESTING.md` and its own `docs/` tree stay unscanned.

**Package READMEs must keep the origin on site links.** Inside `content/docs/` the origin-less
`/docs/guide/plugins` is preferred; in a README it would be wrong, because GitHub and npm both
resolve a leading `/` against their own host, not against this site. Write
`https://www.objectui.org/docs/guide/plugins` there — it is checked exactly as strictly.

**One boundary, stated because it is easy to mistake for coverage:** links written inside a code
fence are invisible to this check. `stripCode()` blanks fenced blocks and inline spans before
scanning — required, since fenced code legitimately contains `[…](…)` that is not a link — so a
dead route in an illustrative snippet is not reported. `CONTRIBUTING.md` carries 10 such links
today against 15 outside fences, of which the gate judges one. Prose *about* links stays a human
review item.

One href shape is checked in **every** surface: a
`https://github.com/objectstack-ai/objectui/(blob|tree)/main/<path>` URL points back into this
repository, so `<path>` must exist in the working tree. Other repos' URLs, other refs, and
`#fragments` are not resolvable offline and stay Lychee's job.

Everything else — external `http(s)` and `mailto:` links, bare `#anchors` — is skipped. No install,
no build, no network: a checkout and one `node` call.

The last two rows are objectui#3490. Reading `apps/site` widens the script's responsibility, and
that is the deliberate purchase: it is the only way to catch a link to a route that does not exist,
and 18 such 404s had accumulated while the check waved every non-`/docs` absolute href through. The
cost is that a docs PR can now go red because `apps/site` moved under it — correct, but real. The
header of the script argues the trade-off in full.

**Why it blocks a merge.** A broken internal link is a 404 on the published site, and nothing else
in CI sees it: the site build succeeds with a dead link in it. The script itself is older than its
gate — it existed, worked, and was wired to nothing under `.github/`, so it had never run in CI at
all, and `main` sat with a broken link it would have caught (objectui#3213, objectui#3292).

**Why it is a separate workflow.** This is the second instance of the lesson `control-bytes.yml`
records, and it was found by the PR that first put this check into CI. That PR added it as a step
in `ci.yml`'s `docs` job — where it could never see the PRs that matter. `ci.yml` *then* listed
`'**/*.md'`, `content/**`, `docs/**` and `apps/site/**` under the `paths-ignore` of **both** its
triggers, GitHub's `paths-ignore` skips the *whole workflow* when every changed file matches, and
GitHub has no per-job path filter. So a **docs-only** PR — the likeliest way an internal link breaks — started no
workflow at all, and the check only ever ran on PRs that touched docs alongside code, plus pushes
to `main`. A bad link could merge through a pure-docs PR and turn `main` red later under an
unrelated author (objectui#3448).

The step was **removed** from `ci.yml` in the same change rather than left in place. This
workflow's trigger set is a strict superset of that job's, so keeping both would only add a second
red check for one broken link, and a second place to forget.
`scripts/__tests__/docs-links-workflow.test.ts` pins all of it: the workflow must exist, must gate
pull requests, must carry neither `paths` nor `paths-ignore`, and must remain the only workflow
that runs the script.

[#3523](https://github.com/objectstack-ai/objectui/issues/3523) removed `ci.yml`'s `pull_request` path filter, so the specific blindness above
no longer exists there — but nothing moves back. `ci.yml` still filters its `push` lane, so it
would miss a docs-only push to `main`; and this workflow is one of the two contexts that audit
found safe to require today precisely because it has never had a filter to reason about.

**If it fails:** it prints every offending `file -> href`. Either the link is misspelled, or the
page it points at has moved or been renamed — fix the link, or restore the target. Links are
checked as *routes*, so `/docs/guide/foo` is what belongs in the markdown, not
`content/docs/guide/foo.md`. Run it locally with `pnpm docs:check-links`.

## Skill Guide Paths (`skills-paths.yml`)

**Triggers:** Push and PR to `main`/`develop`, merge-queue builds, plus manual dispatch — with **no
path filter at all**, for the same reason as the two sections above: this gate's entire scan surface
is markdown, and `ci.yml` still lists `'**/*.md'` under the `paths-ignore` of its `push` trigger. It
appears in the checks list as **Skill Guide Path Check**.

Runs `scripts/check-skills-paths.mjs`, which reads every markdown file under `skills/` and asks, of
each in-repo path the prose states inside a backtick code span, whether it exists on disk. Those
guides are a direct input to every agent that writes code in this repository, and their prose gives
paths as coordinates.

**Why a dead coordinate costs more than its size suggests:** the symbol named next to it is usually
real and only the location is wrong, so nobody gets a compile error — an agent gets "file not found"
from a `Read`, assumes its own search was clumsy, and spends a full lap re-locating something the
guide claimed to have located for it. Two rounds were found by eye while reading:
[#3713](https://github.com/objectstack-ai/objectui/issues/3713) (PR #3729) and
[#3730](https://github.com/objectstack-ai/objectui/issues/3730) (PR #3734), the second one 13 real
symbols at coordinates that did not exist. It also recurs by construction — the app-shell extraction
commits moved code with nothing anywhere to say the guides had gone stale
([#3735](https://github.com/objectstack-ai/objectui/issues/3735)).

**What counts as a stated path:** a backtick span that opens with one of five top-level directories
(`apps/`, `packages/`, `examples/`, `scripts/`, `content/`) and contains no whitespace. Three
exclusions, each a *rule* rather than an exemption, because none of them claims that a file exists:

| Excluded | Example in the guides today | Why |
|---|---|---|
| whitespace inside the span | a `grep -rn … packages/app-shell/src` self-check command line | prose, a command line or a type — not a path |
| glob or placeholder segment | the protected-primitive glob under `packages/components/src/ui`, a schema path with a placeholder domain segment | a shape, not a location; `existsSync` on it would mean nothing |
| fenced code blocks | a `bash` block that creates a file | a worked example may legitimately name a file the reader is about to create |

Measured on `main@6422aa891`: 18 guide files, 91 candidate spans, 5 of them patterns — **86 stated
paths, of which 85 resolve**.

**The one exemption, and why it cannot rot.** `scripts/skills-path-baseline.json` lists paths a guide
states *deliberately as absent*. Today there is exactly one: the Key contexts section of
`console-development.md` exists to correct a recurring wrong guess and says there is no
`apps/console/src/context/` directory at all. That entry is a ratchet, red in **both** directions —
if the path ever appears on disk the gate fails and names it (the sentence has become false), and if
the scan stops meeting the entry the gate fails too (the prose was rewritten, so the entry is dead
weight). Entries are keyed by file and token, never by line number, because guide prose moves
constantly.

**Scope, stated so it is not mistaken for an oversight.** `content/docs/**` carries backtick paths
too and is **not** scanned here. Widening a scan surface arrives with its own batch of red to clear,
which `check-doc-links.mjs` learned three times over (#3479, #3490, #3545) — measure it first, in its
own change. The five-prefix list is the same kind of decision: adding this repository's other five
top-level directories was measured at +2 candidates and 0 new red, so it is cheap, but it stays
deliberate rather than assumed.

**If it fails:** it prints every `file:line — token`. Fix the prose. Add a baseline entry only when
the sentence's whole point is that the path does not exist. Run it locally with
`pnpm check:skills-paths`, or `node scripts/check-skills-paths.mjs --list` to see every candidate and
how it was classified.

## Documented Component Types (`doc-component-types.yml`)

**Triggers:** Push and PR to `main`/`develop`, merge-queue builds, plus manual dispatch — with **no
path filter at all**, and here the reason is sharper than in the three sections above. `ci.yml`'s
`type-check` job decides whether to run its gates with a `git diff` that *excludes* `content/**`, so
a pull request editing only `content/docs/**.mdx` reports that context and runs nothing inside it —
and a docs-only pull request is exactly the change that introduces the defect this gate exists for.
It appears in the checks list as **Doc Component Type Check**.

Runs `scripts/check-doc-component-types.mjs`, which reads every fenced code block under
`content/docs/**` and asks, of each `type` string literal in one, whether the repository registers a
component under that name.

**Why the teaching surface needed its own ratchet.** The catalog side has had one since
[#4616](https://github.com/objectstack-ai/objectui/issues/4616):
`examples/schema-catalog/test/catalog-gallery-render.test.tsx` renders every catalog entry and fails
if any paints the registry's `Unknown component type` panel (OBJUI-001). A snippet in the docs is
rendered by nothing, parsed by nothing and compared against nothing, so it could name any string at
all and every check stayed green — while a reader who copied it got the red panel. The same defect
landed three times that way, each found by a human probe:
[#4786](https://github.com/objectstack-ai/objectui/issues/4786) taught `stats-card`, and
[#4796](https://github.com/objectstack-ai/objectui/issues/4796) taught `plugin:grid` and
`plugin:map` (the registered names are `object-grid` and `object-map`).

**Where the key list comes from.** Nowhere — it is derived from the `ComponentRegistry.register(…)`
and `registerLazy(…)` calls themselves on every run, including the loop forms and two helpers that
register from a collection, with `namespace` and `skipFallback` read out of each call's own balanced
argument span. There is no hard-coded enumeration to drift, and no build step, which is what keeps
the whole run to a checkout plus one `node` call. A registration whose key the derivation cannot
resolve **fails the gate** rather than being skipped: a key silently missing from the universe turns
*correct* documentation red, which is the failure mode that gets gates deleted.

**How a snippet is judged.** `type` is not one vocabulary in these pages — measured across 143 files
and 558 literals, the corpus spells action schemas, block schemas, theme and report schemas, field
and JSON-Schema data types, validation rules and navigation items all under the same key. A
structural discriminator was built and rejected on measurement (a TypeScript annotation reads exactly
like an object key to a brace tracker, and `items` carries navigation entries on one page and
renderable children on another, so any global rule is a silent false green somewhere). So the rule is
flat: every literal is a candidate component key, and a value outside the derived universe must be
**declared** in the script's `DOC_TYPE_EXEMPTIONS` — keyed by (file, value), with a written reason
naming the vocabulary it really belongs to. A whole-file exemption is deliberately not offered:
`blocks/block-schema.mdx` carries `type: 'block'` and `type: 'div'` in the same document.

Entries are re-derived per run, so one whose page stopped spelling that type fails as a stale
exemption rather than quietly widening the hole.

**If it fails:** it prints every `file:line — type '<value>'` with the offending source line. Either
spell the registered key (`grep -rn "ComponentRegistry.register(" packages/` for the real name), or —
if the value belongs to another vocabulary — add the declaration with its reason. Run it locally with
`pnpm check:doc-types`.

## Documented Snippet Types (`doc-snippet-types.yml`)

**Triggers:** Push and PR to `main`/`develop`, merge-queue builds, plus manual dispatch — with **no
path filter at all**, for the same reason as the section above: the change that breaks a
documentation snippet is a docs-only change, and that is exactly the shape `ci.yml`'s expensive jobs
short-circuit. It appears in the checks list as **Doc Snippet Type Check**.

Runs `scripts/check-doc-snippet-types.mjs`, which extracts every fenced `ts` / `tsx` block from the
documents it covers and compiles them `--strict` against each package's **built** `dist/*.d.ts` — the
surface a reader who copies the snippet actually imports.

**The second dimension, and why it is separate from the first.**
`doc-component-types.yml` answers whether a `type` literal names a registered component. It says so
in its own header, and [#5138](https://github.com/objectstack-ai/objectui/issues/5138) measured what
the gap beside it allowed: both plugin-report documents taught the pre-9.0 report form for the whole
interval after the ADR-0021 cutover, and every gate was green on that prose — because the `type`
literals (`summary`, `matrix`, `joined`) were the one thing that was correct, while `objectName`,
`groupingsDown`, an object-shaped `columns` and an import of a type the spec does not export sat
beside them. The harness that catches those had by then been hand-rolled three times, privately, in
[#5053](https://github.com/objectstack-ai/objectui/issues/5053),
[#5060](https://github.com/objectstack-ai/objectui/issues/5060) and
[#5047](https://github.com/objectstack-ai/objectui/issues/5047) — which is what made it consolidation
rather than new capability.

**Why this one builds.** Its criterion is the *published* type surface, so the packages the covered
snippets import must exist as `dist/*.d.ts` first. The build is filtered to exactly those packages,
and the filter is emitted by the gate itself (`node scripts/check-doc-snippet-types.mjs
--build-filter`) rather than hand-maintained in the workflow — so it can never drift from what the
documents import, and the cost grows only when coverage grows. This is deliberately **not** the
per-PR full-repo build the 2026-08-16 ruling on
[#4846](https://github.com/objectstack-ai/objectui/issues/4846) rejected; see *Published Dist Gate*
below.

**Fragments are declared, never guessed.** Documentation legitimately carries partial snippets, so a
block that is not meant to compile carries a marker line immediately above its fence with a written
reason — `{/* doc-snippet: fragment - why */}` in `.mdx`, the HTML-comment form in `.md`. A block
that merely fails to parse is **reported**, never skipped: a skip-on-failure rule turns every real
defect into silence, and degrades exactly as the docs get worse.

**Syntax and semantics are reported apart.** `tsc` reports syntactic diagnostics and, if there are
any, never reports semantic ones — program-wide. #5047 measured a run that printed five parse errors,
zero semantic diagnostics, and read as a meaningful red while proving nothing. So this gate parses
blocks one at a time first, keeps unparseable ones out of the semantic program, tags every failure
`[syntax]` or `[semantic]`, and always prints how many blocks the semantic phase actually judged.

**It proves itself before it judges the docs.** Every run prints three controls: the resolved path
for `@object-ui/types` (which must land in a `dist/*.d.ts` — the root `tsconfig.json` maps the
workspace to *source*, so that substitution is one inherited config away), a planted
`ThisNameIsDefinitelyNotExported` import that must produce TS2305 (a program silently resolving to
`any` reports green forever), and a real import that must be clean (so a broken harness cannot read
as "the docs are full of defects"). A failed control fails the run and says no verdict about the
documents can be read from it.

**Coverage is declared.** A document is covered unless the script's `UNGATED_DOCS` ledger names it
with a reason, so a new page is gated from the day it lands and opting one out is a visible edit.
The ledger is debt with names: those documents are **not** compiled and **not** counted, which the
script's header states plainly rather than letting a green run imply otherwise.

**If it fails:** each line is `file:line TS<code>: <message>`, addressed at the document rather than
at the harness. Either fix what the snippet teaches, or — if the block is genuinely partial — declare
it with a reason. Run it locally with `pnpm check:doc-snippets` (after building the packages it
names: `pnpm exec turbo run build $(node scripts/check-doc-snippet-types.mjs --build-filter)`).

## Link Checking (`check-links.yml`)

**Trigger:** Weekly cron (`17 4 * * 0` — Sundays, off the top of the hour, when the scheduled-run
queue is shortest) plus manual workflow dispatch.

There are **two** link checkers, and they cover different things (objectui#3213):

| | Covers | Network | Runs |
|---|---|---|---|
| `scripts/check-doc-links.mjs` | **Internal** links in `content/docs/` (relative hrefs, `/docs/...` routes, every other site-absolute href against `apps/site`), in `examples/`, `README.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `docs/` and every package `README.md` (as paths on disk), plus this repo's own `blob/main/` and `tree/main/` GitHub URLs and this site's own `objectui.org` URLs everywhere — **except** anything inside a code fence | No | `docs-links.yml` — every push and PR, no path filter (previous section) |
| Lychee (this workflow) | **External** URLs, plus **relative** in-repo file links, in `content/docs/`, `docs/` and `README.md` | Yes | Weekly cron and manual dispatch |

Lychee sweeps **both** documentation trees: `content/docs/` (the 183 pages the site publishes) and
the repo-root `docs/` (15 files of internal material — ADRs, audits, architecture notes) plus
`README.md`. Until objectui#3449 it scanned only the latter, so no published page had ever been
link-checked; the workflow was green about a tree almost nobody reads.
`scripts/__tests__/check-links-workflow.test.ts` now derives the expected scope from
`apps/site/source.config.ts`, so moving the content tree turns that test red instead of quietly
blinding the sweep again.

It is deliberately **not** a PR gate (objectui#3213). External link checking goes over the network,
and one 502 or rate-limit from a third-party site would redden a pull request whose author can do
nothing about it. The cron was added only once the scope was correct: a schedule pointed at the
wrong tree just produces a false-green report on a timer.

Uses [Lychee](https://github.com/lycheeverse/lychee) with configuration from `lychee.toml`:
- Scans `content/docs/**/*.{md,mdx}`, `docs/**/*.{md,mdx}` and `README.md`
- Max concurrency: 10, timeout: 20s, retries: 3
- Excludes: localhost, example.com, Twitter/X, GitHub compare/commit URLs
- Skips **site-absolute** routes (`/docs/...`, `/api/...`): Lychee cannot resolve extensionless
  fumadocs routes, and without handling it fails them while building the URI — before `exclude` is
  even consulted. `root_dir` therefore resolves them into a sentinel namespace that is then
  excluded wholesale. Judging those routes is `check-doc-links.mjs`'s job, and duplicating its
  route-to-file mapping here would only create a second copy free to drift.

## Release Workflows

### Changeset Release (`changeset-release.yml`)

**Trigger:** Push to `main` — the **publish** half. Cron `0 */6 * * *` and manual dispatch with
`refresh_version_pr` — the **version-PR refresh** half.

Uses [Changesets](https://github.com/changesets/changesets) for automated versioning and npm
publishing, in **two lanes that cannot do each other's job**:

| Event | `.changeset/` | What runs |
|---|---|---|
| Push to `main` | empty | **Publish to npm.** The version PR has just been merged; that merge is the release act. |
| Push to `main` | changesets pending | **Nothing.** The whole release job is skipped. |
| Cron `0 */6 * * *` | either | **Refresh the version PR** ([#5400](https://github.com/objectstack-ai/objectui/pull/5400)) — never publishes. |
| Manual, `refresh_version_pr` checked | either | The same refresh, on demand. |
| Manual, unchecked | either | Nothing; the run says so with a `::notice::`. |

The refresh used to run on **every** push to `main`, which force-pushed the version PR ~18 times
a working day while releases are weekly — so its branch CI never converged, and every refresh
was a CI run spent on bookkeeping nobody reads until release day
([objectstack#10850](https://github.com/objectstack-ai/objectstack/issues/10850)). A `lane` job
answers "does this commit carry pending changesets?" from a sparse checkout of `.changeset/`
before anything installs or builds, so a landing that owes no publish costs one cheap job.

The refresh lane is invoked **without** a `publish:` script and **without** npm credentials, so
it cannot publish by construction rather than by a condition — the release act in this
repository stays the human merge of the version PR. Step 3 of the publish lane runs
`pnpm changeset:publish`, and that script is
`node scripts/check-published-dist-tooling.mjs && changeset publish` — the **blocking** copy of
the Published Dist Gate above. A published package whose `dist/` carries tooling material stops
the publish before a single tarball reaches npm, which is where that defect actually costs
anything ([#4846](https://github.com/objectstack-ai/objectui/issues/4846)).

Both lanes configure a pnpm-lock.yaml merge driver to prevent lock file conflicts.

### Published Dist Gate (`published-dist-gate.yml`)

**Trigger:** Nightly cron `41 3 * * *`; push to `main` that touches the gate script or this
workflow; manual. **It carries no `pull_request` trigger, on purpose.**

No published package's build output may contain tooling material — `__tests__/`, `__mocks__/`,
`__benchmarks__/`, `*.test.*`, `*.spec.*`, `*.bench.*`, `*.stories.*`. The gate is
`scripts/check-published-dist-tooling.mjs` (`pnpm check:published-dist`); it builds every
published package itself, then reads each one's tarball file list from `npm pack --dry-run`.

Three things about it are easy to get wrong and are written down in the script's own header
([#4846](https://github.com/objectstack-ai/objectui/issues/4846)):

- **The criterion has to be artifact-level.** The cheap static version — "no build tsconfig
  program may contain a tooling file" — was measured and reds five packages that emit nothing
  wrong, because a tooling file in a *checking* program is correct and only a tooling file in an
  *emitting* program is a defect. Acting on it would mean moving tests out of type programs,
  which is the mirror of what
  [#4006](https://github.com/objectstack-ai/objectui/issues/4006) taught.
- **It must never pass vacuously.** A published package that contributes no build output is a
  finding (`no-build-output`), not a skip, and a failed build is a failure rather than a green
  run with nothing to look at.
- **It is deliberately not a PR gate.** The criterion needs a full-repo build and this repository
  has none per PR: `ci.yml`'s **Build & E2E** builds only `@object-ui/console`, and **Type
  Check** gets only the dependency closure from turbo's `dependsOn: ["^build"]`, so leaf packages
  are never built there. The blocking copy runs on the publish path instead — see below.

### Node ESM Load Gate (`node-esm-load-gate.yml`)

**Trigger:** Nightly cron `17 4 * * *`; push to `main` that touches the gate script or this
workflow; manual. **It carries no `pull_request` trigger, on purpose.**

Every published ESM package must be importable by Node's own resolver — no bundler, no loader
hooks. The gate is `scripts/check-node-esm-load.mjs` and it has two legs, only one of which runs
here:

- **The specifier leg** (`pnpm check:esm-specifiers`) reads *sources* and needs no build, so it
  runs per pull request in **Type Check**, not in this workflow. It is the ratchet: for a package
  whose build preserves import specifiers, the emitted specifier *is* the source specifier,
  because `tsc` never rewrites them.
- **The load leg** (`pnpm check:node-esm-load`) builds every published package and then actually
  `import()`s each entry in a child `node`. That is what runs here, and it needs the full build
  this repository has no per-PR copy of — the same trade `published-dist-gate.yml` records above.

Both legs exist because neither is honest alone
([#4538](https://github.com/objectstack-ai/objectui/issues/4538)):

- **Resolving the entry is not enough.** The card was filed from `@object-ui/plugin-charts`,
  whose own emitted entry resolves perfectly; the failure appeared only once evaluation crossed
  into `@object-ui/react`. A check that stops at resolution passes while the tree is broken, so
  the load leg evaluates.
- **The specifier leg cannot see a defect that arrives through a dependency.** In the first full
  run, four plugin packages failed on `packages/mobile/dist/useBreakpoint` — not their file. The
  gate therefore attributes a missing module to the package that *owns* it, so one cause produces
  one finding against one owner.
- **It must never pass vacuously.** "Imported nothing, found nothing" is the verdict this gate may
  never give, so both legs assert a floor on how much they inspected, and a published entry that
  is missing after the build is a finding (`no-build-output`), not a skip.

Packages that still carry the defect are named in the script's `SPECIFIER_DEBT` ledger with a
reason each. The ledger is a ratchet, not a mute button: an entry whose package has become clean
is itself a failure, so it cannot outlive the debt it records. Packages that are not importable
by design — a `bin`-only CLI, or a built web app whose `dist` is `index.html` — are printed on
every run rather than skipped silently.

A separate list, `UNBUNDLED_NODE_UNSUPPORTED`, names the packages plain Node is **not expected
to load at all**. Three style-carrying plugin packages sit there: `@object-ui/plugin-dashboard`
and `@object-ui/plugin-map` import `react-grid-layout`'s and `maplibre-gl`'s stylesheets at
module scope, and `@object-ui/app-shell` reaches the first of those through static imports. All
three resolve fine and then die on `ERR_UNKNOWN_FILE_EXTENSION`, because Node has no loader for
`.css`. That is **a stated product boundary, not debt** — unbundled Node consumption is not
supported for style-carrying plugin packages, ruled on
[#5384](https://github.com/objectstack-ai/objectui/issues/5384) after measuring that no
unbundled-Node consumer exists: every consumer reaches these packages through a bundler (`vite`
in the console and the examples, Next's `transpilePackages` in `apps/site`). The load leg's count
therefore stops short of the total on purpose, and the run prints those three names on every run
rather than quietly subtracting them. Each package says the same thing in its own README, so a
consumer meets the boundary before a red import rather than after one.

The boundary has a price, and the list states it rather than leaving it to be found later: it
matches by **package name**, not by error code, so the load leg cannot speak for those three at
all — a genuine extensionless-specifier regression in one of them would print as a boundary line
instead of failing the run. What guards them instead is the specifier leg, which is a hard
requirement now that `SPECIFIER_DEBT` is empty; [#5357](https://github.com/objectstack-ai/objectui/issues/5357)'s
ablation reverted app-shell's specifiers and watched the specifier leg redden while the load leg
went on printing its ledger line. The ratchet is kept in the other direction too: a named package
whose entry starts loading is itself a failure, because from that moment the exemption costs
coverage and buys nothing.

### Changeset Guard (`changeset-guard.yml`)

**Trigger:** PR to `main`/`develop`, and push to `main`, **when `.changeset/**` changes** — the
inverse of every other workflow's filter. It was carved out of `ci.yml` because `ci.yml` and
`lint.yml` listed `'**/*.md'` and `.changeset/**` under `paths-ignore`, so a PR that added only a
changeset started nothing at all. Since [#3523](https://github.com/objectstack-ai/objectui/issues/3523) such a PR does start both — and every
job in them short-circuits, because `.changeset/**` is still on the in-job ignore list. The check
that has to read the changeset therefore still lives here.

Runs `scripts/check-changeset-no-major.mjs`, which fails if any pending changeset declares a
`major` bump. Every publishable package is in one `fixed` group (39 packages), so a single
`major` publishes all of them as the next major — and objectui's major is pinned to the
`@objectstack` major it is compatible with, not to its own count of breaking changes. Score
breaking changes of our own as `minor` and describe the break in the changeset body.

The one release that legitimately bumps the major is the one following `@objectstack` across
its major; it sets `OBJECTUI_ALLOW_MAJOR=1`. `pnpm test` asserts the same repository state, so
the rule survives this workflow being skipped.

> **A changeset IS now required, by `changeset-presence.yml` — but there is still no
> `skip-changeset` label.** Until [#3387](https://github.com/objectstack-ai/objectui/issues/3387)
> nothing in CI asked whether a PR had added one, and this note said so at length, because the
> opposite had been documented for months: a second workflow inventory at `.github/WORKFLOWS.md`
> — unpinned, therefore free to drift — gave a "Changeset Check" workflow its own numbered
> section, failing any PR touching `packages/` without a `.changeset/*.md` and skippable with a
> `skip-changeset` or `dependencies` label. None of it existed;
> [#3724](https://github.com/objectstack-ai/objectui/issues/3724) deleted the page. The label
> still does not exist (checked against the labels API, 2026-08-08 — of the two names only
> `dependencies` exists, applied by the auto-labeler and read by no gate), and the real gate has
> no label escape hatch by design: its exemption is a changeset with an **empty frontmatter**,
> which lives in the repository where the next reader finds it, rather than a label that vanishes
> from history.
>
> The three real things with adjacent names each do something different, and none of them
> subsumes another. `changeset-guard.yml` reads pending changesets and rejects a `major` bump.
> `ci.yml`'s `changeset-check` job (**Changeset Fixed Group Check**) checks `fixed`-group
> *membership*. `changeset-presence.yml` asks whether this change declared anything at all.

### Changeset Presence (`changeset-presence.yml`)

**Trigger:** PR to `main`/`develop`, and merge-queue builds. **No path filter** — see below.
**Blocks a PR:** yes, when a released package's `src/` changed and the PR added no changeset.

Runs `scripts/check-changeset-presence.mjs`, which compares the change against its merge base with
the target branch and asks one question: did anything under the `src/` of a package the release
covers change, and if so, does this change **add** a `.changeset/*.md`?

- **The exemption is an empty frontmatter.** What is demanded is a declaration, once, by the person
  who still knows what the change does — not a release. A changeset whose frontmatter names no
  package is a first-class pass:

  ```md
  ---
  ---

  Test-only change to the grid column resolver; no published behaviour changes.
  ```

- **The changeset must be ADDED by this change.** `.changeset/` accumulates until a release, so "a
  changeset exists in the tree" would be satisfied by somebody else's pending declaration and make
  the gate vacuous for every change that followed one.
- **The guarded surface is derived, not written down.** Every workspace package named in the
  `fixed` group of `.changeset/config.json` contributes its `src/`; everything in `ignore` is
  skipped. That matters more than it sounds: `@object-ui/console` lives at `apps/console`, outside
  `packages/`, and is both the most-edited published package here and the one the platform's
  `bump-objectui.sh` writes a changeset for — a hand-written `packages/*/src/**` glob would have
  missed it. A changed source file whose package is in *neither* list fails the check rather than
  being assumed unreleased; `check-changeset-fixed.mjs` is the gate that owns that classification.
- **Every missing input fails loudly.** An unresolvable base commit, a `git diff` that errors, a
  missing `.changeset/` directory: all red, none a silent pass. Note the direction is the *opposite*
  of the filter gates in `ci.yml` — those decide whether to run work, so "cannot tell" means run;
  here the work *is* the decision, so "cannot tell" means fail. Both refuse to report green having
  looked at nothing ([objectstack#4928](https://github.com/objectstack-ai/objectstack/issues/4928)).
- **No path filter, deliberately**, and it is the point of the whole workflow. A `paths:` filter
  skips the entire workflow, so the context is never created on a PR that does not match — and a
  required context that is never created leaves the PR pending rather than failing it
  ([#3523](https://github.com/objectstack-ai/objectui/issues/3523)). It would also be a second copy
  of the guarded surface, free to drift from the config the script reads.

**Why this is separate from `changeset-guard.yml`, which also polices changesets:** that workflow's
trigger is `paths: ['.changeset/**']`, and the inversion is deliberate — on a PR that adds *only* a
changeset, every gate inside `ci.yml` and `lint.yml` short-circuits, so nothing in either of them
ever reads the changeset, and that guard exists to see exactly that PR. (It is *not*, as this
paragraph said until [#4381](https://github.com/objectstack-ai/objectui/issues/4381), that such a PR
"starts no other workflow": since [#3523](https://github.com/objectstack-ai/objectui/issues/3523)
both workflows start and report on it — see **Changeset Guard** above, and the path-filter bullets
at the top of this page.) A PR that **forgot** its
changeset does not touch `.changeset/**` at all, so the one check able to notice was the one check
guaranteed not to run. Widening those paths would have broken the case that guard was built for.
Two workflows, opposite directions: one polices the *level* of a declaration that exists, the other
the *existence* of a declaration at all.

Why it exists: [objectstack#4731](https://github.com/objectstack-ai/objectstack/issues/4731) /
[#4843](https://github.com/objectstack-ai/objectstack/issues/4843) made the declared changesets the
single criterion for which frontend changes shipped, and the premise underneath — published source
changed, so a changeset was written — was enforced by nothing. Replaying this gate over the 80
commits before it landed reports 10 that would have failed, two of them user-visible fixes
(`918888a30` `fix(fields)`, `dcff16e06` `fix(cli,create-plugin)`) that reached a release with no
CHANGELOG line anywhere. `scripts/__tests__/check-changeset-presence.test.ts` pins the verdicts, the derived
surface, and every loud-failure path.

### Changelog Generation (`changelog.yml`)

**Trigger:** manual dispatch only. Nothing triggers this workflow automatically.

Uses [git-cliff](https://git-cliff.org/) with `cliff.toml` configuration to regenerate the root
`CHANGELOG.md` and commit it to the repository. Because it commits back to a branch that may have
moved, it configures the lockfile merge driver first (see **Lockfile Merge Driver** below).

**When to run it:** at release time, as part of cutting the release — that is the ritual it
belongs to, and there is no other owner.

The lane also declared `release: types: [published]` until
[#5409](https://github.com/objectstack-ai/objectui/issues/5409), and that half never fired once.
Every release here is authored by `github-actions[bot]`, created by the Changesets action in
`changeset-release.yml` using `secrets.GITHUB_TOKEN`, and GitHub does not start workflow runs from
events raised with that token — so the automated release path structurally cannot wake this
workflow. Measured before the trigger came off: 0 runs across the repository's whole life, against
`changeset-release.yml`'s 4049 through the identical API call. It was removed rather than left
implying an automation that cannot happen.

What follows for readers: the root `CHANGELOG.md` is a **periodically hand-curated summary**, not
an auto-maintained full history. The per-package `CHANGELOG.md` files that Changesets writes on
each release commit are the source of truth for granular and current history.

## Repository Maintenance

### Auto-Labeler (`labeler.yml`)

**Trigger:** PR opened, synchronized, or reopened.

Automatically labels PRs based on file path patterns defined in `.github/labeler.yml`. Syncs labels on each push to the PR.

### Cross-repo Issue Closer (`cross-repo-issue-closer.yml`)

**Trigger:** `pull_request_target` with type `closed`; the job acts only when the PR was actually
merged.

GitHub's closing keywords work **only within a repository**. A PR here whose body says
`Fixes objectstack-ai/objectstack#4475` reads to a human exactly like a same-repo close, merges,
and leaves that issue open forever — with no reference to the PR on the issue's page either. That
is not hypothetical: during v17 verification it happened twice in one day, and both framework
issues had to be closed by hand.

This workflow scans the merged PR body for **qualified** `owner/repo#N` closing keywords (the bare
`#N` form is left to GitHub) and takes one of two visible paths:

| `CROSS_REPO_ISSUE_TOKEN` | Behaviour |
|---|---|
| Configured | Comments on each foreign issue with the PR link, then closes it as `completed`. |
| Absent | Comments **on this PR**, listing every issue that still has to be closed by hand. |

The second path is the point. A workflow that quietly does nothing because a secret was never
provisioned is the same "declared but never enforced" shape both repositories keep having to fix,
so the missing credential announces itself — the run logs the token's presence before any early
return, and the PR comment names the cost.

It uses `pull_request_target` rather than `pull_request` because the latter withholds repository
secrets from fork-originated runs. The usual hazard of `pull_request_target` does not apply here:
the job never checks out the head ref and never executes anything from the PR — it reads the body
and calls the issues API.

### Stale Issues (`stale.yml`)

**Trigger:** Daily at 00:00 UTC (cron), or manual dispatch.

| Resource | Stale after | Close after | Exempt labels |
|----------|-------------|-------------|---------------|
| Issues | 60 days | 7 days | `pinned`, `security`, `critical`, `bug`, `enhancement` |
| Pull Requests | 45 days | 14 days | `pinned`, `security`, `in-progress`, `blocked` |

The two exemption lists are set separately (`exempt-issue-labels` and `exempt-pr-labels`) and
neither is a subset of the other: `critical`, `bug` and `enhancement` exempt issues only,
`in-progress` and `blocked` exempt pull requests only. This page used to state one merged list
— `pinned`, `security`, `critical`, `in-progress` — which was wrong in both directions for
both resources ([#3724](https://github.com/objectstack-ai/objectui/issues/3724)).

### Dependabot Auto-Merge (`dependabot-auto-merge.yml`)

**Trigger:** PRs on `main`/`develop` authored by `dependabot[bot]`.

- **Patch/minor updates**: approved and enqueued — **but only after an explicit wait**, see below.
- **Major updates**: commented for manual review; never approved, never enqueued.
- Configures a pnpm-lock.yaml merge driver for conflict resolution.

**The wait, and why it exists.** This workflow used to run `gh pr merge --auto --squash`
unconditionally for every patch/minor bump. `--auto` lands the merge as soon as GitHub considers
the PR mergeable — that is, as soon as the *branch-protection required set* is satisfied, which is
a different set from "the checks this repository runs". On 2026-08-17 the difference put a red
commit on `main`: [#4959](https://github.com/objectstack-ai/objectui/issues/4959) merged at
08:13:36Z with nine of its nineteen check runs still in flight, and shard 3/4 then reported
`failure` at 08:21:01Z, shard 1/4 at 08:21:56Z. The four-way test shard matrix is the slowest job
here **by construction** — it exists to cut a ~9 minute wall clock — so it is the check `--auto`
systematically outruns, and the resulting red `main` blocked every parallel agent until
[#4968](https://github.com/objectstack-ai/objectui/issues/4968) repaired it. It was the second
time in seven days ([#4098](https://github.com/objectstack-ai/objectui/issues/4098)).

So the wait is now explicit and this workflow owns it
([#4973](https://github.com/objectstack-ai/objectui/issues/4973)):
`scripts/dependabot-merge-gate.mjs` polls the Checks API for the pull request's head SHA until
every context it declares has reported `success`, and only then may the two mutations — approve,
enqueue — run. The declared set is the unfiltered blocking contexts (all four shards, **Type
Check**, **Lint**, **Build & E2E**, **Build Docs** and the five one-`node`-call gates); the
path-filtered ones (**Bundle Analysis**, **Changeset Bump Policy**) must be green *if they
reported*; everything else is listed with the reason it cannot gate. A context that is missing,
still running at the deadline, or anything other than `success` is **not** green: nothing merges,
the job goes red, and a comment on the PR names what refused.

Two properties are worth keeping in mind when editing it:

- The gate does **not** ask GitHub which checks are required, because that set is a
  repository-settings surface nothing here can read (see the three ordered steps under
  [Merge Queue](#merge-queue)) — and it provably does not contain the shards today, since a merge
  happened while all four were `in_progress`. Reading it would reproduce the hole.
- It does **not** replace `--auto` with a direct merge. `main` is behind an enforced merge queue,
  where a direct merge is rejected with 405; enabling auto-merge *is* the enqueue action. What
  changed is that it happens after the check set is green on that SHA, not 29 seconds after the
  shards started.

`scripts/__tests__/dependabot-merge-gate.test.ts` holds both halves: it replays #4959's measured
check-run timeline and asserts the gate says `pending` at the instant of the old merge and `red`
once the shards report, and it asserts the declared buckets partition exactly the set of check
names that `pull_request`-triggered workflows produce — so a renamed or added job fails that test
instead of quietly dropping out of the wait.

### Shadcn Component Check (`shadcn-check.yml`)

**Trigger:** Weekly on Monday at 9:00 AM UTC, or manual dispatch.

- Runs offline and online analysis of shadcn/ui components.
- Creates or updates a GitHub issue if components need review or updating.
- Uploads analysis artifacts for reference.

## Lockfile Merge Driver

`pnpm-lock.yaml` is never merged line by line — it is regenerated. `.gitattributes` asks for
that:

```
pnpm-lock.yaml merge=pnpm-merge
```

Git does not ship a `pnpm-merge` driver, and an attribute naming a driver nothing defines falls
back to an ordinary text merge. So every workflow that merges, rebases, or commits onto a branch
that may have moved defines it immediately after checkout:

```yaml
- name: Configure Git merge driver for pnpm-lock.yaml
  run: |
    git config merge.pnpm-merge.name "pnpm-lock.yaml merge driver"
    git config merge.pnpm-merge.driver "pnpm install --no-frozen-lockfile"
```

Three workflows carry that step, for three different reasons:

| Workflow | Why it needs the driver |
|---|---|
| `changeset-release.yml` | version bumps rewrite the lockfile on the release branch |
| `changelog.yml` | commits a regenerated `CHANGELOG.md` back to the branch |
| `dependabot-auto-merge.yml` | squash-merges dependency PRs whose entire content is often a lockfile change |

`scripts/__tests__/ci-cd-pipeline-doc.test.ts` pins that table against the workflows that
actually configure `merge.pnpm-merge`, in both directions. It is pinned because the claim had
already drifted two ways at once, and neither copy was checked by anything: this page named
`changeset-release.yml` and `dependabot-auto-merge.yml`, while the deleted `.github/WORKFLOWS.md`
named `changeset-release.yml` and `changelog.yml`. Each was missing a different one
([#3724](https://github.com/objectstack-ai/objectui/issues/3724)).

`--no-frozen-lockfile` is spelled out because Actions sets `CI=true`, under which pnpm refuses
to modify the lockfile — a driver that cannot write the file it exists to rewrite would fail the
merge it was installed to resolve. That default is off locally, which is why the same driver is
configured with a plain `pnpm install` under **Configure Git Merge Driver for pnpm-lock.yaml** in
`CONTRIBUTING.md`; contributors want it for the same reason CI does, on rebases of long-lived
branches.

Adding a workflow that merges or pushes? Add the step **after checkout and before the merge**,
and add its row above — the pin fails otherwise.

## Adding a New Workflow

> **Give it a section on this page in the same PR.** Not a convention — a test.
> `scripts/__tests__/ci-cd-pipeline-doc.test.ts` reads `.github/workflows/` and fails when a
> workflow has no heading here naming its file. Three workflows (`lint.yml`,
> `cross-repo-issue-closer.yml`, `changeset-guard.yml`) went undocumented for months precisely
> because nothing checked, and one of them is a PR gate.

1. Create a new `.yml` file in `.github/workflows/`.
2. Follow the existing pattern for pnpm + Turbo setup:

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'pnpm'
- run: pnpm install --frozen-lockfile
```

3. Use Turbo for any build/test/lint steps to leverage caching:

```yaml
- run: pnpm turbo run build --filter=@object-ui/core
```

4. For PR workflows, consider adding path filters to avoid unnecessary runs:

```yaml
on:
  pull_request:
    paths:
      - 'packages/**'
      - 'pnpm-lock.yaml'
```

5. Add a section for it under the right heading on this page, and a row to the
   [inventory table](#workflow-inventory). State the display name if it differs from the file name,
   and say plainly whether it can block a merge.

## Environment Variables and Secrets

| Secret / Variable | Used By | Purpose |
|-------------------|---------|---------|
| `GITHUB_TOKEN` | All workflows | GitHub API access (automatic) |
| `NPM_TOKEN` | `changeset-release.yml` | npm package publishing |
| `CODECOV_TOKEN` | `ci.yml` (`coverage-report` job) | Coverage upload to Codecov |
| `CROSS_REPO_ISSUE_TOKEN` | `cross-repo-issue-closer.yml` | Closing issues in sibling repositories. `GITHUB_TOKEN` cannot do this — it is scoped to the repository running the workflow. When absent the workflow reports instead of closing. |
| `TURBO_TOKEN` | Build workflows | Turbo remote cache authentication |
| `TURBO_TEAM` | Build workflows | Turbo remote cache team identifier |

Secrets are configured in the repository settings under **Settings → Secrets and variables → Actions**.
