---
'@object-ui/plugin-list': patch
---

Two comment corrections in `ListView.tsx` (objectui#4559, objectui#4966). No runtime
behaviour changes and the emitted bundle is byte-identical; the published `.d.ts` does
change, which is why this is a `patch` rather than an empty frontmatter.

**objectui#4559 — the sort rationale stopped prescribing a formula field.** The comment
block above the `sortFields` memo still called a formula field "the supported
alternative (… which sorts like any text column)". Since objectui#4294 the
`list.sortRelationalHint` string in this same file says the opposite ("Not a formula
field: it is virtual, so no column is stored for it and the server refuses to sort by
one"), the memo underneath filters formula out via `UNMATERIALIZED_FIELD_TYPES`, and the
server answers such a sort with `400 INVALID_SORT` (objectstack#6994). The parenthetical
now names the remedy the hint, the server's refusal and the README already share — a
stored field that denormalizes the name onto this object, written when the source
changes. This was the last copy of the retired advice in the repo.

**objectui#4966 — `formatActionLabel`'s docblock now sits above `formatActionLabel`.**
It had drifted two declarations up, so the exported `parseSortConfig` carried two
stacked leading comments and the helper carried none. This one was not cosmetic: because
`parseSortConfig` is exported, `vite-plugin-dts` copied the misattributed block into
`dist/ListView.d.ts`, so every consumer's editor hover and TypeDoc introduced the sort
parser with a sentence about action labels. Moving the block removes it from the `.d.ts`;
`formatActionLabel` is module-private, so its now-correct docblock does not appear there.
It also matters to `scripts/check-spec-symbol-derivation.mjs`, whose rule 2 reads the
comment block *attached* to a declaration — a misattributed docblock is the mechanism by
which a claim gets scored against the wrong symbol. This block carries no spec-alignment
phrase, so nothing fired today.

No tests accompany this change and none could: both edits are comment-only, and there is
no runtime behaviour to pin. The `.d.ts` delta was measured with the package's real
`vite build` before and after, not asserted.
