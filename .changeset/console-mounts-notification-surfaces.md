---
"@object-ui/app-shell": minor
---

feat(app-shell): the console mounts the notification surfaces, so `displayType` works there (#3014 follow-up)

#3071 gave each spec `NotificationTypeSchema` member its own presentation, but no
host mounted `NotificationProvider` — the capability existed and the console
could not reach it. `ConsoleShell` now mounts the provider and the surfaces with
a single global home; `ConsoleLayout` mounts the one that belongs in the content
area:

| `displayType` | Surface | Mounted by |
|---|---|---|
| `toast` | sonner, via the new `presentNotificationToast` | `ConsoleShell` |
| `snackbar` | `<NotificationSnackbar />` | `ConsoleShell` |
| `alert` | `<NotificationAlerts />` | `ConsoleShell` |
| `banner` | `<NotificationBanners />` | `ConsoleLayout`, beside the draft / unpublished bars |
| `inline` | `<NotificationInline scope="…" />` | the raising surface — **not** mounted globally |

`inline` is left out deliberately: rendering in place at the raiser is the whole
difference between it and a banner, so a global inline outlet would collapse the
two again.

`presentNotificationToast` is the single place a notification becomes a sonner
call — severity → variant, `duration: 0` → `Infinity` (the contract's
"persistent", which passed through raw would have made the toast vanish on the
next tick), first action → the one action slot sonner offers, an absent duration
left to the `ConsoleToaster` default rather than reinvented. Its severity table
is `Record<NotificationSeverityLevel, …>`, so a new spec severity fails
type-check instead of silently rendering neutral.

The banners go through `ConsoleNotificationBanners`, which gates on
`useHasNotificationProvider()`. `ConsoleShell` is deliberately a set of
composable pieces a host assembles in its own `App.tsx`, so `ConsoleLayout` can
legitimately render without the provider above it — and `useNotifications()`
throws there, which would white-screen the whole app instead of simply showing
no banners.

Both pieces are exported (`presentNotificationToast`, `ConsoleNotificationBanners`)
for hand-assembled shells. The provider's `defaultDuration` matches
`ConsoleToaster`'s 4s, so a snackbar and a toast raised together disappear
together.
