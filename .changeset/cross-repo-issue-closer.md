---
---

ci: close issues that a merged PR fixes in another repository

Release-nothing: adds `.github/workflows/cross-repo-issue-closer.yml` and no
package code.

Defects are routinely found in objectstack, where verification runs, and fixed
here. But GitHub's closing keywords only act within a repository, so a PR here
saying `Fixes objectstack-ai/objectstack#4475` merges and leaves that framework
issue open — with no reference to the PR on the issue's own page either. v17
verification hit this twice in one day: #3150 fixed objectstack#4475 and #3163
fixed objectstack#4478, and both were closed by hand.

The job has two modes and both are visible. With a cross-repo token it closes
the foreign issue and links the PR. Without one it comments on the merged PR
naming what still needs closing by hand — this repository's secrets are
`GITHUB_TOKEN` (scoped to the repository running the workflow, which is the
whole problem), `NPM_TOKEN` and `CODECOV_TOKEN`, so until an admin provisions
`CROSS_REPO_ISSUE_TOKEN` the job cannot perform the close at all.

That second mode is deliberate, not a fallback. A workflow that quietly does
nothing because a secret was never provisioned is the "declared but never
enforced" shape both repositories keep having to fix. A missing credential has
to announce itself.

Matched references are restricted to the qualified `owner/repo#N` form; the
bare `#N` form already works natively and is left alone. Same-repo qualified
references are filtered out, already-closed targets are skipped, and one
unreachable target cannot swallow the rest or read as success.
