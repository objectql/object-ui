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
| `changeset-guard.yml` | Changeset Bump Policy, Changeset Overwrite Report | PR / push touching `.changeset/**` or either gate itself | **Yes** — the bump policy job only; the overwrite job is report-only |
| `changeset-presence.yml` | Changeset Declaration | PR to `main`, `develop` — **no path filter**; merge-queue builds | **Yes** — when a released package's `src/` changed and no changeset was added |
| `control-bytes.yml` | Control Byte Scan | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** |
| `docs-links.yml` | Internal Docs Link Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** |
| `skills-paths.yml` | Skill Guide Path Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a path stated in a `skills/` guide does not exist |
| `doc-component-types.yml` | Doc Component Type Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a `content/docs/**.mdx` snippet teaches a `type` nothing registers |
| `doc-snippet-types.yml` | Doc Snippet Type Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a covered documentation snippet no longer compiles against the packages' built types |
| `doc-fence-languages.yml` | Doc Fence Language Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a TypeScript block sits under a fence the snippet gate does not read |
| `pre-install-import-graph.yml` | Pre-Install Import Graph Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a gate a workflow runs *before* `pnpm install` reaches a package anywhere in its import graph |
| `vi-mock-specifiers.yml` | Inert vi.mock Specifier Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a `vi.mock` / `vi.doMock` relative specifier resolves to no file, or the scan's population collapses |
| `shell-escape-residue.yml` | Shell Escape Residue Scan | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a fenced block in `AGENTS.md`, `CLAUDE.md`, `skills/**` or `content/docs/**` carries the enumerated machine-produced shell escape, or a scan root fails to resolve |
| `readme-exports.yml` | README Export Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a `packages/**/README.md` imports a name from its own package that the package does not export, or the scan's population collapses |
| `docs-route-eager-closure.yml` | Docs Route Eager Closure Check | Push / PR to `main`, `develop` — **no path filter**; merge-queue builds; manual | **Yes** — when a package named in `apps/site/app/components/registerCatalogBlocks.ts` is not already reachable from the docs route's module graph (exit 1), or when the gate's own gauge cannot be trusted (exit 2) |
| `governed-surface-guard.yml` | Governed Surface Queue Guard | PR to `main`, `develop` (incl. `ready_for_review`) — **no path filter**; merge-queue builds | **Yes on a queue build only** — a governed-surface diff with no authorized approval pinned to the PR's current head is refused there; on the pull request itself it is deliberately green and prints an early warning |
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
| `spec-range-floors.yml` | Spec Range Floor Scan | Nightly cron `11 4 * * *`; push to `main` touching the gate; manual | No — the blocking copy runs on the publish path, not here |
| `node-esm-load-gate.yml` | Node ESM Load Scan | Nightly cron `17 4 * * *`; push to `main` touching the gate; manual | No — the per-PR half is `pnpm check:esm-specifiers` in **Type Check** |
| `half-state-patrol.yml` | Half-State Patrol | 6-hourly cron `37 1,7,13,19 * * *`; manual; PR touching the sweeper or the workflow | No — **report-only**; it fails only when the sweep could not run |
| `hook-selftests.yml` | Hook Self-Tests | PR / push touching `.claude/hooks/**` or the workflow | **Yes** |

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
- `changeset-guard.yml` carries the inverse filter — it runs *only* when `.changeset/**` changes
  (plus its own YAML and `scripts/check-changeset-no-major.mjs`, so a change to the gate itself is
  exercised by the PR that makes it — objectui#6321), which is precisely why it is a separate
  workflow instead of a job inside `ci.yml`.
- `changeset-presence.yml` is that guard's mirror image and the reason there are two: a PR which
  *forgot* its changeset does not touch `.changeset/**`, so the inverse filter guarantees the one
  check that could notice never runs. It therefore carries **no** filter and decides from the diff
  inside its script.
- `control-bytes.yml` and `docs-links.yml` carry **no** filter of any kind, which is equally
  deliberate: both guard markdown, and a gate that a markdown-only PR cannot start is no gate on
  the change most likely to trip it. Both cost a checkout plus one `node` call.
- `docs-route-eager-closure.yml` carries **no** filter for the opposite reason — not that its
  subject is invisible to a filter, but that a filter naming everything it reads would be
  indistinguishable from having none. Its inputs are the whole `/docs/[[...slug]]` module graph:
  `apps/site/**`, `content/docs/**` (the compiled MDX modules are most of that graph) and
  `packages/**` — a refactor dropping an import from `packages/plugin-view/src/ObjectView.tsx` is
  exactly what turns a free declaration into a new graph — plus the gate's own closure under
  `scripts/`. A filter that then *missed* one of those directories could not be exercised by the
  pull request that changed it, which is the defect
  [#6321](https://github.com/objectstack-ai/objectui/issues/6321) records. It too costs a checkout
  plus one `node` call.

## Merge Queue

`main` sits behind an **enforced merge queue**: a direct push is rejected with
405 `Changes must be made through the merge queue`. The queue takes each approved pull request,
rebuilds it on top of whatever `main` has become in the meantime, and merges it only if the
checks it requires are green **on that rebuilt commit**. Those runs are a distinct event,
`merge_group`, on a throwaway `gh-readonly-queue/**` branch — a workflow that does not subscribe
to that event simply does not run there.

Which workflows subscribe is deliberately not listed here, and is not maintained by hand anywhere
either: `scripts/__tests__/merge-queue-reporting.test.ts` derives the floor from
`REQUIRED_CONTEXTS` — every workflow producing a check that list declares blocking must subscribe,
and an assertion fails the moment one of them does not. `MUST_SUBSCRIBE_MERGE_GROUP` in the same
file records *why* particular members are requirable; a further assertion holds it to being a
subset of the derived floor, so the two cannot drift apart. A copy of the list on this page would
be right the day it was written and quietly wrong after the next subscriber landed, which is
exactly what this paragraph used to do
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

- **A workflow producing a context that could ever be required must subscribe `merge_group`.**
  Nothing has to be added to a list for that to be enforced: name the context in
  `REQUIRED_CONTEXTS` (`scripts/dependabot-merge-gate.mjs`), which is where this repository already
  writes down that a check is blocking and reports on every pull request, and the workflow is
  inside the derived floor from that moment. "May this context be required?" is still a property of
  the repository's settings that no test here can read — `REQUIRED_CONTEXTS` is a human's answer to
  it, and deriving from that answer beats writing it down a second time and watching the copies
  drift ([#6160](https://github.com/objectstack-ai/objectui/issues/6160)). A gate that carries no path filter
  *precisely so that it can be required* is the mirror image of the bullet below, and the sequence
  matters there too: name its context in `REQUIRED_CONTEXTS` and subscribe `merge_group` in the
  same commit that creates the workflow, rather than acquiring either afterwards
  ([#6316](https://github.com/objectstack-ai/objectui/issues/6316) is a worked example — see its
  own section for which gate that was).
- **Some contexts can never be required, structurally**, and no amount of triggering changes
  that. Each line below is blocked by a *different* property, which is why they are all worth
  reading; they are examples rather than a census, so a further workflow carrying any of these
  shapes is just as unrequirable without appearing here.
  - **Changeset Bump Policy** (`changeset-guard.yml`) — an **inverse** path filter: its
    `pull_request` trigger declares
    `paths: ['.changeset/**', '.github/workflows/changeset-guard.yml', 'scripts/check-changeset-no-major.mjs', 'scripts/check-changeset-overwrite.mjs']`,
    so on a PR that touches none of those four neither of its contexts is created at all.
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
| `type-check` | Type Check | `scripts/check-type-check-coverage.mjs`, then `pnpm check:phantom-deps`, then `pnpm check:self-import`, then `pnpm check:side-effects-array`, then `pnpm check:element-data-source-declaration`, then `pnpm check:esm-specifiers`, then `pnpm check:spec-symbols`, then `pnpm check:action-forward-parity`, then `pnpm check:designer-field-key-parity`, then `pnpm check:icon-record-names`, then `pnpm check:i18n-keys`, then `pnpm check:i18n-drift`, then `pnpm type-check:scripts`, then `pnpm type-check`, then `pnpm type-check:vitest-setup`. The coverage guard runs first because turbo silently skips packages that have no `type-check` script, so a package without one would otherwise read as passing (#2911). `pnpm check:phantom-deps` fails when a released package imports a bare specifier its own `package.json` does not declare — a *phantom dependency*, invisible locally because the workspace root's `devDependencies` sit on the upward resolution path from every package directory and on no consumer's, so `require.resolve('react', { paths: ['packages/core/src'] })` succeeds while `@object-ui/core` declares react in no field at all ([#4394](https://github.com/objectstack-ai/objectui/issues/4394)). `pnpm check:self-import` runs next because it reuses that gate's parser: it fails when a file inside a package names its OWN package, a specifier that resolves through the package's `exports` map to `dist/` while `type-check` waits on `^build` — the *dependencies'* builds, never the package's own — so on a cold cache the declarations do not exist yet and the file fails with `TS2307`. Locally it is always green, because every local workflow builds before it type-checks and leaves a `dist/` behind; PR #4789's first run was red on exactly one such line ([#4801](https://github.com/objectstack-ai/objectui/issues/4801)). `pnpm check:side-effects-array` runs next, sources only and no build: it fails when a package's `sideEffects` ARRAY and its module bodies disagree in either direction — a module that registers something at load time and is not named (a bundler drops it, and the registration is gone from a *consumer's* app with no error, no warning and exit 0), or a name whose module no longer registers anything. `@object-ui/app-shell` declares such an array because both simpler answers are measurably wrong for it: omitting the field makes the whole package unshakeable, and `"sideEffects": false` silently drops three live SDUI widget registrations to zero chunks ([#6535](https://github.com/objectstack-ai/objectui/issues/6535), [#6683](https://github.com/objectstack-ai/objectui/issues/6683)). The enumeration is re-derived from the module bodies on every run rather than listed, so there is no second copy to rot. The artifact half of the same contract — do those registrations survive a real bundler — cannot run in this job at all: it needs a built console, so it lives in the SDUI registration pin step of `performance-budget.yml`. `pnpm check:element-data-source-declaration` runs next, sources only and no build: it fails when a source that consumes `ElementDataSourceGate` does not also pass through `elementDataSourceBlock()`, the seam that declares the `dataSource` key the gate reads. A block that wraps the gate off-seam publishes an authoring surface missing the one key its own runtime honours, and the html tier reports that key with the same `unknown-prop` warning it gives the spellings that do nothing ([#6678](https://github.com/objectstack-ai/objectui/issues/6678)). `pnpm check:esm-specifiers` follows it for the same reason — sources only, no build: it fails when a published package whose build preserves import specifiers (a bare emitting `tsc`, which never rewrites them) writes a relative specifier with no file extension. Node's ESM resolver does not extension-search relative specifiers, so such a specifier makes the published entry unloadable outside a bundler; `@object-ui/react`'s entry died with `ERR_MODULE_NOT_FOUND` while every bundler-based consumer, the whole test suite and CI stayed green ([#4538](https://github.com/objectstack-ai/objectui/issues/4538)). The half that actually *imports* each built entry needs a full build and runs in `node-esm-load-gate.yml`. `pnpm check:action-forward-parity` fails when an action renderer's forward whitelist drops a key the action runtime reads — the class that shipped six times one key at a time, each time green, because the key parses and publishes while the payload is dropped one hop before the runner ([#4050](https://github.com/objectstack-ai/objectui/issues/4050)). `pnpm check:designer-field-key-parity` fails when one of the field designers' statically declared payload shapes (`FieldMetadataPayload`, `ServerFieldSchema`, `DesignerFieldDefinition`) declares a key the installed `@objectstack/spec` `FieldSchema` refuses by NAME. Such a key makes `PUT /api/v1/meta/object/:name` return a hard 422 `INVALID_METADATA` that blocks *every subsequent save* of that object, and the author cannot tell from the designer UI which key did it — the class had been filed three times, each closed with a per-key tombstone written after the instance was found in production, with nothing detecting the next one ([#4644](https://github.com/objectstack-ai/objectui/issues/4644) `indexed`, [#4687](https://github.com/objectstack-ai/objectui/issues/4687) `distance_metric`, [#4676](https://github.com/objectstack-ai/objectui/issues/4676) `placeholder`, gated by [#5761](https://github.com/objectstack-ai/objectui/issues/5761)). It reads the accept set off the schema itself rather than from a list, and it covers a deliberately documented *subset* of the write path: a key that reaches the payload only through a `patchDef` spread or an index signature is outside its reach, and the boundary is stated in the script's own docblock. Its draft-I/O half — the `readFields`/`writeFields` round-trip, which has no declared shape to read — runs in the test suite as `object-fields-io.spec-keys.test.ts`. Same placement rationale as the gates around it: it parses the sources with `typescript` and imports the installed spec, so it needs the install and nothing built. `pnpm check:icon-record-names` fails when an authored icon NAME that reaches a resolver reading lucide's runtime `icons` record is not a live key of that record. lucide retires a spelling by dropping it from that record while keeping it as a deprecated named export, so the retired name still imports, still type-checks and still renders wherever it is used as a *component* — `Edit === SquarePen` is true — and resolves to nothing wherever it is used as a *string*: nothing goes red in either direction, which is why the class was repaired twice in two packages before anyone gated it ([#5586](https://github.com/objectstack-ai/objectui/issues/5586), [#5622](https://github.com/objectstack-ai/objectui/issues/5622), [#5633](https://github.com/objectstack-ai/objectui/issues/5633)). It carries no list of retired spellings — the record itself is the judgement — and it re-discovers the resolver population from source on every run, which is how its first pass found four record-reading resolvers nobody had catalogued. It sits here because it parses the sources with `typescript` and reads the installed lucide: the install, and nothing built. The two locale gates sit in the middle because both parse the sources with `typescript`: they need the install and nothing built. `pnpm check:i18n-keys` fails when a `t()` call site asks for a key the `en` pack does not define ([#3530](https://github.com/objectstack-ai/objectui/issues/3530)); `pnpm check:i18n-drift` fails when a change to an `en` string is not accompanied by the nine translation packs ([#3650](https://github.com/objectstack-ai/objectui/issues/3650)), and it is why this job's checkout sets `fetch-depth: 0` — it diffs against the merge base, which a depth-1 clone cannot resolve. `pnpm type-check:scripts` (`tsconfig.scripts.json`) covers `scripts/**/*.ts`, which `pnpm type-check` cannot reach at all — `scripts/` has no package.json, so turbo never walks it, and the coverage guard decides coverage per *package*. Until [#3494](https://github.com/objectstack-ai/objectui/issues/3494) that left the pin tests in `scripts/__tests__/` — including the one pinning this very page — compiled by nothing. `pnpm type-check:vitest-setup` (`tsconfig.vitest-setup.json`) closes the same gap for the four repo-root `vitest.setup.*` files, uncovered until [#3515](https://github.com/objectstack-ai/objectui/issues/3515); it runs *last*, after `pnpm type-check`, because `vitest.setup.dom.tsx` side-effect-imports four `@object-ui/*` packages and resolves them through the declarations that turbo's `^build` produces. | Every run; on a PR the steps short-circuit when only ignored paths changed |
| `test` | Test (shard N/4) | `pnpm test --shard=N/4` across a 4-runner matrix with `fail-fast: false`, so every shard reports its own failures. No coverage instrumentation — v8 adds 40–100% overhead. | Pull requests and merge-queue builds (everything but `push`); steps short-circuit on a PR that changed only ignored paths |
| `test-coverage` | Test (coverage shard N/4) | `pnpm test:coverage --reporter=blob --shard=N/4` across a 4-runner matrix with `fail-fast: false`. Each shard writes `.vitest-reports/blob-N-4.json` — raw coverage and test results in one file — and uploads it as an artifact even when the shard is red, which is what makes a failing coverage run diagnosable at all (vitest deletes `coverage/` on a red run unless `coverage.reportOnFailure` is set, [#5402](https://github.com/objectstack-ai/objectui/issues/5402)). The configured coverage thresholds are neutralised on the shard legs, because a quarter of the suite judged against a whole-suite threshold is not a defect signal; they are enforced once, on the merged report, by the job below ([#5403](https://github.com/objectstack-ai/objectui/issues/5403)). | **Push only** |
| `coverage-report` | Test (coverage) | Downloads the four blob reports, refuses to continue unless all four arrived, merges them with `pnpm test:coverage --merge-reports` into one complete report — which is where the configured coverage thresholds are enforced, over the whole merged map, the shard legs having overridden them to zero — and publishes that report as the `coverage-report` artifact (kept 7 days, the same as the blobs it is derived from). Its last step runs on every path and states the outcome: the job is **red, with an error annotation**, whenever the gate did not run for the commit — before [#5403](https://github.com/objectstack-ai/objectui/issues/5403) the final step carried the implicit `success()` and was silently skipped by 311 of 373 coverage jobs, which is how four days of a 100%-failing coverage job went unnoticed. A breach of the thresholds is reported *separately* from a lane that never delivered, because the two call for opposite actions. ⛔ It never merges a report from fewer than four shards: a wrong coverage number is worse than a missing one. The Codecov upload this job used to carry was retired by [#5436](https://github.com/objectstack-ai/objectui/issues/5436) — `CODECOV_TOKEN` was never set, so it failed on every push; the trend dashboard and PR coverage comments are gone with it, the gate is not. | **Push only** |
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
its `SCAN_ROOTS` (17 rows as of objectui#6280) — `content/docs/`, `examples/`, the internal `docs/`
tree, every package and app `README.md`, the rest of each package's and app's directory tree (every
file except `README.md` and `CHANGELOG.md`, the latter excluded everywhere as changesets output
rather than authored prose), every nested `README.md` a package or app carries below its top level,
and the root-level markdown files (`README.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `AGENTS.md`,
`CHANGELOG.md`, `CLAUDE.md`, `LICENSE-THIRD-PARTY.md`, `QUICK_REFERENCE.md`) — and asks of each
internal markdown link whether its target is really there.

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
documents import, and the cost grows only when coverage grows. Each emitted filter carries pnpm and
turbo's dependency-closure suffix (`--filter=@object-ui/react...`), because the packages the
documents import are not a buildable unit on their own: they depend on workspace packages no snippet
names, and those have to exist first. Under `turbo run build` the suffix selects the same tasks
`dependsOn: ["^build"]` already did; under `pnpm ... run build`, which selects exactly what it
matches, it is the difference between a build that completes and one that dies on an import the
reader never wrote ([#5911](https://github.com/objectstack-ai/objectui/issues/5911)). This is
deliberately **not** the per-PR full-repo build the 2026-08-16 ruling on
[#4846](https://github.com/objectstack-ai/objectui/issues/4846) rejected; see *Published Dist Gate*
below.

**And the filter is checked, twice.** The step that derives it fails the job if the gate exits
non-zero, and the build step refuses a filter that names no package
([#6221](https://github.com/objectstack-ai/objectui/issues/6221)). Written the obvious way —
`echo "args=$(node …)" >> "$GITHUB_OUTPUT"` — the step's status is `echo`'s, so a gate that failed
would read as a gate that named nothing, and `turbo run build` with no filter is the whole-workspace
build this section just said the job must never run.

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

## Fence Languages (`doc-fence-languages.yml`)

**Triggers:** Push and PR to `main`/`develop`, merge-queue builds, plus manual dispatch — **no path
filter**, for the same reason as the two sections above. It appears in the checks list as **Doc Fence
Language Check**.

Runs `scripts/check-doc-fence-languages.mjs`. It answers the question the gate above cannot ask about
itself: *is every TypeScript block in the documentation actually fenced as TypeScript?*
`check-doc-snippet-types` reads `ts` / `tsx` / `typescript` fences and nothing else, so a TypeScript
block fenced any other way is invisible to it —
[#5867](https://github.com/objectstack-ai/objectui/issues/5867), whose remediation lane collected its
population from ```plaintext fences only.

**`plaintext` is not the only spelling of an unhighlighted fence.**
[#6135](https://github.com/objectstack-ai/objectui/issues/6135) measured a ```text block opening
`interface FileUploadSchema {` sitting outside the gate *and* outside the lane that exists to close
it, for no reason but how its fence is spelled. Widening the lane's derivation once would fix that
block; it would not stop a sixth spelling reopening the identical gap.

**So it reads bodies, not a list of languages.** No enumeration of allowed fence languages is on the
enforcement path — an enumeration is the thing that rots, and it rots silently. Every fence's body is
put to #5867's own binding triage classifier (*a block whose first line starts with `import` /
`export` / `interface` / `type X =` / `const x: T` is code*), quoted rather than extended. `txt`,
`console`, `raw`, or a bare fence with no info string at all therefore cannot hide a block.

**Two failure modes, because only one can be auto-classified.** A *known* spelling of an
unhighlighted fence (`plaintext`, `text`, `plain`, `txt`, no info string) is #5867's population and
its remedy is mechanical, so it is the only mode the baseline describes. Any *other* spelling might
be a sixth synonym or a real highlighter language — that is a human's call, so it is reported
separately and can **never** be baselined.

**The baseline is #5867's remaining population.** `KNOWN_UNHIGHLIGHTED_TS_FENCES` maps a path to the
number of hidden blocks it carries, ⛔ **shrink-only** in the shape
[#6133](https://github.com/objectstack-ai/objectui/issues/6133) landed for
`KNOWN_HAND_TYPED_GUARDS`: a file not in the map that carries one fails, a file carrying more than
its number fails, and a file carrying fewer fails as *stale* and names itself. Every #5867 batch now
lowers these numbers in the same pull request that re-fences the blocks, so the lane's arithmetic
lives in the repository instead of being re-derived by hand in each handback.

**`--self-test` runs first.** It drives the real scanner over fixture sources — including a
`text`-fenced, a `txt`-fenced and an info-string-less TypeScript block — and pins the shrink-only
baseline in every direction it can move. A scanner whose recogniser is broken reports a clean tree,
which is why the probe runs before the verdict.

**If it fails:** each line is `file:line ```<language> — <first line of the block>`. Re-fence the
block ```ts (or ```tsx) and fix whatever `check-doc-snippets` then reports, then lower the file's
number. Run it locally with `pnpm check:doc-fences`; it needs no install and no build.

## Pre-Install Import Graphs (`pre-install-import-graph.yml`)

**Triggers:** Push and PR to `main`/`develop`, merge-queue builds, plus manual dispatch — with **no
path filter at all**. What this gate judges is the arrangement of the workflows themselves, so its
input is `.github/workflows/**` plus the `scripts/` files those workflows name, and the change most
likely to break it is a workflow edit. It appears in the checks list as **Pre-Install Import Graph
Check**.

Runs `scripts/check-pre-install-import-graph.mjs`. Several gates in this repository deliberately run
**before any `pnpm install`** — that is what lets them run unfiltered on every pull request shape for
the price of a checkout plus one `node` call. The property that arrangement silently depends on is
that each of those scripts' *whole static import graph* is node builtins plus repo-relative modules,
with nothing in it needing `node_modules`.

**Why it needed a gate.** A violation is invisible everywhere it could be caught cheaply: it is not a
type error (`tsc` is happy with a package import), not a lint error (the package is a real dependency
of the repo), not a local failure (locally `node_modules` exists), and — until
[#6148](https://github.com/objectstack-ai/objectui/issues/6148) — not a test failure, because exactly
one of the pre-install scripts had a test asserting it. It surfaces only as `ERR_MODULE_NOT_FOUND`
inside one CI job, on whichever pull request happens to touch the file; and for the gates that carry
no path filter *precisely so they see every PR shape*, that is a gate which **stops running** rather
than one that fails loudly.

**The population is derived, never listed.** On every run the gate parses every workflow and, per
job, compares each step's index against the index of the first `pnpm install` step **in that same
job**. Move a step above an install and the population grows on the next run; move one below and it
shrinks. A hard-coded list would break silently the first time someone moved a step across an
install, which is exactly the edit that needs catching. Two anchoring decisions the derivation
depends on, each with a case in this repository: `pnpm exec playwright install chromium` installs a
browser rather than the workspace, and `git config merge.pnpm-merge.driver "pnpm install …"` in
`changeset-release.yml` *configures* a driver — the `pnpm install` there is a quoted argument, and
that job's real install is a later step — reading either as an install would move a boundary and
silently drop a script out of the population.

**It walks the graph, not the entry file.** Requiring each of the entry's own imports to start with
`node:` is too narrow in one direction (a relative import of a builtins-only local module is fine,
and two of these scripts spell their builtins bare as `from "fs"`, which is equally install-free) and
too weak in the other, because it cannot see a package pulled in **one hop away**. Since
[#6092](https://github.com/objectstack-ai/objectui/issues/6092) every one of these scripts imports
`scripts/invoked-as.mjs`, so one hop away is exactly where the next breach comes from. The check is
static rather than a runtime resolver hook because a hook *executes* module top level, and these
files are CI gates that spawn `git`, read the whole tree and call `process.exit`.

**It is in its own population.** The step above runs a `scripts/` file before any install, in a job
that never installs, so the gate walks its own import graph on every run. A floor that exempted its
own enforcer would be the first thing to rot.

**If it fails:** it prints the offending chain — `scripts/some-gate.mjs -> scripts/invoked-as.mjs ->
typescript` — rather than a bare verdict, so the hop that introduced the package is named. Repairing
the import is deliberately *not* this gate's job: either drop the package, or move the step below
`pnpm install` in its workflow and accept the install cost. Run it locally with
`pnpm check:pre-install-import-graph`, `node scripts/check-pre-install-import-graph.mjs --list` to see
the derived population and every module walked, or `--self-test` to exercise the parser and the walk
against fixtures.

## Inert vi.mock Specifiers (`vi-mock-specifiers.yml`)

**Triggers:** Push and PR to `main`/`develop`, merge-queue builds, plus manual dispatch — with **no
path filter at all**. A module mock can be written into any package in any shape of pull request, and
the scan costs a checkout plus one `node` call, so there is nothing to gain by hiding it behind a
filter. It appears in the checks list as **Inert vi.mock Specifier Check**.

Runs `scripts/check-vi-mock-specifiers.mjs`. It walks every tracked JS/TS-family source file, finds
each `vi.mock` / `vi.doMock` call site, and resolves the **relative** specifiers against the calling
file's own directory. Any that resolves to no file fails the run.

**Why it needed a gate.** A mock whose specifier names no file does **not** error. Vitest registers
it against a module id nothing imports, the run proceeds with the *real* module everywhere, and the
suite passes — with no warning and no smaller assertion count, identically to a correct one. In
[#5646](https://github.com/objectstack-ai/objectui/issues/5646)'s one known instance (PR #5645) the
suite passed even when the code under test was reverted to the exact broken shape it had been written
to catch; only an ablation leg exposed it. Neighbouring mocks in that same file made it invisible to a
reader: one stepped up a single level and one stepped up two, and **both were correct**, because
their targets sat at different depths. This is
[#4347](https://github.com/objectstack-ai/objectui/issues/4347) one layer down — a declaration
pointing at nothing, reported as a pass.

**It is green at rest, so its census is part of the verdict.** There are zero unresolvable specifiers
in the tree and there should stay zero, which means the run's output alone cannot distinguish a
working gate from one that matches nothing. Two things answer that. The verdict line prints the
**population** it judged, not a bare `OK`. And the scan **fails when that population collapses**: no
source files, no test files, or no relative specifiers is a broken walk, not a clean tree, and
reporting `OK` for it would be this gate's own defect one level up. The evidence that the gate works
lives in `scripts/__tests__/check-vi-mock-specifiers.test.ts`, which reconstructs the historical
specifier on a fixture tree and pins that the two correct neighbours are *not* flagged.

**Resolution matches how this repo spells specifiers**, which is more than an existence check: the
bare path plus `.ts/.tsx/.js/.jsx/.mjs/.cjs`, the `/index.*` forms, and a trailing `.js` stripped and
retried, because `src/` is NodeNext throughout. The judgement is `isFile` rather than "exists", so a
directory with no index is correctly unresolved. Comments are masked and a call quoted inside a string
literal is counted but not judged — an ESLint `RuleTester` code sample is source text, not a mock.

**Scope:** relative specifiers only. A bare specifier (`@object-ui/…`, `lucide-react`) can be
misspelled too, but resolving one needs the workspace map rather than the filesystem — a different
check with a different failure mode. Bare specifiers are counted in the census and never judged.

**If it fails:** it names the file, the line and the specifier, and the first path it tried. Fix the
specifier, then confirm the mock is really installed by reverting the code under test and checking
that the suite goes red. Run it locally with `pnpm check:vi-mock-specifiers`, or
`node scripts/check-vi-mock-specifiers.mjs --list` to see every call site the walk found. It needs no
install and no build.

## Shell Escape Residue (`shell-escape-residue.yml`)

**Triggers:** Push and PR to `main`/`develop`, merge-queue builds, plus manual dispatch — with **no
path filter at all**. The scan surface is markdown that any shape of pull request can touch, and a
markdown-only change is exactly the shape `ci.yml` and `lint.yml` skip their expensive steps on. It
appears in the checks list as **Shell Escape Residue Scan**.

Runs `scripts/check-shell-escape-residue.mjs`. It walks `AGENTS.md`, `CLAUDE.md`, every `.md`/`.mdx`
under `skills/` and every one under `content/docs/`, and fails when a **fenced code block** contains
one of the enumerated machine-produced shell-quote escape runs.

**Why it needed a gate.** In [#5150](https://github.com/objectstack-ai/objectui/issues/5150) the
`git commit -F -` example in `AGENTS.md` §9 shipped with its heredoc terminator wrapped in the
single-quote-inside-single-quote shell escape. Copied verbatim, that example does not fail with a
message — it **hangs**, on a terminator that never matches, and a reader does not attribute a hung
terminal to the document. [#5151](https://github.com/objectstack-ai/objectui/issues/5151) then ran the
full derived gate union against the replanted bytes: `check-control-bytes`, `check-doc-links`,
`check-changeset-presence` and `check-changeset-no-major` **all exited 0**. None of them was
negligent — the residue is printable ASCII inside a code block, and no scan surface in this repository
reached it. The amplifier is that `AGENTS.md`, `CLAUDE.md` and `skills/**` are re-read **once per
session** by every agent seat, so a bad example is not paid once; it is paid by every reader.

**⛔ What this gate does not do.** It checks an **enumerated literal** — one entry today, the sequence
#5150 leaked. It does **not** make fenced shell examples executable-by-construction, and nothing in
this repository does: a ```bash block may be syntactically invalid, may never terminate, or may name
a flag that does not exist, and this gate is green on all of it. Running `bash -n` over every block is
#5151's **unbuilt** "direction 1"; it was ruled out of that card rather than rejected on the merits,
and it carries a dependency worth recording — it is only as good as its **extraction convention**. In
#5150's own example the block sat inside a numbered list, so both lines carried a two-space indent,
and a quoted heredoc terminator must reach **column 0**. Rendered markdown strips the container indent
and the block looks fine; agents read these files by `cat`, not by rendering them, so a verbatim copy
including the indent hangs exactly as the original defect did. The boundary is asserted as a *fact* in
`scripts/__tests__/check-shell-escape-residue.test.ts` — broken shell is fed to the gate and a pass is
required — rather than pinned as a sentence, so the claim cannot rot into a false one.

**It is green at rest, so its census is part of the verdict.** There are zero occurrences in the tree
and there should stay zero, which means the run's output alone cannot distinguish a working gate from
one that matches nothing. The verdict line therefore prints the **per-root population** — files and
fenced blocks for each of the four roots — rather than a bare `OK`, and the scan **fails when that
population collapses**: a root that does not resolve, a root that walks to fewer documents than its
floor, or a total fence count under the floor is a broken walk, not a clean tree. A scan root that has
moved or been mistyped is reported **by name**, because a mistyped root and a clean root produce
identical output otherwise. The evidence that the gate works is the ablation in its test suite, which
replants #5150's exact line in each root on a fixture tree.

**Scope:** fenced blocks only. An occurrence in prose or an inline code span is **counted in the
census and not judged**, because documentation about this defect class has to be able to name the
literal. That is a known narrowing, and the census figure is what keeps it visible.

**If it fails:** it names the file, line and column, the fence language and the line the fence opened
on. Note that `AGENTS.md`, `CLAUDE.md` and `skills/**` are **governed surface** — a finding in one of
those is reported for a human to fix in its own change, not folded into an unrelated pull request. A
finding under `content/docs/**` is an ordinary docs fix. Run it locally with
`pnpm check:shell-escape-residue`, or `node scripts/check-shell-escape-residue.mjs --list` to see the
per-root census. It needs no install and no build.
## README Exports (`readme-exports.yml`)

**Triggers:** Push and PR to `main`/`develop`, merge-queue builds, plus manual dispatch — with **no
path filter at all**. It appears in the checks list as **README Export Check**.

The absent filter is the point. The two edits that introduce this drift are a README change and a
source change that renames or drops an export, and `ci.yml` structurally cannot see the first: every
one of its jobs opens with the `id: relevant` short-circuit whose diff excludes `**/*.md`, so on a
README-only pull request its expensive steps are skipped by design. A gate against fabricated README
imports living behind that switch would rebuild the hole it exists to close.

Runs `scripts/check-readme-exports.mjs` (`pnpm check:readme-exports`). For every **tracked** `README.md`
under `packages/`, it extracts the fenced code blocks, parses each one with the TypeScript parser, walks the
`ImportDeclaration` nodes, and for every binding that names the README's **own** package checks the
name against that package's real export surface.

**Why it needed a gate.** A README teaching `import { X } from '@object-ui/<pkg>'` for an `X` the
package does not export gave the reader a `TypeError` at runtime or a TS2305/TS2724 at build time, and
these READMEs are listed in each package's `files`, so they ship in the npm tarball. Nothing checked
them: `check-doc-links.mjs` parses links and never looks inside a code block, and
`check-doc-component-types.mjs` scans `content/docs` and never enters `packages/`. One manual sweep
([#5043](https://github.com/objectstack-ai/objectui/issues/5043)) found drift in **seven** packages
(#5010–#5016) and recorded that number as a *lower bound*, because the method it used could only see
single-line import statements.

**It parses, it does not match.** The card's first sketch was a cross-line regex; measured on
`plugin-gantt` it reported five words of prose as fabricated import names and missed both real
fabrications, because a **side-effect import** (`import '@object-ui/plugin-gantt';`, no `from`) lets a
lazy quantifier run on to the next `from` twenty lines later. Parsing makes that unrepresentable: a
multi-line block is one node, a trailing `//` comment is trivia that can never contribute a name, and
`A as B` exposes the export name separately from the local alias — the gate judges **`A`**.

**The export set is symbols, never a grep.** It comes from the TypeScript checker's
`getExportsOfModule` over each package's *declared* type entry, with aliases resolved before the
value/type flags are read. A text-level set is measurably wrong here: `GanttSchema` grepped in
`packages/types/src` has six hits, every one of them a substring of `ObjectGanttSchema`.

**Three verdicts, because two of them have different fixes.** `real`; `fabricated` (no package exports
it — delete or rename); and `wrong-path` (the name is real but belongs to another package, so the
*path* is what to change). #5010's `CalendarViewSchema` was the third kind, and the first run of this
gate found one more: `packages/core/src/adapters/README.md` imported `ObjectStackAdapter` and
`createObjectStackAdapter` from `@object-ui/core` when both live in `@object-ui/data-objectstack`.

**It builds first, and refuses to guess when it cannot.** The declared type entry is a built
`dist/index.d.ts` for almost every package, so the workflow installs and runs `turbo run build` before
the check (measured cold, concurrency 2, on a contended container: 2m42s for all 39 packages). If a
package's type entry is missing anyway, that is a **failure**, never a skip: counting it as "exports
nothing" would mark every import in its README fabricated, and skipping it would shrink the judged
population with nothing in the output to say so.

**It is green at rest, so its census is part of the verdict** — READMEs scanned, blocks parsed,
bindings judged, packages whose exports were read — and the census says **tracked** out loud,
because the walk is `git ls-files`: a new README that has not been `git add`-ed is outside the
population and a local run reports OK without opening it (objectui#6545). CI is unaffected — a
committed tree has no untracked files — and the scan **fails when that population
collapses**. The evidence that it can fail lives in `scripts/__tests__/check-readme-exports.test.ts`,
which plants four mutations on a fixture tree: a fabricated name in a multi-line block, one in a
trailing comment (which must **not** be reported), an `X as Y` with `X` fabricated, and one mid-block
in a type import.

**Out of scope, deliberately:** compiling the extracted blocks (a separate card — it has pre-existing
reds that need a baseline decision first), and authorable-JSON *key* surfaces, which no type check can
reject while `BaseSchema` carries an index signature and its Zod mirror is `.passthrough()`.

**If it fails:** it names the README, the line of the offending specifier, and which package really
exports the name. Run it locally with `pnpm check:readme-exports` after a build, or
`node scripts/check-readme-exports.mjs --list` to see every self-import it judged.

## Docs Route Eager Closure (`docs-route-eager-closure.yml`)

**Triggers:** Push and PR to `main`/`develop`, merge-queue builds, plus manual dispatch — with **no
path filter at all** (the reason is in the [inventory](#workflow-inventory) bullets above). It
appears in the checks list as **Docs Route Eager Closure Check**, and `REQUIRED_CONTEXTS` in
`scripts/dependabot-merge-gate.mjs` declares that context blocking — which is also what puts this
workflow inside the derived `merge_group` floor, because a required check that never reports on a
queue build does not fail it, it stalls it for the ruleset's 60 minutes.

Runs `scripts/check-docs-route-eager-closure.mjs` (`pnpm check:docs-route-closure`): a checkout plus
one `node` call over the source tree, **no install and no build**, ~1.3 s.

**What it weighs, and what was not weighing it.**
`apps/site/app/components/registerCatalogBlocks.ts` is a list of side-effect imports, and each one
pulls its package's module graph into the Next docs route `/docs/[[...slug]]` — a route **all 181
docs pages share**, not just the catalog gallery. The cards that added to that list said the cost
was governed by `check:eager-closure`. It was not:
`scripts/check-eager-closure-budget.mjs` reads `apps/console/dist/eager-closure.json` and
`performance-budget.yml` builds `@object-ui/console`, so that budget weighs the **console**. The
only measurement of the docs route that has ever existed was reconstructed by hand, once, from the
`script src` set of the prerendered route on disk, and the `+50%` stop condition
[#4616](https://github.com/objectstack-ai/objectui/issues/4616) set had no gauge behind it
([#6316](https://github.com/objectstack-ai/objectui/issues/6316)).

**Structural, not byte-level — ruled that way on purpose.** A second byte budget would need a
556-page docs build in CI. This gate instead walks the route's **static** module graph from source —
the route entries, plus every compiled `content/docs/**` MDX module, which the route pulls in through
the generated `.source/server.ts` — and sorts every package the registrar names into one of three
buckets:

| Bucket | Meaning |
|---|---|
| **Recorded** | listed in the gate's `MEASURED_PAYLOAD` — its eager cost was argued for and written down when it landed |
| **Free** | already reachable without this file naming it, so the import adds a *declaration* and no payload |
| **New graph** | neither, so the import pulls a graph this route has never carried — **fails** |

The third bucket is the whole point: it turns an unmeasured hazard into a review event, which is
what a cheap instrument can honestly do. `MEASURED_PAYLOAD` is a ledger and **not a ceiling** — it
carries no bytes and no threshold, and every entry is re-measured on each run, so an entry the
registrar stopped naming, or one that became reachable some other way, fails and has to shrink.

**Exit 1 and exit 2 mean different things, and must not be read as one.** Exit **1** is a verdict
about the registrar: a new graph, or a ledger that has drifted. Exit **2** says the **gauge** is not
trustworthy — a specifier the walk must resolve did not, a route entry moved, the registrar is no
longer reachable from the route at all, or every workspace package now reads as reachable (a
traversal that reaches everything cannot tell a new graph from a free one). A reader who sees exit 2
must not conclude the registrar is wrong; nothing was validly measured. All three verdicts print
before any of them decides the code, the way `check-eager-closure-budget.mjs` prints its four.

**A structural gate that cannot fail is worse than none**, because it converts an unmeasured hazard
into a false assurance — so the failing direction is verified rather than assumed.
`scripts/__tests__/check-docs-route-eager-closure.test.ts` drives the real analysis over fixture
trees for each way the walk could silently answer "everything is reachable": a fenced MDX code block
counted as an import, an erased `import type`, a lazy `import()` (the distinction the gate exists to
police — `PluginLoader` is built on it so those graphs stay *off* this route), a package named only
in the registrar's own prose, an unresolved specifier, and the registrar falling off the route.

**If it fails:** the message names the package, the line that declares it, and the two ways out —
reach the code through a package the route already carries, or argue for the payload in review and
record it in `MEASURED_PAYLOAD` with what it is for. Run it locally with
`pnpm check:docs-route-closure`; a green run prints the full classification, including which file
each *free* package is already imported by.

## Governed Surface Guard (`governed-surface-guard.yml`)

**Trigger:** Pull request to `main` / `develop` (`opened`, `synchronize`, `reopened`,
`ready_for_review`) and merge-queue builds — **no path filter** on either leg.
**Appears as:** **Governed Surface Queue Guard**.
**Blocks a PR?** Not on the pull request, by design. On a merge-queue build it refuses.

The **governed surface** is a fixed list — `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `skills/**`,
`docs/adr/**` — and the rule about it is that a change to any of them is merged by a human, not by
the queue. That rule used to live only in prose. On
[#6183](https://github.com/objectstack-ai/objectui/pull/6183) an `AGENTS.md` change was correctly
parked as a draft; a GitHub MCP `update_pull_request` call passing only `reviewers` silently also
set `draft: false`; the pull request entered the merge queue and landed with no human approval, and
converting it back to a draft did not dequeue it. Nothing in CI could have refused that. This
workflow is the refusal ([#6596](https://github.com/objectstack-ai/objectui/issues/6596)).

**The two legs mean different things, and that is the whole design.** On a **pull request** the
check is deliberately green whatever it finds, and prints an early warning naming the governed paths
and the sequence not to start. A governed pull request sitting as a draft for the maintainer to
merge by hand is the *healthy* end state, so a check that reddened on it would be red on the healthy
case forever — and a permanently red check is one everybody learns to ignore. On a **merge-queue
build** the same finding is a refusal: that is a state a governed pull request should never be in at
all, so red there is red on the anomaly.

**What clears the queue leg** is an `APPROVED` review by an account in `GOVERNED_APPROVERS` whose
`commit_id` equals the pull request's *current* head sha. The sha pin is what makes the approval an
approval *of something*: a push after the approval goes stale and reopens the refusal, so a
clearance cannot outlive the bytes it was given for. Dismissed and superseded approvals never count.
The remedy the refusal prints **first** is not approval at all — convert the pull request back to a
draft and leave the merge to the maintainer.

**What it costs when nothing is governed:** nothing. The path test runs before any request is
constructed, so an ordinary pull request produces a `CLEAR` verdict and **zero** GitHub API calls;
an API outage cannot block a diff that touches no governed path. The mirrored requirement is that an
API error on a diff that *is* governed is a refusal with its own exit code (4, distinct from 3 for
"nobody approved"), never a pass — this gate exists because every other layer in the chain failed
open.

**What it deliberately does not do.** It does not govern its own workflow or CI configuration
generally: that would be a larger rule than the one that was ruled. It cannot stop a maintainer
merging a governed pull request by hand, and does not try — under this regime the human merge *is*
the review record. And it does not make itself required: that is a branch-protection setting only
the maintainer can flip. Until it is flipped, the queue leg reports without stopping anything. What
this repository can write down, and has, is `REQUIRED_CONTEXTS` in `scripts/dependabot-merge-gate.mjs`.

**If it fails:** read the verdict — it names every governed path that matched, the pull request each
belongs to, and the two ways out. To ask the same question about a file list before pushing, run
`pnpm governed -- AGENTS.md packages/core/src/index.ts` (or
`node scripts/check-governed-queue-guard.mjs --test <paths>`); it exits 0 when nothing is governed.
The predicates are covered by `node scripts/check-governed-queue-guard.mjs --self-test`, which the
workflow runs as its own first step because a rotted predicate must redden rather than wave a
governed diff through, and the wiring is pinned by
`scripts/__tests__/check-governed-queue-guard.test.ts`.

## Link Checking (`check-links.yml`)

**Trigger:** Weekly cron (`17 4 * * 0` — Sundays, off the top of the hour, when the scheduled-run
queue is shortest) plus manual workflow dispatch.

There are **two** link checkers, and they cover different things (objectui#3213):

| | Covers | Network | Runs |
|---|---|---|---|
| `scripts/check-doc-links.mjs` | **Internal** links in `content/docs/` (relative hrefs, `/docs/...` routes, every other site-absolute href against `apps/site`), and, as paths on disk: `examples/`, the internal `docs/` tree, every package and app `README.md`, the rest of each package's and app's directory tree (everything but `README.md`/`CHANGELOG.md`), every nested `README.md`, and the root-level markdown files (`README.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`, `LICENSE-THIRD-PARTY.md`, `QUICK_REFERENCE.md`) — plus this repo's own `blob/main/` and `tree/main/` GitHub URLs and this site's own `objectui.org` URLs everywhere — **except** anything inside a code fence | No | `docs-links.yml` — every push and PR, no path filter (previous section) |
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

| Event | Predicate | What runs |
|---|---|---|
| Push to `main` | declared version **not** on npm | **Publish to npm.** Normally the version-PR merge, which is the release act; also the retry for a release whose own run failed. |
| Push to `main` | declared version already on npm | **Nothing.** Every ordinary landing — a merge that is not a release does not move the version. |
| Cron `0 */6 * * *` | n/a | **Refresh the version PR** ([#5400](https://github.com/objectstack-ai/objectui/pull/5400)) — never publishes. |
| Manual, `refresh_version_pr` checked | n/a | The same refresh, on demand. |
| Manual, unchecked | n/a | Nothing; the run says so with a `::notice::`. |

The refresh used to run on **every** push to `main`, which force-pushed the version PR ~18 times
a working day while releases are weekly — so its branch CI never converged, and every refresh
was a CI run spent on bookkeeping nobody reads until release day
([objectstack#10850](https://github.com/objectstack-ai/objectstack/issues/10850)). A cheap `lane`
job answers the questions the split turns on from a sparse checkout of `.changeset/` and
`packages/core/`, before anything installs or builds.

#### The publish lane is keyed on npm, not on `.changeset/`

The publish half asks **"is the version this commit declares already on npm?"** — not "are
changesets pending?" ([#5442](https://github.com/objectstack-ai/objectui/issues/5442)). The two
read as interchangeable and come apart exactly where it costs a release: the version PR is cut
from `main` at T and merged at T+n, `main` takes ~18 merges a working day, and the merge does not
remove the changesets that landed in between. Those belong to the *next* version — but keyed on
them, the version this commit just bumped to is skipped, and the next version PR bumps straight
past it. Measured when #5442 was fixed: of the 90 versions `packages/core/CHANGELOG.md` declared,
**16 had never reached npm**, and the repository said `17.6.0` while `dist-tags.latest` said
`17.5.0`.

The npm predicate is also **cheaper** than the one it replaced, rather than a trade against it. An
ordinary landing does not move the manifest version, so it answers "already published" and the
expensive job is skipped — where "no changesets pending" ran the job in full on every landing that
happened to find `.changeset/` empty, only to publish nothing.

`@object-ui/core` is the version anchor because every package in the `fixed` group of
`.changeset/config.json` moves as one version, so any member answers for the whole release. The
lane **asserts** that membership instead of assuming it, and it refuses to guess a lane if the
registry cannot be read: 200 is published, 404 is not, and anything else fails the run.

`changesets/action@v1` chooses publish-vs-version from repository state rather than from an input,
so the predicate cannot reach it on its own — with changesets present it would take its version
branch and publish nothing. The publish lane therefore clears the pending `.changeset/*.md` from
the **runner's working tree** before invoking it. Nothing is committed and nothing is pushed
(`runPublish` pushes tags and creates releases; it never commits), so `.changeset/` on `main` is
untouched and those changesets are still owed to the next version PR.

#### The loud check

#5442's defect was never a red run — it was a green one: run 3370 on `cfeb378b5` completed
`success` having published nothing, and only a CHANGELOG-against-registry audit noticed, 16
versions later. So the publish lane now reads the registry back afterwards and **fails** if the
version it exists to ship is still absent. A repo/npm divergence is a failing run, not a finding.

The refresh lane is invoked **without** a `publish:` script and **without** npm credentials, so
it cannot publish by construction rather than by a condition — the release act in this
repository stays the human merge of the version PR. The publish lane runs
`pnpm changeset:publish`, and that script is
`node scripts/check-published-dist-tooling.mjs && changeset publish` — the **blocking** copy of
the Published Dist Gate above. A published package whose `dist/` carries tooling material stops
the publish before a single tarball reaches npm, which is where that defect actually costs
anything ([#4846](https://github.com/objectstack-ai/objectui/issues/4846)).

#### The release PR runs no CI, so the refresh lane validates the tree itself

The version PR gets **no checks of its own, and cannot be given any**. Measured 2026-08-25:
`ci.yml` has **849** runs on `changeset-release/main` and every recent one is `action_required`
with `created_at == run_started_at == updated_at` — created and immediately parked, nothing
executed. GitHub does not start workflow runs from events raised by `GITHUB_TOKEN`, and the
refresh force-pushes that branch, so there is no stable head to re-run against either. On the
17.6.0 release PR the check-runs endpoint returned `total_count: 1`: one job, started **7 seconds
after the merge**. The release commit is therefore the only commit that reaches `main` without
passing the merge queue ([#5397](https://github.com/objectstack-ai/objectui/issues/5397)).

So the refresh lane renders `pnpm changeset:version` into the runner's working tree, validates it,
restores the tree, and only then invokes the action — which does its own versioning and owns the
commit and the push.

**What it validates, and why that is not `pnpm test`.** The version step cannot move a source
byte. Measured against the real tree (328 pending changesets, 17.6.0 → 17.7.0) it touches 411
paths: 330 `.changeset/*.md` deleted, 40 `package.json` (the `"version"` key and nothing else), 40
generated `CHANGELOG.md`, and `QUICK_REFERENCE.md`. The source in the post-version tree is
byte-identical to the `main` commit `ci.yml`'s push lane just tested under coverage across four
shards, so a suite run here would re-test tested bytes at ~40 minutes a go, four times a day —
~2.7 h of daily runner time for a PR nobody reads until release day, which is the cost
[objectstack#10850](https://github.com/objectstack-ai/objectstack/issues/10850) was closed to
remove. The validation is scoped to the surfaces the diff can move instead:

| Command | Covers | Measured |
|---|---|---|
| `pnpm quick-reference:check` | `QUICK_REFERENCE.md` | ~1 s |
| `pnpm check:control-bytes` | the 40 generated `CHANGELOG.md` | ~4 s |
| `pnpm test scripts/__tests__` | 73 files / 1996 tests — every test that reads a manifest version, `QUICK_REFERENCE.md` or a `CHANGELOG.md` | ~50 s |

`check:spec-floors` and `check:published-dist` are deliberately **not** here: they read dependency
ranges and built `dist/`, neither of which the version step moves, and `pnpm changeset:publish`
runs both first on the publish lane anyway.

There is also **no "only when the PR content changed" condition**, for a measured reason: across
the seven consecutive 6-hourly windows from 2026-08-23T06:08Z to 2026-08-25T00:10Z, six carried
new changeset files (median 18). Such a predicate would skip about one refresh in seven while
adding a local prediction of another project's state that can be wrong silently — the shape
[#6081](https://github.com/objectstack-ai/objectui/issues/6081) just deleted from this file.

**Failure semantics.** A red validation fails the job and the refresh never runs, so the standing
PR keeps its last validated content rather than being force-pushed to a broken one. Nothing here
can touch the publish lane: all three steps are scoped to `schedule` / `workflow_dispatch`. The
restore step is load-bearing — with `.changeset/` left consumed the action would find nothing
pending, take its no-op branch and return, and the PR would fossilise with nothing failing
anywhere — so the restoration is asserted, not assumed.

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

### Spec Range Floors (`spec-range-floors.yml`)

**Trigger:** Nightly cron `11 4 * * *`; push to `main` that touches the gate script or this
workflow; manual. **It carries no `pull_request` trigger, on purpose.**

A package's declared `@objectstack/spec` floor must carry every symbol that package's own
build output references. The gate is `scripts/check-spec-range-floors.mjs`
(`pnpm check:spec-floors`); the workflow builds every published package, then the gate compares
each one's `dist` imports of `@objectstack/spec/*` against the export set of the version that
package's own range admits at its lowest.

The defect it closes ([#5793](https://github.com/objectstack-ai/objectui/issues/5793)):
`@object-ui/plugin-detail` shipped `dist/renderers/record-reference-rail.d.ts` re-exporting
`ReferenceRailEntry` from `@objectstack/spec/ui` — a symbol that arrived in spec 17.1.0 — while
its own `dependencies` still named a floor a minor lower. A declared range is a public claim,
and that one admitted a spec without the symbol. (No range literal is quoted here on purpose:
the live answer is `packages/plugin-detail/package.json`, and this gate's output.) Normal installs resolve the newest 17.x and never see it,
which is exactly why nothing found it: it is a floor-honesty defect, and the lockfile hides it
from every other check in this repository.

Two ways of building this check return a confident green, and both are avoided by construction
rather than by care — the script's header carries the long version:

- **Resolution answers the wrong question.** The root `package.json` declares
  `@objectstack/spec`, so pnpm hoists it to the workspace root and every resolution succeeds
  from every package directory regardless of that package's own manifest. A green type-check
  therefore proves nothing about a floor: it type-checks against the *installed* version. The
  gate resolves nothing through `node_modules` — it fetches the declared minimum from the
  registry and reads that tarball's own `exports` map. It is the same trap
  `check-phantom-dependencies.mjs` records for `react`.
- **The spec is dual-package.** `require` reaches `dist/<entry>/index.js` and `import` reaches
  `dist/<entry>/index.mjs`, with separate type entries. Reading it through `createRequire` judges
  a build no bundler ever puts in an application. The gate walks the fetched manifest's `exports`
  map under the **`import`** condition and prints the entry it landed on, and `--cross-check`
  re-reads the `require` half and compares.

Like the two gates above it, the criterion is artifact-level and therefore needs a full build,
so the blocking copy runs on the publish path and this workflow is the nightly alarm. Reading
`src/` instead would be cheaper and wrong in the expensive direction: an `import type` used only
inside a function body is erased and never reaches `dist/`, so a source-level version would
demand floor bumps nothing published justifies.

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

The same `paths:` list also carries the gate's own YAML and both scripts it runs,
`scripts/check-changeset-no-major.mjs` and `scripts/check-changeset-overwrite.mjs`
([#6321](https://github.com/objectstack-ai/objectui/issues/6321))
— self-coverage, not the inverse trigger above: without it, a PR that edits the gate is not the PR
that runs it, and the first real execution lands on someone else's unrelated `.changeset/**` PR.
Deliberately not listed: `scripts/check-changeset-presence.mjs` (the overwrite gate imports its
base-ref resolver, `git diff` wrapper and frontmatter reader rather than growing a third copy —
the second copy, in `check-i18n-en-drift.mjs`, inherited a real defect from that resolver's first
draft and had to be fixed to match under
[#3766](https://github.com/objectstack-ai/objectui/issues/3766); the root vitest suite exercises it
on any PR touching `scripts/**`), `scripts/invoked-as.mjs` (a dependency the gate scripts import, but a
widely shared one — 40+ importers under `scripts/` — that `published-dist-gate.yml`,
`spec-range-floors.yml` and `node-esm-load-gate.yml` also import without listing; only
`half-state-patrol.yml` lists it, as a documented one-off) and the script's own
`__tests__/check-changeset-no-major.test.ts` (it already runs in the root vitest suite on any PR
that touches `scripts/**`, the same `~ partial` reasoning `published-dist-gate.yml` and
`spec-range-floors.yml` apply to their own gate scripts' `__tests__` files).

Runs `scripts/check-changeset-no-major.mjs`, which fails if any pending changeset declares a
`major` bump. Every publishable package is in one `fixed` group (39 packages), so a single
`major` publishes all of them as the next major — and objectui's major is pinned to the
`@objectstack` major it is compatible with, not to its own count of breaking changes. Score
breaking changes of our own as `minor` and describe the break in the changeset body.

The one release that legitimately bumps the major is the one following `@objectstack` across
its major; it sets `OBJECTUI_ALLOW_MAJOR=1`. `pnpm test` asserts the same repository state, so
the rule survives this workflow being skipped.

#### Second job: Changeset Overwrite Report

Runs `scripts/check-changeset-overwrite.mjs`, which asks a different question of the same files:
did this change **modify or delete a `.changeset/*.md` that already existed at its merge base** —
a changeset it did not add? It is a separate job because it reads a diff and so needs
`fetch-depth: 0`, which the bump-policy job does not want.

[#6336](https://github.com/objectstack-ai/objectui/issues/6336) is why it exists. A dev run wrote
its changeset to a hand-picked `changesets`-style name that already existed on `main`, and the
heredoc overwrote an unrelated `@object-ui/plugin-charts: minor`. It was caught before any commit,
but the property that makes it worth a gate is that **the cost lands on a third party and is
invisible at the time it happens**: the agent that picks the colliding name loses nothing, and
whichever earlier PR's release declaration vanishes only discovers it when a package silently
fails to bump. Both signals that should catch it fail — `git status` shows `` M`` rather than
`??`, which reads as your own new file landing, and a deleted release declaration is not something
any later gate flags. With 424 accumulated changesets against an `adjective-animal-verb` name
space, the collision probability is not theoretical.

**It is report-only, and that is measured rather than cautious.** Across all 5281 first-parent
commits on `main`, 12 commits modified a pre-existing changeset (19 files) and **all 19 were
legitimate** — bump levels corrected when the pending release line changed, a "eleven" corrected
to "ten", a typo'd package name fixed, authors amending their own not-yet-released changeset. A
blocking gate would have failed every one of those PRs. Deletions are dominated by the release
itself (82 of 88 delete changesets alongside a package `CHANGELOG.md`, which is `changeset
version` emptying the queue); the job recognizes that shape and says so instead of reporting it.
`OS_CHANGESET_OVERWRITE_ENFORCE=1` flips the job to blocking for whoever revisits this with a new
measurement.

⭐ **The convention that makes the hazard impossible**: name a changeset after the issue it
settles — `.changeset/<issue>-<slug>.md`. The `adjective-animal-verb` names are safe when
`pnpm changeset` allocates them, because it allocates against the files already present; picking
one by hand is what removes that guarantee.

> **A changeset IS now required, by `changeset-presence.yml` — but there is still no
> `skip-changeset` mechanism.** Until [#3387](https://github.com/objectstack-ai/objectui/issues/3387)
> nothing in CI asked whether a PR had added one, and this note said so at length, because the
> opposite had been documented for months: a second workflow inventory at `.github/WORKFLOWS.md`
> — unpinned, therefore free to drift — gave a "Changeset Check" workflow its own numbered
> section, failing any PR touching `packages/` without a `.changeset/*.md` and skippable with a
> `skip-changeset` or `dependencies` label. None of it existed;
> [#3724](https://github.com/objectstack-ai/objectui/issues/3724) deleted the page.
>
> ⚠️ **The label object came back, and it still does nothing.** This note used to report a
> point-in-time labels-API reading (2026-08-08: of the two names only `dependencies` existed).
> That reading has since expired — a `skip-changeset` label now exists in this repository's
> label set, because GitHub mints a label the first time one is applied by name, so a single
> API call that applies it is enough to create it. By 2026-08-25 it sat on **seven** pull
> requests, carrying the default grey `ededed` and an empty description that tell an
> auto-minted label apart from a curated one.
> [#4912](https://github.com/objectstack-ai/objectui/issues/4912) tracks deleting the object.
>
> ⛔ **Whether or not you can still see it in the picker, applying it declares nothing** — no
> gate in this repository reads it. The real gate has no label escape hatch by design: its
> exemption is a changeset with an **empty frontmatter**, which lives in the repository where
> the next reader finds it, rather than a label that vanishes from history. The name is wired
> in the `objectstack` sibling, not here, which is how it reaches agents that then look for it
> in this repo. If you were told to apply it, the instruction is wrong; declare an empty
> changeset instead.
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
`CHANGELOG.md` and commit it to the repository. It configured the lockfile merge driver until
[#6358](https://github.com/objectstack-ai/objectui/issues/6358); it no longer does, because this
job never merges. It checks out, runs git-cliff, stages exactly `CHANGELOG.md`, commits and
pushes — and a driver fires only when git has to merge the attributed path. Committing back to a
branch that may have moved does not reach one: such a push is *rejected*, not merged.

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

### Half-State Patrol (`half-state-patrol.yml`)

**Trigger:** Four times a day at `:37` past the hour (cron `37 1,7,13,19 * * *`), manual dispatch,
or a pull request touching `scripts/pm/check-half-states.mjs`, `scripts/invoked-as.mjs` or the
workflow itself.

Runs `scripts/pm/check-half-states.mjs` against **this** repository's issue board and rewrites one
pinned anchor issue's body with what it found. The sweeper carries a family of predicates over the
dispatch protocol's label/assignee/PR invariants — a `pm:dispatched` card with no assignee, a card
carrying both `pm:queue` and `pm:dispatched`, a merged PR whose card still says it is in flight, a
`Blocked-by:` block whose blocker already closed, and so on.

**Report-only, and this is a rule rather than a description.** The job never writes a label, never
closes a card, never fixes a state, and no finding fails anything: a completed sweep exits 0 whether
it found 0 half-states or 40. Its one write is the anchor issue's body, and `permissions:` grants
nothing beyond `contents: read` + `issues: write`. A pull-request run proves the sweep on a real
runner but skips the anchor write entirely, publishing the rendered body to the run summary instead.

The run *does* go red when the sweep could not run or its report could not be delivered — that is
the patrol reporting its own death, not a gate on the board. A workflow that quietly does nothing
because a credential lapsed would leave a stale anchor body that reads exactly like a clean board.
For the same reason the `Swept` timestamp is refreshed even when the findings are unchanged: a
timestamp that stops advancing is how a reader learns the standing caller died.

**One manual setup step.** The anchor issue is named by the repository *variable*
`HALF_STATE_ANCHOR_ISSUE` (Settings → Secrets and variables → Actions → Variables). Until it is set
the job fails loudly *after* sweeping, with the findings preserved in the run summary — it will not
guess an issue number and rewrite an unrelated card.

**Ported from objectstack, with the divergences listed in the workflow header.** The pair
(`scripts/pm/check-half-states.mjs` + this workflow) is adopted from `objectstack-ai/objectstack`
and is meant to stay re-syncable, so this install keeps its differences in one place. The
behavioural one: the sweeper's closed-card reader (`pm:*` labels left on cards that already closed)
is switched **off** here via `PM_SWEEP_CLOSED_WINDOW_PAGES: '0'`. Stripping `pm:*` on close was
never this repo's practice — 815 closed cards carry `pm:dispatched`, ~87% of the reader's window —
so that predicate would report the convention rather than a defect and bury every other finding.
The rendered summary says that surface is **UNREAD**, never that it is clean
([#5791](https://github.com/objectstack-ai/objectui/issues/5791)).

### Hook Self-Tests (`hook-selftests.yml`)

**Trigger:** PR to `main`/`develop`, and push to `main`, **when `.claude/hooks/**` or this
workflow file changes**. **Blocks a PR:** yes.

Runs `.claude/hooks/guard-main-checkout-bash.selftest.sh` and
`.claude/hooks/guard-shared-stash.selftest.sh` — the hermetic self-test matrices for
the two PreToolUse guards behind the rule both `CLAUDE.md` files state as binding: worktree-first,
and never `git stash` (AGENTS.md §9). Each self-test builds its own throwaway git fixture and
needs only `jq` and `git`, both preinstalled on `ubuntu-latest` — no install, no build.

Before this workflow ([#5754](https://github.com/objectstack-ai/objectui/issues/5754)), nothing
ran either matrix automatically: a hook is not imported by any package, so no unit test, type
check, or lint reaches it (`eslint.config.js` is scoped to `**/*.{ts,tsx}` throughout, and there
is no `shellcheck` anywhere in this repo), and both self-tests' own headers only say to run them
*after touching the hook* — an instruction with no gate behind it. The failure mode is asymmetric
and both halves are bad: a fail-open regression silently stops guarding the shared checkout, and
a fail-closed regression (a false block) trains an operator onto `OS_ALLOW_MAIN_EDITS=1` /
`OS_ALLOW_STASH=1`, switching the guard off for the whole command. Neither shows up in a PR
without a caller.

**This job is a runner, not a rewrite.** It does not modify the hooks or their self-tests —
`.claude/**` is governed surface. It only gives the existing matrices a caller that fails the
build the moment either one goes red, the same way any other required check does.

**Path-filtered, unlike `control-bytes.yml`.** That gate carries no `paths` filter because a raw
control byte can land in a markdown-only PR just as easily as a TypeScript one. That reasoning
does not transfer here: both self-tests assert the CURRENT hook script's behaviour against a
fixture they build themselves, so nothing about a docs-only or dependency-bump PR can move the
result. This workflow instead mirrors `changeset-guard.yml`'s inverse-filter shape, firing only
on a PR that touches `.claude/hooks/**` — which is also why `scripts/dependabot-merge-gate.mjs`
classifies **Hook Self-Tests** as `OPTIONAL_CONTEXTS` (present → must be `success`; absent → a
Dependabot bump never touches `.claude/hooks/**`, so it is never waited for) rather than
`REQUIRED_CONTEXTS`, following the same rule `Changeset Bump Policy` and `Bundle Analysis` do.

### Dependabot Auto-Merge (`dependabot-auto-merge.yml`)

**Trigger:** PRs on `main`/`develop` authored by `dependabot[bot]`.

- **Patch/minor updates**: approved and enqueued — **but only after an explicit wait**, see below.
- **Major updates**: commented for manual review; never approved, never enqueued.
- Configures **no** lockfile merge driver ([#6369](https://github.com/objectstack-ai/objectui/issues/6369)):
  its only merge is `gh pr merge`, which GitHub runs server-side, where the runner's git config
  cannot reach.

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
path-filtered ones (**Bundle Analysis**, **Changeset Bump Policy**, **Hook Self-Tests**) must be
green *if they reported*; everything else is listed with the reason it cannot gate. A context that is missing,
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
back to an ordinary text merge. So every workflow that performs a **local** merge or rebase --
one git carries out on the runner -- defines it immediately after checkout:

```yaml
- name: Configure Git merge driver for pnpm-lock.yaml
  run: |
    git config merge.pnpm-merge.name "pnpm-lock.yaml merge driver"
    git config merge.pnpm-merge.driver "pnpm install --no-frozen-lockfile"
```

One workflow carries that step:

| Workflow | Why it needs the driver |
|---|---|
| `changeset-release.yml` | ⚠️ configures it — but performs no local merge, see the measurement below |

⚠️ **That row's stated reason was wrong, and the row is now the whole question**
([#6391](https://github.com/objectstack-ai/objectui/issues/6391)). It used to read "version bumps
rewrite the lockfile on the release branch". A **rewrite is not a merge**: `changeset:version`
overwrites `pnpm-lock.yaml` outright, and git runs a merge driver only when it has to *reconcile
two versions* of an attributed path. Measured on `changeset-release.yml`, and recorded in the file
itself so it is not re-derived a fourth time:

- Every `git` in that workflow, enumerated rather than grepped for absence: the two `git config`
  lines, `git status --porcelain` twice, and `git checkout -- .` plus `git clean -fdq` in "Restore
  the pre-version tree". No `merge`, `rebase`, `pull`, `cherry-pick`, `am`, `apply` or `revert` —
  every zero-hit taken with a control term that hit the same file.
- `git checkout -- .` there takes tracked paths from the **index** to undo what the version step
  wrote. That is a discard, not a merge.
- The deciding fact is in the marketplace action, not the workflow. Read at `changesets/action`
  v1.9.0 (`a45c4d5`), `src/git.ts` and the shipped `dist/` bundle agreeing: its entire git surface
  is `checkout`, `reset --hard`, `add .`, `commit -m`, `push --force` and `config user.*`. The
  version-branch update is a checkout, a `reset --hard` to the triggering commit, a commit, and a
  **force-push**. A force-push resolves no merge, so the driver has no occasion to fire.

⭐ **But the `.gitattributes` line is not dead, and that is why this is not simply a third
removal.** The attribute is repository-wide, and its live consumer is the contributor path this
page already points at: `CONTRIBUTING.md` tells contributors to configure this same driver and
then to `git merge upstream/main`. Measured in a scratch repository, one variable changed between
the two runs — **with** the attribute the driver fires and the lockfile is regenerated; **without**
it, and nothing else altered, the identical merge ends in `CONFLICT (content)` with conflict
markers left in `pnpm-lock.yaml`. So the CI half is dead and the repository half is live, while the
pin below binds them together. Resolving that is a decision, not a cleanup.

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

Adding a workflow that merges **locally** — a merge git performs on the runner? Add the step
after checkout and before the merge, and add its row above — the pin fails otherwise. This
sentence has been read too widely twice, and each reading left a dead copy behind:

⛔ **Pushing is not merging.** It said "merges or pushes" until
[#6358](https://github.com/objectstack-ai/objectui/issues/6358): `changelog.yml` carried the step
on the strength of that word, having no merge to resolve. A workflow that only commits and pushes
needs no driver, and giving it one buys nothing while implying a lockfile hazard it does not have.

⛔ **A server-side merge is not a local one.** `dependabot-auto-merge.yml` carried the step until
[#6369](https://github.com/objectstack-ai/objectui/issues/6369) for a merge it genuinely performs
— `gh pr merge`. But GitHub executes that one itself, not on the runner, so no local git config
takes part in it.

⛔ **A rewrite is not a merge, and a force-push resolves none.** `changeset-release.yml` carries
the step on the strength of "version bumps rewrite the lockfile"
([#6391](https://github.com/objectstack-ai/objectui/issues/6391)). Regenerating a file is not
reconciling two versions of it, and the version branch is updated by `reset --hard` plus a
force-push inside `changesets/action`, which merges nothing on the runner.

## Adding a New Workflow

> **Give it a section on this page in the same PR.** Not a convention — a test.
> `scripts/__tests__/ci-cd-pipeline-doc.test.ts` reads `.github/workflows/` and fails when a
> workflow has no heading here naming its file. Three workflows (`lint.yml`,
> `cross-repo-issue-closer.yml`, `changeset-guard.yml`) went undocumented for months precisely
> because nothing checked, and one of them is a PR gate.

1. Create a new `.yml` file in `.github/workflows/`.
2. Copy the pnpm + Turbo setup from a workflow that runs today, not from a snippet on this
   page. A copied YAML block is a fossil the moment it is pasted — this page used to keep
   one here, and every line of it had drifted: `actions/setup-node@v4` where every workflow
   now uses `@v7`, a hardcoded `node-version: 20` where every workflow declares `'22.x'`
   (and 20 sat below the floor the root `package.json`'s `engines` field now declares), and
   `pnpm/action-setup@v4`, which no workflow in this repository has ever used — pnpm comes
   from `corepack enable` plus the root `packageManager` field instead.

   `readme-exports.yml` (see the **README Exports** section above) is a good one to read: it
   is short, runs on every pull request, and its setup is the complete pattern most new
   build/test/lint workflows need — checkout, enable Corepack, `actions/setup-node` with
   pnpm's own cache, `pnpm install --frozen-lockfile`, then a `turbo run build` step for
   whatever it needs built. Two of its steps hold for any workflow no matter which Node or
   pnpm version the repository is on when you read this:

   ```yaml
   - uses: actions/checkout@v7
   - run: corepack enable
   ```

   Copy everything else — the Node version, the cache key, the install command — from the
   workflow itself, not from this page.

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
| `CROSS_REPO_ISSUE_TOKEN` | `cross-repo-issue-closer.yml` | Closing issues in sibling repositories. `GITHUB_TOKEN` cannot do this — it is scoped to the repository running the workflow. When absent the workflow reports instead of closing. |
| `TURBO_TOKEN` | Build workflows | Turbo remote cache authentication |
| `TURBO_TEAM` | Build workflows | Turbo remote cache team identifier |

Secrets are configured in the repository settings under **Settings → Secrets and variables → Actions**.
