---
---

CI/doc-only: `.github/workflows/dependabot-auto-merge.yml` no longer configures the
`pnpm-lock.yaml` merge driver, and the pinned "Lockfile Merge Driver" table in
`content/docs/guide/ci-cd-pipeline.md` loses the row that named it (objectui#6369).

A merge driver runs only when git has to merge the attributed path *on the runner*. The
only merge that job performs is `gh pr merge --auto --squash`, which GitHub executes
server-side in the merge queue — the runner's local git config takes no part in it, so
the driver had no occasion to fire. Swept the whole file before removing: no `git
merge`, `rebase`, `pull`, `cherry-pick`, `am`, `apply` or `revert` anywhere in it, the
`git config` pair being the only `git` present; `actions/checkout` checks out the merge
commit GitHub already computed rather than computing one; and the gate script imports
`node:fs` only.

Same no-occasion property objectui#6358 measured on `changelog.yml`, reached by a
different route — that job never merged at all, this one merges only where local config
cannot reach. With both dead copies gone the mechanism has one row left,
`changeset-release.yml`.

The guide sentence that produced both copies is narrowed in the same change: it now asks
for a **local** merge, and records that neither a push nor a server-side merge is one.

No source and no behaviour change; nothing a consumer installs is affected.
