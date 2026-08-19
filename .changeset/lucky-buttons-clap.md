---
'@object-ui/console': patch
---

Approvals Inbox: stop offering a record link that dead-ends for the viewer it is
offered to. Approver routing goes by position while record visibility is a
separate gate, so an approver can be routed a request about a record they cannot
read — the row's record chip then landed on the record page's "Record not found".
The row (and the drawer's record title) now suppress the link for exactly those
targets, decided by one batched readability read per distinct object. Nothing
else changes: the title still shows, the approval decision path is untouched, and
the server's access semantics are neither read nor reported on.
