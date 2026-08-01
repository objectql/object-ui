---
"@object-ui/components": patch
"@object-ui/plugin-form": patch
"@object-ui/core": patch
"@object-ui/fields": patch
---

A required boolean must be savable in its UNCHECKED state — `false` and `0` are values.

Reported against an AI-built task tracker whose 任务 object has a required
`是否完成` boolean: the create form showed the switch OFF, answered "是否完成不能
为空", and saved instantly once the switch was turned ON. The app could only ever
create ALREADY-DONE tasks — the one state the control shows by default was the
one value it refused to save (cloud#972).

Two defects stacked, and either alone is enough to break it:

**The `required` verdict read truthiness, not presence.** `@objectstack/spec`
FieldSchema.required (ADR-0113) is "an insert must provide a NON-NULL value",
and objectql's record validator implements exactly that. react-hook-form's
built-in rule instead fails whenever `isBoolean(value) && !value` — its
accept-the-terms checkbox heritage — silently redefining every required boolean
as "must be TRUE", including a select whose chosen option value is `false`. It
also disagreed the other way, letting a whitespace-only string through for the
server to reject with a 400. The form renderer no longer hands RHF its own
`required`: the check is now a `validate` entry keyed `required` (so the error
still surfaces as `type: 'required'`, which the conditional-required cleanup
keys on) backed by a new shared `isMissingForRequired` in `@object-ui/core`, a
deliberate mirror of objectql `record-validator.isMissing` — `undefined`,
`null`, blank-after-trim string, empty array. Deleting the inherited rule also
stops a `required` that rode in on `validation` from outliving a `requiredWhen`
that resolved to FALSE.

**A boolean field held `undefined` while displaying "off".** A two-state control
has no third state, but a field with no entry in `defaultValues` rendered an OFF
switch backed by nothing: the create payload omitted the column (it lands null,
which reads as unchecked but isn't) and the presence check above would still
refuse it. The form renderer now folds `false` into `defaultValues` for every
boolean-widget field the caller left unset — in `defaultValues` itself, not
per-Controller, because that object is also the dirty-check baseline and what
the defaults-reset window replays. Every surface gets it, including the
modal/drawer create dialogs that start from a bare `{}`. An authored default
(or a loaded record, `null` included) still wins.

`WizardForm`'s cross-step gate had its own copy of the empty-value predicate; it
now imports the shared one so it cannot drift from the per-field verdict. And
the field-demo renderer read `schema.defaultValue || schema.value`, throwing
away an authored default of `false` / `0` / `''` — same falsy-as-empty class,
now `??`.

Verified end to end on a local stack against the exact metadata shape
`apply_blueprint` materializes (`{ type: 'boolean', required: true }`, no
default): a 是否完成 = 否 task with 工时 = 0 now creates and persists as
`{ hours: 0, is_done: false }`, turning the switch on still stores `true`, and a
blank required text is still refused.
