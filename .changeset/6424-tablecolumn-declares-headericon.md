---
'@object-ui/types': minor
---

`TableColumn` declares `headerIcon`, the icon node `data-table` has rendered into the
header cell all along (objectui#6424, maintainer ruling 2026-08-27, Option C per-key).

The key was undeclared-but-honoured: `data-table` renders `col.headerIcon` before the
header text, and `ObjectGrid` writes it for `showColumnTypeIcons` — but the published
declaration refused it, so a typed author writing `{ accessorKey: 'x', headerIcon: icon }`
got a compile error for a key the renderer implements, and `TableColumnSchema.parse`
silently STRIPPED it, while the same key placed by an untyped producer worked. The runtime
admitted a vocabulary the declaration refused — the second de-facto contract AGENTS.md
#0.1 forbids, here with the CONSUMER out of step.

- `TableColumn.headerIcon?: React.ReactNode` — a runtime slot like `cell`, not
  serializable metadata.
- `TableColumnSchema` mirrors it (`z.any()`, passthrough): the node now SURVIVES parse
  instead of vanishing. Pinned by output survival, not parse acceptance — acceptance was
  green before while the icon was stripped.
- `StaticTableColumn` / `StaticTableColumnSchema` tombstone it (`?: never` +
  `z.never().optional()`), per #5474's lockstep rule: every rich key needs a deliberate
  static-side decision, and the static renderer never read this one. Authoring it on a
  static `table` column is a loud parse refusal naming the key, not a silent strip.

No runtime behaviour changes in `data-table` itself — the reads were already live; the
declaration and the parse road now agree with them.

The card's second key, `fitContent`, is deliberately NOT declared and NOT retired here:
the ruled measurement found real authors (`ObjectGrid`'s row-actions column authors
`fitContent: true` on `main`), so per the ruling that arm goes back to the decision box
with the reading rather than into this PR.
