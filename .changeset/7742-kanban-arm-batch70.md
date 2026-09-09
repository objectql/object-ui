---
'@object-ui/types': minor
'@object-ui/plugin-kanban': minor
---

**BREAKING (scored `minor` per this repo's version-alignment convention)** — the
`'kanban'` arm retires four accepted spellings and declares one read it never
named (objectui#7742, ADR-0049, maintainer decision batch #70, 2026-09-07:
「同意」).

The accept set moves in **both** directions in one change, which is why the PR
carries `needs:contract-review`.

## Narrowing — four keys the `'kanban'` arm no longer accepts

Each is a `?: never` tombstone on the TypeScript face and a named refusal arm on
the `@object-ui/types/zod` mirror, so a document that names one is **refused by
name** with the remedy in the message. ⛔ None is dropped instead of refused:
`BaseSchema` is `.passthrough()`, so a dropped key is *kept*, not refused — the
failure objectui#7664's own first cut shipped at `onCardClick`.

- **`allowCollapse`, `cardTemplates`, `columnWidths`** — declared on both faces
  since the dialect was carried over, and read by **no registered board**.
  Re-measured for this change over `packages/plugin-kanban/src`, every file
  including tests: 0 hits / 0 files each, with `groupBy` (85 hits / 27 files),
  `cardTitle` (18/9) and `coverImageField` (17/3) firing as controls on the same
  instrument. An author who wrote `allowCollapse: true` validated green and got
  a board that never collapsed off that key. Each capability exists on a
  *different* channel, and the refusal message names it: a lane's own
  `columns[].collapsed` for collapsing, a `templates` component prop for card
  templates, a `useColumnWidths` hook option for widths. Wiring a board-level
  switch to any of them would be new behaviour and is not ordered here.
  `CardTemplate` and `ColumnWidthConfig` stay exported — the prop and the hook
  still consume the types.
- **`titleField`** — ⚠️ **not** an inertness retirement, and reading it as one
  gets the mechanism backwards. `ObjectKanban` still reads the key and the read
  stays, because the **sibling `object-kanban` arm declares it and keeps it**
  (objectui#7322 item ②). What retires is *this* arm's acceptance of the legacy
  spelling: one arm, one spelling, and the refusal points at `cardTitle`. A
  `type: "object-kanban"` document naming `titleField` still validates and still
  renders; a `type: "kanban"` one is now refused. The key was never declared on
  this face before — it rode `BaseSchema`'s index signature — so this is the
  first time this face judges it at all.

## Widening — one key the board reads and no face named

- **`navigation`** is now declared on `KanbanSchema` (both faces), on the gantt
  precedent objectui#5903. `ObjectKanban` reads it to choose the record-detail
  overlay mode and defaults it to a drawer; until now an authored overlay mode
  rode `BaseSchema`'s `[key: string]: any` — admitted, never examined — and the
  read site had to spell itself `(schema as any).navigation`. That cast is gone.
  The member list is `@objectstack/spec`'s `NavigationConfig` by reference, not
  restated, so the vocabulary cannot fork.

## `@object-ui/plugin-kanban` — one internal channel leaves the schema bag

`objectFields` (the fetched object's field definitions, which card conditional
formatting needs so a rule comparing a relation sees the stored foreign key) is
now a **React prop on `KanbanRendererProps`**, a sibling of `schema`, rather than
a member of the `schema` bag. It is an internal channel from the one caller that
fetched the object definition, never an authoring surface. Inside `schema` it was
reachable by an *author*: on the schema-only `kanban-ui` entry, which has no
object schema of its own to substitute, an authored `objectFields` reached
`resolveConditionalFormatting` verbatim while no schema face declared or judged
it. Callers that render `KanbanRenderer` directly and passed `objectFields`
inside `schema` must move it to the prop.
