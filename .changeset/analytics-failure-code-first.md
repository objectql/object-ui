---
'@object-ui/data-objectstack': minor
---

Classify `/analytics/query` failures by their ADR-0112 `code` rather than their HTTP status, so a chart is no longer answered from a different code path behind the wrong explanation.

`classifyAnalyticsFailure` tested `status === 404 || status === 501` before the code operands on the same line, so the status short-circuited every one of them: any 404 on this face was classified "the analytics capability is not installed" whatever code it carried, and `NOT_IMPLEMENTED` / `ROUTE_NOT_FOUND` were unreachable for the conditions they name. Three unrelated conditions answer 404 on this url, so the status cannot tell them apart — the `code` is the contract.

Two conditions change behaviour:

- **404 `CUBE_NOT_FOUND`** (a misspelled or unregistered cube — an authoring mistake) now **throws** the server's own error verbatim, keeping `code` and the producer's repair instructions. It previously warned "install `@objectstack/service-analytics`" and silently degraded to `find()` + client-side aggregation — which cannot answer it anyway, because the fallback re-reads the same name through `/data`, where an unregistered object is a 404 `OBJECT_NOT_FOUND`.
- **401 `UNAUTHENTICATED`** (an anonymous or lapsed session) now **throws** `AnalyticsUnauthenticatedError` instead of degrading silently behind a `find()` that is about to be refused the same way.

Unchanged: `NOT_IMPLEMENTED` / `ROUTE_NOT_FOUND` and code-less 404/501 answers still degrade loudly to the client-side fallback, 400 `VALIDATION_FAILED` still throws, and 5xx / network failures still degrade silently.
