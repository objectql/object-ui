---
'@object-ui/auth': patch
---

`sweepStore()` — the walk that drops the previous user's `localStorage`/`sessionStorage`
state on a change of session user (objectui#5664 part 3) — now costs one key when a
single `removeItem` throws, instead of aborting the rest of the sweep (objectui#5763).

The `try` wrapped the WHOLE loop, not each removal. A `removeItem` that threw on key
`n` aborted the walk, so keys `n+1..end` were never swept, and the failure was
swallowed — `purgePreviousUserClientState()` returned normally and `SessionUserScope.adopt`
believed the sign-in purge had completed. This is an ALLOWLIST sweep precisely so the
next un-namespaced key — one nobody has written yet — cannot re-open the cross-user
pollution class #5664 fixed; a partial sweep is a partial allowlist, and which keys
survived depended on `Object.keys` iteration order rather than on anything bounded. The
previous user's org id, recents, favourites, or a `sessionStorage` metadata seed (their
permission-filtered app list, a cross-principal disclosure per objectui#5198) could all
land on the wrong side of the abort.

`Object.keys(store)` — the reason a guard exists here at all — stays guarded on its
own; only the per-key guard is new, so one uncooperative key now costs exactly that key.

Unlike `ActiveOrganizationStorage.clear()` (objectui#5731), a failed removal here is
NOT verified by read-back and NOT quarantined: `clear()` owns every future read of its
one key through `ActiveOrganizationStorage.get()`, so a "still readable" verdict and a
quarantine are what keep a failed `clear()` from handing the value straight back.
`sweepStore` walks keys it does not own reads for — another package's recents cache, a
metadata seed — so there is no `get()` here to guard and nothing to quarantine; adding
read-back verification for keys this function does not otherwise touch would be a
general storage-error-handling refactor of the module, which this card is scoped away
from. What IS mirrored is the reporting channel: a key whose `removeItem` throws is
named in a `console.warn`, the same channel `clear()` uses, so a partial sweep is
discoverable instead of silent. The caller (`SessionUserScope.adopt`, on the sign-in
path, inside an `AuthProvider` effect) still cannot act on the failure and must not
throw either.

A working `localStorage`/`sessionStorage` behaves exactly as before: every
non-device-scoped key is removed, nothing is reported, and the device-scoped allowlist
(`auth-session-token`, `auth-session-user-id`, `vite-ui-theme`) is unaffected.
