---
'@object-ui/core': patch
'@object-ui/components': patch
'@object-ui/plugin-form': patch
---

A create form no longer deadlocks on a `requiredWhen` field that also declares a runtime `defaultValue`.

`#4069` ruled that in **create** mode a field whose `defaultValue` is a runtime
instruction the server resolves per insert (`NOW()` / `current_user`, or a CEL
Expression envelope) is producer-owned: the control is deliberately left empty
and the key is omitted from the payload, because `ObjectQL.applyFieldDefaults`
resolves the declaration only for a field that arrives absent or null. That was
implemented on the STATIC `required` flag.

The conditional spelling was not covered. `requiredWhen` is resolved one layer
downstream, in the form renderer, against the live record — so a predicate
resolving TRUE on a create form put the requirement straight back: the control
was still empty by design, the submit was refused, and the user had nothing
sensible to type.

Both spellings now behave identically on a producer-owned field. A
`requiredWhen` predicate is a claim about the value at rest in a given state,
and `NOW()` / `current_user` resolve at insert regardless of state, so the
producer's guarantee covers the conditional claim by the same argument that
covers the unconditional one. An author who really means "the user must supply
this in this state" has a natural spelling for it: do not declare the default.

The suppression lands in the single evaluator both layers read,
`resolveFieldRuleState` — the same verdict that draws the required marker and
the one the submit-time check consults — so a field can never lose its asterisk
while still refusing the write. The classifier that answers "is this value the
producer's to supply" moved down to `@object-ui/core`
(`isRuntimeDefault` / `isServerOwnedValue`, re-exported from
`@object-ui/plugin-form`) so the renderer, the wizard's cross-step gate and the
create-form field builders all read one implementation rather than three.

**Edit mode is unchanged.** Defaults do not re-apply to an existing record, so
on a persisted row the token was already resolved at insert and blanking the
column is a real removal: `requiredWhen` enforces there exactly as authored.
Fields with no declared default, and fields whose default is a static literal
(which IS seeded into the control), are also unaffected in both modes.
