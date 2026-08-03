---
title: CI/CD Pipeline
description: Overview of the ObjectUI continuous integration and deployment workflows.
---

# CI/CD Pipeline

ObjectUI uses **11 GitHub Actions workflows** to automate testing, quality checks, security scanning, releases, and repository maintenance. All workflow files live in `.github/workflows/`.

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Push / PR to main/develop                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────────┐                                 │
│  │  ci.yml  │  │ performance- │                                 │
│  │ (test,   │  │ budget.yml   │                                 │
│  │  lint,   │  │ (bundle size)│                                 │
│  │  build)  │  │              │                                 │
│  └──────────┘  └──────────────┘                                 │
│                                                                 │
│  ┌──────────────┐                                              │
│  │  labeler.yml │                                              │
│  │              │                                              │
│  └──────────────┘                                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        Push to main                             │
│  ┌───────────────────┐                                         │
│  │ changeset-release  │ → npm publish via changesets            │
│  │      .yml          │                                         │
│  └───────────────────┘                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      Tag push (v*)                              │
│  ┌──────────┐  ┌───────────────┐                               │
│  │ release  │  │ changelog.yml │                               │
│  │  .yml    │  │ (git-cliff)   │                               │
│  └──────────┘  └───────────────┘                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        Scheduled                                │
│  ┌──────────┐  ┌───────────────────┐  ┌──────────────────┐    │
│  │ stale    │  │ shadcn-check.yml  │  │  dependabot-     │    │
│  │  .yml    │  │ (weekly Mon 9AM)  │  │  auto-merge.yml  │    │
│  └──────────┘  └───────────────────┘  └──────────────────┘    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    Manual dispatch                              │
│  ┌──────────────┐                                              │
│  │ check-links  │ → Lychee link validation                     │
│  │    .yml      │                                              │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Core CI Workflow (`ci.yml`)

**Triggers:** Push and PR to `main` and `develop` branches.

Runs five parallel jobs:

| Job | Description |
|-----|-------------|
| **Test** | Runs `vitest` across all packages with Turbo caching. Uploads coverage to Codecov. |
| **Lint** | Runs ESLint via `eslint.config.js` (flat config) and TypeScript type-checking. |
| **Build Core** | Builds all packages using `turbo run build`. |
| **E2E Tests** | Runs Playwright end-to-end tests from the `e2e/` directory. |
| **Build Docs** | Builds the documentation site (`apps/site`). |

Uses: Node 22, pnpm (via `corepack`), Turbo remote caching.

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

## Environment Variables and Secrets

| Secret / Variable | Used By | Purpose |
|-------------------|---------|---------|
| `GITHUB_TOKEN` | All workflows | GitHub API access (automatic) |
| `NPM_TOKEN` | `changeset-release.yml` | npm package publishing |
| `CODECOV_TOKEN` | `ci.yml` | Coverage upload to Codecov |
| `TURBO_TOKEN` | Build workflows | Turbo remote cache authentication |
| `TURBO_TEAM` | Build workflows | Turbo remote cache team identifier |

Secrets are configured in the repository settings under **Settings → Secrets and variables → Actions**.
