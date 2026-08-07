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
| `ci.yml` | CI | Push / PR to `main`, `develop` | **Yes** — every job but `test-coverage` (push only) runs on PRs |
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
| `check-links.yml` | Check Links | Weekly cron `17 4 * * 0`; manual | n/a — reports, never gates |

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
| `type-check` | Type Check | `scripts/check-type-check-coverage.mjs`, then `pnpm check:spec-symbols`, then `pnpm check:i18n-keys`, then `pnpm check:i18n-drift`, then `pnpm type-check:scripts`, then `pnpm type-check`, then `pnpm type-check:vitest-setup`. The coverage guard runs first because turbo silently skips packages that have no `type-check` script, so a package without one would otherwise read as passing (#2911). The two locale gates sit in the middle because both parse the sources with `typescript`: they need the install and nothing built. `pnpm check:i18n-keys` fails when a `t()` call site asks for a key the `en` pack does not define ([#3530](https://github.com/objectstack-ai/objectui/issues/3530)); `pnpm check:i18n-drift` fails when a change to an `en` string is not accompanied by the nine translation packs ([#3650](https://github.com/objectstack-ai/objectui/issues/3650)), and it is why this job's checkout sets `fetch-depth: 0` — it diffs against the merge base, which a depth-1 clone cannot resolve. `pnpm type-check:scripts` (`tsconfig.scripts.json`) covers `scripts/**/*.ts`, which `pnpm type-check` cannot reach at all — `scripts/` has no package.json, so turbo never walks it, and the coverage guard decides coverage per *package*. Until [#3494](https://github.com/objectstack-ai/objectui/issues/3494) that left the pin tests in `scripts/__tests__/` — including the one pinning this very page — compiled by nothing. `pnpm type-check:vitest-setup` (`tsconfig.vitest-setup.json`) closes the same gap for the four repo-root `vitest.setup.*` files, uncovered until [#3515](https://github.com/objectstack-ai/objectui/issues/3515); it runs *last*, after `pnpm type-check`, because `vitest.setup.dom.tsx` side-effect-imports four `@object-ui/*` packages and resolves them through the declarations that turbo's `^build` produces. | Every run |
| `test` | Test (shard N/4) | `pnpm test --shard=N/4` across a 4-runner matrix with `fail-fast: false`, so every shard reports its own failures. No coverage instrumentation — v8 adds 40–100% overhead. | **Pull requests only** |
| `test-coverage` | Test (coverage) | One unsharded `pnpm test:coverage`, uploaded to Codecov. Nothing blocks on it, which is why it is not sharded. | **Push only** |
| `e2e` | Build & E2E | Builds the console with `vite build` (`VITE_BASE_PATH=/console/`), verifies the artifact, then `pnpm test:e2e --project=chromium`. Uploads the Playwright report on failure. | Every run |
| `docs` | Build Docs | `turbo run build --filter='@object-ui/site'`. On a PR it first diffs against the base and skips the build when nothing under `apps/site/` or `content/` changed. It does **not** check docs links any more — that moved to `docs-links.yml` (#3448), because this workflow's `paths-ignore` hides exactly the docs-only PRs a link check needs to see. | Every run (build itself conditional) |

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
