---
'@object-ui/auth': patch
---

`purgeSignedOutClientCaches()` — the sweep that drops the signed-out user's
`objectui:metadata:*` seed cache on sign-out (objectui#5198) — now costs one key when a
single `removeItem` throws, instead of aborting the rest of the sweep (objectui#5777).

The `try` wrapped the WHOLE loop, not each removal. A `removeItem` that threw on key `n`
aborted the walk, so keys `n+1..end` were never swept, and the failure was swallowed —
`AuthProvider`'s `signOut` believed the purge had completed. The entries this sweeps are
the previous principal's org-scoped, PERMISSION-FILTERED app list — objectui#5198
classifies a surviving entry as a cross-principal disclosure on a shared browser, not
mere staleness — so a partial sweep here is the sharper half of the same defect class
objectui#5763 fixed on the sign-in path (`sweepStore` in `ActiveOrganizationStorage.ts`).

`Object.keys(sessionStorage)` — the reason a guard exists here at all — stays guarded on
its own; only the per-key guard is new. Same as `sweepStore`, a failed removal here is
not verified by read-back and not quarantined the way `ActiveOrganizationStorage.clear()`
(objectui#5731) quarantines a key: this function does not own reads for the metadata
seed cache (`MetadataProvider` in `@object-ui/app-shell` does), so there is no `get()` to
guard and nothing to quarantine — adding read-back verification would be a general
storage-error-handling refactor of the module, out of this card's scope. What is
mirrored is the reporting channel: a key whose `removeItem` throws is named in a
`console.warn`, the same channel `sweepStore` and `clear()` use, so a partial sweep is
discoverable instead of silent.

Adds a partial-failure test: a `sessionStorage` whose `removeItem` throws on one metadata
key, asserting every other metadata key on both sides of it is still swept and unrelated
non-matching keys are untouched, plus a control that the warning fires only on an actual
failure.
