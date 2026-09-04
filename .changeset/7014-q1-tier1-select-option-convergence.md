---
'@object-ui/types': minor
---

Converge the two named select-option types onto one spec-derived base (objectui#7014, Q1).

`SelectOptionMetadata` (`field-types`, the object-metadata read model) and `SelectOption`
(`form`, the SDUI form vocabulary) each restated the select-option vocabulary by hand.
Both now extend the new `SelectOptionBase`, which derives the spec's keys from
`@objectstack/spec/data` **by reference** and writes out only the divergences. A key the
spec adds now reaches both faces with no edit here; a key it removes becomes a compile
error at the sites that read it, instead of a hand copy that goes on compiling while the
contract moves underneath it.

**What widened.** Exactly one key, on one face: `SelectOptionMetadata` gains
`default?: boolean`. It is a spec key that face could not describe before — ruled
`enforce` on the object-field face (objectstack#7246), where the engine seeds a new
record from the option marked `default: true` — and it arrives OPTIONAL, so every
document that face accepted before is still accepted.

**What narrowed.** Nothing. Both faces resolve to member-for-member what they resolved to
before (`SelectOption` identically; `SelectOptionMetadata` identically plus `default`),
pinned invariantly against the pre-convergence member lists in
`select-option-tier1-convergence-7014.test.ts` so a future "unification" cannot quietly
drop a key. `SelectOption.value` keeps its deliberate widening past the spec's machine
identifier (numeric/boolean values for standalone forms, objectui#3090), now named in an
`Omit` instead of restated.

**The convergence is an EXTENSION, not a replacement.** objectui legitimately carries
keys the spec does not: `description` (`LookupField` searches it, objectui#6153) on the
metadata face, and `disabled` / `icon` on both. The spec's `SelectOptionSchema` is strict
over exactly `{label, value, color, default, visibleWhen}` and refuses each of those
three **by name**, so they are declared as objectui dialect with that refusal written
into the published JSDoc rather than described as spec-aligned. These are read-model keys
and must never reach an authored object document — a field's `options` are routed through
the strict schema, so one of them fails the whole field.

`SelectOptionBase` is exported from `@object-ui/types` because it appears in the
`extends` clause of both published interfaces.
