---
'@object-ui/plugin-grid': patch
---

fix(grid): list column headers fall back to the field's label, not the prettified machine name

A view column declared as a bare `{ field: 'request_title' }` (no explicit `label`) rendered
its header from the prettified machine name ("Request title") even when the field had a
localized label ("申请标题"). On a non-English app that surfaced English column headers despite
fully-localized field labels. ObjectGrid now resolves the header as
`column.label → schema field label → prettified name`, matching the other header-resolution
sites in the same file. Found dogfooding AI-built Chinese apps.
