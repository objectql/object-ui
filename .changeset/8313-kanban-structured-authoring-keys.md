---
'@object-ui/plugin-kanban': patch
---

`object-kanban` / `view:kanban` now DECLARE the four array/object-armed spec keys the board
already honoured — `data`, `cardFields`, `grouping` and `conditionalFormatting` — so the html
tier stops reporting working metadata as `unknown-prop` (objectui#8313, slice 2a of
objectui#8201).

No renderer behaviour changes: every one of the four was already read and already acted on.
What changes is that authoring tools can discover them, and that each declared description now
states exactly HOW MUCH of the key this board honours — `grouping` only at
`grouping.fields[0].field` and only as the fallback for `swimlaneField`, `cardFields` as bare
field names rather than entry objects, `data` as a fetch suppressor as well as a value — so a
declaration cannot recommend a write the renderer would drop.
