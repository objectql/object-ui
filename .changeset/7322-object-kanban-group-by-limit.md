---
'@object-ui/types': minor
---

**Breaking for authored metadata:** `ObjectKanbanSchema.groupField` is RETIRED
(objectui#7322, ADR-0049 enforce-or-remove), and the two keys the `object-kanban`
renderer actually reads — `groupBy` and `limit` — are now DECLARED and validated
on both published faces: the TypeScript interface in `objectql.ts` and the Zod
mirror in `zod/objectql.zod.ts`.

**What was measured, on this branch's base (`53ded82b`).**
`packages/plugin-kanban/src/ObjectKanban.tsx` reads `schema.groupBy` at thirteen
sites (lane materialisation at `:601` / `:625` / `:640`, card moves at `:747` /
`:865`, and their effect deps) and `schema.limit` at two (`:264`,
`$top: schema.limit ?? DEFAULT_KANBAN_LIMIT`, and the effect deps at `:291`).
`groupField` has ZERO read sites anywhere under `packages/plugin-kanban/` —
against a control of those thirteen `groupBy` reads in the same query, so the
zero is a reading, not a blind grep. Yet the declaration REQUIRED `groupField`
and declared neither `groupBy` nor `limit`. Measured from source: the
documented, tested, working shape — `{ type: 'object-kanban', objectName,
groupBy, limit }` — failed `ObjectKanbanSchema.safeParse` and
`safeValidateSchema` on the missing `groupField`, and only ever reached the
renderer through `BaseSchema`'s `[key: string]: any` and `.passthrough()`,
admitted unexamined. An author who followed the declaration wrote `groupField`
and got a board that grouped nothing, with no diagnostic on either face.

**Who is affected — an `object-kanban` node authoring `groupField`:**

```json
{ "type": "object-kanban",
  "objectName": "task",
  "groupField": "status" }   // ← validated, compiled, grouped nothing
```

now fails validation at `groupField` with:

> RETIRED (objectui#7322) — `groupField` is not read by the object-kanban
> renderer; author `groupBy`. (The view-level `kanban.groupField` alias is
> unaffected.)

and is refused at compile time: `groupField?: never`. The tombstone is
load-bearing rather than decorative — `BaseSchema` carries `[key: string]: any`,
so DELETING the member would let the retired spelling type-check green and go on
doing nothing. **Migration:** rename the key to `groupBy`; the value — the field
whose value places a record in a lane — is unchanged.

**What now validates that did not before:** the documented shape. `groupBy` is
REQUIRED (the retired contract required a lane field too; the renderer's
`if (!schema.groupBy)` branches are defensive early-returns, not a lane-less
mode, and every documented and tested `object-kanban` node authors the key) and
must be a string; `limit` is an optional positive integer. A wrong-typed
`groupBy: 42` or `limit: "twenty"` — previously admitted unexamined — is now
refused at its own path.

**Who is NOT affected.** The VIEW-LEVEL kanban config is untouched:
`kanban.groupField` there is a live legacy alias of the spec's `groupByField`
(`packages/core/src/utils/normalize-list-view.ts` maps it; `plugin-list`'s
`ListView` and `plugin-view`'s `ObjectView` still read it). `groupField` is dead
only on the `object-kanban` NODE. The declarative `kanban` node (`KanbanSchema`)
is untouched, `BaseSchema`'s unknown-key policy is byte-identical (an undeclared
key still passes through), and the renderer is unchanged — boards authored the
documented way rendered before and render now. One in-repo fixture authored
`groupField` on this node (`packages/types/src/__tests__/kanban-conditional-formatting.test.ts`);
it now authors `groupBy`. No doc snippet, catalog entry, skill or app in this
repository authored `groupField` on an `object-kanban` node.

Graded `minor`, not `patch`: this narrows the accepted input set, which is
breaking for any author who wrote the retired key. It is not `major` per this
repo's fixed-group convention (objectui's own breaking changes ship as `minor`;
the group's major tracks `@objectstack` — AGENTS.md 版本号策略, mechanically
enforced by `scripts/check-changeset-no-major.mjs`).
