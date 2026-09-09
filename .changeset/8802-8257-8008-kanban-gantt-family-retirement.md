---
'@object-ui/types': minor
'@object-ui/plugin-kanban': minor
'@object-ui/plugin-gantt': minor
'@object-ui/cli': patch
'@object-ui/console': patch
---

Four node type keys retire, and the kanban and gantt families converge on their
`object-*` spellings: `kanban` (objectui#8802), `kanban-ui` and `kanban-enhanced`
(objectui#8257), and `gantt` (objectui#8008). All four were ruled by the
maintainer in one batch on 2026-09-09.

**⛔ No stored document moves.** The strings `kanban` and `gantt` name two
different things at two different layers, and only one of them is retiring:

| layer | value | who writes it | retired? |
| --- | --- | --- | --- |
| stored `NamedListView.type` | `"kanban"`, `"gantt"` | `CreateViewDialog`, persisted per tenant | **no — untouched** |
| node type key | `kanban`, `gantt` | hand-authored JSON | **yes** |

`ObjectView`'s `switch (viewType)` maps a stored view type onto the node type it
renders, and it already emitted `object-kanban` and `object-gantt` — as it does
for all twelve stored view types. So every kanban and gantt view any user ever
created through the console already renders through the surviving spelling.
Nothing in a tenant database changes, and ⛔ nothing should be migrated there.

**What each retirement was, measured.** Three of the four were
registration-only: no schema face in `@object-ui/types` ever declared
`kanban-ui`, `kanban-enhanced` or `gantt` as a component node type, so
unregistering is the whole retirement. The bare `kanban` key was the exception —
it had a declared arm on both faces (`KanbanSchema` in `complex.ts` and its Zod
mirror), and a plain deletion there would have been the objectui#7664 failure:
`BaseSchema` is `.passthrough()`, so a document naming a dropped key validates
green and renders nothing. It therefore retires as a **named refusal**: the Zod
union keeps an arm claiming the literal and answers a `{ "type": "kanban" }`
document with a message naming `object-kanban` as the remedy, while the
TypeScript half is the absence of the arm from `ComplexSchema` and of the key
from `SchemaRegistry`, so `tsc` refuses it at the authoring site.

**⭐ This closes objectui#8818's `objectFields` hole — for that ENTRY, not for
the class.** `SchemaRenderer` strips a fixed enumerated metadata list and
spreads the rest as React props; `objectFields` is not on that list, and
`KanbanRenderer` — the component the `kanban-ui` key resolved to — declares
`objectFields` as a real prop, so an authored value reached the predicate layer
with no schema face judging it. With the registration gone, no authored node
reaches that component through the registry. ⚠️ The **class** is still open: the
hole returns the moment another registered renderer declares an `objectFields`
prop. objectui#8818's option (a) — stripping at the `SchemaRenderer` boundary —
is what would close the class.

**⚠️ What the `kanban` arm took with it, stated because it is the cost of this
change.** That arm was the only schema face that ever declared `columns`,
`cardTitle`, `swimlaneField`, `grouping` and `navigation`, the only one that
refused `allowCollapse` / `cardTemplates` / `columnWidths` / `titleField` /
`draggable` / `onColumnAdd` / `onCardAdd` by name, and — through
`columns: KanbanColumn[]` — the only one that judged a lane's `cards`
(objectui#6939). The surviving `ObjectKanbanSchema` face declares none of them.
⛔ Nothing about an `object-kanban` document changes: it was never judged by the
`kanban` arm, so all of those keys have always ridden `BaseSchema`'s index
signature there. What is gone is the `kanban` document that had them. Declaring
them on `ObjectKanbanSchema` would WIDEN a published accept set, which is a
maintainer ruling and not part of this one; every one of these readings is
pinned where it can be seen rather than left to be rediscovered.

**Migrating.** Replace `"type": "kanban"` with `"type": "object-kanban"` and
`"type": "gantt"` with `"type": "object-gantt"` in hand-authored documents. The
`object-kanban` face requires `groupBy` and one of `bind` / `data` /
`objectName`; a purely static board (lanes carrying their own cards, no record
source) adds `"groupBy"` and `"data": []`. `kanban-ui` and `kanban-enhanced`
have no authored documents anywhere in this repository to migrate.
`KanbanRenderer` and `KanbanEnhanced` are still exported and still importable —
only their registry keys are gone.
