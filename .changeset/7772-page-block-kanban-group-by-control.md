---
'@object-ui/app-shell': minor
---

**Breaking for the page designer's output:** the page-block inspector's `object-kanban`
panel now authors `groupBy` (the key the board reads) instead of `groupField` (the key it
never read), and offers the `limit` control the schema has declared since objectui#7322.

**What was measured, on this branch's base (`0c8dbc49`).** `BLOCK_CONFIG['object-kanban']`
offered exactly four controls — `objectName` / `groupField` / `titleField` / `cardFields`.
`ObjectKanbanSchema.groupBy` is REQUIRED on both published faces (`objectql.ts:2765
groupBy: string`, no `?`; `objectql.zod.ts:1001 groupBy: z.string()`, no `.optional()`) and
had **no control at all**, while `groupField` — the only control able to set grouping — has
been a `retirementTombstone()` on the Zod face and `?: never` on the TS face since
objectui#7322. `ObjectKanban.tsx` reads `schema.groupBy` at thirteen sites and `groupField`
at zero (control: those same thirteen hits in the one query, so the zero is a reading).

Run against the node those four controls produced, `ObjectKanbanSchema.safeParse` reported
**two** issues, not one: `groupBy` "expected string, received undefined", and `groupField`
carrying the retirement guidance verbatim. So this panel could not author a valid
`object-kanban` node however it was filled in, and the board it produced grouped nothing
with no diagnostic on any face. Both halves are now pinned against the schema itself rather
than against a spelling, in `previews/__tests__/block-config.test.ts` —
`scripts/check-designer-field-key-parity.mjs` judges `PAYLOAD_SHAPES` and does not read
`BLOCK_CONFIG`, so nothing mechanical was watching this table.

`limit` is not polish: `ObjectKanban.tsx` sends it as a real `$top`
(`$top: schema.limit ?? DEFAULT_KANBAN_LIMIT`) and renders every fetched record into a lane
with no pagination, so a board over 100 records was silently truncated with no way to widen
it. The new number box states `100` — `DEFAULT_KANBAN_LIMIT`, read from the renderer's own
source by its pin — as the value that applies while it is empty.

**Stored pages.** Documents saved by every released build since
`@object-ui/app-shell@17.5.0` can carry `properties.groupField` on an `object-kanban` block.
The inspector's read door now strips it (`stripRetiredBlockProps`, keyed to
`RETIRED_BLOCK_PROP_KEYS`), so an edit-and-save round-trip comes out without the retired
key — no migration pass, and no blanket unknown-key purge: every other key the designer
does not render still survives. It is a strip and **not** a migration into `groupBy` on
purpose: reading the old spelling into the new box would be a second de-facto alias
(AGENTS.md #0.1) for a value no board ever acted on.

The **view-level** `kanban.groupField` alias (`core/src/utils/normalize-list-view.ts`) is
live and untouched — node-level retirement and the view-level alias are different things.

The two locale entries move with the control (`engine.inspector.pageBlock.field.object-kanban.groupBy`,
plus a new `.limit`); the English wording is unchanged, so the panel reads the same as it
always did.
