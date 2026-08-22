---
'@object-ui/types': patch
'@object-ui/app-shell': patch
---

The console's cold load no longer asks `/api/v1/runtime/config` or
`/auth/me/localization` twice (objectui#5544).

Two pairs of boot callers were racing each other for the same URL, with no shared
provider between them, so no guard inside either component could see the other:

- `GET /api/v1/runtime/config` — the pre-React branding script inlined in
  `apps/console/index.html` (it runs during HTML parse so the tab title and
  favicon are the operator's before the bundle is fetched) and
  `initRuntimeConfig()`. Measured ×2 on prod and on staging. This is the
  expensive one: the console `await`s `initRuntimeConfig()` before
  `createRoot().render()`, so the duplicate sat on the critical path to first
  paint, and at the control plane's ~0.5–1.4 s for this endpoint it also pushed
  boot concurrency further past the server's pool knee.
- `GET /api/v1/auth/me/localization` — `seedTenantLanguage()` on a device's true
  first visit and `LocalizationFetchProvider` on every boot. The seed keeps
  running past its 500 ms race by design and the provider mounts the moment that
  race resolves, so on a first visit the two overlap. Measured ×2 on staging.

`@object-ui/types` gains `sharedGetJson()`: callers that ask for the same GET
while one is already in flight join that request instead of starting another. It
shares the in-flight promise and nothing else — the entry is deleted the instant
the request settles, so there is no cache, no TTL and no stale window, and a
caller arriving after settle fetches fresh exactly as before. Rejections fan out
to every sharer with the status intact (`LocalizationFetchProvider`'s retry
policy still sees its own 503), each caller receives its own copy of the parsed
body, and only GETs are eligible — a non-GET is refused rather than quietly
rewritten.

Requests that differ in credentials mode or headers keep separate identities, so
the console's two deliberate `auth/get-session` calls — one Bearer-only with the
cookie omitted to detect a stale token, then one through the cookie — stay two
requests. Collapsing those would have destroyed the signal the first one exists
to read.

No component receives anything different: same payloads, same errors, one fewer
round trip.
