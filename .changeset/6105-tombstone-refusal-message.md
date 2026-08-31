---
'@object-ui/types': patch
---

Static-table retirement tombstones now refuse with their remediation text
(objectui#6105).

The nine ADR-0049 tombstones on `StaticTableColumnSchema` (`minWidth`, `align`,
`fixed`, `type`, `sortable`, `filterable`, `resizable`, `editable`, `cell`)
already refused an authored value at the right path — but the carefully written
`.describe()` string never reached the author, because `.describe()` is schema
METADATA. What an author saw was zod's own `Invalid input: expected never,
received string`: which key is wrong, nothing about why it was retired or what
to write instead. Loud refusal is the ruled outcome; half its payload was being
dropped.

One shared mechanism carries the text into both channels. `retirementTombstone()`
(`zod/tombstone.zod.ts`) takes the guidance string ONCE and writes it to both
`z.never({ error })` — the parse-time issue message — and `.describe()` — the
generated JSON-Schema and docs surface, unchanged. One string, so the two cannot
drift.

Authoring `align: 'right'` on a static table column now reports `RETIRED
(objectui#5474) — never read by the static table; use data-table, or a
cellClassName like text-right`.

The accept set is untouched: same `success`, same issue `path`, same issue `code`
(`invalid_type`) for all nine, measured member-by-member before and after. Only
the message differs.
