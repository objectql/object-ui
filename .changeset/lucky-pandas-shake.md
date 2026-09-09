---
'@object-ui/permissions': patch
---

`MePermissionsProvider` no longer keys its permissions-fetch effect on a memoised
driver's identity. The driver was a `useCallback` over
`[endpoint, fetcher, maxRetries, retryBaseDelayMs]` and the effect named that
callback as its dependency; React is permitted to discard a `useCallback` cache
and rebuild even when the dependency list compares equal, and the rebuilt
function is a new identity, so a discard tore the effect down and re-ran it —
costing a redundant `/api/v1/auth/me/permissions` round trip with none of the
four inputs changed. The driver is now a module-level function and the effect
keys on the four values directly. The trigger set is unchanged, so every
legitimate refetch (a new endpoint, a swapped fetcher, either retry knob) still
happens exactly once.
