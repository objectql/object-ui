---
'@object-ui/data-objectstack': patch
---

fix(data-objectstack): an `enable`-block API denial is surfaced, not degraded to an empty result set

`find()` degraded **every** 404 into `{ data: [], total: 0 }` and memoised the resource in
`missingResources`, so a list pointed at an object the server refuses to expose answered
"successfully" with zero rows. A resolved promise with zero rows is indistinguishable from a
genuinely empty object, so the surface rendered its ordinary empty state: *"you have no
records"* over a page that can never hold any (objectui#4408).

The two denials the server derives from an object's `enable` block are now let through:

- `OBJECT_API_DISABLED` (404) — `enable.apiEnabled: false`, the object is not exposed at all;
- `OBJECT_API_METHOD_NOT_ALLOWED` (405) — the operation is absent from `enable.apiMethods`.

Both are pure functions of the object's metadata — no user, no permission, no context — so
neither is transient or per-user, which is exactly the case where a silent empty state is
most misleading. The memo is skipped for them too: absorbing a denial would have pinned the
object to "empty" for the rest of the session.

The discrimination is on the ADR-0112 `code`, never the status — a missing collection and a
disabled object are both 404, and the missing-collection half **must** keep degrading to
empty (the optional-collection probes read empty data as "feature unavailable"). Unchanged:
a bare 404, `OBJECT_NOT_FOUND` and `RECORD_NOT_FOUND` still resolve to an empty result and
are still memoised, and a 2xx with zero rows is still an ordinary empty result.

Also fixes a code-propagation gap on the same path: the raw `$expand`/`$search` branch
bypasses `@objectstack/client` and hand-rolled its own error, stamping only `status`. It now
carries the ADR-0112 envelope (`code` + `httpStatus`) with the same precedence as the client's
fetch wrapper, so a denial arriving on the branch a list takes whenever it expands a lookup or
runs a search is no longer indistinguishable from any other 404/405.

New exports: `isApiAccessDeniedError(error)` and `API_ACCESS_DENIED_CODES`.
