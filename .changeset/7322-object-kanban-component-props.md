---
'@object-ui/plugin-kanban': minor
---

`ObjectKanbanComponentProps.schema` names both node types the component is registered for
(objectui#7322 item ②, following the objectui#5903 / #5018 land shape).

`ObjectKanbanRenderer` is registered under two keys — `'object-kanban'` and `'kanban'` —
and the two keys have different declared node types: `ObjectKanbanSchema` (`type:
'object-kanban'`, `objectName` and `groupBy` required) and `KanbanSchema` (`type:
'kanban'`, both optional). The prop named `KanbanSchema` alone, so **no `object-kanban`
node was assignable to the component that renders it**, and the discriminants are disjoint
string literals, so no cast-free annotation existed for half the boards this component
serves. It is now the union of the two.

## What settled it: the read set

`ObjectKanban` reads thirteen keys off `schema`. Neither declaration covers them; the two
TOGETHER cover twelve, and each arm is load-bearing:

- `objectName`, `groupBy`, `limit`, `cardFields` — declared on both;
- `columns`, `cardTitle`, `swimlaneField`, `grouping` — `KanbanSchema` only;
- `titleField` — `ObjectKanbanSchema` only (which is why that read was spelled
  `(schema as any).titleField`);
- `data`, `bind`, `className` — `BaseSchema`;
- `filter` — declared by **neither** face, still riding `BaseSchema`'s index signature.
  Measured and reported, **not** changed here: this card moves the prop, not the two
  published schema faces.

So naming `ObjectKanbanSchema` alone — the remedy the original card implied — would have
been wrong in the other direction: it drops four declared reads and the `'kanban'`
registration.

## Not affected

Widening a member of an exported prop type is additive: every caller that passed a
`KanbanSchema` still compiles, and the union claims exactly the accept set the registry
dispatches to this component — a third node type is still turned away. The runtime is
untouched; `ObjectKanbanRenderer` still takes `schema: any`, so no shape is turned away
there either (the objectui#5903 disposition, restated). The view-level `kanban.groupField`
alias, `BaseSchema`'s index signature, and `@object-ui/types` are all untouched.

## Casts this removes

Inside `ObjectKanban.tsx`, three schema-key reads drop their `as any`: `titleField` (two
sites, now honest because the `object-kanban` arm declares it) and `cardFields` /
`cardTitle` (already declared; the casts were redundant). `(schema as any).navigation`
**stays** — `navigation` is declared on neither face, so removing the cast would change
nothing but the spelling of an index-signature read.

Four of the six in-package fixtures that mount an `object-kanban` board drop their
`as never` escape for a real `satisfies ObjectKanbanSchema`. The other two are static
boards (`columns` + inline `data`, no fetch) that author no `objectName`, which
`ObjectKanbanSchema` declares required — objectui#7780's subject; their casts stay, now
carrying the reason and the card number.
