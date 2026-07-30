---
"@object-ui/types": minor
"@object-ui/app-shell": patch
"@object-ui/react": patch
"@object-ui/data-objectstack": patch
---

fix(errors): error-code branches survive the framework's ADR-0112 rename — objectstack#3841

Framework ADR-0112 renamed the whole `error.code` vocabulary from lowercase
`snake_case` to `SCREAMING_SNAKE` (`destructive_change` → `DESTRUCTIVE_CHANGE`).
Eleven places compared `err.code` against the old spelling with `===`, so against
a swept server they simply stopped matching — and nothing threw. The affordance
each branch guards just vanished and the user got the generic error toast instead:

- the destructive-change confirm dialog (resource editor, permission matrix)
- the "create a writable package first" hint
- field-scoped validation issues on embedded item saves
- the all-or-nothing publish summary naming the causal item
- unknown-object tolerance in the app header and in record search
- the marketplace's local-install messages for conflict / auth / unavailable
- `isNotFoundError` in the data layer

`RECORD_NOT_FOUND` had already been renamed a release earlier, so that branch was
already dead before this fix.

New `errorCodeIs` / `errorCodeIsAnyOf` in `@object-ui/types` compare
case-insensitively, so the console keeps working against servers on either side
of the rename — the console ships separately from the server it talks to. Every
call site now passes the catalog (SCREAMING) spelling, and `error-code.ts` is the
single file to delete once no supported server emits the old vocabulary.
