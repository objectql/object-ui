---
"@object-ui/react": minor
"@object-ui/app-shell": minor
---

Adapt to framework 15.1: (1) ADR-0067 D2 all-or-nothing publishes — `formatPublishFailures` renders a rolled-back batch as ONE banner anchored on the causal item (`batch_aborted` entries are summarized, not listed as parallel errors); PackagesPage says "rolled back because X" instead of "{n} failed"; the AI chat publish toast surfaces the real reason instead of a bare count. Pre-15.1 partial-publish responses keep their per-item rendering. (2) ADR-0076 D12 honest discovery — `DiscoveryServiceStatus` gains `handlerReady` + `degraded`/`stub` statuses, new backward-tolerant `isServiceUsable()` helper (absent fields keep the pre-15.1 default; `stub`/`handlerReady:false` gate off; `degraded` stays usable), consumed by `isAuthEnabled`/`isAiEnabled` and `ConditionalAuthWrapper`.
