---
'@object-ui/types': patch
---

Remove stale source-line citations (`NAME.ext:NNN`) from all 6 published `.describe()`
schema descriptions in `packages/types/src/zod/complex.zod.ts` (objectstack-ai/objectui#8478)
— the last file of this card's remainder, which the card now closes.

Text only — no accept-set, key, or shape change. Per-address editorial disposition, not a
uniform treatment: three descriptions (`FilterBuilderSchema.wrapperClass`,
`CarouselSchema.itemClassName`, `ChatMessageSchema.avatar` / `avatarFallback`) had their cited
renderer expression relocated into a maintainer-facing `//` comment beside the schema, since
the expression only restated what the author-facing prose already said; two
(`CarouselSchema.opts`, `CarouselSchema.orientation`) kept their expression inline because it
reveals a real default/policy authors need (`orientation` falls back to `'horizontal'`; `opts`
is deliberately left open, unnarrowed).

All 6 addresses were spot-checked against the files they cite and are accurate today — no
drift found, unlike the two prior slices on this card (which found `ObjectKanban.tsx:264`,
`checkbox.tsx:45/:49` and `text.tsx:162,167` all pointing to stale lines).
