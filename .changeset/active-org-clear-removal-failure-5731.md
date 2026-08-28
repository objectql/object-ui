---
'@object-ui/auth': patch
---

`ActiveOrganizationStorage.clear()` now verifies that the persisted key is actually
gone and, when it is not, both reports the failure and stops `get()` answering from
the surviving value — instead of swallowing the failed removal (objectui#5731).

`clear()` nulled `_memoryValue` and then removed the persisted key inside a
`try`/`catch` that discarded any failure. Since objectui#5703 `get()` prefers a
NON-NULL `localStorage` read and only falls through to `_memoryValue`, so the two
halves of `clear()` were not equally strong: nulling memory always sticks, while a
removal that did not stick left the key readable and the read order preferred it.
Sign-out is one of `clear()`'s five callers, so the failure mode was "sign-out does
not stick", and it was silent — the cleared organization went back on the wire as
`X-Tenant-ID` on every subsequent request.

The removal is now judged by a READ-BACK rather than by catching the throw, which is
both narrower and wider in the right directions. Wider: a wrapped or proxied
`localStorage` whose `removeItem` is a silent no-op never throws and leaves identical
residue, and is now covered. Narrower: SSR and the partitioned-iframe browser where
every operation throws have nothing readable to resurrect, were already safe, and are
not reported as failures.

A key whose removal could not be verified is quarantined in memory for the rest of the
page-load: `get()` skips the persisted branch for it and answers from `_memoryValue`,
which `clear()` has just nulled and which a later `set()` refills with the value that
write was meant to persist. The quarantine is released as soon as a removal on that key
sticks. An unstamped `X-Tenant-ID` is a documented state of the edge contract
(objectui#5279); a re-stamped signed-out organization is not.

The failure is not thrown and not returned. All five call sites — sign-out's
`purgeSignedOutClientCaches`, `switchOrganization`, `deleteOrganization`,
`leaveOrganization`, and the session-user purge that runs on the SIGN-IN path — arrive
after the transition they follow up on has already happened, and none can act on a
storage failure; a `boolean` every caller ignores would read as handled when it is not.
So the invariant is restored inside `clear()` and the failure is reported to the
console.

A working `localStorage` behaves exactly as before: the removal sticks, nothing is
quarantined, nothing is reported, and a non-null persisted read is still authoritative.
`set()`'s swallowed write failure is deliberately untouched — that swallow is
objectui#5703's memory fallback, and it is the correct kind, because the memory copy
upholds `set()`'s postcondition where nulling memory could not uphold `clear()`'s.
