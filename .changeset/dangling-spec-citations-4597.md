---
"@object-ui/types": patch
"@object-ui/i18n": patch
---

Doc comments no longer cite `@objectstack/spec` symbols the pinned spec has retired

Eight exported declarations carried a doc comment claiming alignment with a
`@objectstack/spec` symbol that `17.0.0-rc.6` does not export — four locale
formatting shapes in `@object-ui/i18n` (`SpecPluralRule`, `SpecDateFormat`,
`SpecNumberFormat`, `SpecLocaleConfig`) and four activity-feed shapes in
`@object-ui/types` (`FieldChangeEntry`, `Mention`, `Reaction`,
`RecordSubscription`). A citation that points at nothing is worse than a stale
one: the next reader cannot tell whether the protocol retired the symbol,
renamed it, or never had it.

Measuring all eight against the published registry answered that question, and
the answer was not "these names never existed". Every one was a real export the
protocol retired on purpose, and every local key set was faithful to the schema
it named. The feed four left `@objectstack/spec/data` in the `16.0.0` major,
when the feed surface was replaced by the data API over `sys_comment` /
`sys_activity`. The i18n four left `@objectstack/spec/ui` in `17.0.0-rc.6`
itself — they were still present in `rc.5` — retired under ADR-0049
enforce-or-remove because no authorable shape carried them and nothing ever
parsed them.

Each comment now records that provenance, including the version the symbol left
and what (if anything) replaced it, so the shapes read as declarations these
packages own rather than as a view onto a protocol type. Type shapes, runtime
behaviour and exports are unchanged — the published `.d.ts` files differ only in
comment text, which is why this is graded `patch`.
