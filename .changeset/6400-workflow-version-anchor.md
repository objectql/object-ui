---
---

Test-only (objectui#6400): the version-claim ledger's `Node 22.x` entries no
longer restate a hand-written count of `.github/workflows`, they are asserted
against it.

`scripts/__tests__/doc-version-claims.test.ts` gains a `workflowVersionKey`
field on `KNOWN_CLAIMS` — the objectui#6400 counterpart to `skeletonDep`. It
names the GitHub-Actions key (`node-version`) whose declarations across
`.github/workflows` are a claim's anchor, and a new
`describe('doc version claims - the workflow-version assertion')` reads those
declarations on every run and demands the page state their major.

The entry that motivated it was `anchored` and both halves of its reason had
gone false: it named "the 14 `node-version: 22.x` declarations" against a tree
holding 28 across 23 files, one of which is spelled `'22'` rather than `'22.x'`,
and it credited `ci-cd-pipeline-doc.test.ts` with pinning the line when that
file contains no `node-version` and no `22` at all. The claim itself stayed true
throughout — what rotted is the sentence a reviewer re-measures it by, which is
the entire load an `anchored` entry without a machine-checked field carries.

Three entries carry the new field (`ci-cd-pipeline.md`, `building-crud-app.md`,
`quick-start.md` — all three counts were stale), and none of their reasons
states a count any more. The comparison is on the **major**, not the spelling,
so the one lane declaring `'22'` is inside the anchor rather than a blind spot;
a value the parser cannot read is reported rather than skipped, and the line
parser is cross-checked against a counter that knows only the key.

No package source changed and nothing is published by this.
