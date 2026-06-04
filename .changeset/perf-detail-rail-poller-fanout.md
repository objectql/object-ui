---
'@object-ui/app-shell': patch
'@object-ui/plugin-detail': patch
---

perf(detail/header): lazy + dedupe related-list fan-out, coalesce header polls

Opening a record detail fired ~50 concurrent `/api/v1` requests that
head-of-line-blocked one another on a single control-plane container.

- `RecordDetailView` no longer eager-preloads reverse-reference children
  when the reference rail renders them (that data was discarded while the
  rail re-fetched the same collections).
- `record:reference_rail` now gates fetching on visibility
  (`IntersectionObserver`; the rail is `hidden xl:flex`), caps concurrency
  at 3, and fetches once per `(parentId + entries)` via a signature guard,
  applying results through a mounted ref.
- `AppHeader` inbox/notification, approvals, and activity pollers gained
  in-flight guards so bootstrap effect re-runs coalesce to one request; the
  approvals poll now sends one request with all identities comma-joined
  instead of one per identity.

Measured locally: opening an environment detail dropped from ~52 to ~17
requests, related collections from ×3–5 each to ×1, approvals from ×9 to ≤3.
