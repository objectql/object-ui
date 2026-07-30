---
"@object-ui/permissions": minor
"@object-ui/console": patch
---

fix(permissions,console): `MePermissionsProvider` retries a transient `/me/permissions` failure instead of stranding the app on its loading state

"Not now" is a real answer from this endpoint. On a multi-tenant host it is served
by the environment kernel that owns the session, and a COLD one answers `503` +
`Retry-After` while it warms (objectstack#4159 / cloud#927). The provider treated
that like any other failure: it set `error` — and a consumer that passes no
`errorFallback` renders `loadingFallback` for the error state too. The console
does exactly that (`loadingFallback={<LoadingScreen />}`, no `errorFallback`), so
the app sat on its spinner indefinitely, with a `retry` nobody could reach.

The fetch now re-attempts a **transient** failure — `408`, `425`, `429`, `502`,
`503`, `504`, or a thrown fetch (offline / DNS / aborted), which never got an
answer at all. A server-stated `Retry-After` wins over the exponential backoff
(both wire forms are read, and clamped to 30s so a hostile value cannot park the
UI); otherwise the delay doubles from `retryBaseDelayMs`. `loading` stays true
across the waits, so the fail-closed loading state holds and consumers never see
a permissive flash mid-recovery.

Unchanged for a real answer about the caller: `401`, `403`, `404` and `500` fail
on the first attempt exactly as before. `500` is deliberately not retried — a
genuine server fault neither benefits from hammering nor should be hidden behind
a spinner.

**New props**, both optional and defaulted so no call site needs to change:

- `maxRetries` (default `3`) — `0` restores the previous single-attempt
  behaviour.
- `retryBaseDelayMs` (default `500`) — base for the exponential backoff.

Also fixes a latent race the retries made much wider: the in-flight fetch is now
cancelled when the effect tears down, so a slow answer for a previous `endpoint`
or `fetcher` can no longer overwrite a fast answer for the current one. The retry
primitives (`parseRetryAfterMs`, `backoffMs`, `isTransientFailure`,
`TRANSIENT_STATUS`, `PermissionsFetchError`) live in a new internal `./retry`
module — not exported from the package root.

**The console now passes an `errorFallback`.** Retrying narrows the window but
cannot close it — a kernel build slower than the retry budget still lands in the
error state, and rendering `loadingFallback` there is what produced the eternal
spinner. It now renders `<LoadingScreen error={...} onRetry={retry} />`, using the
error + retry affordance that component has carried all along, so a user is never
left with a spinner and no way forward.
