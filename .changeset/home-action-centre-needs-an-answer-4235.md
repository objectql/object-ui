---
'@object-ui/app-shell': patch
---

Home's action centre no longer says "You're all caught up" to a user whose inbox it failed to read (#4235)

`useHomeInbox` caught every failed `sys_inbox_message` read to `[]`, so a denial
arrived at `HomeActionCenter` wearing the exact shape of an empty inbox and the
panel reported a quiet day, with no badge, to a user with nine unread messages.
That is the reported symptom, and objectstack#7344 measured its mechanism in a
browser: `403 PERMISSION_DENIED` on that object for every non-admin session,
while `/api/v1/notifications` — a projection of the very same rows — answered
with their messages. It also resolves the cross-run contradiction the card
carried: two QA runs on one console pin disagreed because one was an admin and
one was not.

The hook now reports `notificationsStatus` (`idle` / `loading` / `ready` /
`error` — `MetadataProvider`'s vocabulary, per #4300's one-dialect ruling), and
the affirmative copy renders only on `ready`. An unanswered read gets a quiet,
non-affirmative notice instead, rendered alongside the approvals row when only
that half answered. A deployment with no inbox object at all is still an answer
and still reads as caught up, unchanged.

The source is unchanged and deliberately so: ADR-0030 names `sys_inbox_message`
as the console's consumer channel, and `/api/v1/notifications` projects the same
query one hop later.
