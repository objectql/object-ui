---
'@object-ui/types': minor
---

**BREAKING** — the `'kanban'` validator arm now accepts the shape the registered
renderer reads, and the six `DeclarativeKanban*` exports retire (objectui#7664,
maintainer ruling (a), 2026-09-05).

For an authored `type: 'kanban'` document two different types were
authoritative depending on who asked. `safeValidateSchema` — what the CLI's
`validate` / `check` commands apply — honoured `DeclarativeKanbanSchema`
(`columns` with `color`, `draggable`, cards with `labels` / `assignees` /
`priority`), while the renderer registered for the key, `ObjectKanbanRenderer`
in `@object-ui/plugin-kanban`, consumed that package's own `KanbanSchema`
(`objectName` / `groupBy` / `cardTitle` / `cardFields`, cards with `badges`).
The two were unrelated dialects, so a board could pass `objectui validate` and
render **empty**. The ruling: the plugin dialect is authoritative.

**What changes on this package's published surface:**

- **The `'kanban'` arm's accept set is replaced.** `ComplexSchema` →
  `AnyComponentSchema` → `safeValidateSchema` now validate the plugin dialect,
  declared here as `KanbanSchema` / `KanbanColumn` / `KanbanCard` /
  `CardTemplate` / `ColumnWidthConfig` (TypeScript) and `KanbanSchema` /
  `KanbanColumnSchema` / `KanbanCardSchema` / `CardTemplateSchema` /
  `ColumnWidthConfigSchema` (`@object-ui/types/zod`). An `objectName` /
  `groupBy` board passes. A static `columns[].cards[]` board passes — that
  spelling is the same document in both dialects and always rendered. A board
  in the retired dialect is **refused by name** at the keys that betray it: a
  board-level `draggable` and a column `color` are `?: never` tombstones on the
  TypeScript face and named refusal arms on the mirror, each message naming the
  retired `DeclarativeKanbanSchema` shape and the spelling to write instead.
  Both were measured inert (zero read sites in the plugin). The retired card
  keys are deliberately *not* refused: a card is an open record
  (`[key: string]: any`), and `priority` or `dueDate` are legitimate record
  fields.
- **Six exports retire — the second step of the objectui#6172 rename.**
  objectui#6172 (PR #7643, same release line) renamed this package's trio from
  the bare names to `DeclarativeKanbanSchema` / `DeclarativeKanbanColumn` /
  `DeclarativeKanbanCard` and the three Zod mirrors to `DeclarativeKanban*Schema`
  so the bare names could belong to the renderer's dialect. objectui#6172's own
  stop condition was "if the renamed copy has no retained value, escalate", and
  the retained value it cited was precisely the validator arm. This ruling moves
  that arm to the plugin dialect, so the renamed copies have no consumer left
  and retire under ADR-0049 (enforce-or-remove): `DeclarativeKanbanSchema`,
  `DeclarativeKanbanColumn`, `DeclarativeKanbanCard` from `@object-ui/types` and
  `DeclarativeKanbanSchema`, `DeclarativeKanbanColumnSchema`,
  `DeclarativeKanbanCardSchema` from `@object-ui/types/zod` are gone.
  Importing any of them is a compile error (TS2305).
- **`SchemaRegistry['kanban']` is `KanbanSchema`.** objectui#7645 (PR #7662)
  weakened the entry to `BaseSchema & { type: 'kanban' }` because this layer
  could not name the plugin's type; it now names the declaration the plugin
  itself imports. `keyof SchemaRegistry` — the published `ComponentType` union —
  is unchanged.
- **The bare names return to this package with a different shape than they had
  before objectui#6172.** `KanbanSchema` here is now the plugin dialect, not the
  declarative one the pre-rename `KanbanSchema` was. A consumer that never
  migrated off the old bare name and expected `columns` to be required, or
  `draggable` to exist, gets a type error rather than a silent change.
- `KanbanConditionalFormattingRuleSchema` is newly exported from
  `@object-ui/types/zod`: the rule union the `'object-kanban'` arm already
  applied, now shared with the `'kanban'` arm.

**Migration.** Author boards in the plugin dialect — `objectName` + `groupBy`
for an object-bound board, or `columns[].cards[]` with `badges` for a static
one. Replace `DeclarativeKanbanSchema` imports with `KanbanSchema` (from
`@object-ui/types`, or the Zod `KanbanSchema` from `@object-ui/types/zod`;
`@object-ui/plugin-kanban` re-exports the same `KanbanSchema` type). Delete
`draggable` (drag-and-drop is always on) and column `color` (style a lane
through `className`). `content/docs/api/schema-reference.md`'s kanban section
now documents this dialect.

This is a breaking change shipped as `minor`: this repository's
version-alignment rule keeps objectui's major pinned to `@objectstack`'s and
ships objectui's own breaking changes as `minor` with the break spelled out in
the changeset body, which is what the bullets above are.
