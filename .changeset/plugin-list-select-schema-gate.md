---
"@object-ui/plugin-list": patch
---

fix(plugin-list): gate speculative `$select` fields by the object's real schema

A list view auto-includes view-binding fields (kanban `groupBy`, calendar/gantt/
timeline dates, gallery image, timeline status/priority) in `$select` so
alternate view modes render populated. These were added unconditionally on the
assumption that "the projection ignores unknown names" — but some backends
(notably the cloud multi-tenant runtime) reject an unknown `$select` column with
an EMPTY result set, so a single phantom field zeroed the whole list (an AI-built
`product` view requesting `status`/`due_date`/`image` showed "no data" though
rows existed). The speculative additions now go through `addSpeculative()`, which
keeps only fields present in the object schema; user-declared columns and expand
roots are untouched.
