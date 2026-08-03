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
| `performance-budget.yml` | Bundle Analysis | Push / PR touching `packages/**`, `apps/console/**`, `pnpm-lock.yaml` | **Yes** — the console entry gzip budget |
| `labeler.yml` | Auto Label PRs | PR `opened`, `synchronize`, `reopened` | No |
| `dependabot-auto-merge.yml` | Dependabot Auto-merge | PR to `main`/`develop` authored by `dependabot[bot]` | No |
| `cross-repo-issue-closer.yml` | Cross-repo Issue Closer | PR `closed` (acts only when merged) | No — runs after merge |
| `changeset-release.yml` | Changeset Release | Push to `main` | n/a |
| `release.yml` | Release | Push of a `v*` tag | n/a |
| `changelog.yml` | Auto Changelog | GitHub Release published; manual | n/a |
| `stale.yml` | Stale Issues & PRs | Daily cron `0 0 * * *`; manual | n/a |
| `shadcn-check.yml` | Check Shadcn Components | Weekly cron `0 9 * * 1`; manual | n/a |
| `check-links.yml` | Check Links | Manual dispatch only | n/a |

Two path-filter facts explain most "why did nothing run on my PR?" questions:

- `ci.yml` and `lint.yml` both list `**/*.md`, `content/**`, `docs/**` and `.changeset/**` under
  `paths-ignore` (`ci.yml` also ignores `apps/site/**`). A docs-only or changeset-only PR starts
  neither of them.
- `changeset-guard.yml` carries the inverse filter — it runs *only* when `.changeset/**` changes,
  which is precisely why it is a separate workflow instead of a job inside `ci.yml`.

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
| `docs` | Build Docs | `turbo run build --filter='@object-ui/site'`. On a PR it first diffs against the base and skips the build when nothing under `apps/site/` or `content/` changed. | Every run (build itself conditional) |
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

## Link Checking (`check-links.yml`)

**Trigger:** Manual workflow dispatch (`workflow_dispatch`).

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
