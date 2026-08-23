---
'@object-ui/console': patch
---

The console's form routes no longer seed a RUNTIME `defaultValue` into the
control, so the server-side resolution the declaration asks for actually happens
(objectui#5727).

`readPrefill` in `apps/console/src/components/FormPage.tsx` seeded every declared
default unconditionally. A `defaultValue` may be a literal, or an *instruction*
the server resolves per insert — a `DEFAULT_VALUE_TOKENS` token (`NOW()`,
`current_user`) or a CEL Expression envelope. Seeding one of those literally put
the text `NOW()` into a datetime input on both `/forms/:name` and the public
`/f/:slug` route, and submitting it sent that string as the field's value —
which is neither absent nor null, so `ObjectQL.applyFieldDefaults` never resolved
the declared default and the column stored the token text instead of a timestamp.

The seed is now guarded by `isRuntimeDefault` from `@object-ui/core` — the same
published classifier `@object-ui/plugin-form`'s `schemaDefaults.ts` guards its
seeding with, and the one this renderer already reads once removed (through
`isServerOwnedValue`) for the create-mode `required` carve-out. A runtime default
leaves the key ABSENT rather than empty, because absent is precisely the case the
engine resolves.

Nothing else about the prefill precedence moves: a literal default still seeds, a
stored record value still wins over a default, and an explicit `prefill_<field>=`
param still wins over both — including for a field whose default is a runtime
token, since a value a producer supplies is not a declaration awaiting
resolution.
