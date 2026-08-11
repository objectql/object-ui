---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

The build-history panel tells an operator a 503 means "the commit store could not be reached — retry", instead of `commits HTTP 503`

`packages/app-shell/src/preview/commitHistory.ts` flattened every non-OK response to a bare status code (`commits HTTP {status}` for the read, `HTTP {status}` for the revert). Nothing was ever swallowed and no fictional "no history" was ever rendered — those fail-loud properties held, and still hold, which is why objectstack#5980's 503-ification (ADR-0110 D3) needed no follow-up here. What was lost is the meaning the backend already sends, on the one screen where it matters most: this is the rollback surface, read by an operator who is usually mid-incident. A 503 says the read/write did not happen and is worth retrying; a 404 says the store answered "no". They now read differently, and 404, 500 and 503 stay tellable apart.

Failures now throw a `CommitStoreError` carrying `status`, the ADR-0112 `code`, and a `retryable` flag, and the panel renders a sentence rather than a number. The revert half gets a deliberately different sentence: a write that could not reach the store may still have landed, and re-issuing it appends a *second* revert commit to an append-only log, so the copy asks the operator to re-read the timeline before retrying rather than simply saying "try again".

Two details of the report this fixes were checked against the producer and came back different, and both are the reason the copy is authored client-side. The semantic code arrives at **`error.code`**, not `details.code` — `HttpDispatcher.errorFromThrown` parks it in `details` and `buildApiError`/`splitSemanticCode` lift it out and drop `details` (objectstack#3842) — so a consumer reading `details.code` would run a check that can only pass vacuously. And the envelope's own `message` for this class is *withheld*: `declaresServerFault` (objectstack#5811) is true for a 5xx carrying a string code, so the prose on the wire is the generic `Internal server error`. Rendering it would have been strictly worse than the bare status code it replaced. Classification therefore keys on the HTTP status first and treats the code as a second signal, which also means a 503 shed by a proxy with an HTML body still produces the retryable reading.

Adds `preview.history.loadFailedUnavailable` and `preview.history.revertUnavailable` to all ten locale packs.
