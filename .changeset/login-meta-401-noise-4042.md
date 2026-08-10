---
"@object-ui/app-shell": patch
"@object-ui/data-objectstack": patch
---

The console no longer reads `/meta/*` before it knows whether it has a session, and a failed request now says which request failed

Opening a logged-out console painted ~30 red `HTTP request failed` lines before
the login form was drawn. Two independent causes, fixed independently
(objectui#4042).

**1. Requests fired before the session was known.** `ConnectedShellInner` now
withholds the metadata tree until `GET /auth/get-session` resolves, so
`meta/object` / `meta/view` / `meta/app` are never issued blind. `useAuth()`
outside an `AuthProvider` reports `isLoading: false`, so an embed with no auth
provider is unaffected, and every protected route already sat behind an
`AuthGuard` that resolves auth first — the signed-in data flow is unchanged.

The console's landing route (`<Route path="/">`) was the actual entry point for
the burst: it mounted `ConnectedShell` with no guard above it, so simply opening
`/_console/` mounted the whole data layer as an anonymous visitor. It is now
guarded, which also means an unauthenticated visitor reaches `/login` without a
single doomed request. `examples/console-starter` had the same shape and got the
same fix.

**2. Two requests per type, per mount — not an unauthenticated artefact.**
Consumers read metadata during the FIRST render (`useActionModal` reads
`objects`, whose getter kicks `ensureType('object')` and `ensureType('view')`
from the render phase), before any effect runs. `MetadataProvider`'s preview-mode
effect then cleared the whole cache on mount, discarding those two entries while
their requests were in flight; the next render found them `idle` and refetched
both. The effect now skips its mount run — on mount the cache is empty and there
was never anything to drop; it only ever meant something on a later
`previewDrafts` change. That halved `meta/object` and `meta/view` on **every**
mount, signed in included.

A second duplicate only appeared once a read had failed: `entry.promise`
collapses callers that arrive while a request is in flight, but callers arriving
just after a failure each started a fresh attempt. A failed type now stays
un-retried for ~1s, which collapses one mount's burst of callers into a single
attempt. This is deliberately not the 5-minute `ttlMs` — later callers still
retry on their own, and `refresh()` / `invalidate()` retry immediately and
unconditionally, so no explicit recovery path changes.

**3. `HTTP request failed` now identifies the request.** `@objectstack/client`
reports every non-2xx as
`logger.error("HTTP request failed", undefined, { method, url, status, error })`,
and the console's logger forwarded that verbatim — so the identifying fields
lived only in the third argument, and anything that flattens a console record to
text rendered them `[object Object]` / `Object`. A screenful of failures could
not tell you a single URL or status. The message string now carries them:

```text
HTTP request failed: GET /api/v1/meta/object -> 401 [UNAUTHORIZED]
```

The structured bag is still passed alongside for DevTools to expand — text for
the flatteners, object for the inspectors, neither at the other's expense. The
formatter is exported as `formatHttpFailureMessage`, and `createQuietHttpLogger`
is now exported too so an app wiring its own `ObjectStackClient` gets the same
identified failures.

Nothing is newly silenced. The only demotion remains 404-on-an-optional-
collection (`sys_presence`, `sys_activity`), which is an expected outcome of a
request we still mean to make; a 401 that survives the session gate — a
mid-session expiry, say — stays a visible, fully-identified error. The cure for
doomed requests is not issuing them, never hiding them once issued.
