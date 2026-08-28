---
---

Doc-only fixes in `@object-ui/components` and the docs site: two stale claims about
`scripts/check-doc-links.mjs`'s scan surface, both frozen at an earlier `SCAN_ROOTS`
shape (objectui#6280).

- `packages/components/src/__tests__/readme-shadcn-sync-categories.test.ts`'s
  `## Scan surface` docblock said `README_SHADCN_SYNC.md` had "never been scanned by
  anything" — false since objectui#4938, whose `packages/*` row excludes only the
  basenames `README.md`/`CHANGELOG.md` and so does include this file. Rewritten to
  argue from the current tree: the file IS scanned, but check-doc-links only inspects
  `[text](href)` markdown-link syntax (never the backticked code spans this README
  uses for every in-repo path) and has no notion of prose-vs-manifest consistency —
  so the hand-rolled checks below survive regardless of scan surface, for reasons
  unrelated to whether the surface reaches this file.
- `content/docs/guide/ci-cd-pipeline.md` described the scan surface twice (prose and
  the two-link-checkers table), both frozen at the objectui#3622 shape ("the internal
  `docs/` tree and every package `README.md`"). Re-derived from the live `SCAN_ROOTS`
  table (17 rows) and rewritten to include the app READMEs and root-level markdown
  (objectui#4148), the rest of each package/app directory tree (objectui#4938), and
  every nested `README.md` (objectui#6026).

No source or behaviour change; text and a test docblock only.
