---
'@object-ui/data-objectstack': minor
---

`classifyAnalyticsFailure` now reads a 400 as a refusal of the query body we
sent regardless of which ADR-0112 `code` it carries, so `aggregate()` no
longer answers a rejected filter with client-side numbers from a different
door (objectui#7755).

Before this fix, only 400 `VALIDATION_FAILED` (and a code-less 400) threw
`AnalyticsQueryRejectedError`. Any OTHER coded 400 — `service-analytics` ships
its own 400 `INVALID_FILTER` on a filter shape it refuses — matched none of
`classifyAnalyticsFailure`'s branches and fell through to `unknown`, which
`aggregate()`'s catch has no arm for, so it silently degraded to
`aggregateViaFind`: a re-read through `find()`'s `$filter` query-string
contract, which accepts array shapes the analytics request body does not. A
filter the analytics route refused could still be answered — with a
plausible, wrong number, and no sign the request had a defect.

The fix is a floor UNDER the existing code branches, not a replacement for
them: `NOT_IMPLEMENTED` / `ROUTE_NOT_FOUND` still win `not-installed`,
`VALIDATION_FAILED` / `UNAUTHENTICATED` / `CUBE_NOT_FOUND` still win their own
outcomes first (objectui#5721). Only a 400 that none of those four already
claimed now falls to the new floor instead of past it. An unmatched NON-400
coded error (e.g. a coded 5xx) is unaffected and keeps degrading exactly as
before — this fix is scoped to the 400 case only.
