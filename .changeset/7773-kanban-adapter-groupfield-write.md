---
'@object-ui/plugin-view': minor
'@object-ui/plugin-list': minor
---

The two kanban adapters stop writing the retired `groupField` onto the
`object-kanban` node they generate (objectui#7773). `groupBy` — the key the
renderer actually reads — is unchanged and is now the only lane key emitted.

**What was measured, on this branch's base (`a915064e`).** Both adapters emitted
the key twice:

```
packages/plugin-view/src/ObjectView.tsx:1362   groupField: groupBy,
packages/plugin-list/src/ListView.tsx:2500     groupField: laneField,
```

The `object-kanban` renderer never read it: `groupField` has ZERO hits anywhere
under `packages/plugin-kanban/`, against a control of thirteen `schema.groupBy`
read sites in `ObjectKanban.tsx` from the same query — so the zero is a reading,
not a blind grep. The write was inert; the board grouped by `groupBy` and
`groupField` rode along unread.

**Why it is removed rather than tolerated.** objectui#7322 RETIRED
`groupField` on this node on both published faces — `groupField?: never` on the
TypeScript interface and a `retirementTombstone()` in the Zod mirror, which
refuses an authored value BY NAME. So the adapters were producers emitting a
node their own published contract rejects. That was harmless only because a
generated node never reaches the mirror at runtime (`SchemaRenderer` runs the
structural `validateSchema`, not `safeValidateSchema`) — but the CLI's
`os check` / `os validate` DO run the mirror, so the identical node was already
refused when authored by hand and admitted when generated. This closes that
split.

**What changes for a consumer.** Nothing on any documented path: the renderer's
behaviour is byte-identical, because it never read the key. A host that
registers its own `object-kanban` component and reads `props.schema.groupField`
off the generated node now reads `undefined` — read `groupBy` instead, which
carries the same value and always did. Graded `minor` rather than `patch` for
exactly that narrowing, following the repo convention that objectui's own
breaking changes ship as `minor` (AGENTS.md 版本号策略, mechanically enforced by
`scripts/check-changeset-no-major.mjs`).

**Who is NOT affected — the boundary is node-local.** Every VIEW-LEVEL
`groupField` read is untouched and still live: it is a legacy alias of the
spec's `groupByField` on the kanban *view config*, mapped by
`normalize-list-view.ts`, and both adapters still resolve lanes through it
(`ObjectView.tsx`'s `kanbanCfg.groupField ||`, `ListView.tsx`'s
`groupByField || groupField`). Authoring `options.kanban.groupField` on a
`list-view` or `object-view` keeps working exactly as documented in
`packages/plugin-list/README.md`. `groupField` is dead only on the generated
`object-kanban` NODE.

The two tests that pinned the duplicate write are TURNED, not deleted — they now
assert the key is absent, so restoring the write reddens them instead of being
silently re-blessed by a missing assertion.
