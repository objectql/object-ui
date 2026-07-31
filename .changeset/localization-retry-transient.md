---
"@object-ui/types": minor
"@object-ui/permissions": patch
"@object-ui/console": patch
---

fix(console): `LocalizationFetchProvider` retries a transient `/me/localization` failure instead of degrading for the whole session

`/auth/me/localization` is served by the environment kernel that owns the session
on a multi-tenant host, and a cold one answers `503` + `Retry-After` while it
warms (objectstack#4159). A transient failure is therefore a normal part of a
cold start — not an exception.

The provider made ONE attempt and `.catch()`-ed into silence. So a single 503
during warm-up left currency and locale unset for the **whole session**, silently
and permanently, long after the kernel was ready. Every money field rendered a
plain number and nothing ever tried again.

It now re-attempts a transient failure (`408`, `425`, `429`, `502`, `503`, `504`,
or a thrown fetch), server-stated `Retry-After` first, exponential backoff
otherwise. `401` / `403` / `404` / `500` are real answers about the caller and
still fail on the first attempt.

**It keeps its posture.** This provider is cosmetic, so it renders children
throughout — including mid-retry — and fills the value in if and when an attempt
succeeds. That is the opposite of `MePermissionsProvider`, which is fail-closed
and holds its loading state across the waits. Both are pinned by tests.

The retry PRIMITIVES ("is this transient", "how long to wait", `Retry-After`
parsing) move from `@object-ui/permissions`'s internal module to
`@object-ui/types` — the lowest package both callers can reach — and
`PermissionsFetchError` becomes the generic `HttpFetchError`. One definition of
transient, two policies, rather than a second copy free to drift from the first.
No behaviour change for `MePermissionsProvider`.
