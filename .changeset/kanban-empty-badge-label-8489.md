---
'@object-ui/plugin-kanban': patch
---

Kanban cards no longer draw an empty coloured badge for a card field that resolves to no label.

The explicit-card-field loop's guard (`raw == null || raw === ''`) let an empty array
through, and the branch it then took for any field carrying declared `options` never
reached the shared `@object-ui/fields` cell renderers — it resolved a label and colour
itself. With nothing to resolve, a fully styled, fully coloured pill was drawn with
nothing inside it, on the most commonly authored shape of all: a picklist that declares
its options.

Both badge-push sites now decline a badge whose resolved label is empty. This also closes
the half that has nothing to do with arrays — any value resolving to an empty label drew
the same pill. A legitimately authored `'0'` label still renders: the test is against the
empty string, not falsiness.
