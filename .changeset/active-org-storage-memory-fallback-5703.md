---
'@object-ui/auth': patch
---

`ActiveOrganizationStorage.get()` now prefers a non-null `localStorage` read and falls
back to the in-memory value otherwise, instead of returning the `localStorage` read
unconditionally — so the fallback is reachable in the browser state it was written for
(objectui#5703).

`set()` already swallowed a failed `localStorage.setItem` into `_memoryValue`, but
`get()` only consulted `_memoryValue` when the READ itself threw. There is a real
browser state where the read does not throw and the fallback is nonetheless the only
copy: `localStorage` present and readable but rejecting writes — Safari private
browsing, and any quota-exhausted origin, where `setItem` throws `QuotaExceededError`.
In that state the active org was stored and could not be read back, measured as
`_memoryValue = org-42` alongside `get() = null`.

The cost was silent and lasted the whole session rather than the documented first-boot
window: `createAuthenticatedFetch` reads `get()`, so `X-Tenant-ID` was never stamped on
any request. Per the edge contract documented on objectui#5279 that header is a routing
hint a reader falls through on — the framework scopes from the session — so no row
visibility rode on this; what was missing is the tenant-routing input, on every request.
`switchOrganization` also appeared to succeed while the client-side stamp never
followed.

Sign-out is unaffected, and that is the half worth stating: the new fallback fires
exactly when the `localStorage` read is null, which is the state `clear()` leaves
behind. It answers `null` there because `clear()` nulls `_memoryValue` too. That
property is now pinned by test rather than relied upon, so a future `clear()` that only
removed the persisted key fails a test instead of quietly re-stamping a cleared org.

A non-null persisted read still wins over the memory value, so a working `localStorage`
behaves exactly as before.
