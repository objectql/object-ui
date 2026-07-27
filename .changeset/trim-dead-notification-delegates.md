---
"@object-ui/react": minor
---

feat(react)!: trim the dead device/preference delegates from
`useClientNotifications` (objectstack#3612 companion)

`registerDevice`, `getPreferences`, and `updatePreferences` delegated to
`@objectstack/client` methods that were deleted in objectstack#3612 — the
`/notifications/devices` and `/notifications/preferences` server routes they
targeted were never built, so every call already surfaced an error at
runtime. The hook keeps `fetchNotifications` and `markAsRead` (both
dispatcher-served and route-ledgered). Breaking only for code destructuring
the removed functions from the hook result; nothing in this repo did.
