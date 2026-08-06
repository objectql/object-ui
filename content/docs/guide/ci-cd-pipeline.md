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
| `ci.yml` | CI | Push / PR to `main`, `develop` | **Yes** — 6 of its 7 jobs run on PRs |
| `lint.yml` | Lint | Push / PR to `main`, `develop`; manual | **Yes** — ESLint **errors** only |
| `changeset-guard.yml` | Changeset Bump Policy | PR / push touching `.changeset/**` | **Yes** |
| `control-bytes.yml` | Control Byte Scan | Push / PR to `main`, `develop` — **no path filter**; manual | **Yes** |
| `docs-links.yml` | Internal Docs Link Check | Push / PR to `main`, `develop` — **no path filter**; manual | **Yes** |
| `performance-budget.yml` | Bundle Analysis | Push / PR touching `packages/**`, `apps/console/**`, `pnpm-lock.yaml` | **Yes** — the console entry gzip budget |
| `live-e2e.yml` | Live E2E (informational) | PR to `main`, `develop` (code paths); nightly cron `30 6 * * *`; manual | No — informational lane, `continue-on-error` |
| `labeler.yml` | Auto Label PRs | PR `opened`, `synchronize`, `reopened` | No |
| `dependabot-auto-merge.yml` | Dependabot Auto-merge | PR to `main`/`develop` authored by `dependabot[bot]` | No |
| `cross-repo-issue-closer.yml` | Cross-repo Issue Closer | PR `closed` (acts only when merged) | No — runs after merge |
| `changeset-release.yml` | Changeset Release | Push to `main` | n/a |
| `release.yml` | Release | Push of a `v*` tag | n/a |
| `changelog.yml` | Auto Changelog | GitHub Release published; manual | n/a |
| `stale.yml` | Stale Issues & PRs | Daily cron `0 0 * * *`; manual | n/a |
| `shadcn-check.yml` | Check Shadcn Components | Weekly cron `0 9 * * 1`; manual | n/a |
| `check-links.yml` | Check Links | Manual dispatch only | n/a |

The path filters explain most "why did nothing run on my PR?" questions:

- `ci.yml` and `lint.yml` both list `**/*.md`, `content/**`, `docs/**` and `.changeset/**` under
  `paths-ignore` (`ci.yml` also ignores `apps/site/**`). A docs-only or changeset-only PR starts
  neither of them.
- `changeset-guard.yml` carries the inverse filter — it runs *only* when `.changeset/**` changes,
  which is precisely why it is a separate workflow instead of a job inside `ci.yml`.
- `control-bytes.yml` and `docs-links.yml` carry **no** filter of any kind, which is equally
  deliberate: both guard markdown, and a gate that a markdown-only PR cannot start is no gate on
  the change most likely to trip it. Both cost a checkout plus one `node` call.

## Core CI Workflow (`ci.yml`)

**Triggers:** Push and PR to `main` and `develop`, unless the change touches only `**/*.md`,
`content/**`, `docs/**`, `apps/site/**` or `.changeset/**` (`paths-ignore`).

Seven jobs, all parallel — there are no `needs:` edges between them:

| Job key | Appears as | What it runs | When |
|---|---|---|---|
| `changeset-check` | Changeset Fixed Group Check | `scripts/check-changeset-fixed.mjs` — every workspace package must be in the changeset `fixed` group or explicitly ignored. It checks group *membership*; it does **not** check whether the PR added a changeset. | Every run |
| `type-check` | Type Check | `scripts/check-type-check-coverage.mjs`, then `pnpm check:spec-symbols`, then `pnpm type-check`. The coverage guard runs first because turbo silently skips packages that have no `type-check` script, so a package without one would otherwise read as passing (#2911). | Every run |
| `test` | Test (shard N/4) | `pnpm test --shard=N/4` across a 4-runner matrix with `fail-fast: false`, so every shard reports its own failures. No coverage instrumentation — v8 adds 40–100% overhead. | **Pull requests only** |
| `test-coverage` | Test (coverage) | One unsharded `pnpm test:coverage`, uploaded to Codecov. Nothing blocks on it, which is why it is not sharded. | **Push only** |
| `e2e` | Build & E2E | Builds the console with `vite build` (`VITE_BASE_PATH=/console/`), verifies the artifact, then `pnpm test:e2e --project=chromium`. Uploads the Playwright report on failure. | Every run |
| `docs` | Build Docs | `turbo run build --filter='@object-ui/site'`. On a PR it first diffs against the base and skips the build when nothing under `apps/site/` or `content/` changed. It does **not** check docs links any more — that moved to `docs-links.yml` (#3448), because this workflow's `paths-ignore` hides exactly the docs-only PRs a link check needs to see. | Every run (build itself conditional) |
| `dev-server` | Dev-server fixture build | `pnpm --filter @object-ui/dev-server build` — guards `apps/dev-server`'s `objectstack.config.ts` against fixture / `@objectstack/spec` drift. | Every run |

Uses: Node 22.x, pnpm via `corepack`, `actions/cache` over `.turbo/cache`.

### What is *not* in `ci.yml`

Two jobs this page used to list have never existed under those names, and looking for them in
`ci.yml` is a dead end:

- **Lint** is not a `ci.yml` job. ESLint runs in its own workflow, `lint.yml` (next section), and
  shows up as a separate **Lint** check on the PR.
- **Build Core** does not exist. `ci.yml` builds only the console SPA that Playwright consumes;
  building the packages and measuring their size belongs to the Bundle Analysis workflow
  (`performance-budget.yml`), as the comment on the `e2e` job states.

## Lint (`lint.yml`)

**Triggers:** Push and PR to `main`/`develop` (same `paths-ignore` as `ci.yml`, minus
`apps/site/**`), plus manual dispatch.

This is a **real PR gate**, and it is easy to miss because it is not part of CI — it is its own
**Lint** entry in the checks list.

- `scripts/check-lint-coverage.mjs` runs first: every package must run ESLint or be declared a
  known gap. turbo skips scriptless packages silently, so without this guard a package reads as
  clean because nothing ever linted it.
- Then `pnpm lint`.

**It gates errors, not warnings.** `--max-warnings` is deliberately unset: the repository carries
thousands of warnings (overwhelmingly `no-explicit-any`, plus React Compiler rules the config
downgrades on purpose), and failing on those would make the gate unusable. What must stay clean are
the rules `eslint.config.js` sets to `error` — including the custom `object-ui/*` ratchets
(ADR-0054 Phase 5, #2879, the `objectql.ts` ratchet, `no-dynamic-import-in-test-hook`). Until #2923
this workflow was `workflow_dispatch`-only, so every one of those `error` ratchets was inert: each
was written specifically to fail CI, and nothing ran them.

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

**Why it is a separate workflow.** `ci.yml` and `lint.yml` both list `'**/*.md'`, `content/**`,
`docs/**` and `.changeset/**` under `paths-ignore`, and GitHub has no per-job path filter. Markdown
is exactly the carrier the worst instance of this bug used — objectstack#4890 was a raw NUL in a
`.claude/` skill file, emitted by the PR that was writing the rule forbidding it, leaving the agent
instructions unfindable by `grep -r` with no signal that anything was missing. A path-filtered gate
could not have seen that PR. `scripts/__tests__/check-control-bytes.test.ts` fails if a `paths` or
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

What it does: runs the allowlisted live specs (`pnpm test:e2e:live:ci` — screen-flow,
action-modal, master-detail) against a real `objectstack dev` backend booted from **published**
`@objectstack/*` packages serving the showcase app, catching the class of bug only a real
browser against a real backend can see. Failures still surface as a red step plus an uploaded
Playwright report and job summary.

Backend pins live in `e2e/live/ci/backend.env` and must match the `@objectstack/spec` version in
`pnpm-lock.yaml` — bump both in the same PR, or the run proves nothing.

## Internal Docs Links (`docs-links.yml`)

**Triggers:** Push and PR to `main`/`develop`, plus manual dispatch — with **no path filter at
all**, which is the point of the workflow. It appears in the checks list as **Internal Docs Link
Check**.

Runs `scripts/check-doc-links.mjs`, which walks every `.md` / `.mdx` file under `content/docs/` and
resolves each internal markdown link against the files actually on disk (`/docs/foo` must have a
`foo.md`, `foo.mdx` or `foo/index.md*` under `content/docs/`). External `http(s)` and `mailto:`
links and bare `#anchors` are skipped — those belong to Lychee, below. No install, no build, no
network: a checkout and one `node` call.

**Why it blocks a merge.** A broken internal link is a 404 on the published site, and nothing else
in CI sees it: the site build succeeds with a dead link in it. The script itself is older than its
gate — it existed, worked, and was wired to nothing under `.github/`, so it had never run in CI at
all, and `main` sat with a broken link it would have caught (objectui#3213, objectui#3292).

**Why it is a separate workflow.** This is the second instance of the lesson `control-bytes.yml`
records, and it was found by the PR that first put this check into CI. That PR added it as a step
in `ci.yml`'s `docs` job — where it could never see the PRs that matter. `ci.yml` lists
`'**/*.md'`, `content/**`, `docs/**` and `apps/site/**` under `paths-ignore`, GitHub's
`paths-ignore` skips the *whole workflow* when every changed file matches, and GitHub has no
per-job path filter. So a **docs-only** PR — the likeliest way an internal link breaks — started no
workflow at all, and the check only ever ran on PRs that touched docs alongside code, plus pushes
to `main`. A bad link could merge through a pure-docs PR and turn `main` red later under an
unrelated author (objectui#3448).

The step was **removed** from `ci.yml` in the same change rather than left in place. This
workflow's trigger set is a strict superset of that job's, so keeping both would only add a second
red check for one broken link, and a second place to forget.
`scripts/__tests__/docs-links-workflow.test.ts` pins all of it: the workflow must exist, must gate
pull requests, must carry neither `paths` nor `paths-ignore`, and must remain the only workflow
that runs the script.

**If it fails:** it prints every offending `file -> href`. Either the link is misspelled, or the
page it points at has moved or been renamed — fix the link, or restore the target. Links are
checked as *routes*, so `/docs/guide/foo` is what belongs in the markdown, not
`content/docs/guide/foo.md`. Run it locally with `pnpm docs:check-links`.

## Link Checking (`check-links.yml`)

**Trigger:** Manual workflow dispatch (`workflow_dispatch`).

There are **two** link checkers, and they cover different things (objectui#3213):

| | Covers | Network | Runs |
|---|---|---|---|
| `scripts/check-doc-links.mjs` | **Internal** `/docs/...` routes, resolved against `content/docs/` | No | `docs-links.yml` — every push and PR, no path filter (previous section) |
| Lychee (this workflow) | **External** URLs in `docs/` and `README.md` | Yes | Manual dispatch only |

Note the asymmetry in what Lychee scans: `docs/` holds internal material (ADRs, audits,
architecture notes), while the published site is built from `content/docs/`. Lychee therefore does
not currently see the site's own pages.

One known gap remains tracked rather than silently lived with: Lychee's scan scope predates the
move to `content/docs/` (objectui#3449), so **external** URLs on the published site's own pages are
checked by nothing. The gap that used to sit beside it — docs-only PRs never being link-checked,
because `ci.yml` ignores `content/**` — is closed: that check is now `docs-links.yml` (objectui#3448).

Uses [Lychee](https://github.com/lycheeverse/lychee) with configuration from `lychee.toml`:
- Scans markdown files in `docs/` and `README.md`
- Max concurrency: 10, timeout: 20s, retries: 3
- Excludes: localhost, example.com, Twitter/X, GitHub compare/commit URLs
- Remaps internal `/docs/*` paths to `file://./docs/*` for local resolution

## Release Workflows

### Tag Release (`release.yml`)

**Trigger:** Push of version tags matching `v*`.

1. Runs the full test suite.
2. Builds all packages.
3. Creates a GitHub Release with auto-generated release notes.

> Note: npm publish is currently handled by `changeset-release.yml` instead.

### Changeset Release (`changeset-release.yml`)

**Trigger:** Push to `main`.

Uses [Changesets](https://github.com/changesets/changesets) for automated versioning and npm publishing:
1. Detects pending changesets.
2. Bumps package versions.
3. Publishes to npm.
4. Configures a pnpm-lock.yaml merge driver to prevent lock file conflicts.

### Changeset Guard (`changeset-guard.yml`)

**Trigger:** PR to `main`/`develop`, and push to `main`, **when `.changeset/**` changes** — the
inverse of every other workflow's filter. `ci.yml` and `lint.yml` both list `'**/*.md'` and
`.changeset/**` under `paths-ignore`, so a PR that adds only a changeset starts nothing else.

Runs `scripts/check-changeset-no-major.mjs`, which fails if any pending changeset declares a
`major` bump. Every publishable package is in one `fixed` group (39 packages), so a single
`major` publishes all of them as the next major — and objectui's major is pinned to the
`@objectstack` major it is compatible with, not to its own count of breaking changes. Score
breaking changes of our own as `minor` and describe the break in the changeset body.

The one release that legitimately bumps the major is the one following `@objectstack` across
its major; it sets `OBJECTUI_ALLOW_MAJOR=1`. `pnpm test` asserts the same repository state, so
the rule survives this workflow being skipped.

### Changelog Generation (`changelog.yml`)

**Trigger:** `release` event (when a GitHub Release is published), or manual dispatch.

Uses [git-cliff](https://git-cliff.org/) with `cliff.toml` configuration to auto-generate `CHANGELOG.md` and commit it to the repository.

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

| Resource | Stale after | Close after |
|----------|-------------|-------------|
| Issues | 60 days | 7 days |
| Pull Requests | 45 days | 14 days |

Exempt labels: `pinned`, `security`, `critical`, `in-progress`.

### Dependabot Auto-Merge (`dependabot-auto-merge.yml`)

**Trigger:** PRs on `main`/`develop` authored by `dependabot[bot]`.

- **Patch/minor updates**: Auto-approved and squash-merged.
- **Major updates**: Approved with a comment for manual review.
- Configures a pnpm-lock.yaml merge driver for conflict resolution.

### Shadcn Component Check (`shadcn-check.yml`)

**Trigger:** Weekly on Monday at 9:00 AM UTC, or manual dispatch.

- Runs offline and online analysis of shadcn/ui components.
- Creates or updates a GitHub issue if components need review or updating.
- Uploads analysis artifacts for reference.

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
| `CODECOV_TOKEN` | `ci.yml` (`test-coverage` job) | Coverage upload to Codecov |
| `CROSS_REPO_ISSUE_TOKEN` | `cross-repo-issue-closer.yml` | Closing issues in sibling repositories. `GITHUB_TOKEN` cannot do this — it is scoped to the repository running the workflow. When absent the workflow reports instead of closing. |
| `TURBO_TOKEN` | Build workflows | Turbo remote cache authentication |
| `TURBO_TEAM` | Build workflows | Turbo remote cache team identifier |

Secrets are configured in the repository settings under **Settings → Secrets and variables → Actions**.
