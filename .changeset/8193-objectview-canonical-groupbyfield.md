---
'@object-ui/app-shell': minor
'@object-ui/plugin-list': minor
---

Emit the spec-canonical kanban lane key from the object page, and teach the
capability gate to recognize it (objectui#8193).

`ObjectView` built the view-level kanban config it hands to `list-view` and wrote
the deprecated alias `groupField` — never `groupByField`, the key
`@objectstack/spec`'s `KanbanConfigSchema` actually declares — even though it
already READ the canonical key first. Its sibling producer in the same package,
`defaultKanbanFromObject` in `InterfaceListPage`, had migrated long before and
left the reasoning next to itself ("that read-site now prefers the spec key, so
one key is enough"); the twin was not carried along, so one producer surface
spoke two vocabularies for one concept depending on which entry point you
arrived through. `ObjectView` writes into `options.kanban`, which
`normalizeListViewSchema`'s alias fold deliberately does not reach, so nothing
corrected it downstream and the legacy spelling was what drove the lanes.

The expression is now the exported `kanbanViewOptions`, the fifth member of the
`timelineViewOptions` / `calendarViewOptions` / `ganttViewOptions` /
`galleryViewOptions` family it had been the odd one out of.

**`ListView`'s kanban capability gate changed with it, and had to.** The gate
consulted the `options.kanban` bag for the LEGACY spelling only, so a producer
writing the spec key into the bag was invisible to it while still rendering
correctly — the render branch merges the bag and resolves
`groupByField || groupField`, so the gate recognized strictly less than what
renders. Measured before and after: a bag of `{groupBy, groupField}` offered
Kanban and `{groupBy, groupByField}` did not, so shipping the producer change
alone would have removed the Kanban toggle from every object view. The gate now
reads both spellings out of the bag — the same one-question-two-sites repair
objectui#5042 made for `map` and objectui#7544 for `chart`.

**No alias READ was removed, and the alias is not retired.** Stored metadata
still authors `groupField`, and every read site still resolves it; `ListView`
already preferring the canonical key is precisely why the sibling producer could
drop the alias write. What changed is only what this one face WRITES, plus one
added rung on the gate.

**Migration.** Nothing authored has to change. If you read
`options.kanban.groupField` off the schema `ObjectView` produces, read
`groupByField` (or both) instead — that bag now carries the spec spelling.

The view-level `groupBy` in the same bag is untouched. It is not a spec key
either — measured against the strict `KanbanConfigSchema`, which refuses it by
name — but `ListView`'s projection collectors read it, so retiring it needs its
own producer census and is filed as objectui#8213.
