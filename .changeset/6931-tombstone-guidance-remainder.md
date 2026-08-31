---
'@object-ui/types': patch
---

The remaining eleven ADR-0049 tombstones now refuse with their remediation text
(objectui#6931).

objectui#6105 converted nine tombstones on `StaticTableColumnSchema` to
`retirementTombstone()`, which writes a guidance string ONCE into both
author-facing channels — `z.never({ error })` (the parse-time issue message)
and `.describe()` (generated JSON-Schema and docs). Eleven declarations were
left on the bare `z.never().optional().describe(...)` spelling and kept
emitting zod's own `Invalid input: expected never, received string`: which key
is wrong, nothing about why it was retired or what to write instead.

Five of those eleven sat on `StaticTableColumnSchema` itself, so an author of a
static-table column read guidance on nine keys and zod's generic on five — a
shape that teaches the message means something and then withholds it. This
converts all eleven:

- `StaticTableColumnSchema`: `headerIcon`, `fitContent` (objectui#6424),
  `format`, `options`, `currency` (objectui#6425)
- `TableSchema`: `hoverable`, `striped` (objectui#5474)
- `TimelineSchema`: `timeScale` (objectui#6355)
- `MenuItemSchema`, both union arms: `type` (objectui#6523)
- `ActionSchema`: `confirm` (objectui#4314) — the key that ESTABLISHED this
  convention, and the last one still answering with zod's generic message

Authoring `timeScale: 'day'` on a timeline now reports `RETIRED
(objectui#6355) — author scale instead`; authoring the structured `confirm`
object on an action now reports `RETIRED (objectui#4314) — author confirmText
instead`.

The accept set is untouched. For every converted member, plus the nine already
converted and six live-value controls, `safeParse` reports the same `success`,
the same issue `path`, the same issue `code` (`invalid_type`) and the same
`expected` (`never`) before and after — only the message differs. Every
`.description` on the five affected schemas (132 members) is byte-identical:
`retirementTombstone()` passes the same string `.describe()` already carried.

One nuance for `MenuItemSchema`, which is a union: its top-level issue is
still zod's own `invalid_union` / `Invalid input` at path `[]`, and the
converted guidance rides the per-arm issues underneath it. That is a property
of the union rather than of the tombstone, and it is pinned in the tests so the
unchanged top-level message is not misread later as a failed conversion.
