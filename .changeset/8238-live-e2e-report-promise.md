---
---

Correct the Live E2E lane's claim about what a failing run leaves behind, and pin it to the
config that decides it (objectui#8238). `playwright.live.config.ts` declares
`reporter: [['list']]`, which writes to stdout only, so no run of this lane could ever produce
the `playwright-report/` the workflow header, the job summary, the upload glob and
`content/docs/guide/ci-cd-pipeline.md` all promised. CI, docs and tests only; no package is
released by this change.
