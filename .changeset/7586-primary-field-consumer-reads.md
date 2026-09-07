---
'@object-ui/components': minor
'@object-ui/plugin-detail': minor
---

The last two consumer-side reads of `primaryField` off an OBJECT def are gone (objectui#7586).

`primaryField` is a `DetailViewSchema` key (`@object-ui/types` `views.ts`) — a **view** key,
which `DetailView.resolveDisplayTitle` reads off `schema` and is welcome to. Read off an
**object** def it is undeclared: `@objectstack/spec`'s object schema is a `strictObject`
answering `unrecognized_keys: ['primaryField']`, and `ObjectSchema.create()` throws.
`primaryField` appears in **zero** files of the shipped `@objectstack/spec@17.2.0` dist,
against 68 for the canonical `nameField`. objectstack#6326 removed the identical read from
two lint rules; objectui#7287 / PR #7585 removed it from `resolveTitleField`. These two
survived it — and three of this repo's own changelogs already called the probe *"not a spec
property — always undefined"* while the code kept honouring it.

**They are two different repairs, not one patch applied twice.**

`@object-ui/components` — `PageHeaderRenderer`'s record-chip chain ranked
`objectSchema.primaryField` directly under `schema.title` and **above** the unified ADR-0079
resolver, on the surface that renders the **actual H1** of a synthesized record page. The
rung is deleted, so the heading now comes from `titleFormat` → the ADR-0079 resolver
(`nameField` → `displayNameField` → type-aware derivation) → the record-key walk, the same
precedence `DetailView`'s own header uses.

`@object-ui/plugin-detail` — `record:details`' dedupe ladder decides **which row the body
grid hides**, so that the field already shown as the H1 is not repeated underneath it. That
is a different question from "what is the title", and `primaryField` was its *first*
candidate. The rung is deleted; the ladder is the literal display-name walk that mirrors the
tail of the header chip's chain. Its docstring, which had described the chip as resolving
"from objectSchema.primaryField", went stale when PR #7585 landed and now describes the chip
as it is.

**User-visible, deliberately.** A payload that carries the off-spec key anyway changes in two
ways: the H1 of its record page stops being `primaryField`'s value, and a different row
survives the detail grid. Nothing spec-legal can reach either path.

`DetailViewSchema.primaryField` is untouched, and so is `ObjectDefLike.primaryField` in
`buildDefaultPageSchema` — a deliberate declaration (not a read) that keeps an external
caller's object literal type-checking.
