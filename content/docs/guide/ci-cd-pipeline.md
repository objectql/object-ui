---
title: CI/CD Pipeline
description: Overview of the ObjectUI continuous integration and deployment workflows.
---

# CI/CD Pipeline

ObjectUI uses **13 GitHub Actions workflows** to automate testing, quality checks, security scanning, releases, and repository maintenance. All workflow files live in `.github/workflows/`.

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Push / PR to main/develop                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐               │
│  │  ci.yml   │  │ storybook- │  │ size-check   │               │
│  │ (test,    │  │ tests.yml  │  │   .yml       │               │
│  │  lint,    │  │            │  │              │               │
│  │  build)   │  │            │  │              │               │
│  └──────────┘  └────────────┘  └──────────────┘               │
│                                                                 │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────┐    │
│  │ performance- │  │ visual-regression │  │  labeler.yml │    │
│  │ budget.yml   │  │      .yml         │  │              │    │
│  └──────────────┘  └───────────────────┘  └──────────────┘    │
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

Uses: Node 20, pnpm (via `corepack`), Turbo remote caching.

## Storybook Tests (`storybook-tests.yml`)

**Triggers:** Push and PR to `main` and `develop`.

Two-stage pipeline:

1. **Build Storybook** — Compiles the Storybook static site.
2. **Test Storybook** — Runs the Storybook test runner with Playwright. Depends on the build step.

Tests component behavior in isolation using story-level interaction tests.

## Visual Regression (`visual-regression.yml`)

**Triggers:** PRs that modify `packages/components/`, `packages/fields/`, `packages/layout/`, or `.storybook/`.

- Captures Storybook snapshots via Playwright.
- Compares against baseline images.
- Fails the PR if visual differences exceed thresholds.

## Performance Budget (`performance-budget.yml`)

**Triggers:** Push and PR when changes touch `packages/`, `apps/console/`, or `pnpm-lock.yaml`.

**Enforced limits:**

| Bundle | Max gzip size |
|--------|---------------|
| Console main entry | 60 KB |

- Builds the console app and measures bundle sizes.
- Posts a PR comment with the budget report and pass/fail status.

## Size Check (`size-check.yml`)

**Triggers:** Push to `main`/`develop` with changes in `packages/`.

**Enforced limits:**

| Package Category | Max Size |
|------------------|----------|
| Core (`@object-ui/core`) | 50 KB |
| Components (`@object-ui/components`) | 100 KB |
| Plugins (`@object-ui/plugin-*`) | 150 KB each |

- Generates a markdown table with raw and gzipped sizes for each package.
- Posts the size report as a PR comment.

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
