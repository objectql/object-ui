---
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

Announce inbox messages when they arrive — an in-app toast while the tab is visible, a
desktop notification while it is hidden (objectui#7011).

The inbox was completely silent about arrivals. `sharedUserFeeds` polls
`sys_inbox_message` every 10s, the rows landed in the store, the bell badge counted
them — and a user not staring at the bell learned nothing, so approvals and @-mentions
were routinely missed. Three candidate popup paths existed and none was connected to the
inbox: the feed had no diff logic, the console's sonner bridge only serves notifications
that explicitly declare `displayType: 'toast'`, and there was no `new Notification(` call
anywhere in `packages/` or `apps/`.

**Presentation layer only.** The transport is untouched: the same two reads, the same
10s / 60s cadence, the same backoff, and no push channel. The accepted consequence is
that a backgrounded tab can be up to a minute late — speeding the poll up to shave that
would trade a server-wide cost for one surface's latency.

What arrives:

- **`useInboxArrivalNotifier`**, mounted from `useInboxBell` — the one wiring of the
  shared feed onto a bell — so the header bell and the `global:notifications` page block
  announce by the same rules and through the same `markRead`.
- **`inboxArrivals`**, the pure diff: a session-scoped seen set, `(topic, title)`
  collapse reused from the inbox's own `groupNotifications`, and a bounded memory.
- **`desktopNotifications`**, the single door to the browser Notification API.
- **Two switches** in the account menu's Preferences section, stored per user in
  localStorage: in-app alerts (on by default) and desktop notifications (off).

Four rules decide when nothing happens, and they matter more than the positive case — an
announcer that pops for everything is worse than the silence it replaces, because users
switch it off and then miss the approvals too:

- the FIRST answered read primes the seen set and announces nothing, so historical unread
  at login or after a refresh updates the badge only;
- several rows in one cycle announce once, collapsed by `(topic, title)`;
- a row that already carries a read receipt never announces;
- a hidden tab gets the desktop notification and no toast; a visible tab gets the toast
  and no desktop notification.

**`Notification.requestPermission()` is called from the settings toggle's change handler
and from nowhere else** — never on mount, on a feed refresh, or on a first message. A
browser answers that prompt once and `denied` is permanent for the origin, so a
load-time request spends the channel for every user who reflexively blocks, and no later
release can undo it. A browser that has not granted permission behaves exactly as it did
before this change: completely silent.

Seven `notifications.*` keys are added to all ten locale packs.
