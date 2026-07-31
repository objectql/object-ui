---
"@object-ui/console": patch
---

feat(settings): a rejected save marks the fields that caused it — objectstack#4224 follow-up

A `SETTINGS_VALIDATION` rejection names the offending keys, and the settings page
threw all of it away. Every failure collapsed into one toast carrying the
server's summary sentence, with nothing marked on the inputs — so on a namespace
with a dozen keys the user was told a value was wrong and left to find which.

**That was not the console's fault, which is the part worth recording.** The
server sent `fields` as a `Record<key, message>` hung *beside* `error.code`, a
position `ApiErrorSchema` never declared — it survived only because the schema
is a plain `z.object` and strips undeclared keys rather than rejecting them.
`extractFieldErrors` reads arrays (`details.fields`, `fields`,
`validationErrors`), so a map at an undeclared position matched nothing and
returned `null`. objectstack#4224 moved it to `error.details.fields` as the
declared `FieldError[]`, which is what makes this wiring a few lines rather than
a parser.

What changes for a user: the server's message now renders against the input that
caused it, in the slot the help text occupies, and clears the moment that field
is edited, on Discard, or on the next successful save. `SettingsField` gained an
`error` prop; it sets `aria-invalid` and `aria-describedby` on the control and
gives the message `role="alert"`, so the rejection is announced rather than being
conveyed by colour alone.

The toast still fires alongside the per-field marks. The offending field can be
scrolled out of view or hidden behind a `visible` expression, and a save that
appears to do nothing is the worse failure.

Fields the server did not name are left unmarked — a wrong mark on an innocent
input is worse than the generic toast that was already there — and a failure
carrying no field array (a 500, an unknown namespace) behaves exactly as before.
