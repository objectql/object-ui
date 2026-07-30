---
"@object-ui/data-objectstack": minor
"@object-ui/app-shell": patch
---

fix(analytics): a missing analytics capability no longer renders as an empty KPI — objectstack#3891

The framework retired its degraded in-kernel analytics fallback (objectstack#3891):
it dropped the caller's RLS/tenant scope and ignored the contract filter, so it
answered `200` with over-broad numbers. `@objectstack/service-analytics` is now
the only implementation, and a deployment without it answers `404` on
`/analytics/query` (objectstack#4019 stops mounting the routes) or `501` on
`/analytics/dataset/query`.

Three things were wrong on this side of that boundary:

**① A KPI on such a deployment rendered a confident zero.** `aggregate()`'s
`catch` promises a client-side fallback, and the fallback is correct — but the
adapter never got there for the most likely failure. It now classifies the
failure (`classifyAnalyticsFailure`) instead of treating every error alike:
capability-absent (404/501) degrades to a client-side aggregate over a
**server-scoped** `find()` — same rows, same filter, RLS still applied — and
says so **once per adapter** in the console, naming the package to install,
rather than once per widget or not at all.

**② A rejected query was answered with plausible numbers.** The framework
validates `/analytics/query` at the entry now (objectstack#4010), so a `400
VALIDATION_FAILED` means *this adapter* sent an off-contract body. Degrading
there would bury our own bug behind output from a different code path — the
misdirection objectstack#3878 documented. It now throws
`AnalyticsQueryRejectedError` and never falls back. Transient failures (5xx,
network) degrade exactly as before.

**③ The dataset preview blamed the author for a missing capability.**
`queryDataset` mapped `501`/`404` to `Dataset query failed: 501 Not Implemented
— …`; it now throws the typed `AnalyticsNotInstalledError`
(`code: 'ANALYTICS_NOT_INSTALLED'`) with a message a UI can render verbatim, and
`DatasetPreview` shows it as a "analytics capability not installed" empty state
instead of a red error banner. A real compile error (e.g. "relationship not
declared in include") keeps its server detail and its banner.

New exports from `@object-ui/data-objectstack`: `AnalyticsNotInstalledError`,
`AnalyticsQueryRejectedError`, `isAnalyticsNotInstalledError`,
`classifyAnalyticsFailure`.
