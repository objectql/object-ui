---
"@object-ui/app-shell": patch
"@object-ui/plugin-list": patch
"@object-ui/fields": patch
---

feat(app-shell): global settle signal (window.__objectui) + region aria-busy (ADR-0054 Phase 3)

Adds a single machine-readable "is the app idle?" predicate (ADR-0054 C5). The
data layer wraps the adapter's `fetch` to count in-flight requests, mirrored onto
`window.__objectui` with live `idle` / `pendingRequests` getters plus `whenIdle()`
and `subscribe()`. New `useSettleSignal()` React hook and lower-level exports
(`getPendingRequests`, `subscribeSettle`, `whenIdle`, `withSettleSignal`,
`installSettleSignalGlobal`). The list view and record-picker results regions now
set `aria-busy` while fetching and `data-state="loading|idle"` for region-level
waiting. Lets an automated (AI) driver wait for settle instead of hardcoding
timeouts.
