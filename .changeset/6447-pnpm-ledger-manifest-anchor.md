---
---

The version-claim ledger's two `pnpm 10.x` entries now rest on a run instead of a sentence
(objectui#6447). Test-only: no package changes, so this changeset declares no bump.

`scripts/__tests__/doc-version-claims.test.ts` classified both entries `anchored` on the
strength of a `why` string that said "17 `corepack enable` steps across 12 workflow files".
The tree holds 20 across 14 and has since four days after that sentence was typed. Nothing
re-took the measurement, which is the exact defect the file exists to notice, sitting in the
strongest class it has — the second site of it, after objectui#6400 moved the `Node 22.x`
entries' count into a derivation.

- New `manifestVersionField` on `KnownClaim`, the third way an entry names its anchor and
  has the comparison RUN: it names a field of the root `package.json` whose value is the
  anchor. A second source field rather than one more spelling on objectui#6400's
  `workflowVersionKey`, because the two read different kinds of thing — that one sweeps a
  directory for every declaration of a GitHub-Actions key and reduces them to one major,
  this one reads a single field holding a tool and a version welded with an at-sign.
- The comparison judges BOTH halves. A version-only check would stay green if this
  workspace switched package managers and kept a major — a page teaching `pnpm 10.x`
  against a field naming something else, with the gate reporting agreement. So the tool the
  field names is compared against the toolchain word the claim leads with, read with the
  same `TOOLCHAIN` alternation the scan matched that word with; no new vocabulary enters
  the file for it.
- Both `pnpm 10.x` reasons lose their `corepack enable` count. The count was never the
  anchor — it was the argument for why the field is the anchor, and that argument does not
  need a live number to stand.
- The docblock lost its own frozen counts under one stated policy: a count describing the
  CURRENT tree is removed and replaced by the run that re-takes it, while a count recording
  what a change MEASURED when it landed is kept and attributed to that change, so it reads
  as history. A card about frozen counts cannot leave frozen counts in the prose arguing
  for the reason strings.

Both directions are pinned permanently by a manifest fixture rather than demonstrated once:
a major bump goes red on the version, and a tool swap that KEEPS the major goes red on the
tool — the case a version-only comparison would have called agreement.
