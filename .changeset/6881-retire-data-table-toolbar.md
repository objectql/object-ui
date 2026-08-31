---
'@object-ui/types': minor
---

**Breaking for authored metadata:** `DataTableSchema.toolbar` is RETIRED
(objectui#6881, maintainer ruling 2026-08-31). A `data-table` node that authors
`toolbar` no longer validates — the parse fails loudly on the `toolbar` path
with the remediation in the message — and the TS member is a `?: never`
tombstone, so the same document is refused at compile time.

**What was measured.** The key was declared on both published faces —
`data-display.ts` (`toolbar?: SchemaNode[]`, "Table toolbar actions/content")
and the Zod mirror (`SchemaNode | SchemaNode[]`) — documented, mirrored, and
read by NOTHING: `data-table.tsx`, the registered renderer for
`type: 'data-table'`, contains the word only in two prose comments and never
reads `schema.toolbar`. The sibling `emptyAction` slot on the same interface IS
mounted through `SchemaRenderer`, so the census zero is a reading, not a blind
query. An author who wrote a toolbar got a green document and a blank result,
with no signal anywhere that said so — the declared-vs-enforced failure mode
that is worst for AI-authored metadata, which has nothing but the declaration
to go on.

**Who is affected — a `toolbar` authored directly onto a `data-table` node,
in either spelling:**

```json
{ "type": "data-table",
  "columns": [{ "header": "Name", "accessorKey": "name" }],
  "data": [],
  "toolbar": [{ "type": "button", "label": "Refresh" }] }   // ← was tolerated, rendered nothing
```

now fails validation with:

> RETIRED (objectui#6881) — never mounted by the data-table renderer; use the
> built-in toolbar chrome (searchable / exportable), or compose nodes beside
> the table

The single-node spelling `"toolbar": { … }` — which only the Zod mirror ever
accepted; the TS face always refused it — is refused the same way, so the two
faces now agree by refusing both.

**Who is NOT affected.** A document that never wrote the key is untouched
(`absent` stays valid), and every other `SchemaNode` slot — `emptyAction`
included — is unchanged. No fixture, example, catalog entry, doc page or app
in this repository authored the key (measured: all five
`components-complex-data-table` catalog schemas are toolbar-free, and every
other `toolbar` occurrence repo-wide is an i18n key, an ARIA role, or an
unrelated React prop of the same name).

**Migration:** use the built-in toolbar chrome (`searchable` / `exportable`),
or compose your own nodes beside the table. Per the ruling, a real toolbar
slot must arrive as a redesigned proposal WITH its enforcing reader — published
zero-consumer capability gets no sunk-cost exemption.

Graded `minor`, not `patch`: this narrows the accepted input set, which is
breaking for any author who wrote the tolerated key. It is not `major` per
this repo's fixed-group convention (objectui's own breaking changes ship as
`minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
mechanically enforced by `scripts/check-changeset-no-major.mjs`).
