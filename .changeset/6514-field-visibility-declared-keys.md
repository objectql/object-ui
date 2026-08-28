---
'@object-ui/app-shell': minor
---

Object-field visibility on the record form page and the console's global
record-form modal now reads the keys `@objectstack/spec` DECLARES — the static
`hidden` and the `visibleWhen` predicate — instead of `visible`, a key the
contract refuses (objectui#6514; maintainer ruling 2026-08-27, Option A).

`FieldSchema` is a `strictObject` and `visible` is not one of its keys: it
appears in `FIELD_KEY_GUIDANCE` as prose that REFUSES the spelling, deliberately
not as an alias, because — quoting the guidance — "this surface declares BOTH
forms and the two answers have opposite polarity". So both call sites were
gating on something no author could legally write: metadata carrying a
field-level `visible` never survives validation, and a census re-run for this
card over the framework's 113 `*.object.*` files (`aef1b7e64`) found zero of
them, against 113 `label` / 107 `required` / 76 `readonly` field-level hits from
the same query shape.

What changes for an author: `hidden: true` on a field now actually withholds it
from these two forms, and a `visibleWhen` predicate now decides there — both
previously inert. The dead `visible` read is deleted rather than kept beside the
declared keys, so the refused spelling cannot survive as a second, renderer-side
contract.

`hidden` is INVERTED relative to the key it replaces (`visible: false` is
`hidden: true`), and an inversion read backwards raises no error — a field
either vanishes with no diagnostic or leaks to a principal it was hidden from.
Both directions are therefore pinned per call site (hidden/shown, predicate
false/true), and the suites were measured red against the pre-fix code AND
against a deliberately inverted implementation.

The two keys compose as AND: `visibleWhen` is documented as "shown only when
TRUE (else hidden)", a necessary condition and never a licence to un-hide a
statically hidden field — the same shape `resolveFieldRuleState` already uses
for `readonly`/`readonlyWhen` and `required`/`requiredWhen`.

Field-level visibility keeps the contract's current scope: no `current_user`
binding is added, and the tier's documented fault-open is unchanged. Per-user
field hiding still goes through the option/form layers that bind the user.
