---
'@object-ui/app-shell': patch
---

A notification with no link now opens the full inbox from the bell instead of being consumed silently.

`InboxPopover`'s notification click handler marked the row read and then, when
nothing resolved a target, returned. A linkless row was therefore spent — the
mark-read is server-authoritative — while the user was taken nowhere and the
popover stayed open on the row it had just greyed out.

Linkless rows are a routine state, not a corner case: `service-messaging` leaves
`action_url` undefined whenever an emit carries neither a `payload.url` nor a
`source`. Home's action centre already answers that state deliberately by
opening the user-scoped full inbox (objectui#4074); the bell was the unruled
half of one behaviour. It now reuses the drill it already had one screen up, so
the click closes the popover and lands on
`/apps/{host app}/sys_inbox_message?view=mine` — the same page the row came
from, resolved through `resolveHostAppSegment` like every other app-independent
drill in the file (never a bare or empty app segment, which matches no route).

Also removes the pre-ADR-0030 `source_object`/`source_id` back-compat arm and
the two fields from the `InboxNotification` shape. `mergeInboxRows` — the single
producer of every row both the bell and Home render — mapped neither, and
`sys_inbox_message` declares `action_url` with no source columns to map from, so
the arm was unreachable in the shipped tree. A declared input that no producer
fills, read by a handler that silently does nothing, is a standing invitation to
wire it up; the fields are removed rather than maintained (objectui#5190).
