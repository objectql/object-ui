---
'@object-ui/app-shell': patch
---

`ActivityFeed` no longer drops a row whose activity kind it does not recognise
(objectui#6816).

The notification filter was `activities.filter(a => notificationPreferences[a.type])`
— a truthiness test over a `Record<ActivityItemType, boolean>`, which answers the
same falsy value to two unrelated questions: "the user toggled this kind off"
(hide, which is the feature) and "this kind is not in the record at all". The
second made the row **vanish** from the panel.

In-repo `tsc` keeps that case out of reach — three exhaustive
`Record<ActivityItemType, …>` tables force every member to be handled — but
`ActivityFeed` is published API, and a host that mounts it passes rows whose
`type` came from its own data. `sys_activity.type` is author-extensible and is
not validated on write, so those kinds are real, and a missing row is the least
detectable failure a feed can have.

An unrecognised kind now fails **open**: the row renders, through the generic
`system` presentation `activityItemType.ts` already declares for a value outside
its mapping table (neutral on purpose, and in particular not `update`). A kind
that is present and toggled off is still filtered out — presence, not
truthiness, is now the question the filter asks.
