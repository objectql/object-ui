---
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-calendar': patch
---

`object-kanban` / `view:kanban` and `object-calendar` / `view:calendar` now DECLARE seven
spec-carried keys their renderers already honoured, so the html tier stops reporting working
metadata as `unknown-prop` (objectui#8201, the backlog objectui#8176 exposed).

Board: `groupBy`, `cardTitle`, `titleField`, `swimlaneField`, `coverImageField`.
Calendar: `defaultView` (the spec's three-member enum) and `locale`.

No renderer behaviour changes — every one of these keys was already read and already acted on;
what changes is that authoring tools can now discover them and the save gate agrees with the
validator. Both tags of each block now spread ONE shared `inputs` list, so the two published
surfaces cannot drift apart by hand-copy.
