---
---

Comments-only truth correction: six comments in the console app surface named the app
LIST endpoint with a plural-collection spelling that no request in this repo constructs
and that no framework route ledger declares as a row of its own. All six now name what
the console actually calls — the generic metadata list route `GET /api/v1/meta/:type`,
requested with the singular type segment `app` (`MetadataProvider` →
`client.meta.getItems('app')`) — and keep the per-session filtering claim, which
verification confirmed: `filterAppForUser` in `packages/rest/src/rest-server.ts` gates the
list inside that `:type` handler once the type segment resolves to `app`. Three of the six
are test-file rationale headers; every assertion is untouched, and one of them
(`appAccessProbe.test.ts`) already pinned the singular address in its own expectation,
which is what made the header's spelling demonstrably wrong.

No behaviour changes: each touched file transpiles byte-identically with comments stripped
(objectui#4887).
