---
---

Docs and gate change; no published surface.

Two consumer-facing guides stated Node/pnpm floors this project neither declares nor
tests: `content/docs/guide/quick-start.md` carried `**Node.js** 20+` / `**pnpm** 9+ or
npm/yarn`, and `content/docs/guide/building-crud-app.md` the same pair on one line. Both
pages address the reader's OWN project, so the root `engines` field never governed them,
and no published package supplies a floor either — of the 46 workspace manifests, zero
declare `engines.node` or `engines.pnpm` (the only `engines` block outside the root is
`packages/vscode-extension`'s `engines.vscode`). The pages now state what is measurable
instead: the packages are built and tested on Node 22.x with pnpm 10.x — 26 of the 27
`node-version:` declarations in `.github/workflows` read `'22.x'` and the 27th reads
`'22'`; the root `packageManager` field is `pnpm@10.31.0`, which is what `corepack enable`
hands every CI job. Worded as what CI exercises, not as a requirement the project has not
measured.

The reason nothing objected: `scripts/__tests__/doc-version-claims.test.ts` scans
`content/docs` for exactly this, and the `SEP` character class between a toolchain name
and its version admitted backticks, quotes, whitespace, colons, commas, pipes and brackets
— but not `*`. So `**Node.js** 20+` never matched `TOOLCHAIN + SEP + VERSION`, and the
ratchet reported green over four literals it had never examined. `SEP` now admits `*` and
`_`; measured over the 241 files the three scan roots resolve to, the corpus goes from 33
matched literals to 37 — exactly those four, none lost. None of the four was ledgered:
they were deleted, which is what the gate's own failure message asks for when a literal
restates no manifest and no lane tests it, and the sentences replacing them are inventoried
as `anchored` entries naming the anchor each can be re-measured against.

A new fixture test keeps the widening measurable now that the repaired corpus carries no
emphasised claim at all, and pins the one boundary it does not cross: `_Node.js_ 20+` stays
invisible, because `_` is a word character and the `\b` on each side of the toolchain name
therefore fires on neither side of it (measured: zero such spellings in the corpus today).

objectui#6307.
