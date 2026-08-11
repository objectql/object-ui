---
'@object-ui/app-shell': patch
---

The bell popover's and Home's "see all" drills open inside an app the user can actually open, not the setup app

Four navigation producers hardcoded `/apps/setup/...` for pages that are not bound to the setup app at all: Home's notification fallback (`sys_inbox_message?view=mine`, taken whenever a notification carries no `action_url`), Home's "View all activity" (`sys_activity`), and the bell popover's two footer links to the same two pages. `sys_inbox_message` and `sys_activity` are framework-owned objects that resolve at `/apps/{any app}/{object}` — exactly like `system/approvals`, whose sibling entry in the very same popover was already resolving the current app. The in-code comment defending the hardcoded path argued the OBJECT is app-independent, which is true, and which is precisely why rendering it in `setup` does not follow.

Both halves of the cost were measured in a browser before the fix. A business user whose app list does not contain `setup` clicked "View all notifications" and got the target rendered inside their own app's shell with the page showing "You don't have access" — a softer, more confusing failure than a hard app guard. Every other user, admins included, was switched out of the app they were in: the URL, the sidebar and the header app switcher all flipped to Setup, with no announcement and no way back except the app switcher.

All four now resolve the host app through one shared helper (`resolveHostAppSegment` in `utils/appRoute.ts`), which generalizes the resolution objectstack#7231 introduced for the approvals entry and which Home and the popover both call, so the two surfaces cannot drift into different answers: the app the user is in (or last had open) re-checked against the live active-app list, then their first active app, then — only when the list names no app at all, i.e. it has not loaded yet — the caller's own hint, and `setup` last. A user whose current app is `setup` still lands in `setup`; a remembered app that has since been deactivated or hidden is not resurrected as a link.

Two admin-scoped links, `/apps/setup/system/marketplace` and `/apps/setup/system/apps`, are deliberately left alone and pinned as such: those are setup-app surfaces by intent.

Routing was not the only reason a business user saw an empty inbox — objectstack#7344 (no shipped permission set grants `sys_inbox_message`) is a second, independent cause, and the destination can still refuse the data read until that grant question is settled. This fix is necessary rather than sufficient, and the tests assert the resolved target, never the far end's data grant.
