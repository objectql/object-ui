---
'@object-ui/types': minor
---

`TableColumn` declares `fitContent`, the content-hugging flag `data-table` has
honoured all along (objectui#6424, maintainer ruling 2026-08-28, Option A — the
card's second key, in the shape #6615 landed `headerIcon` in).

The key was undeclared-but-honoured: `data-table` skips `fitContent` columns in
the auto-width pass and renders them as a `width:1%` + `whitespace-nowrap` cell
with no `overflow-hidden` clamp — but the published declaration refused the key,
so a typed author writing `{ accessorKey: '_actions', fitContent: true }` got a
compile error for a key the renderer implements, and `TableColumnSchema.parse`
silently STRIPPED it, while the same key placed by an untyped producer worked.
The runtime admitted a vocabulary the declaration refused — the second de-facto
contract AGENTS.md #0.1 forbids, here with the CONSUMER out of step.

Retiring the reads instead was excluded BY MEASUREMENT, not preference: shipped
source authors the key (`ObjectGrid` writes `fitContent: true` on the injected
row-actions `_actions` column) and `data-table-fit-content.test.tsx` pins the
result. Retiring would re-clip inline row-action buttons.

- `TableColumn.fitContent?: boolean` — serializable metadata, unlike the
  `React.ReactNode` slot `headerIcon` is.
- `TableColumnSchema` mirrors it as `z.boolean().optional()`: the flag now
  SURVIVES parse instead of vanishing, and a non-boolean is a loud refusal
  naming the key rather than acceptance-without-validation. Pinned by output
  survival, not parse acceptance — acceptance was green before, while the flag
  was stripped.
- `StaticTableColumn` / `StaticTableColumnSchema` tombstone it (`?: never` +
  `z.never().optional()`), per #5474's lockstep rule: every rich key needs a
  deliberate static-side decision, and the static renderer has no auto-width
  pass to opt out of (its measured read set is the five live keys). Authoring
  it on a static `table` column is a loud parse refusal naming the key, not a
  silent strip.

No runtime behaviour changes in `data-table` itself — the reads were already
live; the declaration and the parse road now agree with them. The two
`(col as any).fitContent` sites drop with the declaration, but that removal is
bookkeeping rather than the fix: `col` is already `any` at both sites, widened
by the file's own `col: any` normalization, so the casts were redundant at
compile time today. They become load-bearing the moment those render callbacks
are typed — which is the standing instrument gap, not closed here.
