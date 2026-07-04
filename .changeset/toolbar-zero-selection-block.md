---
"@object-ui/app-shell": patch
"@object-ui/components": patch
---

Block record-scoped toolbar actions launched with zero rows selected (#2210).

A flow/script action that also mounts on list rows (`locations` includes
`list_item`) has no record to run on when triggered from the list toolbar with
nothing selected — pre-fix the wizard opened anyway, collected input, and died
at its first record-bound node ("Update requires an ID or options.multi=true").
The console runtime now blocks up front with "select a row first", mirroring
the existing multi-selection guard. Pure object-level toolbar actions
(`locations: ['list_toolbar']` only) keep triggering without a record.

The action renderers (button/icon/menu/group) now forward the `locations`
declaration to the ActionRunner — previously it was dropped by their
allow-list payloads, so the runtime could not tell the two shapes apart.
