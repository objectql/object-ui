---
---

Release tooling and repo docs only — this publishes nothing, declared explicitly with an
empty frontmatter rather than left undeclared.

`changeset:version` now runs `scripts/sync-quick-reference-release.mjs` after bumping the
manifests, so `QUICK_REFERENCE.md`'s "Current Release" block moves in the same commit as
the versions it quotes. Before this, the release path had no human in it and nothing
updated the doc, so the block fossilised once per release and the anti-fossil gate
`scripts/__tests__/quick-reference-current-release-4143.test.ts` reddened `main` on the
push build every time (objectui#4642, objectui#4977, objectui#5394). The gate is
unchanged — it is the judge; this is the thing that keeps the doc true.

No package `src/` is touched, so no `@object-ui/*` package changes behaviour and there is
nothing here for a consumer to upgrade to.
