---
'@object-ui/plugin-tree': patch
---

`ObjectTree` no longer queries a switched-to object with the previous object's
`$expand` set (objectui#6481).

The schema-settled gate was two separate pieces of state — the definition
(`objectSchema`) and a bare `schemaSettled` boolean that was set `true` in a
`finally` and never reset. Two independent values cannot express "settled, but
for a DIFFERENT object", so when the host swapped the bound object both effects
re-ran while the latch still read `true` from the previous object's settle and
the definition still held the previous object's fields. The tree issued

    find(newObject, { $filter: …, $expand: [ …previous object's relation fields… ] })

— rejected or silently ignored depending on the adapter, plus the transient it
painted — before a correct second query followed.

`ObjectTree` now adopts `useSettledSchema` from `@object-ui/react` (the shared
resolution hook ruled in objectui#6482), replacing BOTH pieces of state with the
hook's single `{ key, def } | null`. Readiness is derived during render by
comparing the settled key against the currently bound object, so the gate closes
in the same commit that changes the object rather than one commit later — the
stale-key window is not merely fixed but unrepresentable.

Behaviour that deliberately does NOT change: the gate stays inside the
object-provider branch of the record effect (the inline/static branches issue no
metadata read and must not wait on one), and every exit still settles — no
`getObjectSchema`, no object name, or a rejected read each settle with no
definition, so a tree whose adapter serves no schema still queries instead of
waiting forever.
