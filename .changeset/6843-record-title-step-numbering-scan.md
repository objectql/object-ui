---
---

Correct the one comment in `packages/core/src/utils/__tests__/record-title.test.ts`
that still numbered the record-key name probe "step 3b" (the module's ADR-0079
ladder puts it under step 4, as `4b`), and widen the source-reading pin
`record-title.stepNumbering.test.ts` to scan that sibling test file as well as
`record-title.ts`, with a vacuity guard on the scanned set (objectui#6843).
Comment text and tests only; no package is released by this change.
