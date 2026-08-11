---
'@object-ui/app-shell': patch
---

The bell's Approvals and Activity tabs fill in on Home, Organizations and the AI screen — from the same fetch the cards below them already use

The top bar's bell renders on every console surface, but two of the three streams that fill it were gated on `variant === 'app'`: the pending-approvals poll and the `sys_activity` read. Off-app the popover therefore held nothing to show — the Approvals tab read "No pending approvals" and the Activity tab "No recent activity" — on the very page whose own To-do and activity cards were listing both, from the same endpoint and the same object. Neither stream is app-scoped: approvals are scoped to the signed-in user, activity to the tenant. Whichever app happened to be in the URL was never part of either query.

The badge made the inconsistency arithmetic. It is `unreadTopics + pendingApprovalsCount`, and after objectui#4199 un-gated the inbox half, only the first addend was fetched outside an app — so one user with one set of data read 1 on Home and 3 inside an app, and the popover's own breakdown line disagreed with the number on the bell.

Un-gating alone would have fixed the emptiness by paying for it twice: on `/home` the bell and the cards mount in one tree, so each owning its own effect means the approvals request and the `sys_activity` read both go out twice per page. They now share one fetch. A module-scoped store (`hooks/sharedUserFeeds`) owns each feed — one in-flight request, one 30s approvals poll, one 404-retires-the-feature rule — and both the bell and `useHomeInbox` subscribe to it. The dedupe is structural rather than agreed: there is no longer a second producer that could drift, so the badge and the card cannot show different numbers. Home's card keeps its narrower cut of the rows (human actors only, `sys_*`/`ai_*` churn dropped) by filtering the shared feed at its own call site rather than by issuing its own query.

`isApp` keeps the meaning it was introduced for. The presence avatars and the connection dot are app-shell chrome and stay behind it — and presence was never a read to begin with: it is a transport-level subscription (`useTenantPresence`), which is why the effect that used to be called `fetchPresenceAndActivities` only ever fetched `sys_activity`. The boundary this draws is data scope, not surface: user- and tenant-scoped feeds follow the bell everywhere it renders, app-scoped chrome does not.
