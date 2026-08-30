---
---

CI-only change in `.github/workflows/dependabot-auto-merge.yml` (objectui#6392): removed the
`corepack enable` + `pnpm --version` steps left behind once objectui#6389 removed the lockfile
merge driver that had been their only consumer. Nothing in this job runs `pnpm install` or
otherwise shells out to `pnpm`, so the two lines were a package manager enabled and
version-printed for zero consumers. A comment in the workflow records the reasoning for the
removal (and for not keeping `pnpm --version` alone as a fail-fast) so a future reader does not
re-add it unexplained; the `cache: 'pnpm'` comment on the `Setup Node.js` step below was reworded
to note that no pnpm setup happens in this job at all.

No source or behaviour change outside the workflow file; no published package touched.
