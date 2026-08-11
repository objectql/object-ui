---
'@object-ui/app-shell': patch
---

Home's action centre stops counting messages the user has already read, and the inbox is read once per page instead of twice (#4316, #4225)

`useHomeInbox` read `sys_inbox_message` and nothing else — it never joined
`sys_notification_receipt`, where ADR-0030 (resolved decision 2) puts read-state.
So Home's "Needs your attention" card could not tell a read message from an
unread one: it listed the five most recent unconditionally and badged them. A
user who opened the bell, read all nine messages and returned to Home still found
up to five of them filed as work waiting on them — while the bell two hundred
pixels above correctly showed zero, because its own poll did join the receipts.
One page load, two panels, opposite claims about the same rows (#4316).

The fix is the one #4225 sketched: `hooks/sharedUserFeeds.ts` gains an inbox feed
holding the bell's already-joined 20-row window, polled once at the bell's 10s
cadence, and BOTH consumers derive from it — the bell lists the window and badges
its unread topics, Home takes the unread ones newest-first and caps them at its
own smaller limit. Home's second query is gone (one `sys_inbox_message` read and
one `sys_notification_receipt` read per page, not two and one), and the two
surfaces can no longer disagree about a row's read-state, because there is no
second read left to drift from the first.

Two supporting changes travel with it, both visible only when something goes
wrong. The shared store now reports per-feed status in the same four words the
rest of the console uses (`idle` / `loading` / `ready` / `error`, per #4300's
one-dialect ruling): it used to swallow every failure into "keep the last value"
and say nothing, which is indistinguishable from a successful re-read, and would
have turned #4235's hard-won `error` state back into stale-but-confident data on
its way through the store. A missing object (404 / `OBJECT_NOT_FOUND`) is still
an answer — the deployment has no inbox, so nothing is waiting — and a denial
still is not. The bell's hidden-tab throttle, its return-to-tab refetch and its
failure backoff moved into the store with the poll rather than being dropped, and
now apply to every shared feed.
