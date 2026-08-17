---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

RecordAttachmentsPanel distinguishes a DENIED attachment list from an empty one.

A `sys_attachment` list read refused for authorization reasons (HTTP 403 /
`PERMISSION_DENIED` / `FORBIDDEN` / a row-level-security denial) was swallowed
into the panel's empty state, so a member denied the parent record was told
"No attachments yet. Upload a file to get started." about a record holding
2095+ attachments — and was offered an Upload the server would refuse.

The panel now classifies that refusal with the same `isPermissionError`
predicate the kanban, calendar and form surfaces branch on, renders a distinct
denied state ("You don't have access to these attachments.", new
`detail.attachmentsAccessDenied` key in all ten locale packs), and withdraws
the Upload affordance. The denied state renders the translated sentence and
nothing sourced from the error — no status code, no server text, no row count.
The empty state is now reserved for a genuine 200-with-zero-rows; non-authz
failures keep their pre-existing handling.
